-- Sync lead_organiser_patch_assignments using proven patches selector logic
-- This creates a denormalized table that serves as single source of truth for lead organizer → patch relationships

-- Function to compute patches for a specific lead organizer using patches selector logic
CREATE OR REPLACE FUNCTION public.compute_patches_for_lead_organizer(p_lead_organizer_id UUID)
RETURNS UUID[] AS $$
DECLARE
  is_live_lead BOOLEAN := FALSE;
  is_draft_lead BOOLEAN := FALSE;
  live_organiser_ids UUID[];
  draft_organiser_ids UUID[];
  live_patches UUID[];
  draft_patches UUID[];
  all_patches UUID[];
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Check if it's a live lead organizer (in profiles table)
  SELECT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = p_lead_organizer_id AND role = 'lead_organiser' AND is_active = true
  ) INTO is_live_lead;

  -- Check if it's a draft lead organizer (in pending_users table)
  SELECT EXISTS(
    SELECT 1 FROM pending_users 
    WHERE id = p_lead_organizer_id AND role = 'lead_organiser' 
    AND status IN ('draft', 'invited')
  ) INTO is_draft_lead;

  IF NOT is_live_lead AND NOT is_draft_lead THEN
    RETURN ARRAY[]::UUID[]; -- Return empty array if not a valid lead organizer
  END IF;

  IF is_live_lead THEN
    -- LIVE LEAD LOGIC (same as patches selector)
    
    -- Get live organizers under this lead via role_hierarchy
    SELECT ARRAY_AGG(DISTINCT rh.child_user_id)
    INTO live_organiser_ids
    FROM role_hierarchy rh
    WHERE rh.parent_user_id = p_lead_organizer_id 
      AND rh.end_date IS NULL
      AND rh.is_active = true;

    -- Get draft organizers under this lead via lead_draft_organiser_links
    SELECT ARRAY_AGG(DISTINCT ldol.pending_user_id)
    INTO draft_organiser_ids
    FROM lead_draft_organiser_links ldol
    WHERE ldol.lead_user_id = p_lead_organizer_id 
      AND ldol.is_active = true;

    -- Get patches from live organizers
    IF live_organiser_ids IS NOT NULL AND array_length(live_organiser_ids, 1) > 0 THEN
      SELECT ARRAY_AGG(DISTINCT opa.patch_id)
      INTO live_patches
      FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = ANY(live_organiser_ids)
        AND opa.effective_to IS NULL;
    END IF;

    -- Get patches from draft organizers under this lead
    IF draft_organiser_ids IS NOT NULL AND array_length(draft_organiser_ids, 1) > 0 THEN
      SELECT ARRAY_AGG(DISTINCT patch_id)
      INTO draft_patches
      FROM (
        SELECT UNNEST(pu.assigned_patch_ids) as patch_id
        FROM pending_users pu
        WHERE pu.id = ANY(draft_organiser_ids)
          AND pu.assigned_patch_ids IS NOT NULL
      ) sub;
    END IF;

    -- Combine live and draft patches
    SELECT ARRAY_AGG(DISTINCT patch_id)
    INTO all_patches
    FROM (
      SELECT UNNEST(COALESCE(live_patches, ARRAY[]::UUID[])) as patch_id
      UNION
      SELECT UNNEST(COALESCE(draft_patches, ARRAY[]::UUID[])) as patch_id
    ) combined_patches;

  ELSIF is_draft_lead THEN
    -- DRAFT LEAD LOGIC (same as patches selector)
    
    -- Get patches directly from assigned_patch_ids
    SELECT assigned_patch_ids
    INTO all_patches
    FROM pending_users
    WHERE id = p_lead_organizer_id;

    -- Also get patches from organizers managed by this draft lead
    SELECT ARRAY_AGG(DISTINCT dlol.organiser_user_id) FILTER (WHERE dlol.organiser_user_id IS NOT NULL),
           ARRAY_AGG(DISTINCT dlol.organiser_pending_user_id) FILTER (WHERE dlol.organiser_pending_user_id IS NOT NULL)
    INTO live_organiser_ids, draft_organiser_ids
    FROM draft_lead_organiser_links dlol
    WHERE dlol.draft_lead_pending_user_id = p_lead_organizer_id 
      AND dlol.is_active = true;

    -- Get patches from live organizers under this draft lead
    IF live_organiser_ids IS NOT NULL AND array_length(live_organiser_ids, 1) > 0 THEN
      SELECT ARRAY_AGG(DISTINCT opa.patch_id)
      INTO live_patches
      FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = ANY(live_organiser_ids)
        AND opa.effective_to IS NULL;
    END IF;

    -- Get patches from draft organizers under this draft lead
    IF draft_organiser_ids IS NOT NULL AND array_length(draft_organiser_ids, 1) > 0 THEN
      SELECT ARRAY_AGG(DISTINCT patch_id)
      INTO draft_patches
      FROM (
        SELECT UNNEST(pu.assigned_patch_ids) as patch_id
        FROM pending_users pu
        WHERE pu.id = ANY(draft_organiser_ids)
          AND pu.assigned_patch_ids IS NOT NULL
      ) sub;
    END IF;

    -- Combine direct assignment + child patches
    SELECT ARRAY_AGG(DISTINCT patch_id)
    INTO all_patches
    FROM (
      SELECT UNNEST(COALESCE(all_patches, ARRAY[]::UUID[])) as patch_id
      UNION
      SELECT UNNEST(COALESCE(live_patches, ARRAY[]::UUID[])) as patch_id
      UNION
      SELECT UNNEST(COALESCE(draft_patches, ARRAY[]::UUID[])) as patch_id
    ) combined_patches;

  END IF;

  RETURN COALESCE(all_patches, ARRAY[]::UUID[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync a specific lead organizer's patch assignments
CREATE OR REPLACE FUNCTION public.sync_lead_organizer_patches(p_lead_organizer_id UUID)
RETURNS JSONB AS $$
DECLARE
  computed_patches UUID[];
  existing_patches UUID[];
  patches_to_add UUID[];
  patches_to_remove UUID[];
  result JSONB;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get computed patches using our proven logic
  computed_patches := compute_patches_for_lead_organizer(p_lead_organizer_id);
  
  -- Get existing assignments
  SELECT ARRAY_AGG(DISTINCT patch_id)
  INTO existing_patches
  FROM lead_organiser_patch_assignments
  WHERE lead_organiser_id = p_lead_organizer_id
    AND effective_to IS NULL;
  
  existing_patches := COALESCE(existing_patches, ARRAY[]::UUID[]);
  computed_patches := COALESCE(computed_patches, ARRAY[]::UUID[]);

  -- Find patches to add (in computed but not in existing)
  SELECT ARRAY_AGG(patch_id)
  INTO patches_to_add
  FROM UNNEST(computed_patches) AS patch_id
  WHERE patch_id IS NOT NULL 
    AND NOT patch_id = ANY(existing_patches);

  -- Find patches to remove (in existing but not in computed)
  SELECT ARRAY_AGG(patch_id)
  INTO patches_to_remove
  FROM UNNEST(existing_patches) AS patch_id
  WHERE patch_id IS NOT NULL 
    AND NOT patch_id = ANY(computed_patches);

  -- Remove outdated assignments
  IF patches_to_remove IS NOT NULL AND array_length(patches_to_remove, 1) > 0 THEN
    UPDATE lead_organiser_patch_assignments
    SET effective_to = NOW()
    WHERE lead_organiser_id = p_lead_organizer_id
      AND patch_id = ANY(patches_to_remove)
      AND effective_to IS NULL;
  END IF;

  -- Add new assignments
  IF patches_to_add IS NOT NULL AND array_length(patches_to_add, 1) > 0 THEN
    INSERT INTO lead_organiser_patch_assignments (lead_organiser_id, patch_id)
    SELECT p_lead_organizer_id, patch_id
    FROM UNNEST(patches_to_add) AS patch_id;
  END IF;

  result := jsonb_build_object(
    'lead_organizer_id', p_lead_organizer_id,
    'computed_patches', array_length(computed_patches, 1),
    'existing_patches', array_length(existing_patches, 1),
    'patches_added', COALESCE(array_length(patches_to_add, 1), 0),
    'patches_removed', COALESCE(array_length(patches_to_remove, 1), 0),
    'final_patch_count', array_length(computed_patches, 1)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to sync ALL lead organizers at once
CREATE OR REPLACE FUNCTION public.sync_all_lead_organizer_patches()
RETURNS JSONB AS $$
DECLARE
  lead_organizer_record RECORD;
  sync_result JSONB;
  all_results JSONB[] := ARRAY[]::JSONB[];
  total_leads INTEGER := 0;
  total_patches_added INTEGER := 0;
  total_patches_removed INTEGER := 0;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Sync confirmed lead organizers from profiles
  FOR lead_organizer_record IN
    SELECT id FROM profiles 
    WHERE role = 'lead_organiser' AND is_active = true
  LOOP
    sync_result := sync_lead_organizer_patches(lead_organizer_record.id);
    all_results := all_results || sync_result;
    total_leads := total_leads + 1;
    total_patches_added := total_patches_added + (sync_result->>'patches_added')::INTEGER;
    total_patches_removed := total_patches_removed + (sync_result->>'patches_removed')::INTEGER;
  END LOOP;

  -- Note: We don't sync draft lead organizers to lead_organiser_patch_assignments
  -- because that table references profiles(id), not pending_users(id)
  -- Draft leads will be handled through compute_patches_for_lead_organizer when needed

  RETURN jsonb_build_object(
    'operation', 'sync_all_lead_organizer_patches',
    'timestamp', NOW(),
    'summary', jsonb_build_object(
      'total_leads_processed', total_leads,
      'total_patches_added', total_patches_added,
      'total_patches_removed', total_patches_removed
    ),
    'detailed_results', all_results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle role hierarchy changes and sync affected lead organizers
CREATE OR REPLACE FUNCTION public.sync_lead_patches_on_hierarchy_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_lead_id UUID;
  sync_result JSONB;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get the lead organizer ID that was affected
  IF TG_OP = 'DELETE' THEN
    affected_lead_id := OLD.parent_user_id;
  ELSE
    affected_lead_id := NEW.parent_user_id;
  END IF;

  -- Only sync if the parent is actually a lead organizer
  IF EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = affected_lead_id AND role = 'lead_organiser' AND is_active = true
  ) THEN
    PERFORM sync_lead_organizer_patches(affected_lead_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle organiser patch assignment changes and sync affected lead organizers
CREATE OR REPLACE FUNCTION public.sync_lead_patches_on_organiser_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_organiser_id UUID;
  affected_lead_ids UUID[];
  lead_id UUID;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get the organiser ID that was affected
  IF TG_OP = 'DELETE' THEN
    affected_organiser_id := OLD.organiser_id;
  ELSE
    affected_organiser_id := NEW.organiser_id;
  END IF;

  -- Find all lead organizers that manage this organiser
  SELECT ARRAY_AGG(DISTINCT rh.parent_user_id)
  INTO affected_lead_ids
  FROM role_hierarchy rh
  WHERE rh.child_user_id = affected_organiser_id
    AND rh.end_date IS NULL
    AND rh.is_active = true
    AND EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = rh.parent_user_id AND p.role = 'lead_organiser' AND p.is_active = true
    );

  -- Sync each affected lead organizer
  IF affected_lead_ids IS NOT NULL THEN
    FOREACH lead_id IN ARRAY affected_lead_ids
    LOOP
      PERFORM sync_lead_organizer_patches(lead_id);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle draft links changes and sync affected lead organizers
CREATE OR REPLACE FUNCTION public.sync_lead_patches_on_draft_links_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_lead_id UUID;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get the lead organizer ID that was affected
  IF TG_OP = 'DELETE' THEN
    affected_lead_id := OLD.lead_user_id;
  ELSE
    affected_lead_id := NEW.lead_user_id;
  END IF;

  -- Only sync if the lead is actually a live lead organizer
  IF EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = affected_lead_id AND role = 'lead_organiser' AND is_active = true
  ) THEN
    PERFORM sync_lead_organizer_patches(affected_lead_id);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle pending user assignment changes and sync affected lead organizers
CREATE OR REPLACE FUNCTION public.sync_lead_patches_on_pending_user_change()
RETURNS TRIGGER AS $$
DECLARE
  affected_pending_id UUID;
  affected_lead_ids UUID[];
  lead_id UUID;
BEGIN
  PERFORM set_config('search_path', 'public', true);

  -- Get the pending user ID that was affected
  IF TG_OP = 'DELETE' THEN
    affected_pending_id := OLD.id;
  ELSE
    affected_pending_id := NEW.id;
  END IF;

  -- Find all live lead organizers that manage this pending user
  SELECT ARRAY_AGG(DISTINCT ldol.lead_user_id)
  INTO affected_lead_ids
  FROM lead_draft_organiser_links ldol
  WHERE ldol.pending_user_id = affected_pending_id
    AND ldol.is_active = true
    AND EXISTS(
      SELECT 1 FROM profiles p 
      WHERE p.id = ldol.lead_user_id AND p.role = 'lead_organiser' AND p.is_active = true
    );

  -- Sync each affected lead organizer
  IF affected_lead_ids IS NOT NULL THEN
    FOREACH lead_id IN ARRAY affected_lead_ids
    LOOP
      PERFORM sync_lead_organizer_patches(lead_id);
    END LOOP;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers to auto-sync when related data changes

-- Trigger on role_hierarchy changes
DROP TRIGGER IF EXISTS trigger_sync_lead_patches_on_hierarchy ON role_hierarchy;
CREATE TRIGGER trigger_sync_lead_patches_on_hierarchy
  AFTER INSERT OR UPDATE OR DELETE ON role_hierarchy
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_patches_on_hierarchy_change();

-- Trigger on organiser_patch_assignments changes
DROP TRIGGER IF EXISTS trigger_sync_lead_patches_on_organiser ON organiser_patch_assignments;
CREATE TRIGGER trigger_sync_lead_patches_on_organiser
  AFTER INSERT OR UPDATE OR DELETE ON organiser_patch_assignments
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_patches_on_organiser_change();

-- Trigger on lead_draft_organiser_links changes
DROP TRIGGER IF EXISTS trigger_sync_lead_patches_on_draft_links ON lead_draft_organiser_links;
CREATE TRIGGER trigger_sync_lead_patches_on_draft_links
  AFTER INSERT OR UPDATE OR DELETE ON lead_draft_organiser_links
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_patches_on_draft_links_change();

-- Trigger on pending_users.assigned_patch_ids changes
DROP TRIGGER IF EXISTS trigger_sync_lead_patches_on_pending_user ON pending_users;
CREATE TRIGGER trigger_sync_lead_patches_on_pending_user
  AFTER INSERT OR UPDATE OF assigned_patch_ids OR DELETE ON pending_users
  FOR EACH ROW
  EXECUTE FUNCTION sync_lead_patches_on_pending_user_change();

-- Admin function to manually trigger a full sync
CREATE OR REPLACE FUNCTION public.admin_sync_all_lead_organizer_patches()
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Only allow admins to run this
  IF NOT EXISTS(
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Admin role required for manual sync';
  END IF;

  -- Run the sync
  result := sync_all_lead_organizer_patches();
  
  -- Log the operation
  RAISE NOTICE 'Manual lead organizer patch sync completed: %', result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION compute_patches_for_lead_organizer TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_lead_organizer_patches TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION sync_all_lead_organizer_patches TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_sync_all_lead_organizer_patches TO authenticated, service_role;

-- Initial population: Run the sync for all existing lead organizers
SELECT sync_all_lead_organizer_patches() AS initial_sync_result;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ LEAD ORGANIZER PATCH ASSIGNMENTS SYNC IMPLEMENTED';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 FUNCTIONS CREATED:';
  RAISE NOTICE '   - compute_patches_for_lead_organizer(uuid) - Uses patches selector logic';
  RAISE NOTICE '   - sync_lead_organizer_patches(uuid) - Syncs specific lead';
  RAISE NOTICE '   - sync_all_lead_organizer_patches() - Syncs all leads';
  RAISE NOTICE '   - admin_sync_all_lead_organizer_patches() - Manual admin sync';
  RAISE NOTICE '';
  RAISE NOTICE '🔗 TRIGGERS CREATED:';
  RAISE NOTICE '   - Auto-sync on role_hierarchy changes';
  RAISE NOTICE '   - Auto-sync on organiser_patch_assignments changes';
  RAISE NOTICE '   - Auto-sync on lead_draft_organiser_links changes';
  RAISE NOTICE '   - Auto-sync on pending_users.assigned_patch_ids changes';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULT:';
  RAISE NOTICE '   - lead_organiser_patch_assignments now populated correctly';
  RAISE NOTICE '   - Dashboard should show coordinator-specific data';
  RAISE NOTICE '   - Future features can query lead_organiser_patch_assignments directly';
  RAISE NOTICE '';
END $$;

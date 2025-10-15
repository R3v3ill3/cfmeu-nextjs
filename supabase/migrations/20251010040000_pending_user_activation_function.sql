-- ============================================================================
-- Pending User Activation Function
-- ============================================================================
-- This function activates a pending_user by migrating all their relationships,
-- patch assignments, and role to an activated user profile.
-- 
-- Usage:
--   SELECT activate_pending_user('cpappas@testing.org', 'cpappas@cfmeu.org');
--
-- Returns JSON with migration summary or error details
-- ============================================================================

CREATE OR REPLACE FUNCTION activate_pending_user(
  p_pending_email text,
  p_activated_email text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_pending_user_id uuid;
  v_activated_user_id uuid;
  v_pending_full_name text;
  v_pending_role text;
  v_patch_ids uuid[];
  v_count int;
  v_total_role_hierarchy int := 0;
  v_total_lead_draft_links int := 0;
  v_total_draft_links_updated int := 0;
  v_total_links_deactivated int := 0;
  v_total_patches_migrated int := 0;
  v_invalid_patches_cleaned int := 0;
  v_result jsonb;
BEGIN
  -- Validate inputs
  IF p_pending_email IS NULL OR p_activated_email IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Both pending_email and activated_email are required'
    );
  END IF;

  -- Normalize emails to lowercase
  p_pending_email := lower(trim(p_pending_email));
  p_activated_email := lower(trim(p_activated_email));

  -- Find the pending_user by email
  SELECT id, full_name, role, assigned_patch_ids
  INTO v_pending_user_id, v_pending_full_name, v_pending_role, v_patch_ids
  FROM pending_users 
  WHERE lower(email) = p_pending_email
    AND status != 'archived'
  LIMIT 1;
  
  IF v_pending_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Pending user not found with email: %s', p_pending_email)
    );
  END IF;
  
  -- Find or create the activated user profile
  SELECT id INTO v_activated_user_id
  FROM profiles 
  WHERE lower(email) = p_activated_email
  LIMIT 1;
  
  IF v_activated_user_id IS NULL THEN
    -- User doesn't exist in profiles yet - this shouldn't happen if they've been invited
    -- but we'll handle it gracefully
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Activated user profile not found with email: %s. User must sign in first.', p_activated_email)
    );
  END IF;
  
  -- Start migration process
  BEGIN
    -- Step 0: Clean up invalid patch IDs from pending_users (important for trigger constraints)
    UPDATE pending_users pu
    SET assigned_patch_ids = (
      SELECT COALESCE(ARRAY_AGG(patch_id), '{}'::uuid[])
      FROM unnest(pu.assigned_patch_ids) AS patch_id
      WHERE EXISTS (SELECT 1 FROM patches p WHERE p.id = patch_id)
    )
    WHERE id IN (
      -- Get all pending organisers that would be affected by this activation
      SELECT DISTINCT dlol.organiser_pending_user_id
      FROM draft_lead_organiser_links dlol
      WHERE dlol.draft_lead_pending_user_id = v_pending_user_id
        AND dlol.organiser_pending_user_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM unnest(
            (SELECT assigned_patch_ids FROM pending_users WHERE id = dlol.organiser_pending_user_id)
          ) AS patch_id
          WHERE NOT EXISTS (SELECT 1 FROM patches p WHERE p.id = patch_id)
        )
    );
    
    GET DIAGNOSTICS v_invalid_patches_cleaned = ROW_COUNT;
    
    -- Step 1: Migrate draft_lead_organiser_links where user is the draft lead
    -- Convert draft_lead_pending_user_id to parent_user_id in role_hierarchy
    
    -- For each organiser_user_id under this draft lead, create a role_hierarchy entry
    INSERT INTO role_hierarchy(parent_user_id, child_user_id, start_date, end_date, is_active, assigned_by)
    SELECT 
      v_activated_user_id,
      dlol.organiser_user_id,
      dlol.start_date,
      dlol.end_date,
      dlol.is_active,
      COALESCE(dlol.assigned_by, v_activated_user_id)
    FROM draft_lead_organiser_links dlol
    WHERE dlol.draft_lead_pending_user_id = v_pending_user_id
      AND dlol.organiser_user_id IS NOT NULL
    ON CONFLICT (parent_user_id, child_user_id, start_date) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_role_hierarchy := v_total_role_hierarchy + v_count;
    
    -- For each organiser_pending_user_id under this draft lead, create a lead_draft_organiser_links entry
    INSERT INTO lead_draft_organiser_links(lead_user_id, pending_user_id, start_date, end_date, is_active, assigned_by)
    SELECT 
      v_activated_user_id,
      dlol.organiser_pending_user_id,
      dlol.start_date,
      dlol.end_date,
      dlol.is_active,
      COALESCE(dlol.assigned_by, v_activated_user_id)
    FROM draft_lead_organiser_links dlol
    WHERE dlol.draft_lead_pending_user_id = v_pending_user_id
      AND dlol.organiser_pending_user_id IS NOT NULL
    ON CONFLICT (lead_user_id, pending_user_id, start_date) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_lead_draft_links := v_total_lead_draft_links + v_count;
    
    -- Deactivate the old draft_lead_organiser_links entries
    UPDATE draft_lead_organiser_links
    SET is_active = false, 
        end_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE draft_lead_pending_user_id = v_pending_user_id
      AND is_active = true;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_links_deactivated := v_total_links_deactivated + v_count;
    
    -- Step 2: Update draft_lead_organiser_links where user is the organiser (pending)
    -- Handle cases where the draft lead is still a pending user
    UPDATE draft_lead_organiser_links
    SET organiser_pending_user_id = NULL,
        organiser_user_id = v_activated_user_id,
        updated_at = NOW()
    WHERE organiser_pending_user_id = v_pending_user_id
      AND organiser_user_id IS NULL;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_draft_links_updated := v_total_draft_links_updated + v_count;
    
    -- Step 3: Update lead_draft_organiser_links where user is the pending organiser
    -- Convert lead_draft_organiser_links to role_hierarchy
    INSERT INTO role_hierarchy(parent_user_id, child_user_id, start_date, end_date, is_active, assigned_by)
    SELECT 
      ldol.lead_user_id,
      v_activated_user_id,
      ldol.start_date,
      ldol.end_date,
      ldol.is_active,
      COALESCE(ldol.assigned_by, ldol.lead_user_id)
    FROM lead_draft_organiser_links ldol
    WHERE ldol.pending_user_id = v_pending_user_id
    ON CONFLICT (parent_user_id, child_user_id, start_date) DO NOTHING;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_role_hierarchy := v_total_role_hierarchy + v_count;
    
    -- Deactivate the old lead_draft_organiser_links entries
    UPDATE lead_draft_organiser_links
    SET is_active = false,
        end_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE pending_user_id = v_pending_user_id
      AND is_active = true;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    v_total_links_deactivated := v_total_links_deactivated + v_count;
    
    -- Step 4: Update the activated user's role
    UPDATE profiles
    SET role = v_pending_role,
        full_name = COALESCE(full_name, v_pending_full_name),
        is_active = true,
        updated_at = NOW()
    WHERE id = v_activated_user_id;
    
    -- Step 5: Migrate patch assignments to appropriate tables
    IF v_pending_role = 'organiser' AND v_patch_ids IS NOT NULL AND array_length(v_patch_ids, 1) > 0 THEN
      -- Insert into organiser_patch_assignments
      INSERT INTO organiser_patch_assignments(organiser_id, patch_id, effective_from, effective_to)
      SELECT v_activated_user_id, patch_id, NOW(), NULL
      FROM unnest(v_patch_ids) AS patch_id
      WHERE EXISTS (SELECT 1 FROM patches p WHERE p.id = patch_id)
        AND NOT EXISTS (
          SELECT 1 FROM organiser_patch_assignments opa
          WHERE opa.organiser_id = v_activated_user_id 
            AND opa.patch_id = patch_id
            AND opa.effective_to IS NULL
        );
      
      GET DIAGNOSTICS v_total_patches_migrated = ROW_COUNT;
      
    ELSIF v_pending_role = 'lead_organiser' AND v_patch_ids IS NOT NULL AND array_length(v_patch_ids, 1) > 0 THEN
      -- Insert into lead_organiser_patch_assignments
      INSERT INTO lead_organiser_patch_assignments(lead_organiser_id, patch_id, effective_from, effective_to)
      SELECT v_activated_user_id, patch_id, NOW(), NULL
      FROM unnest(v_patch_ids) AS patch_id
      WHERE EXISTS (SELECT 1 FROM patches p WHERE p.id = patch_id)
        AND NOT EXISTS (
          SELECT 1 FROM lead_organiser_patch_assignments lopa
          WHERE lopa.lead_organiser_id = v_activated_user_id 
            AND lopa.patch_id = patch_id
            AND lopa.effective_to IS NULL
        );
      
      GET DIAGNOSTICS v_total_patches_migrated = ROW_COUNT;
    END IF;
    
    -- Step 6: Archive the pending_user
    UPDATE pending_users
    SET status = 'archived',
        notes = COALESCE(notes || E'\n\n', '') || 
                'Archived on ' || NOW()::text || 
                ' - User activated and relationships migrated to user ID: ' || v_activated_user_id::text ||
                ' (email: ' || p_activated_email || ')',
        updated_at = NOW()
    WHERE id = v_pending_user_id;
    
    -- Build success response
    v_result := jsonb_build_object(
      'success', true,
      'pending_user_id', v_pending_user_id,
      'activated_user_id', v_activated_user_id,
      'pending_email', p_pending_email,
      'activated_email', p_activated_email,
      'role', v_pending_role,
      'full_name', v_pending_full_name,
      'hierarchy_migrated', jsonb_build_object(
        'role_hierarchy_created', v_total_role_hierarchy,
        'lead_draft_links_created', v_total_lead_draft_links,
        'draft_links_updated', v_total_draft_links_updated,
        'links_deactivated', v_total_links_deactivated
      ),
      'patches_migrated', v_total_patches_migrated,
      'invalid_patches_cleaned', v_invalid_patches_cleaned
    );
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- Return error details
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'pending_email', p_pending_email,
        'activated_email', p_activated_email
      );
  END;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION activate_pending_user(text, text) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION activate_pending_user(text, text) IS 
'Activates a pending_user by migrating all relationships, patch assignments, and role to an activated user profile. Returns JSON with migration summary or error details.';


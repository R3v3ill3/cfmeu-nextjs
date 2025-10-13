-- Remap Chris Pappas from pending_user to activated user
-- This script migrates all hierarchies and patch assignments from pending_user Chris Pappas to user Chris Pappas

DO $$
DECLARE
  v_pending_user_id uuid;
  v_activated_user_id uuid;
  v_pending_full_name text;
  v_activated_full_name text;
  v_count int;
  v_pending_role text;
  v_patch_ids uuid[];
BEGIN
  -- Find the pending_user Chris Pappas
  SELECT id, full_name 
  INTO v_pending_user_id, v_pending_full_name
  FROM pending_users 
  WHERE LOWER(full_name) LIKE '%chris%pappas%'
  LIMIT 1;
  
  IF v_pending_user_id IS NULL THEN
    RAISE NOTICE 'Could not find pending_user Chris Pappas';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found pending_user: % (ID: %)', v_pending_full_name, v_pending_user_id;
  
  -- Find the activated user Chris Pappas
  SELECT id, full_name 
  INTO v_activated_user_id, v_activated_full_name
  FROM profiles 
  WHERE LOWER(full_name) LIKE '%chris%pappas%'
  LIMIT 1;
  
  IF v_activated_user_id IS NULL THEN
    RAISE NOTICE 'Could not find activated user Chris Pappas in profiles';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Found activated user: % (ID: %)', v_activated_full_name, v_activated_user_id;
  
  -- 0. Clean up invalid patch IDs from pending_users (important for trigger constraints)
  RAISE NOTICE '--- Cleaning up invalid patch IDs ---';
  
  UPDATE pending_users pu
  SET assigned_patch_ids = (
    SELECT COALESCE(ARRAY_AGG(patch_id), '{}'::uuid[])
    FROM unnest(pu.assigned_patch_ids) AS patch_id
    WHERE EXISTS (SELECT 1 FROM patches p WHERE p.id = patch_id)
  )
  WHERE id IN (
    -- Get all pending organisers that would be affected by Chris's activation
    SELECT DISTINCT dlol.organiser_pending_user_id
    FROM draft_lead_organiser_links dlol
    WHERE dlol.draft_lead_pending_user_id = v_pending_user_id
      AND dlol.organiser_pending_user_id IS NOT NULL
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Cleaned invalid patch IDs from % pending organisers', v_count;
  
  -- 1. Update draft_lead_organiser_links where Chris is the draft lead
  -- Convert draft_lead_pending_user_id to parent_user_id in role_hierarchy
  RAISE NOTICE '--- Processing draft_lead_organiser_links where Chris is the draft lead ---';
  
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
  RAISE NOTICE 'Created % role_hierarchy entries (draft lead -> live organisers)', v_count;
  
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
  RAISE NOTICE 'Created % lead_draft_organiser_links entries (draft lead -> pending organisers)', v_count;
  
  -- Deactivate the old draft_lead_organiser_links entries
  UPDATE draft_lead_organiser_links
  SET is_active = false, 
      end_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE draft_lead_pending_user_id = v_pending_user_id
    AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deactivated % draft_lead_organiser_links entries where Chris was draft lead', v_count;
  
  -- 2. Update draft_lead_organiser_links where Chris is the organiser (pending)
  RAISE NOTICE '--- Processing draft_lead_organiser_links where Chris is the organiser ---';
  
  -- For each lead where Chris is the organiser_pending_user_id, update to organiser_user_id
  -- But we need to check if there's already a lead_user_id in the draft_lead_organiser_links
  -- If the lead is still draft, we can update the link
  -- If the lead is live, we need to create a role_hierarchy entry instead
  
  -- Handle cases where the draft lead is still a pending user
  UPDATE draft_lead_organiser_links
  SET organiser_pending_user_id = NULL,
      organiser_user_id = v_activated_user_id,
      updated_at = NOW()
  WHERE organiser_pending_user_id = v_pending_user_id
    AND organiser_user_id IS NULL;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Updated % draft_lead_organiser_links entries where Chris was pending organiser', v_count;
  
  -- 3. Update lead_draft_organiser_links where Chris is the pending organiser
  RAISE NOTICE '--- Processing lead_draft_organiser_links where Chris is the pending organiser ---';
  
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
  RAISE NOTICE 'Created % role_hierarchy entries (live leads -> Chris as organiser)', v_count;
  
  -- Deactivate the old lead_draft_organiser_links entries
  UPDATE lead_draft_organiser_links
  SET is_active = false,
      end_date = CURRENT_DATE,
      updated_at = NOW()
  WHERE pending_user_id = v_pending_user_id
    AND is_active = true;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Deactivated % lead_draft_organiser_links entries where Chris was pending organiser', v_count;
  
  -- 4. Update the activated user's role and copy patch assignments
  RAISE NOTICE '--- Processing role and patch assignments ---';
  
  -- Get the role and assigned patches from pending_user
  SELECT role, assigned_patch_ids 
  INTO v_pending_role, v_patch_ids
  FROM pending_users 
  WHERE id = v_pending_user_id;
  
  -- Update the activated user's role
  UPDATE profiles
  SET role = v_pending_role,
      updated_at = NOW()
  WHERE id = v_activated_user_id;
  
  RAISE NOTICE 'Updated activated user role to: %', v_pending_role;
  
  IF v_pending_role = 'organiser' AND v_patch_ids IS NOT NULL AND array_length(v_patch_ids, 1) > 0 THEN
    -- Insert into organiser_patch_assignments
    INSERT INTO organiser_patch_assignments(organiser_id, patch_id, effective_from, effective_to)
    SELECT v_activated_user_id, patch_id, NOW(), NULL
    FROM unnest(v_patch_ids) AS patch_id
    WHERE NOT EXISTS (
      SELECT 1 FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = v_activated_user_id 
        AND opa.patch_id = patch_id
        AND opa.effective_to IS NULL
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Created % organiser_patch_assignments entries', v_count;
    
  ELSIF v_pending_role = 'lead_organiser' AND v_patch_ids IS NOT NULL AND array_length(v_patch_ids, 1) > 0 THEN
    -- Insert into lead_organiser_patch_assignments
    INSERT INTO lead_organiser_patch_assignments(lead_organiser_id, patch_id, effective_from, effective_to)
    SELECT v_activated_user_id, patch_id, NOW(), NULL
    FROM unnest(v_patch_ids) AS patch_id
    WHERE NOT EXISTS (
      SELECT 1 FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = v_activated_user_id 
        AND lopa.patch_id = patch_id
        AND lopa.effective_to IS NULL
    );
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Created % lead_organiser_patch_assignments entries', v_count;
  END IF;
  
  -- 5. Archive the pending_user
  RAISE NOTICE '--- Archiving pending_user ---';
  
  UPDATE pending_users
  SET status = 'archived',
      notes = COALESCE(notes || E'\n\n', '') || 
              'Archived on ' || NOW()::text || 
              ' - User activated and relationships migrated to user ID: ' || v_activated_user_id::text,
      updated_at = NOW()
  WHERE id = v_pending_user_id;
  
  RAISE NOTICE 'Archived pending_user Chris Pappas';
  
  RAISE NOTICE '=== Migration complete ===';
  RAISE NOTICE 'Pending User ID: %', v_pending_user_id;
  RAISE NOTICE 'Activated User ID: %', v_activated_user_id;
  
END $$;

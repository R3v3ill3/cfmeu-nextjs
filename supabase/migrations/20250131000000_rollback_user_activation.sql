-- ============================================================================
-- Rollback User Activation Function
-- ============================================================================
-- This function rolls back a failed user activation by restoring the pending user
-- and cleaning up any partial changes made during activation.
--
-- Usage:
--   SELECT rollback_user_activation('activated-user-id', 'pending-user-id');
--
-- Returns JSON with rollback status
-- ============================================================================

CREATE OR REPLACE FUNCTION rollback_user_activation(
  p_user_id uuid,
  p_pending_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_profile_count int := 0;
  v_organiser_patch_count int := 0;
  v_lead_patch_count int := 0;
  v_hierarchy_count int := 0;
  v_pending_count int := 0;
  v_total_count int := 0;
  v_result jsonb;
BEGIN
  -- Validate inputs
  IF p_user_id IS NULL OR p_pending_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Both user_id and pending_user_id are required'
    );
  END IF;

  -- Start rollback process
  BEGIN
    -- Step 1: Reset user role to viewer (default)
    UPDATE profiles
    SET role = 'viewer',
        updated_at = NOW()
    WHERE id = p_user_id;

    GET DIAGNOSTICS v_profile_count = ROW_COUNT;

    -- Step 2: Remove any organiser patch assignments created for this user
    DELETE FROM organiser_patch_assignments
    WHERE organiser_id = p_user_id
      AND effective_from >= NOW() - INTERVAL '1 hour'; -- Only recent assignments

    GET DIAGNOSTICS v_organiser_patch_count = ROW_COUNT;

    -- Step 3: Remove any lead organiser patch assignments created for this user
    DELETE FROM lead_organiser_patch_assignments
    WHERE lead_organiser_id = p_user_id
      AND effective_from >= NOW() - INTERVAL '1 hour'; -- Only recent assignments

    GET DIAGNOSTICS v_lead_patch_count = ROW_COUNT;

    -- Step 4: Remove any recent role_hierarchy entries created for this user
    DELETE FROM role_hierarchy
    WHERE (parent_user_id = p_user_id OR child_user_id = p_user_id)
      AND start_date >= CURRENT_DATE; -- Only today's entries

    GET DIAGNOSTICS v_hierarchy_count = ROW_COUNT;

    -- Step 5: Reactivate the pending user (if it was archived)
    UPDATE pending_users
    SET status = 'draft',
        updated_at = NOW()
    WHERE id = p_pending_user_id
      AND status = 'archived';

    GET DIAGNOSTICS v_pending_count = ROW_COUNT;

    -- Calculate total rollback count
    v_total_count := v_profile_count + v_organiser_patch_count + v_lead_patch_count + v_hierarchy_count + v_pending_count;

    -- Build success response
    v_result := jsonb_build_object(
      'success', true,
      'user_id', p_user_id,
      'pending_user_id', p_pending_user_id,
      'rollback_details', jsonb_build_object(
        'profiles_reset', v_profile_count,
        'organiser_patches_removed', v_organiser_patch_count,
        'lead_patches_removed', v_lead_patch_count,
        'hierarchies_removed', v_hierarchy_count,
        'pending_users_reactivated', v_pending_count,
        'total_changes', v_total_count
      ),
      'message', 'Rollback completed successfully'
    );

    RETURN v_result;

  EXCEPTION
    WHEN OTHERS THEN
      -- Return error details
      RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'user_id', p_user_id,
        'pending_user_id', p_pending_user_id
      );
  END;
END;
$$;

-- Grant execute permissions to authenticated users (for API use)
GRANT EXECUTE ON FUNCTION rollback_user_activation(uuid, uuid) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION rollback_user_activation(uuid, uuid) IS
'Reverts a failed user activation by resetting user roles and removing recent assignments. Used by the activation API when auth user creation fails.';
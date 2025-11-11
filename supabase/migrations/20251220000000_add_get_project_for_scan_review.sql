-- ============================================================================
-- Add RPC function to fetch project data for scan-review without RLS recursion
-- ============================================================================
-- This function uses SECURITY DEFINER to bypass RLS and fetch project data
-- directly, avoiding the stack depth recursion issue when organisers query projects

CREATE OR REPLACE FUNCTION get_project_for_scan_review(p_project_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
STABLE
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_project jsonb;
  v_eba_status text;
  v_result jsonb;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  
  -- Get user role (bypasses RLS due to SECURITY DEFINER)
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = v_user_id;
  
  -- Check access using the helper function (which also bypasses RLS)
  IF NOT user_can_access_project_direct(v_user_id, p_project_id) THEN
    RETURN jsonb_build_object('error', 'Forbidden');
  END IF;
  
  -- Fetch project data (bypasses RLS due to SECURITY DEFINER)
  SELECT to_jsonb(p.*) INTO v_project
  FROM (
    SELECT 
      id,
      name,
      value,
      builder_id,
      main_job_site_id,
      proposed_start_date,
      proposed_finish_date,
      roe_email,
      project_type,
      state_funding,
      federal_funding,
      approval_status,
      created_by,
      organising_universe,
      stage_class
    FROM public.projects
    WHERE id = p_project_id
  ) p;
  
  IF v_project IS NULL THEN
    RETURN jsonb_build_object('error', 'Project not found');
  END IF;
  
  -- Fetch EBA details separately
  SELECT status INTO v_eba_status
  FROM public.project_eba_details
  WHERE project_id = p_project_id
  LIMIT 1;
  
  -- Convert EBA status to boolean
  v_result := v_project || jsonb_build_object(
    'eba_with_cfmeu',
    CASE 
      WHEN v_eba_status = 'yes' THEN true
      WHEN v_eba_status = 'no' THEN false
      ELSE null
    END
  );
  
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_project_for_scan_review(uuid) TO authenticated;

COMMENT ON FUNCTION get_project_for_scan_review(uuid) IS
  'Fetch project data for scan-review page without triggering RLS recursion. Uses SECURITY DEFINER to bypass RLS. Includes EBA status converted to boolean.';


-- ============================================================================
-- Fix Projects RLS Stack Depth Recursion Issue
-- ============================================================================
--
-- Problem: When fetching projects with select('*'), the projects_select RLS 
-- policy triggers recursive checks through can_access_job_site → job_sites → 
-- potentially back to projects, causing infinite recursion (error 54001).
--
-- Root Cause: The fallback path in projects_select policy queries job_sites
-- and calls can_access_job_site, which can trigger RLS checks that query
-- back into projects table, creating a circular dependency.
--
-- Solution: Create a SECURITY DEFINER helper function that checks project 
-- access directly via patch assignments without querying job_sites, breaking
-- the recursion cycle.
-- ============================================================================

-- 1. Create helper function to check project access without triggering RLS recursion
--    Uses SECURITY DEFINER to bypass RLS during checks
CREATE OR REPLACE FUNCTION user_can_access_project_direct(
  p_user_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with elevated privileges, bypasses RLS
STABLE
SET "search_path" TO 'public'
AS $$
DECLARE
  v_user_role text;
BEGIN
  -- Get user role (bypasses RLS due to SECURITY DEFINER)
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_user_id;
  
  -- Admin can access everything
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- Check if user created this project (for pending projects)
  IF EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = p_project_id
      AND p.created_by = p_user_id
  ) THEN
    RETURN true;
  END IF;
  
  -- For organisers, check patch assignments directly (avoids recursion)
  IF v_user_role = 'organiser' THEN
    IF EXISTS (
      SELECT 1
      FROM public.patch_project_mapping_view ppmv
      INNER JOIN public.organiser_patch_assignments opa 
        ON ppmv.patch_id = opa.patch_id
      WHERE ppmv.project_id = p_project_id
        AND opa.organiser_id = p_user_id
        AND opa.effective_to IS NULL
    ) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- For lead organisers, check patch assignments directly
  IF v_user_role = 'lead_organiser' THEN
    IF EXISTS (
      SELECT 1
      FROM public.patch_project_mapping_view ppmv
      INNER JOIN public.lead_organiser_patch_assignments lopa 
        ON ppmv.patch_id = lopa.patch_id
      WHERE ppmv.project_id = p_project_id
        AND lopa.lead_organiser_id = p_user_id
        AND lopa.effective_to IS NULL
    ) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Default: no access
  RETURN false;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION user_can_access_project_direct(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION user_can_access_project_direct(uuid, uuid) IS
  'Check if user can access a project without triggering RLS recursion. Uses SECURITY DEFINER to bypass RLS during checks. Checks patch assignments directly without querying job_sites.';

-- 2. Update projects_select RLS policy to use the helper function
--    Replace the fallback that queries job_sites with direct function call
DROP POLICY IF EXISTS "projects_select" ON "public"."projects";

CREATE POLICY "projects_select" ON "public"."projects" 
FOR SELECT TO "authenticated" 
USING (
  -- Admin can access everything
  "public"."is_admin"()
  OR
  -- Organisers can access projects via patch assignments (avoids recursion)
  EXISTS (
    SELECT 1
    FROM public.patch_project_mapping_view ppmv
    INNER JOIN public.organiser_patch_assignments opa 
      ON ppmv.patch_id = opa.patch_id
    WHERE ppmv.project_id = projects.id
      AND opa.organiser_id = auth.uid()
      AND opa.effective_to IS NULL
  )
  OR
  -- Lead organisers can access projects via patch assignments
  EXISTS (
    SELECT 1
    FROM public.patch_project_mapping_view ppmv
    INNER JOIN public.lead_organiser_patch_assignments lopa 
      ON ppmv.patch_id = lopa.patch_id
    WHERE ppmv.project_id = projects.id
      AND lopa.lead_organiser_id = auth.uid()
      AND lopa.effective_to IS NULL
  )
  OR
  -- Fallback: use direct function call instead of querying job_sites
  -- This avoids recursion by checking patch assignments directly
  user_can_access_project_direct(auth.uid(), projects.id)
);


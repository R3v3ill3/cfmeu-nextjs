-- ============================================================================
-- Fix RLS Stack Depth Issue for Organisers
-- ============================================================================
--
-- Problem: When organisers query dashboard data, PostgreSQL throws error 
-- 54001: stack depth limit exceeded. This happens because RLS policies 
-- create circular dependencies when checking access through scoped_sites/
-- scoped_employers.
--
-- Solution: Update can_access_job_site() and can_access_employer() functions
-- to check patch assignments FIRST using SECURITY DEFINER to bypass RLS
-- recursion. This allows organisers' access to be determined by their patch
-- assignments without triggering recursive RLS checks.
-- ============================================================================

-- 1. Update can_access_job_site() function
--    Add patch-based access check BEFORE checking scoped_sites
--    Use SECURITY DEFINER to bypass RLS during the check
CREATE OR REPLACE FUNCTION "public"."can_access_job_site"("target_job_site_id" "uuid") 
RETURNS boolean
LANGUAGE "plpgsql"
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
  WHERE id = auth.uid();
  
  -- Admin can access everything
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- For organisers and lead_organisers, check patch assignments FIRST
  -- This avoids recursion by checking patch assignments directly
  IF v_user_role IN ('organiser', 'lead_organiser') THEN
    -- Check if job site is in any of the user's assigned patches
    IF EXISTS (
      SELECT 1
      FROM public.patch_job_sites pjs
      INNER JOIN public.organiser_patch_assignments opa 
        ON pjs.patch_id = opa.patch_id
      WHERE pjs.job_site_id = target_job_site_id
        AND opa.organiser_id = auth.uid()
        AND opa.effective_to IS NULL
        AND pjs.effective_to IS NULL
    ) OR EXISTS (
      SELECT 1
      FROM public.patch_job_sites pjs
      INNER JOIN public.lead_organiser_patch_assignments lopa 
        ON pjs.patch_id = lopa.patch_id
      WHERE pjs.job_site_id = target_job_site_id
        AND lopa.lead_organiser_id = auth.uid()
        AND lopa.effective_to IS NULL
        AND pjs.effective_to IS NULL
    ) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Fallback to original scoped_sites check for backward compatibility
  -- This uses a CTE to avoid recursion
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.scoped_sites = '{}'::uuid[] 
        OR target_job_site_id = ANY(p.scoped_sites)
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.role_hierarchy rh
    INNER JOIN public.profiles child ON child.id = rh.child_user_id
    WHERE rh.parent_user_id = auth.uid()
      AND (
        child.scoped_sites = '{}'::uuid[] 
        OR target_job_site_id = ANY(child.scoped_sites)
      )
  );
END;
$$;

-- 2. Update can_access_employer() function
--    Add patch-based access check BEFORE checking scoped_employers
--    Use SECURITY DEFINER to bypass RLS during the check
CREATE OR REPLACE FUNCTION "public"."can_access_employer"("target_employer_id" "uuid") 
RETURNS boolean
LANGUAGE "plpgsql"
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
  WHERE id = auth.uid();
  
  -- Admin can access everything
  IF v_user_role = 'admin' THEN
    RETURN true;
  END IF;
  
  -- For organisers and lead_organisers, check patch assignments FIRST
  -- This avoids recursion by checking patch assignments directly
  IF v_user_role IN ('organiser', 'lead_organiser') THEN
    -- Check if employer is in any of the user's assigned patches
    IF EXISTS (
      SELECT 1
      FROM public.patch_employers pe
      INNER JOIN public.organiser_patch_assignments opa 
        ON pe.patch_id = opa.patch_id
      WHERE pe.employer_id = target_employer_id
        AND opa.organiser_id = auth.uid()
        AND opa.effective_to IS NULL
    ) OR EXISTS (
      SELECT 1
      FROM public.patch_employers pe
      INNER JOIN public.lead_organiser_patch_assignments lopa 
        ON pe.patch_id = lopa.patch_id
      WHERE pe.employer_id = target_employer_id
        AND lopa.lead_organiser_id = auth.uid()
        AND lopa.effective_to IS NULL
    ) THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Fallback to original scoped_employers check for backward compatibility
  -- This avoids recursion by checking scoped_employers directly
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        p.scoped_employers = '{}'::uuid[]
        OR target_employer_id = ANY(p.scoped_employers)
        OR EXISTS (
          SELECT 1
          FROM public.site_contractor_trades sct
          WHERE sct.employer_id = target_employer_id
            AND (
              p.scoped_sites = '{}'::uuid[] 
              OR sct.job_site_id = ANY(p.scoped_sites)
            )
        )
      )
  ) OR EXISTS (
    SELECT 1
    FROM public.role_hierarchy rh
    INNER JOIN public.profiles child ON child.id = rh.child_user_id
    WHERE rh.parent_user_id = auth.uid()
      AND (
        child.scoped_employers = '{}'::uuid[]
        OR target_employer_id = ANY(child.scoped_employers)
        OR EXISTS (
          SELECT 1
          FROM public.site_contractor_trades sct
          WHERE sct.employer_id = target_employer_id
            AND (
              child.scoped_sites = '{}'::uuid[] 
              OR sct.job_site_id = ANY(child.scoped_sites)
            )
        )
      )
  );
END;
$$;

-- 3. Update projects_select RLS policy
--    Add patch-based check directly for organisers to avoid recursion
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
  -- Fallback: check via job sites (for backward compatibility)
  -- This uses can_access_job_site which now checks patches first
  EXISTS (
    SELECT 1
    FROM public.job_sites js
    WHERE js.project_id = projects.id
      AND "public"."can_access_job_site"(js.id)
  )
);

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION "public"."can_access_job_site"("uuid") TO authenticated;
GRANT EXECUTE ON FUNCTION "public"."can_access_employer"("uuid") TO authenticated;

COMMENT ON FUNCTION "public"."can_access_job_site"("uuid") IS 
  'Check if user can access a job site. For organisers, checks patch assignments first to avoid RLS recursion. Uses SECURITY DEFINER to bypass RLS during checks.';

COMMENT ON FUNCTION "public"."can_access_employer"("uuid") IS 
  'Check if user can access an employer. For organisers, checks patch assignments first to avoid RLS recursion. Uses SECURITY DEFINER to bypass RLS during checks.';





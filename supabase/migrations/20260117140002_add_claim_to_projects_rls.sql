-- ============================================================================
-- Update projects_select RLS Policy to Include Claim-Based Access
-- ============================================================================
-- Purpose: Allow users to access projects they have claimed, in addition to
-- projects in their assigned patches.
-- ============================================================================

-- Drop and recreate the projects_select policy with claim support
DROP POLICY IF EXISTS "projects_select" ON "public"."projects";

CREATE POLICY "projects_select" ON "public"."projects" 
FOR SELECT TO "authenticated" 
USING (
  -- Admin can access everything
  "public"."is_admin"()
  OR
  -- User created this project (for pending projects)
  created_by = auth.uid()
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
  -- NEW: Users can access projects they have claimed
  EXISTS (
    SELECT 1
    FROM public.organiser_project_claims opc
    WHERE opc.project_id = projects.id
      AND opc.organiser_id = auth.uid()
      AND opc.released_at IS NULL
  )
  OR
  -- Fallback: use direct function call instead of querying job_sites
  user_can_access_project_direct(auth.uid(), projects.id)
);

-- ============================================================================
-- Update the helper function to also check claims
-- ============================================================================

CREATE OR REPLACE FUNCTION user_can_access_project_direct(
  p_user_id uuid,
  p_project_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- NEW: Check if user has claimed this project
  IF EXISTS (
    SELECT 1
    FROM public.organiser_project_claims opc
    WHERE opc.project_id = p_project_id
      AND opc.organiser_id = p_user_id
      AND opc.released_at IS NULL
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

COMMENT ON FUNCTION user_can_access_project_direct(uuid, uuid) IS
  'Check if user can access a project without triggering RLS recursion. Now also checks organiser_project_claims.';

-- ============================================================================
-- Create find_nearby_projects_with_access RPC Function
-- ============================================================================
-- Purpose: Enhanced version of find_nearby_projects that includes access status
-- for each project, enabling the UI to show:
-- - 'owned': User has access via patch assignment or claim
-- - 'claimable': Project has no patch or patch has no organiser
-- - 'assigned_other': Project is assigned to other organisers
-- ============================================================================

CREATE OR REPLACE FUNCTION find_nearby_projects_with_access(
  search_lat double precision,
  search_lng double precision,
  search_address text DEFAULT NULL,
  max_results integer DEFAULT 10,
  max_distance_km double precision DEFAULT 100
)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  project_tier text,
  job_site_id uuid,
  job_site_name text,
  job_site_address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  is_exact_match boolean,
  builder_name text,
  organising_universe text,
  stage_class text,
  project_value numeric,
  -- NEW: Access control columns
  access_status text,  -- 'owned' | 'claimable' | 'assigned_other'
  assigned_to_names text[],  -- Array of organiser names if assigned_other
  patch_id uuid,  -- The patch this project belongs to (if any)
  patch_name text  -- The patch name (if any)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET statement_timeout = '10s'
AS $$
DECLARE
  search_point geography;
  v_user_id uuid;
  v_user_role text;
BEGIN
  -- Get current user info
  v_user_id := auth.uid();
  
  SELECT role INTO v_user_role
  FROM profiles
  WHERE id = v_user_id;

  -- Validate inputs
  IF search_lat IS NULL OR search_lng IS NULL THEN
    RAISE EXCEPTION 'Coordinates are required';
  END IF;
  
  IF search_lat < -90 OR search_lat > 90 THEN
    RAISE EXCEPTION 'Invalid latitude: must be between -90 and 90';
  END IF;
  
  IF search_lng < -180 OR search_lng > 180 THEN
    RAISE EXCEPTION 'Invalid longitude: must be between -180 and 180';
  END IF;

  -- Create geography point from coordinates
  search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography;

  RETURN QUERY
  WITH project_distances AS (
    SELECT
      p.id as project_id,
      p.name as project_name,
      p.tier as project_tier,
      p.value as project_value,
      p.organising_universe::text as organising_universe,
      p.stage_class::text as stage_class,
      js.id as job_site_id,
      js.name as job_site_name,
      COALESCE(js.full_address, js.location) as job_site_address,
      js.latitude,
      js.longitude,
      js.patch_id,
      -- Calculate distance in kilometers
      ST_Distance(
        search_point,
        ST_SetSRID(ST_MakePoint(js.longitude, js.latitude), 4326)::geography
      ) / 1000.0 as distance_km,
      -- Check for exact or partial address match
      CASE
        WHEN search_address IS NOT NULL AND (
          LOWER(COALESCE(js.full_address, js.location)) = LOWER(search_address)
          OR LOWER(COALESCE(js.full_address, js.location)) LIKE '%' || LOWER(search_address) || '%'
        ) THEN true
        ELSE false
      END as is_exact_match,
      -- Get builder name from project_assignments
      (
        SELECT e.name
        FROM project_assignments pa
        JOIN employers e ON e.id = pa.employer_id
        JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
        WHERE pa.project_id = p.id
          AND pa.assignment_type = 'contractor_role'
          AND crt.code IN ('builder', 'head_contractor')
        LIMIT 1
      ) as builder_name
    FROM projects p
    INNER JOIN job_sites js ON js.project_id = p.id
    WHERE js.latitude IS NOT NULL
      AND js.longitude IS NOT NULL
      -- Filter to projects within max radius
      AND ST_DWithin(
        search_point,
        ST_SetSRID(ST_MakePoint(js.longitude, js.latitude), 4326)::geography,
        max_distance_km * 1000
      )
  ),
  -- Get patch information and organiser assignments
  patch_info AS (
    SELECT 
      pd.project_id,
      pd.patch_id,
      pa.name as patch_name,
      -- Get organisers assigned to this patch
      ARRAY_AGG(DISTINCT pr.full_name) FILTER (WHERE pr.full_name IS NOT NULL) as organiser_names,
      -- Check if current user is assigned to this patch
      BOOL_OR(opa.organiser_id = v_user_id) as user_is_assigned,
      -- Check if current user is lead organiser for this patch
      BOOL_OR(lopa.lead_organiser_id = v_user_id) as user_is_lead
    FROM project_distances pd
    LEFT JOIN patches pa ON pa.id = pd.patch_id
    LEFT JOIN organiser_patch_assignments opa 
      ON opa.patch_id = pd.patch_id AND opa.effective_to IS NULL
    LEFT JOIN lead_organiser_patch_assignments lopa 
      ON lopa.patch_id = pd.patch_id AND lopa.effective_to IS NULL
    LEFT JOIN profiles pr ON pr.id = opa.organiser_id
    GROUP BY pd.project_id, pd.patch_id, pa.name
  ),
  -- Get claim information
  claim_info AS (
    SELECT 
      pd.project_id,
      BOOL_OR(opc.organiser_id = v_user_id) as user_has_claim
    FROM project_distances pd
    LEFT JOIN organiser_project_claims opc 
      ON opc.project_id = pd.project_id AND opc.released_at IS NULL
    GROUP BY pd.project_id
  )
  SELECT
    pd.project_id,
    pd.project_name,
    pd.project_tier,
    pd.job_site_id,
    pd.job_site_name,
    pd.job_site_address,
    pd.latitude,
    pd.longitude,
    pd.distance_km,
    pd.is_exact_match,
    pd.builder_name,
    pd.organising_universe,
    pd.stage_class,
    pd.project_value,
    -- Determine access status
    CASE
      -- Admin always has access
      WHEN v_user_role = 'admin' THEN 'owned'
      -- User has a claim on this project
      WHEN COALESCE(ci.user_has_claim, false) THEN 'owned'
      -- User is assigned to the patch (organiser or lead)
      WHEN COALESCE(pi.user_is_assigned, false) OR COALESCE(pi.user_is_lead, false) THEN 'owned'
      -- Project has no patch - claimable
      WHEN pi.patch_id IS NULL THEN 'claimable'
      -- Patch has no organisers - claimable
      WHEN pi.organiser_names IS NULL OR ARRAY_LENGTH(pi.organiser_names, 1) IS NULL THEN 'claimable'
      -- Otherwise, assigned to other organisers
      ELSE 'assigned_other'
    END::text as access_status,
    -- Show assigned organiser names (only if assigned_other)
    CASE
      WHEN v_user_role = 'admin' THEN NULL
      WHEN COALESCE(ci.user_has_claim, false) THEN NULL
      WHEN COALESCE(pi.user_is_assigned, false) OR COALESCE(pi.user_is_lead, false) THEN NULL
      WHEN pi.patch_id IS NULL THEN NULL
      WHEN pi.organiser_names IS NULL OR ARRAY_LENGTH(pi.organiser_names, 1) IS NULL THEN NULL
      ELSE pi.organiser_names
    END as assigned_to_names,
    pi.patch_id,
    pi.patch_name
  FROM project_distances pd
  LEFT JOIN patch_info pi ON pi.project_id = pd.project_id
  LEFT JOIN claim_info ci ON ci.project_id = pd.project_id
  ORDER BY pd.distance_km ASC
  LIMIT max_results;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_nearby_projects_with_access(double precision, double precision, text, integer, double precision) TO authenticated;

COMMENT ON FUNCTION find_nearby_projects_with_access(double precision, double precision, text, integer, double precision) IS
  'Enhanced nearby project search that includes access status for each project. Returns owned/claimable/assigned_other status to enable proper UI display and claim functionality.';

-- ============================================================================
-- Also create a helper function to check project access for a single project
-- ============================================================================

CREATE OR REPLACE FUNCTION check_project_access(p_project_id uuid)
RETURNS TABLE (
  has_access boolean,
  access_reason text,  -- 'admin' | 'patch_assignment' | 'lead_assignment' | 'claim' | 'none'
  is_claimable boolean,
  assigned_to_names text[],
  patch_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_patch_id uuid;
  v_patch_name text;
  v_organiser_names text[];
  v_has_claim boolean;
  v_has_patch_assignment boolean;
  v_has_lead_assignment boolean;
BEGIN
  v_user_id := auth.uid();
  
  SELECT role INTO v_user_role FROM profiles WHERE id = v_user_id;
  
  -- Get patch info for the project
  SELECT js.patch_id, p.name INTO v_patch_id, v_patch_name
  FROM job_sites js
  LEFT JOIN patches p ON p.id = js.patch_id
  WHERE js.project_id = p_project_id
  LIMIT 1;
  
  -- Check if user has a claim
  SELECT EXISTS (
    SELECT 1 FROM organiser_project_claims opc
    WHERE opc.project_id = p_project_id
      AND opc.organiser_id = v_user_id
      AND opc.released_at IS NULL
  ) INTO v_has_claim;
  
  -- Check patch assignment
  SELECT EXISTS (
    SELECT 1 FROM organiser_patch_assignments opa
    WHERE opa.patch_id = v_patch_id
      AND opa.organiser_id = v_user_id
      AND opa.effective_to IS NULL
  ) INTO v_has_patch_assignment;
  
  -- Check lead assignment
  SELECT EXISTS (
    SELECT 1 FROM lead_organiser_patch_assignments lopa
    WHERE lopa.patch_id = v_patch_id
      AND lopa.lead_organiser_id = v_user_id
      AND lopa.effective_to IS NULL
  ) INTO v_has_lead_assignment;
  
  -- Get assigned organiser names
  SELECT ARRAY_AGG(DISTINCT pr.full_name)
  INTO v_organiser_names
  FROM organiser_patch_assignments opa
  JOIN profiles pr ON pr.id = opa.organiser_id
  WHERE opa.patch_id = v_patch_id
    AND opa.effective_to IS NULL;
  
  RETURN QUERY SELECT
    -- has_access
    CASE
      WHEN v_user_role = 'admin' THEN true
      WHEN v_has_claim THEN true
      WHEN v_has_patch_assignment THEN true
      WHEN v_has_lead_assignment THEN true
      ELSE false
    END,
    -- access_reason
    CASE
      WHEN v_user_role = 'admin' THEN 'admin'
      WHEN v_has_claim THEN 'claim'
      WHEN v_has_patch_assignment THEN 'patch_assignment'
      WHEN v_has_lead_assignment THEN 'lead_assignment'
      ELSE 'none'
    END::text,
    -- is_claimable
    CASE
      WHEN v_patch_id IS NULL THEN true
      WHEN v_organiser_names IS NULL OR ARRAY_LENGTH(v_organiser_names, 1) IS NULL THEN true
      ELSE false
    END,
    -- assigned_to_names
    v_organiser_names,
    -- patch_name
    v_patch_name;
END;
$$;

GRANT EXECUTE ON FUNCTION check_project_access(uuid) TO authenticated;

COMMENT ON FUNCTION check_project_access(uuid) IS
  'Check access status for a specific project. Returns whether user has access, the reason, and if the project is claimable.';

-- Dashboard optimization functions for server-side processing
-- Creates optimized RPC functions for organizing universe calculations and patch summaries

-- Function to calculate organizing universe metrics with filters
CREATE OR REPLACE FUNCTION calculate_organizing_universe_metrics(
  p_patch_ids UUID[] DEFAULT NULL,
  p_tier TEXT DEFAULT NULL,
  p_stage TEXT DEFAULT NULL,
  p_universe TEXT DEFAULT 'active',
  p_eba_filter TEXT DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_user_role TEXT DEFAULT NULL
)
RETURNS TABLE (
  eba_projects_percentage INTEGER,
  eba_projects_count INTEGER,
  total_active_projects INTEGER,
  known_builder_percentage INTEGER,
  known_builder_count INTEGER,
  key_contractor_coverage_percentage INTEGER,
  mapped_key_contractors INTEGER,
  total_key_contractor_slots INTEGER,
  key_contractor_eba_builder_percentage INTEGER,
  key_contractors_on_eba_builder_projects INTEGER,
  total_key_contractors_on_eba_builder_projects INTEGER,
  key_contractor_eba_percentage INTEGER,
  key_contractors_with_eba INTEGER,
  total_mapped_key_contractors INTEGER
) AS $$
DECLARE
  key_contractor_trades TEXT[] := ARRAY['demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 'tower_crane', 'mobile_crane'];
  key_contractor_roles TEXT[] := ARRAY['head_contractor', 'builder'];
BEGIN
  RETURN QUERY
  WITH filtered_projects AS (
    SELECT DISTINCT p.id, p.name, p.organising_universe, p.stage_class, p.tier
    FROM projects p
    LEFT JOIN job_sites js ON js.project_id = p.id
    LEFT JOIN patch_job_sites pjs ON pjs.job_site_id = js.id AND pjs.effective_to IS NULL
    WHERE p.organising_universe::text = COALESCE(p_universe, 'active')
      AND (p_tier IS NULL OR p.tier::text = COALESCE(p_tier, p.tier::text))
      AND (p_stage IS NULL OR p.stage_class::text = COALESCE(p_stage, p.stage_class::text))
      AND (p_patch_ids IS NULL OR pjs.patch_id = ANY(p_patch_ids))
  ),
  project_builders AS (
    SELECT 
      fp.id as project_id,
      pa.employer_id,
      CASE WHEN EXISTS (
        SELECT 1 FROM company_eba_records cer 
        WHERE cer.employer_id = pa.employer_id 
        AND cer.fwc_certified_date IS NOT NULL
      ) THEN true ELSE false END as has_eba
    FROM filtered_projects fp
    LEFT JOIN project_assignments pa ON pa.project_id = fp.id 
      AND pa.assignment_type = 'contractor_role'
    LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id 
      AND pa.is_primary_for_role = true
  ),
  project_metrics AS (
    SELECT 
      fp.id as project_id,
      -- EBA projects (builder has EBA)
      CASE WHEN pb.has_eba = true THEN 1 ELSE 0 END as is_eba_project,
      -- Known builder projects  
      CASE WHEN pb.employer_id IS NOT NULL THEN 1 ELSE 0 END as has_known_builder,
      -- Key contractor metrics calculation
      (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
      ) as mapped_key_contractors_count,
      (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
        AND EXISTS (
          SELECT 1 FROM company_eba_records cer 
          WHERE cer.employer_id = pa2.employer_id 
          AND cer.fwc_certified_date IS NOT NULL
        )
      ) as key_contractors_with_eba_count,
      -- Key contractors on EBA builder projects
      CASE WHEN pb.has_eba = true THEN (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
      ) ELSE 0 END as key_contractors_on_eba_builder_project,
      CASE WHEN pb.has_eba = true THEN (
        SELECT COUNT(DISTINCT COALESCE(pa2.contractor_role_type_id::text, pa2.trade_type_id::text))
        FROM project_assignments pa2
        LEFT JOIN contractor_role_types crt2 ON crt2.id = pa2.contractor_role_type_id
        LEFT JOIN trade_types tt2 ON tt2.id = pa2.trade_type_id
        WHERE pa2.project_id = fp.id
        AND (
          (pa2.assignment_type = 'contractor_role' AND crt2.code = ANY(key_contractor_roles))
          OR (pa2.assignment_type = 'trade_work' AND tt2.code = ANY(key_contractor_trades))
        )
        AND EXISTS (
          SELECT 1 FROM company_eba_records cer 
          WHERE cer.employer_id = pa2.employer_id 
          AND cer.fwc_certified_date IS NOT NULL
        )
      ) ELSE 0 END as key_contractors_with_eba_on_eba_builder_project
    FROM filtered_projects fp
    LEFT JOIN project_builders pb ON pb.project_id = fp.id
  ),
  aggregated_metrics AS (
    SELECT 
      COUNT(*) as total_projects,
      SUM(is_eba_project) as eba_projects,
      SUM(has_known_builder) as known_builders,
      SUM(mapped_key_contractors_count) as total_mapped_key_contractors,
      SUM(key_contractors_with_eba_count) as total_key_contractors_with_eba,
      SUM(key_contractors_on_eba_builder_project) as total_key_contractors_on_eba_projects,
      SUM(key_contractors_with_eba_on_eba_builder_project) as total_key_contractors_eba_on_eba_projects,
      COUNT(*) * 9 as total_key_contractor_slots
    FROM project_metrics
  )
  SELECT 
    CASE WHEN am.total_projects > 0 THEN ROUND((am.eba_projects::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    am.eba_projects::INTEGER,
    am.total_projects::INTEGER,
    CASE WHEN am.total_projects > 0 THEN ROUND((am.known_builders::DECIMAL / am.total_projects) * 100) ELSE 0 END::INTEGER,
    am.known_builders::INTEGER,
    CASE WHEN am.total_key_contractor_slots > 0 THEN ROUND((am.total_mapped_key_contractors::DECIMAL / am.total_key_contractor_slots) * 100) ELSE 0 END::INTEGER,
    am.total_mapped_key_contractors::INTEGER,
    am.total_key_contractor_slots::INTEGER,
    CASE WHEN am.total_key_contractors_on_eba_projects > 0 THEN ROUND((am.total_key_contractors_eba_on_eba_projects::DECIMAL / am.total_key_contractors_on_eba_projects) * 100) ELSE 0 END::INTEGER,
    am.total_key_contractors_eba_on_eba_projects::INTEGER,
    am.total_key_contractors_on_eba_projects::INTEGER,
    CASE WHEN am.total_mapped_key_contractors > 0 THEN ROUND((am.total_key_contractors_with_eba::DECIMAL / am.total_mapped_key_contractors) * 100) ELSE 0 END::INTEGER,
    am.total_key_contractors_with_eba::INTEGER,
    am.total_mapped_key_contractors::INTEGER
  FROM aggregated_metrics am;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get patch summaries for a user based on their role
CREATE OR REPLACE FUNCTION get_patch_summaries_for_user(
  p_user_id UUID,
  p_user_role TEXT,
  p_lead_organiser_id UUID DEFAULT NULL,
  p_filters JSONB DEFAULT NULL
)
RETURNS TABLE (
  patch_id UUID,
  patch_name TEXT,
  organiser_names TEXT[],
  project_count INTEGER,
  eba_projects_count INTEGER,
  eba_projects_percentage INTEGER,
  known_builder_count INTEGER,
  known_builder_percentage INTEGER,
  key_contractor_coverage INTEGER,
  key_contractor_eba_percentage INTEGER,
  last_updated TIMESTAMPTZ
) AS $$
DECLARE
  patch_ids_filter UUID[];
BEGIN
  -- Get relevant patches based on user role
  IF p_user_role = 'organiser' THEN
    -- Get patches assigned to this organiser
    SELECT ARRAY_AGG(opa.patch_id) INTO patch_ids_filter
    FROM organiser_patch_assignments opa
    WHERE opa.organiser_id = p_user_id AND opa.effective_to IS NULL;
  ELSIF p_user_role = 'lead_organiser' THEN
    -- Get patches assigned to this lead organiser
    SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
    FROM lead_organiser_patch_assignments lopa
    WHERE lopa.lead_organiser_id = COALESCE(p_lead_organiser_id, p_user_id) 
    AND lopa.effective_to IS NULL;
  ELSIF p_user_role = 'admin' THEN
    -- Admin can see all patches, optionally filtered by lead organiser
    IF p_lead_organiser_id IS NOT NULL THEN
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = p_lead_organiser_id AND lopa.effective_to IS NULL;
    ELSE
      patch_ids_filter := NULL; -- No filter = all patches
    END IF;
  END IF;

  RETURN QUERY
  WITH relevant_patches AS (
    SELECT p.id, p.name
    FROM patches p
    WHERE (patch_ids_filter IS NULL OR p.id = ANY(patch_ids_filter))
  ),
  patch_projects AS (
    SELECT 
      rp.id as patch_id,
      rp.name as patch_name,
      COUNT(DISTINCT proj.id) as total_projects,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM project_assignments pa
          JOIN contractor_roles cr ON cr.id = pa.contractor_role_id
          WHERE pa.project_id = proj.id 
          AND pa.assignment_type = 'contractor_role' 
          AND cr.is_primary = true
          AND EXISTS (
            SELECT 1 FROM company_eba_records cer 
            WHERE cer.employer_id = pa.employer_id 
            AND cer.fwc_certified_date IS NOT NULL
          )
        ) THEN proj.id 
      END) as eba_projects,
      COUNT(DISTINCT CASE 
        WHEN EXISTS (
          SELECT 1 FROM project_assignments pa
          JOIN contractor_roles cr ON cr.id = pa.contractor_role_id
          WHERE pa.project_id = proj.id 
          AND pa.assignment_type = 'contractor_role' 
          AND cr.is_primary = true
        ) THEN proj.id 
      END) as known_builder_projects
    FROM relevant_patches rp
    LEFT JOIN patch_job_sites pjs ON pjs.patch_id = rp.id AND pjs.effective_to IS NULL
    LEFT JOIN job_sites js ON js.id = pjs.job_site_id
    LEFT JOIN projects proj ON proj.id = js.project_id
    WHERE proj.organising_universe::text = 'active'
      AND (p_filters IS NULL OR (
        (p_filters->>'tier' IS NULL OR proj.tier::text = (p_filters->>'tier'))
        AND (p_filters->>'stage' IS NULL OR proj.stage_class::text = (p_filters->>'stage'))
        AND (p_filters->>'universe' IS NULL OR proj.organising_universe::text = (p_filters->>'universe'))
      ))
    GROUP BY rp.id, rp.name
  ),
  patch_organisers AS (
    SELECT 
      rp.id as patch_id,
      ARRAY_AGG(DISTINCT pr.full_name ORDER BY pr.full_name) as organiser_names
    FROM relevant_patches rp
    LEFT JOIN organiser_patch_assignments opa ON opa.patch_id = rp.id AND opa.effective_to IS NULL
    LEFT JOIN profiles pr ON pr.id = opa.organiser_id
    GROUP BY rp.id
  )
  SELECT 
    pp.patch_id,
    pp.patch_name,
    COALESCE(po.organiser_names, ARRAY[]::TEXT[]),
    pp.total_projects::INTEGER,
    pp.eba_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.eba_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    pp.known_builder_projects::INTEGER,
    CASE WHEN pp.total_projects > 0 THEN ROUND((pp.known_builder_projects::DECIMAL / pp.total_projects) * 100) ELSE 0 END::INTEGER,
    0::INTEGER, -- key_contractor_coverage (calculated separately if needed)
    0::INTEGER, -- key_contractor_eba_percentage (calculated separately if needed)  
    NOW() as last_updated
  FROM patch_projects pp
  LEFT JOIN patch_organisers po ON po.patch_id = pp.patch_id
  ORDER BY pp.patch_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_organizing_universe_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_patch_summaries_for_user TO authenticated, service_role;

-- Create indexes for performance
-- CREATE INDEX IF NOT EXISTS idx_project_assignments_composite 
--   ON project_assignments(project_id, assignment_type, employer_id, contractor_role_id, trade_type_id);

-- (comment out the other 3 indexes too)

-- Add comment for documentation
COMMENT ON FUNCTION calculate_organizing_universe_metrics IS 'Optimized server-side calculation of organizing universe metrics with filtering support';
COMMENT ON FUNCTION get_patch_summaries_for_user IS 'Role-based patch summaries with project counts and EBA metrics for dashboard';

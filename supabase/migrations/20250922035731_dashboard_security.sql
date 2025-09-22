-- Harden dashboard RPCs to derive permissions from auth context

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
  active_user_id UUID;
  caller_role TEXT;
  effective_role TEXT;
  sanitized_universe TEXT;
  sanitized_tier TEXT;
  sanitized_stage TEXT;
BEGIN
  active_user_id := auth.uid();

  IF active_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Organizing metrics require authentication';
  END IF;

  SELECT role INTO caller_role
  FROM profiles
  WHERE id = active_user_id;

  IF caller_role IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Unable to determine caller role';
  END IF;

  IF caller_role NOT IN ('organiser', 'lead_organiser', 'admin') THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Role is not permitted to view organizing metrics';
  END IF;

  IF caller_role <> 'admin' AND p_user_id IS NOT NULL AND p_user_id <> active_user_id THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Impersonating another account is not permitted';
  END IF;

  effective_role := CASE
    WHEN caller_role = 'admin' AND p_user_role IS NOT NULL THEN p_user_role
    ELSE caller_role
  END;

  IF effective_role NOT IN ('organiser', 'lead_organiser', 'admin') THEN
    effective_role := caller_role;
  END IF;

  sanitized_universe := COALESCE(p_universe, 'active');
  sanitized_tier := NULLIF(p_tier, '');
  sanitized_stage := NULLIF(p_stage, '');

  RETURN QUERY
  WITH filtered_projects AS (
    SELECT DISTINCT p.id, p.name, p.organising_universe, p.stage_class, p.tier
    FROM projects p
    LEFT JOIN job_sites js ON js.project_id = p.id
    LEFT JOIN patch_job_sites pjs ON pjs.job_site_id = js.id AND pjs.effective_to IS NULL
    WHERE p.organising_universe::text = sanitized_universe
      AND (sanitized_tier IS NULL OR p.tier::text = sanitized_tier)
      AND (sanitized_stage IS NULL OR p.stage_class::text = sanitized_stage)
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
      CASE WHEN pb.has_eba = true THEN 1 ELSE 0 END as is_eba_project,
      CASE WHEN pb.employer_id IS NOT NULL THEN 1 ELSE 0 END as has_known_builder,
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

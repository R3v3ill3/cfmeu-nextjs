-- Update role-based permissions for enhanced lead organiser and organiser visibility
-- Lead organisers can now see entire universe, organisers can see peer patches under same lead

-- Updated function to get patch summaries for a user based on new role hierarchy
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
  user_lead_organiser_id UUID;
BEGIN
  -- Enhanced permission logic
  IF p_user_role = 'organiser' THEN
    -- NEW: Get patches assigned to organisers under the same lead organiser
    -- First, find which lead organiser this organiser reports to
    SELECT lopa.lead_organiser_id INTO user_lead_organiser_id
    FROM organiser_patch_assignments opa
    JOIN lead_organiser_patch_assignments lopa ON lopa.patch_id = opa.patch_id 
      AND lopa.effective_to IS NULL
    WHERE opa.organiser_id = p_user_id 
      AND opa.effective_to IS NULL
    LIMIT 1;
    
    IF user_lead_organiser_id IS NOT NULL THEN
      -- Get all patches assigned to organisers under the same lead organiser
      SELECT ARRAY_AGG(DISTINCT lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = user_lead_organiser_id 
        AND lopa.effective_to IS NULL;
    ELSE
      -- Fallback: just get patches directly assigned to this organiser
      SELECT ARRAY_AGG(opa.patch_id) INTO patch_ids_filter
      FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = p_user_id AND opa.effective_to IS NULL;
    END IF;
    
  ELSIF p_user_role = 'lead_organiser' THEN
    -- NEW: Lead organisers can see entire universe (same as admin)
    IF p_lead_organiser_id IS NOT NULL THEN
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = p_lead_organiser_id AND lopa.effective_to IS NULL;
    ELSE
      patch_ids_filter := NULL; -- No filter = all patches (entire universe)
    END IF;
    
  ELSIF p_user_role = 'admin' THEN
    -- Admin can see all patches, optionally filtered by lead organiser
    IF p_lead_organiser_id IS NOT NULL THEN
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = p_lead_organiser_id AND lopa.effective_to IS NULL;
    ELSE
      patch_ids_filter := NULL; -- No filter = all patches
    END IF;
  ELSE
    -- Other roles (delegate, viewer) get no patches
    patch_ids_filter := ARRAY[]::UUID[];
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
      COUNT(DISTINCT CASE WHEN ceba.fwc_certified_date IS NOT NULL THEN proj.id END) as eba_projects,
      COUNT(DISTINCT CASE WHEN proj.builder_name IS NOT NULL AND proj.builder_name != '' THEN proj.id END) as known_builder_projects
    FROM relevant_patches rp
    LEFT JOIN patch_job_sites pjs ON pjs.patch_id = rp.id AND pjs.effective_to IS NULL
    LEFT JOIN job_sites js ON js.id = pjs.job_site_id
    LEFT JOIN projects proj ON proj.main_job_site_id = js.id
      AND proj.organising_universe = 'active'
    LEFT JOIN project_assignments pa ON pa.project_id = proj.id
      AND pa.assignment_type = 'employer'
    LEFT JOIN employers emp ON emp.id = pa.employer_id
    LEFT JOIN company_eba_records ceba ON ceba.employer_id = emp.id
    WHERE proj.id IS NULL OR (
      (p_filters IS NULL OR (
        (p_filters->>'tier' IS NULL OR proj.tier = (p_filters->>'tier')) AND
        (p_filters->>'stage' IS NULL OR proj.stage_class = (p_filters->>'stage')) AND
        (p_filters->>'eba' IS NULL OR (
          CASE p_filters->>'eba'
            WHEN 'eba_active' THEN ceba.fwc_certified_date IS NOT NULL
            WHEN 'eba_inactive' THEN ceba.fwc_certified_date IS NULL
            WHEN 'builder_unknown' THEN proj.builder_name IS NULL OR proj.builder_name = ''
            ELSE TRUE
          END
        ))
      ))
    )
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

-- Update function to calculate organizing universe metrics with enhanced permissions
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
  effective_patch_ids UUID[];
  user_lead_organiser_id UUID;
BEGIN
  -- Enhanced role-based patch filtering
  IF p_user_role = 'organiser' AND p_user_id IS NOT NULL THEN
    -- Get patches for organisers under the same lead organiser
    SELECT lopa.lead_organiser_id INTO user_lead_organiser_id
    FROM organiser_patch_assignments opa
    JOIN lead_organiser_patch_assignments lopa ON lopa.patch_id = opa.patch_id 
      AND lopa.effective_to IS NULL
    WHERE opa.organiser_id = p_user_id 
      AND opa.effective_to IS NULL
    LIMIT 1;
    
    IF user_lead_organiser_id IS NOT NULL THEN
      -- Get all patches under the same lead organiser
      SELECT ARRAY_AGG(DISTINCT lopa.patch_id) INTO effective_patch_ids
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = user_lead_organiser_id 
        AND lopa.effective_to IS NULL;
    ELSE
      -- Fallback: just get patches directly assigned to this organiser
      SELECT ARRAY_AGG(opa.patch_id) INTO effective_patch_ids
      FROM organiser_patch_assignments opa
      WHERE opa.organiser_id = p_user_id AND opa.effective_to IS NULL;
    END IF;
    
  ELSIF p_user_role = 'lead_organiser' THEN
    -- Lead organisers see entire universe (no patch filtering unless explicitly provided)
    effective_patch_ids := p_patch_ids;
    
  ELSIF p_user_role = 'admin' THEN
    -- Admins see everything
    effective_patch_ids := p_patch_ids;
    
  ELSE
    -- Other roles get limited access
    effective_patch_ids := COALESCE(p_patch_ids, ARRAY[]::UUID[]);
  END IF;

  RETURN QUERY
  WITH filtered_projects AS (
    SELECT DISTINCT p.id, p.name, p.tier, p.stage_class, p.builder_name
    FROM projects p
    WHERE p.organising_universe = COALESCE(p_universe, 'active')
      AND (p_tier IS NULL OR p.tier = p_tier)
      AND (p_stage IS NULL OR p.stage_class = p_stage)
      AND (effective_patch_ids IS NULL OR EXISTS (
        SELECT 1 FROM patch_job_sites pjs
        WHERE pjs.job_site_id = p.main_job_site_id
          AND pjs.patch_id = ANY(effective_patch_ids)
          AND pjs.effective_to IS NULL
      ))
  ),
  project_metrics AS (
    SELECT 
      COUNT(*) as total_projects,
      COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM project_assignments pa
        JOIN employers e ON e.id = pa.employer_id
        JOIN company_eba_records cer ON cer.employer_id = e.id
        WHERE pa.project_id = fp.id 
          AND pa.assignment_type = 'employer'
          AND cer.fwc_certified_date IS NOT NULL
      ) THEN 1 END) as eba_projects,
      COUNT(CASE WHEN fp.builder_name IS NOT NULL AND fp.builder_name != '' THEN 1 END) as known_builder_projects,
      COUNT(CASE WHEN EXISTS (
        SELECT 1 FROM project_assignments pa
        JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
        WHERE pa.project_id = fp.id 
          AND crt.code = ANY(key_contractor_roles)
      ) OR EXISTS (
        SELECT 1 FROM project_assignments pa
        JOIN trade_types tt ON tt.id = pa.trade_type_id
        WHERE pa.project_id = fp.id 
          AND tt.code = ANY(key_contractor_trades)
      ) THEN 1 END) as projects_with_key_contractors
    FROM filtered_projects fp
  )
  SELECT 
    CASE WHEN pm.total_projects > 0 THEN ROUND((pm.eba_projects::DECIMAL / pm.total_projects) * 100) ELSE 0 END::INTEGER,
    pm.eba_projects::INTEGER,
    pm.total_projects::INTEGER,
    CASE WHEN pm.total_projects > 0 THEN ROUND((pm.known_builder_projects::DECIMAL / pm.total_projects) * 100) ELSE 0 END::INTEGER,
    pm.known_builder_projects::INTEGER,
    CASE WHEN pm.total_projects > 0 THEN ROUND((pm.projects_with_key_contractors::DECIMAL / pm.total_projects) * 100) ELSE 0 END::INTEGER,
    pm.projects_with_key_contractors::INTEGER,
    pm.total_projects::INTEGER,
    0::INTEGER, -- key_contractor_eba_builder_percentage
    0::INTEGER, -- key_contractors_on_eba_builder_projects
    0::INTEGER, -- total_key_contractors_on_eba_builder_projects
    0::INTEGER, -- key_contractor_eba_percentage
    0::INTEGER, -- key_contractors_with_eba
    pm.projects_with_key_contractors::INTEGER -- total_mapped_key_contractors
  FROM project_metrics pm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_organizing_universe_metrics TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_patch_summaries_for_user TO authenticated, service_role;

-- Add comments
COMMENT ON FUNCTION get_patch_summaries_for_user IS 'Enhanced role-based patch summaries: lead organisers see entire universe, organisers see peer patches under same lead';
COMMENT ON FUNCTION calculate_organizing_universe_metrics IS 'Enhanced organizing universe metrics with expanded lead organiser and organiser visibility';

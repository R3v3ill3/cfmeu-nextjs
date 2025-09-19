-- Fix get_patch_summaries_for_user to align with current contractor role schema
-- Replaces legacy joins to contractor_roles with contractor_role_type-aware logic.

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
  -- Determine patch scope based on viewer role
  IF p_user_role = 'organiser' THEN
    SELECT ARRAY_AGG(opa.patch_id) INTO patch_ids_filter
    FROM organiser_patch_assignments opa
    WHERE opa.organiser_id = p_user_id
      AND opa.effective_to IS NULL;
  ELSIF p_user_role = 'lead_organiser' THEN
    SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
    FROM lead_organiser_patch_assignments lopa
    WHERE lopa.lead_organiser_id = COALESCE(p_lead_organiser_id, p_user_id)
      AND lopa.effective_to IS NULL;
  ELSIF p_user_role = 'admin' THEN
    IF p_lead_organiser_id IS NOT NULL THEN
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = p_lead_organiser_id
        AND lopa.effective_to IS NULL;
    ELSE
      patch_ids_filter := NULL; -- Admin without lead filter = all patches
    END IF;
  END IF;

  RETURN QUERY
  WITH relevant_patches AS (
    SELECT p.id, p.name
    FROM patches p
    WHERE patch_ids_filter IS NULL OR p.id = ANY(patch_ids_filter)
  ),
  patch_projects AS (
    SELECT
      rp.id AS patch_id,
      rp.name AS patch_name,
      COUNT(DISTINCT proj.id) AS total_projects,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = proj.id
            AND pa.assignment_type = 'contractor_role'
            AND pa.is_primary_for_role = TRUE
            AND EXISTS (
              SELECT 1
              FROM company_eba_records cer
              WHERE cer.employer_id = pa.employer_id
                AND cer.fwc_certified_date IS NOT NULL
            )
        ) THEN proj.id END) AS eba_projects,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM project_assignments pa
          WHERE pa.project_id = proj.id
            AND pa.assignment_type = 'contractor_role'
            AND pa.is_primary_for_role = TRUE
        ) THEN proj.id END) AS known_builder_projects
    FROM relevant_patches rp
    LEFT JOIN patch_job_sites pjs
      ON pjs.patch_id = rp.id
     AND pjs.effective_to IS NULL
    LEFT JOIN job_sites js
      ON js.id = pjs.job_site_id
    LEFT JOIN projects proj
      ON proj.id = js.project_id
    WHERE proj.organising_universe::text = 'active'
      AND (
        p_filters IS NULL OR (
          (p_filters->>'tier' IS NULL OR proj.tier::text = p_filters->>'tier')
          AND (p_filters->>'stage' IS NULL OR proj.stage_class::text = p_filters->>'stage')
          AND (p_filters->>'universe' IS NULL OR proj.organising_universe::text = p_filters->>'universe')
        )
      )
    GROUP BY rp.id, rp.name
  ),
  patch_organisers AS (
    SELECT
      rp.id AS patch_id,
      ARRAY_AGG(DISTINCT pr.full_name ORDER BY pr.full_name) AS organiser_names
    FROM relevant_patches rp
    LEFT JOIN organiser_patch_assignments opa
      ON opa.patch_id = rp.id
     AND opa.effective_to IS NULL
    LEFT JOIN profiles pr
      ON pr.id = opa.organiser_id
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
    0::INTEGER,
    0::INTEGER,
    NOW() AS last_updated
  FROM patch_projects pp
  LEFT JOIN patch_organisers po ON po.patch_id = pp.patch_id
  ORDER BY pp.patch_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_patch_summaries_for_user IS
  'Role-based patch summaries aligned with contractor_role_types schema';

-- Fix get_patch_summaries_for_user to include draft lead organisers and their patch assignments
-- This resolves the issue where draft lead organisers' patches were being attributed to confirmed lead organisers

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
  target_lead_id UUID;
  is_draft_lead BOOLEAN := FALSE;
BEGIN
  -- Determine the target lead organiser ID
  target_lead_id := COALESCE(p_lead_organiser_id, p_user_id);

  -- Check if the target lead organiser is a draft lead organiser
  SELECT EXISTS(
    SELECT 1 FROM pending_users
    WHERE id = target_lead_id
      AND role = 'lead_organiser'
      AND status IN ('draft', 'invited')
  ) INTO is_draft_lead;

  -- Determine patch scope based on viewer role and lead organiser type
  IF p_user_role = 'organiser' THEN
    -- Organiser: Get patches assigned directly to them
    SELECT ARRAY_AGG(opa.patch_id) INTO patch_ids_filter
    FROM organiser_patch_assignments opa
    WHERE opa.organiser_id = p_user_id
      AND opa.effective_to IS NULL;

  ELSIF p_user_role = 'lead_organiser' THEN
    -- Lead organiser: Get patches assigned to them
    IF is_draft_lead THEN
      -- Draft lead organiser: Get patches from assigned_patch_ids
      SELECT pu.assigned_patch_ids INTO patch_ids_filter
      FROM pending_users pu
      WHERE pu.id = target_lead_id
        AND pu.role = 'lead_organiser'
        AND pu.status IN ('draft', 'invited');
    ELSE
      -- Confirmed lead organiser: Get patches from lead_organiser_patch_assignments
      SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
      FROM lead_organiser_patch_assignments lopa
      WHERE lopa.lead_organiser_id = target_lead_id
        AND lopa.effective_to IS NULL;
    END IF;

  ELSIF p_user_role = 'admin' THEN
    -- Admin: Handle both confirmed and draft lead organisers
    IF p_lead_organiser_id IS NOT NULL THEN
      -- Check if the specified lead is draft or confirmed
      IF is_draft_lead THEN
        -- Draft lead organiser: Get patches from assigned_patch_ids
        SELECT pu.assigned_patch_ids INTO patch_ids_filter
        FROM pending_users pu
        WHERE pu.id = p_lead_organiser_id
          AND pu.role = 'lead_organiser'
          AND pu.status IN ('draft', 'invited');
      ELSE
        -- Confirmed lead organiser: Get patches from lead_organiser_patch_assignments
        SELECT ARRAY_AGG(lopa.patch_id) INTO patch_ids_filter
        FROM lead_organiser_patch_assignments lopa
        WHERE lopa.lead_organiser_id = p_lead_organiser_id
          AND lopa.effective_to IS NULL;
      END IF;
    ELSE
      -- Admin without lead filter: Include all patches
      patch_ids_filter := NULL;
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
  -- Enhanced organiser names query to include draft organisers
  patch_organisers AS (
    SELECT
      rp.id AS patch_id,
      ARRAY_AGG(DISTINCT organiser_name ORDER BY organiser_name) AS organiser_names
    FROM (
      SELECT DISTINCT
        rp.id,
        CASE
          WHEN pr.full_name IS NOT NULL THEN pr.full_name
          WHEN pu.full_name IS NOT NULL THEN pu.full_name || ' (Draft)'
          ELSE 'Unknown'
        END AS organiser_name
      FROM relevant_patches rp
      -- Live organisers
      LEFT JOIN organiser_patch_assignments opa
        ON opa.patch_id = rp.id
       AND opa.effective_to IS NULL
      LEFT JOIN profiles pr
        ON pr.id = opa.organiser_id
      -- Draft organisers
      LEFT JOIN organiser_patch_assignments opa_draft
        ON opa_draft.patch_id = rp.id
       AND opa_draft.effective_to IS NULL
      LEFT JOIN pending_users pu
        ON pu.id = opa_draft.organiser_id
       AND pu.role = 'organiser'
       AND pu.status IN ('draft', 'invited')
      WHERE (pr.full_name IS NOT NULL OR pu.full_name IS NOT NULL)
    ) AS distinct_organisers
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
    0::INTEGER, -- key_contractor_coverage (placeholder for future enhancement)
    0::INTEGER, -- key_contractor_eba_percentage (placeholder for future enhancement)
    NOW() AS last_updated
  FROM patch_projects pp
  LEFT JOIN patch_organisers po ON po.patch_id = pp.patch_id
  ORDER BY pp.patch_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_patch_summaries_for_user IS
  'Enhanced role-based patch summaries that include both confirmed and draft lead organisers with their respective patch assignments';

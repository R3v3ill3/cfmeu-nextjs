-- Fix get_employer_sites function to properly retrieve organiser names
-- This version restructures the organiser query to match the mapping sheets logic
DROP FUNCTION IF EXISTS get_employer_sites(UUID);

CREATE FUNCTION get_employer_sites(p_employer_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    project_id UUID,
    project_name TEXT,
    address TEXT,
    patch_names TEXT[],
    organiser_names TEXT[],
    compliance_check_conducted BOOLEAN,
    compliance_rating traffic_light_rating
) AS $$
BEGIN
    RETURN QUERY
    WITH employer_projects AS (
      SELECT DISTINCT js.project_id
      FROM worker_placements wp
      JOIN job_sites js ON wp.job_site_id = js.id
      WHERE wp.employer_id = p_employer_id

      UNION

      SELECT DISTINCT pe.project_id
      FROM project_employer_roles pe
      WHERE pe.employer_id = p_employer_id

      UNION

      SELECT DISTINCT pr.id AS project_id
      FROM projects pr
      WHERE pr.builder_id = p_employer_id

      UNION

      SELECT DISTINCT pct.project_id
      FROM project_contractor_trades pct
      WHERE pct.employer_id = p_employer_id

      UNION

      SELECT DISTINCT js.project_id
      FROM site_contractor_trades sct
      JOIN job_sites js ON sct.job_site_id = js.id
      WHERE sct.employer_id = p_employer_id

      UNION

      SELECT DISTINCT pa.project_id
      FROM project_assignments pa
      WHERE pa.employer_id = p_employer_id
        AND pa.assignment_type = 'contractor_role'
    ),
    project_job_sites AS (
      SELECT js.id, js.name, js.project_id, COALESCE(js.full_address, js.location) AS address
      FROM job_sites js
      JOIN employer_projects ep ON ep.project_id = js.project_id
    ),
    projects_missing_sites AS (
      SELECT ep.project_id
      FROM employer_projects ep
      LEFT JOIN project_job_sites pjs ON pjs.project_id = ep.project_id
      WHERE pjs.id IS NULL
    ),
    site_patches AS (
      SELECT 
        pjs.id AS site_id,
        ARRAY_AGG(DISTINCT pat.name ORDER BY pat.name) FILTER (WHERE pat.name IS NOT NULL) AS patch_names
      FROM project_job_sites pjs
      LEFT JOIN patch_job_sites pjs_link ON pjs_link.job_site_id = pjs.id AND pjs_link.effective_to IS NULL
      LEFT JOIN patches pat ON pat.id = pjs_link.patch_id
      GROUP BY pjs.id
    ),
    site_patches_for_orgs AS (
      SELECT DISTINCT
        pjs.id AS site_id,
        pjs_link.patch_id
      FROM project_job_sites pjs
      LEFT JOIN patch_job_sites pjs_link ON pjs_link.job_site_id = pjs.id AND pjs_link.effective_to IS NULL
      WHERE pjs_link.patch_id IS NOT NULL  -- Only include sites with patches
    ),
    all_organisers_by_patch AS (
      -- Get live organisers from organiser_patch_assignments
      SELECT 
        opa.patch_id,
        prof.full_name AS org_name
      FROM organiser_patch_assignments opa
      JOIN profiles prof ON prof.id = opa.organiser_id
      WHERE opa.effective_to IS NULL
        AND prof.full_name IS NOT NULL
      
      UNION
      
      -- Get draft/invited organisers from pending_users
      SELECT 
        patch_id::uuid AS patch_id,
        CASE 
          WHEN pu.role = 'lead_organiser' THEN pu.full_name || ' (lead)'
          ELSE pu.full_name
        END AS org_name
      FROM pending_users pu
      CROSS JOIN LATERAL unnest(pu.assigned_patch_ids::uuid[]) AS patch_id
      WHERE pu.status IN ('draft', 'invited')
        AND pu.full_name IS NOT NULL
    ),
    site_organisers AS (
      SELECT 
        spo.site_id,
        ARRAY_AGG(DISTINCT aobp.org_name ORDER BY aobp.org_name) FILTER (WHERE aobp.org_name IS NOT NULL) AS organiser_names
      FROM site_patches_for_orgs spo
      LEFT JOIN all_organisers_by_patch aobp ON aobp.patch_id = spo.patch_id
      GROUP BY spo.site_id
    ),
    project_compliance_data AS (
      SELECT 
        pjs.project_id,
        BOOL_OR(pca.id IS NOT NULL) AS has_assessment,
        (SELECT pca2.rating 
         FROM project_compliance_assessments pca2
         WHERE pca2.project_id = pjs.project_id
           AND pca2.employer_id = p_employer_id
           AND pca2.is_active = true
         ORDER BY pca2.assessment_date DESC, pca2.created_at DESC
         LIMIT 1) AS latest_rating
      FROM project_job_sites pjs
      LEFT JOIN project_compliance_assessments pca ON pca.project_id = pjs.project_id 
        AND pca.employer_id = p_employer_id 
        AND pca.is_active = true
      GROUP BY pjs.project_id
    ),
    project_missing_compliance_data AS (
      SELECT 
        pm.project_id,
        BOOL_OR(pca.id IS NOT NULL) AS has_assessment,
        (SELECT pca2.rating 
         FROM project_compliance_assessments pca2
         WHERE pca2.project_id = pm.project_id
           AND pca2.employer_id = p_employer_id
           AND pca2.is_active = true
         ORDER BY pca2.assessment_date DESC, pca2.created_at DESC
         LIMIT 1) AS latest_rating
      FROM projects_missing_sites pm
      LEFT JOIN project_compliance_assessments pca ON pca.project_id = pm.project_id 
        AND pca.employer_id = p_employer_id 
        AND pca.is_active = true
      GROUP BY pm.project_id
    )
    SELECT
      js.id,
      js.name,
      js.project_id,
      p.name AS project_name,
      COALESCE(js.address, '') AS address,
      COALESCE(sp.patch_names, ARRAY[]::TEXT[]) AS patch_names,
      COALESCE(so.organiser_names, ARRAY[]::TEXT[]) AS organiser_names,
      COALESCE(pcd.has_assessment, false) AS compliance_check_conducted,
      pcd.latest_rating AS compliance_rating
    FROM project_job_sites js
    JOIN projects p ON p.id = js.project_id
    LEFT JOIN site_patches sp ON sp.site_id = js.id
    LEFT JOIN site_organisers so ON so.site_id = js.id
    LEFT JOIN project_compliance_data pcd ON pcd.project_id = js.project_id

    UNION ALL

    SELECT
      p.id,
      p.name,
      p.id AS project_id,
      p.name AS project_name,
      '' AS address,
      ARRAY[]::TEXT[] AS patch_names,
      ARRAY[]::TEXT[] AS organiser_names,
      COALESCE(pmcd.has_assessment, false) AS compliance_check_conducted,
      pmcd.latest_rating AS compliance_rating
    FROM projects_missing_sites m
    JOIN projects p ON p.id = m.project_id
    LEFT JOIN project_missing_compliance_data pmcd ON pmcd.project_id = m.project_id
    ORDER BY project_name, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


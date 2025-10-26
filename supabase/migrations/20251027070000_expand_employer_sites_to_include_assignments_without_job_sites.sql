CREATE OR REPLACE FUNCTION get_employer_sites(p_employer_id UUID)
RETURNS TABLE(
    id UUID,
    name TEXT,
    project_id UUID,
    project_name TEXT
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
      SELECT js.id, js.name, js.project_id
      FROM job_sites js
      JOIN employer_projects ep ON ep.project_id = js.project_id
    ),
    projects_missing_sites AS (
      SELECT ep.project_id
      FROM employer_projects ep
      LEFT JOIN project_job_sites pjs ON pjs.project_id = ep.project_id
      WHERE pjs.id IS NULL
    )
    SELECT
      js.id,
      js.name,
      js.project_id,
      p.name AS project_name
    FROM project_job_sites js
    JOIN projects p ON p.id = js.project_id

    UNION ALL

    SELECT
      p.id, -- use project id as a stable placeholder uuid
      p.name,
      p.id AS project_id,
      p.name AS project_name
    FROM projects_missing_sites m
    JOIN projects p ON p.id = m.project_id
    ORDER BY project_name, name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

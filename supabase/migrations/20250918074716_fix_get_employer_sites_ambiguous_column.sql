-- Fix the get_employer_sites function to resolve ambiguous column reference
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
    )
    SELECT DISTINCT
      js.id,
      js.name,
      js.project_id,
      p.name AS project_name
    FROM job_sites js
    JOIN projects p ON p.id = js.project_id
    WHERE js.project_id IN (SELECT ep.project_id FROM employer_projects ep)
    ORDER BY p.name, js.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

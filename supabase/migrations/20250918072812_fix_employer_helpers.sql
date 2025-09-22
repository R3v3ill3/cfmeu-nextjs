-- Update worker count helper to use worker_placements
CREATE OR REPLACE FUNCTION get_employer_worker_count(p_employer_id UUID)
RETURNS INT AS $$
DECLARE
    worker_count INT;
BEGIN
    SELECT COUNT(DISTINCT worker_id)
    INTO worker_count
    FROM worker_placements
    WHERE employer_id = p_employer_id
      AND (end_date IS NULL OR end_date >= CURRENT_DATE);

    RETURN worker_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update site helper to avoid ambiguous column references
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
      SELECT DISTINCT pr.id
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
    WHERE js.project_id IN (SELECT project_id FROM employer_projects)
    ORDER BY project_name, js.name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

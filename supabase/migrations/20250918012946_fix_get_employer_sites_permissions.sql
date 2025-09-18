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
        -- Projects where the employer has a direct role
        SELECT project_id
        FROM project_employer_roles
        WHERE employer_id = p_employer_id
        UNION
        -- Projects where the employer is a builder
        SELECT id AS project_id
        FROM projects
        WHERE builder_id = p_employer_id
    )
    SELECT DISTINCT
        js.id,
        js.name,
        js.project_id,
        p.name AS project_name
    FROM job_sites js
    JOIN projects p ON js.project_id = p.id
    WHERE js.project_id IN (SELECT project_id FROM employer_projects)
    ORDER BY p.name, js.name;
END;
$$ LANGUAGE plpgsql SECURITY INVOKER;

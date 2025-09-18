-- Update get_employer_sites to run with definer privileges
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get worker count, bypassing RLS for a simple count
CREATE OR REPLACE FUNCTION get_employer_worker_count(p_employer_id UUID)
RETURNS INT AS $$
DECLARE
    worker_count INT;
BEGIN
    SELECT count(*)
    INTO worker_count
    FROM workers
    WHERE employer_id = p_employer_id;
    RETURN worker_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

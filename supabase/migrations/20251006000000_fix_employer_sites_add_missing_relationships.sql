-- Fix get_employer_sites to include ALL employer-project relationship tables
-- This resolves the issue where employers assigned via BCI imports or manual contractor assignments
-- were not appearing in the Worksites tab of the Employer detail modal.
-- 
-- IMPORTANT: This queries ALL relationship types without changing the underlying database structure.
-- Both project_assignments and project_employer_roles remain separate tables with distinct purposes.

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
      -- 1. Worker placements
      SELECT DISTINCT js.project_id
      FROM worker_placements wp
      JOIN job_sites js ON wp.job_site_id = js.id
      WHERE wp.employer_id = p_employer_id
      
      UNION
      
      -- 2. Direct role assignments via project_employer_roles
      SELECT DISTINCT pe.project_id
      FROM project_employer_roles pe
      WHERE pe.employer_id = p_employer_id
      
      UNION
      
      -- 3. Builder assignments (projects.builder_id)
      SELECT DISTINCT pr.id AS project_id
      FROM projects pr
      WHERE pr.builder_id = p_employer_id
      
      UNION
      
      -- 4. Trade assignments at project level (subcontractors)
      SELECT DISTINCT pct.project_id
      FROM project_contractor_trades pct
      WHERE pct.employer_id = p_employer_id
      
      UNION
      
      -- 5. Trade assignments at site level
      SELECT DISTINCT js.project_id
      FROM site_contractor_trades sct
      JOIN job_sites js ON sct.job_site_id = js.id
      WHERE sct.employer_id = p_employer_id
      
      UNION
      
      -- 6. Contractor role assignments (builders, head contractors, project managers, etc.)
      SELECT DISTINCT pa.project_id
      FROM project_assignments pa
      WHERE pa.employer_id = p_employer_id
        AND pa.assignment_type = 'contractor_role'
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

-- Add comment explaining the function
COMMENT ON FUNCTION get_employer_sites(UUID) IS 
'Returns all job sites (worksites) for an employer across all projects they are connected to.
Includes connections via ALL relationship types: worker placements, project_employer_roles, 
builder assignments (projects.builder_id), project_contractor_trades, site_contractor_trades, 
and project_assignments (contractor roles like builders, head contractors, project managers).
Both project_assignments and project_employer_roles are queried to ensure complete coverage.';

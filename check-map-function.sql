-- Run this in your Supabase SQL Editor to check if the map view function exists
-- This should return one row if the function is properly installed

SELECT 
  proname as function_name,
  pg_get_functiondef(oid) as definition
FROM pg_proc 
WHERE proname = 'get_projects_for_map_view';

-- If the above returns no rows, the function is missing. Run this to create it:

CREATE OR REPLACE FUNCTION get_projects_for_map_view()
RETURNS TABLE (
  id uuid,
  name text,
  latitude double precision,
  longitude double precision,
  tier text,
  organising_universe text,
  stage_class text,
  builder_status text
) AS $$
BEGIN
  RETURN QUERY
  WITH projects_with_main_site AS (
    SELECT
      p.id,
      p.name,
      p.tier,
      p.organising_universe,
      p.stage_class,
      js.latitude,
      js.longitude,
      p.builder_id
    FROM projects p
    JOIN job_sites js ON p.main_job_site_id = js.id
    WHERE js.latitude IS NOT NULL AND js.longitude IS NOT NULL
  ),
  builder_assignments AS (
    SELECT
      pa.project_id,
      MAX(CASE WHEN e.enterprise_agreement_status = true THEN 2
               WHEN e.enterprise_agreement_status = false THEN 1
               ELSE 0
          END) AS eba_status_code
    FROM project_assignments pa
    JOIN contractor_role_types crt ON pa.contractor_role_type_id = crt.id
    JOIN employers e ON pa.employer_id = e.id
    WHERE pa.assignment_type = 'contractor_role'
      AND crt.code IN ('builder', 'head_contractor')
    GROUP BY pa.project_id
  )
  SELECT
    p.id,
    p.name,
    p.latitude,
    p.longitude,
    p.tier::text,
    p.organising_universe::text,
    p.stage_class::text,
    CASE
      WHEN ba.eba_status_code = 2 THEN 'active_builder'
      WHEN ba.eba_status_code = 1 THEN 'inactive_builder'
      WHEN ba.project_id IS NOT NULL THEN 'inactive_builder'
      WHEN p.builder_id IS NOT NULL THEN 'unknown_builder'
      ELSE 'unknown_builder'
    END::text AS builder_status
  FROM projects_with_main_site p
  LEFT JOIN builder_assignments ba ON p.id = ba.project_id;
END;
$$ LANGUAGE plpgsql;

-- Test the function to make sure it works:
SELECT * FROM get_projects_for_map_view() LIMIT 5;


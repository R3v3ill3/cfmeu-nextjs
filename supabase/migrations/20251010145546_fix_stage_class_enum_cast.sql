-- Migration: Fix Stage Class Enum Type Casting
-- Fixes the stage_class enum to text conversion issue

DROP FUNCTION IF EXISTS find_nearby_projects(double precision, double precision, text, integer, double precision);

CREATE OR REPLACE FUNCTION find_nearby_projects(
  search_lat double precision,
  search_lng double precision,
  search_address text DEFAULT NULL,
  max_results integer DEFAULT 5,
  max_distance_km double precision DEFAULT 100
)
RETURNS TABLE (
  project_id uuid,
  project_name text,
  project_tier text,
  job_site_id uuid,
  job_site_name text,
  job_site_address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  is_exact_match boolean,
  builder_name text,
  organising_universe text,
  stage_class text,
  project_value numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  search_point geography;
BEGIN
  -- Create geography point from coordinates
  search_point := ST_SetSRID(ST_MakePoint(search_lng, search_lat), 4326)::geography;

  RETURN QUERY
  WITH project_distances AS (
    SELECT
      p.id as project_id,
      p.name as project_name,
      p.tier as project_tier,
      p.value as project_value,
      p.organising_universe::text as organising_universe,
      p.stage_class::text as stage_class,
      js.id as job_site_id,
      js.name as job_site_name,
      COALESCE(js.full_address, js.location) as job_site_address,
      js.latitude,
      js.longitude,
      -- Calculate distance in kilometers
      ST_Distance(
        search_point,
        ST_SetSRID(ST_MakePoint(js.longitude, js.latitude), 4326)::geography
      ) / 1000.0 as distance_km,
      -- Check for exact or partial address match (case-insensitive)
      CASE
        WHEN search_address IS NOT NULL AND (
          LOWER(COALESCE(js.full_address, js.location)) = LOWER(search_address)
          OR LOWER(COALESCE(js.full_address, js.location)) LIKE '%' || LOWER(search_address) || '%'
        ) THEN true
        ELSE false
      END as is_exact_match,
      -- Get builder name from project_assignments
      (
        SELECT e.name
        FROM project_assignments pa
        JOIN employers e ON e.id = pa.employer_id
        JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
        WHERE pa.project_id = p.id
          AND pa.assignment_type = 'contractor_role'
          AND crt.code IN ('builder', 'head_contractor')
        LIMIT 1
      ) as builder_name
    FROM projects p
    INNER JOIN job_sites js ON js.project_id = p.id
    WHERE js.latitude IS NOT NULL
      AND js.longitude IS NOT NULL
      -- Filter to projects within max radius
      AND ST_DWithin(
        search_point,
        ST_SetSRID(ST_MakePoint(js.longitude, js.latitude), 4326)::geography,
        max_distance_km * 1000 -- Convert km to meters
      )
  )
  SELECT
    pd.project_id,
    pd.project_name,
    pd.project_tier,
    pd.job_site_id,
    pd.job_site_name,
    pd.job_site_address,
    pd.latitude,
    pd.longitude,
    pd.distance_km,
    pd.is_exact_match,
    pd.builder_name,
    pd.organising_universe,
    pd.stage_class,
    pd.project_value
  FROM project_distances pd
  ORDER BY pd.is_exact_match DESC, pd.distance_km ASC
  LIMIT max_results;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION find_nearby_projects(double precision, double precision, text, integer, double precision) TO authenticated;
GRANT EXECUTE ON FUNCTION find_nearby_projects(double precision, double precision, text, integer, double precision) TO anon;

COMMENT ON FUNCTION find_nearby_projects(double precision, double precision, text, integer, double precision) IS
  'Finds projects near given coordinates. Returns exact matches first, then closest by distance. Limited to max_distance_km radius (default 100km). Fixed type casting for both organising_universe and stage_class enums.';

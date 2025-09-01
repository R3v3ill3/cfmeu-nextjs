-- Backfill patch matching for existing job sites with coordinates
-- This migration runs the same spatial matching logic as the trigger
-- for job sites that already have coordinates but no patch assignment

-- 1) Update job sites with patch assignments using spatial matching
UPDATE job_sites 
SET patch_id = (
  SELECT p.id
  FROM patches p
  WHERE p.type = 'geo'
    AND p.status = 'active'
    AND p.geom IS NOT NULL
    AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(job_sites.longitude, job_sites.latitude), 4326))
  LIMIT 1
)
WHERE patch_id IS NULL 
  AND latitude IS NOT NULL 
  AND longitude IS NOT NULL;

-- 2) Sync the patch_job_sites linking table for newly matched sites
INSERT INTO patch_job_sites (patch_id, job_site_id)
SELECT js.patch_id, js.id
FROM job_sites js
LEFT JOIN patch_job_sites pjs 
  ON pjs.patch_id = js.patch_id 
  AND pjs.job_site_id = js.id 
  AND pjs.effective_to IS NULL
WHERE js.patch_id IS NOT NULL 
  AND pjs.job_site_id IS NULL
ON CONFLICT (patch_id, job_site_id) 
WHERE effective_to IS NULL 
DO NOTHING;

-- 3) Create a helper function for manual patch matching from the admin interface
CREATE OR REPLACE FUNCTION public.match_job_sites_to_patches()
RETURNS TABLE (
  sites_processed integer,
  sites_matched integer,
  patches_used integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_processed integer := 0;
  v_matched integer := 0;
  v_patches_used integer := 0;
BEGIN
  -- Count sites before processing
  SELECT COUNT(*) INTO v_processed
  FROM job_sites
  WHERE patch_id IS NULL 
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL;

  -- Run the spatial matching
  UPDATE job_sites 
  SET patch_id = (
    SELECT p.id
    FROM patches p
    WHERE p.type = 'geo'
      AND p.status = 'active'
      AND p.geom IS NOT NULL
      AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(job_sites.longitude, job_sites.latitude), 4326))
    LIMIT 1
  )
  WHERE patch_id IS NULL 
    AND latitude IS NOT NULL 
    AND longitude IS NOT NULL;

  -- Sync the linking table
  INSERT INTO patch_job_sites (patch_id, job_site_id)
  SELECT js.patch_id, js.id
  FROM job_sites js
  LEFT JOIN patch_job_sites pjs 
    ON pjs.patch_id = js.patch_id 
    AND pjs.job_site_id = js.id 
    AND pjs.effective_to IS NULL
  WHERE js.patch_id IS NOT NULL 
    AND pjs.job_site_id IS NULL
  ON CONFLICT (patch_id, job_site_id) 
  WHERE effective_to IS NULL 
  DO NOTHING;

  -- Count results
  SELECT COUNT(*) INTO v_matched
  FROM job_sites
  WHERE patch_id IS NOT NULL;

  SELECT COUNT(DISTINCT patch_id) INTO v_patches_used
  FROM job_sites
  WHERE patch_id IS NOT NULL;

  RETURN QUERY SELECT v_processed, v_matched, v_patches_used;
END;
$$;

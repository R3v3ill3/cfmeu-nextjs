-- Migration: Add overlap/gap detection for patch assignments
-- When patch boundaries change, job sites may end up in overlaps (2+ patches)
-- or gaps (0 patches). This migration adds tracking and detection for those cases.

-- 1. Add patch_assignment_status to job_sites to track assignment quality
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS patch_assignment_status text DEFAULT 'unset'
    CONSTRAINT job_sites_patch_assignment_status_check
      CHECK (patch_assignment_status IN ('clean', 'overlap', 'gap', 'fallback', 'manual', 'unset'));

COMMENT ON COLUMN public.job_sites.patch_assignment_status IS
  'Tracks how this site was assigned to its patch: clean=single match, overlap=multiple patches matched (first picked), gap=no patch matched, fallback=assigned to fallback patch, manual=admin override, unset=legacy/not yet evaluated';

-- 2. Add overlap_patch_ids to store which patches overlapped (for admin resolution)
ALTER TABLE public.job_sites
  ADD COLUMN IF NOT EXISTS overlap_patch_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.job_sites.overlap_patch_ids IS
  'When patch_assignment_status=overlap, stores all matching patch IDs so admin can pick the correct one';

-- 3. Create function to find ALL patches containing a point (not LIMIT 1)
CREATE OR REPLACE FUNCTION public.find_all_patches_for_point(
  p_lng double precision,
  p_lat double precision
) RETURNS TABLE(
  patch_id uuid,
  patch_name text,
  patch_code text
) AS $$
  SELECT p.id, p.name, p.code
  FROM public.patches p
  WHERE p.type = 'geo'
    AND p.status = 'active'
    AND p.geom IS NOT NULL
    AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326))
  ORDER BY p.name;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.find_all_patches_for_point IS
  'Returns ALL patches containing the given point. Used for overlap detection -- if >1 result, the point is in an overlap zone.';

-- 4. Replace the trigger function to detect overlaps and gaps
CREATE OR REPLACE FUNCTION public.job_sites_set_patch_from_coords()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_patch_id uuid;
  v_patch_count integer;
  v_all_patch_ids uuid[];
  v_fallback_patch_id uuid := 'b06b9622-024c-4cd7-8127-e4664f641034';
BEGIN
  -- Only assign if unset and coordinates present
  IF (NEW.patch_id IS NULL) AND (NEW.latitude IS NOT NULL) AND (NEW.longitude IS NOT NULL) THEN

    -- Find ALL matching patches (not just first)
    SELECT array_agg(p.id), count(*)
    INTO v_all_patch_ids, v_patch_count
    FROM public.patches p
    WHERE p.type = 'geo'
      AND p.status = 'active'
      AND p.geom IS NOT NULL
      AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326));

    IF v_patch_count = 1 THEN
      -- Clean single match
      v_patch_id := v_all_patch_ids[1];
      NEW.patch_id := v_patch_id;
      NEW.patch_assignment_status := 'clean';
      NEW.overlap_patch_ids := NULL;

    ELSIF v_patch_count > 1 THEN
      -- Overlap: multiple patches contain this point
      -- Assign to the first one but flag it
      v_patch_id := v_all_patch_ids[1];
      NEW.patch_id := v_patch_id;
      NEW.patch_assignment_status := 'overlap';
      NEW.overlap_patch_ids := v_all_patch_ids;

    ELSE
      -- Gap: no patch contains this point, use fallback
      v_patch_id := v_fallback_patch_id;
      NEW.patch_id := v_fallback_patch_id;
      NEW.patch_assignment_status := 'fallback';
      NEW.overlap_patch_ids := NULL;
    END IF;

    -- Keep link table in sync for downstream UIs
    BEGIN
      INSERT INTO public.patch_job_sites (patch_id, job_site_id)
      VALUES (v_patch_id, NEW.id)
      ON CONFLICT (patch_id, job_site_id)
        WHERE effective_to IS NULL
      DO NOTHING;
    EXCEPTION WHEN OTHERS THEN
      -- ignore duplicates or partial index differences
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Create a function to re-evaluate all job sites against current patch boundaries
-- Useful after patch boundaries are redrawn in the editor
CREATE OR REPLACE FUNCTION public.reevaluate_patch_assignments()
RETURNS TABLE(
  total_sites integer,
  clean_count integer,
  overlap_count integer,
  gap_count integer,
  unchanged_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total integer := 0;
  v_clean integer := 0;
  v_overlap integer := 0;
  v_gap integer := 0;
  v_unchanged integer := 0;
  v_site record;
  v_patch_ids uuid[];
  v_patch_count integer;
  v_old_patch_id uuid;
BEGIN
  FOR v_site IN
    SELECT js.id, js.latitude, js.longitude, js.patch_id, js.patch_assignment_status
    FROM job_sites js
    WHERE js.latitude IS NOT NULL
      AND js.longitude IS NOT NULL
      -- Skip manually assigned sites
      AND (js.patch_assignment_status IS NULL OR js.patch_assignment_status != 'manual')
  LOOP
    v_total := v_total + 1;
    v_old_patch_id := v_site.patch_id;

    -- Find all matching patches
    SELECT array_agg(p.id), count(*)
    INTO v_patch_ids, v_patch_count
    FROM patches p
    WHERE p.type = 'geo'
      AND p.status = 'active'
      AND p.geom IS NOT NULL
      AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(v_site.longitude, v_site.latitude), 4326));

    IF v_patch_count = 1 THEN
      UPDATE job_sites
      SET patch_id = v_patch_ids[1],
          patch_assignment_status = 'clean',
          overlap_patch_ids = NULL,
          updated_at = now()
      WHERE id = v_site.id;
      v_clean := v_clean + 1;

      -- Update linking table if patch changed
      IF v_old_patch_id IS DISTINCT FROM v_patch_ids[1] THEN
        -- Close old assignment
        UPDATE patch_job_sites
        SET effective_to = now()
        WHERE job_site_id = v_site.id
          AND effective_to IS NULL
          AND patch_id IS DISTINCT FROM v_patch_ids[1];

        -- Create new assignment
        INSERT INTO patch_job_sites (patch_id, job_site_id)
        VALUES (v_patch_ids[1], v_site.id)
        ON CONFLICT (patch_id, job_site_id)
          WHERE effective_to IS NULL
        DO NOTHING;
      END IF;

    ELSIF v_patch_count > 1 THEN
      UPDATE job_sites
      SET patch_id = v_patch_ids[1],
          patch_assignment_status = 'overlap',
          overlap_patch_ids = v_patch_ids,
          updated_at = now()
      WHERE id = v_site.id;
      v_overlap := v_overlap + 1;

      -- Update linking table if needed
      IF v_old_patch_id IS DISTINCT FROM v_patch_ids[1] THEN
        UPDATE patch_job_sites
        SET effective_to = now()
        WHERE job_site_id = v_site.id
          AND effective_to IS NULL
          AND patch_id IS DISTINCT FROM v_patch_ids[1];

        INSERT INTO patch_job_sites (patch_id, job_site_id)
        VALUES (v_patch_ids[1], v_site.id)
        ON CONFLICT (patch_id, job_site_id)
          WHERE effective_to IS NULL
        DO NOTHING;
      END IF;

    ELSE
      -- Gap: no patch found
      UPDATE job_sites
      SET patch_assignment_status = 'gap',
          overlap_patch_ids = NULL,
          updated_at = now()
      WHERE id = v_site.id;
      v_gap := v_gap + 1;
      -- Don't change the patch_id -- leave whatever was assigned before
    END IF;

    -- Track unchanged
    IF v_old_patch_id IS NOT DISTINCT FROM (
      SELECT js2.patch_id FROM job_sites js2 WHERE js2.id = v_site.id
    ) THEN
      v_unchanged := v_unchanged + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_total, v_clean, v_overlap, v_gap, v_unchanged;
END;
$$;

COMMENT ON FUNCTION public.reevaluate_patch_assignments IS
  'Re-evaluates all job site patch assignments against current patch boundaries. Call after redrawing patch boundaries. Skips manually-assigned sites. Returns counts of clean/overlap/gap assignments.';

-- 6. Backfill: set existing assigned sites to "clean" status (assume current assignments are correct)
UPDATE public.job_sites
SET patch_assignment_status = 'clean'
WHERE patch_id IS NOT NULL
  AND patch_assignment_status = 'unset'
  AND latitude IS NOT NULL
  AND longitude IS NOT NULL;

-- Set sites with no patch and no coordinates to 'unset'
UPDATE public.job_sites
SET patch_assignment_status = 'unset'
WHERE (latitude IS NULL OR longitude IS NULL)
  AND patch_assignment_status = 'unset';

-- Set sites assigned to the fallback patch to 'fallback'
UPDATE public.job_sites
SET patch_assignment_status = 'fallback'
WHERE patch_id = 'b06b9622-024c-4cd7-8127-e4664f641034'
  AND patch_assignment_status = 'clean';

-- 7. Index for quick lookup of problem assignments
CREATE INDEX IF NOT EXISTS idx_job_sites_patch_assignment_status
  ON public.job_sites (patch_assignment_status)
  WHERE patch_assignment_status IN ('overlap', 'gap', 'fallback');

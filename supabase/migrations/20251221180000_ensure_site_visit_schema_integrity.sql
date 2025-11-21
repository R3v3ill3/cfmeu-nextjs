-- Ensure site_visit table has complete schema with integrity constraints
-- This migration ensures the enhancement columns exist and adds validation

-- =============================================
-- 1. Ensure all enhanced columns exist (idempotent)
-- =============================================

-- These should already exist from 20251016170000_enhance_site_visits.sql
-- but we ensure they're present in case migration was skipped
ALTER TABLE IF EXISTS public.site_visit
  ADD COLUMN IF NOT EXISTS date timestamptz DEFAULT now() NOT NULL,
  ADD COLUMN IF NOT EXISTS organiser_id uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS actions_taken text,
  ADD COLUMN IF NOT EXISTS visit_status text DEFAULT 'completed' NOT NULL,
  ADD COLUMN IF NOT EXISTS offline_created boolean DEFAULT false NOT NULL,
  ADD COLUMN IF NOT EXISTS synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS attachments_meta jsonb DEFAULT '[]'::jsonb;

-- =============================================
-- 2. Add data integrity validation via trigger
-- =============================================

-- Create function to validate project_id matches job_site's project
CREATE OR REPLACE FUNCTION public.validate_site_visit_project_match()
RETURNS TRIGGER AS $$
DECLARE
  v_job_site_project_id uuid;
BEGIN
  -- If project_id is NULL, allow it (optional field)
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the project_id from the job_site
  SELECT project_id INTO v_job_site_project_id
  FROM public.job_sites
  WHERE id = NEW.job_site_id;

  -- Check if project_id matches
  IF v_job_site_project_id IS NULL THEN
    RAISE EXCEPTION 'Invalid job_site_id: site does not exist';
  END IF;

  IF NEW.project_id != v_job_site_project_id THEN
    RAISE EXCEPTION 'project_id (%) does not match the project of job_site_id (%). Expected project_id: %',
      NEW.project_id, NEW.job_site_id, v_job_site_project_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for re-running migration)
DROP TRIGGER IF EXISTS validate_site_visit_project_match_trigger ON public.site_visit;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER validate_site_visit_project_match_trigger
  BEFORE INSERT OR UPDATE OF project_id, job_site_id
  ON public.site_visit
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_site_visit_project_match();

-- =============================================
-- 3. Backfill project_id from job_site_id
-- =============================================

-- For any existing records without project_id, derive it from job_site
UPDATE public.site_visit sv
SET project_id = js.project_id
FROM public.job_sites js
WHERE sv.job_site_id = js.id
  AND sv.project_id IS NULL;

-- =============================================
-- 4. Add indexes if missing
-- =============================================

CREATE INDEX IF NOT EXISTS idx_site_visit_date 
  ON public.site_visit(date DESC);
CREATE INDEX IF NOT EXISTS idx_site_visit_project 
  ON public.site_visit(project_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_job_site 
  ON public.site_visit(job_site_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_organiser 
  ON public.site_visit(organiser_id);
CREATE INDEX IF NOT EXISTS idx_site_visit_status 
  ON public.site_visit(visit_status);
CREATE INDEX IF NOT EXISTS idx_site_visit_created_by 
  ON public.site_visit(created_by);

-- =============================================
-- 5. Add comments for documentation
-- =============================================

COMMENT ON FUNCTION public.validate_site_visit_project_match() IS 
  'Validates that site_visit.project_id matches the project of the associated job_site to maintain data integrity';

COMMENT ON TRIGGER validate_site_visit_project_match_trigger ON public.site_visit IS
  'Ensures project_id matches job_site project on INSERT/UPDATE';



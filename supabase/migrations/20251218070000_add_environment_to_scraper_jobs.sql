-- Add environment isolation for scraper jobs
-- This prevents multiple workers (local + Railway) from competing over the same queue.

ALTER TABLE public.scraper_jobs
  ADD COLUMN IF NOT EXISTS environment text;

ALTER TABLE public.scraper_jobs
  ALTER COLUMN environment SET DEFAULT 'production';

-- Backfill existing rows
UPDATE public.scraper_jobs
  SET environment = 'production'
  WHERE environment IS NULL;

-- Helpful index for workers polling queued jobs
CREATE INDEX IF NOT EXISTS scraper_jobs_environment_status_run_at_idx
  ON public.scraper_jobs (environment, status, run_at);


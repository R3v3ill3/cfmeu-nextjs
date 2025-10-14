-- Align scraper_jobs table with application expectations
ALTER TABLE scraper_jobs
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5;

ALTER TABLE scraper_jobs
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Ensure existing rows respect NOT NULL constraint after adding the column
UPDATE scraper_jobs
SET priority = COALESCE(priority, 5);

CREATE INDEX IF NOT EXISTS idx_scraper_jobs_priority
  ON scraper_jobs(priority);

COMMENT ON COLUMN scraper_jobs.priority IS 'Lower value means higher processing priority (1-10).';

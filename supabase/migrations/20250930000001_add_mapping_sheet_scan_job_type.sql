-- Add mapping_sheet_scan to scraper_job_type enum
ALTER TYPE scraper_job_type ADD VALUE IF NOT EXISTS 'mapping_sheet_scan';

-- Add mapping_sheet_scan to scraper_job_status enum if needed (for completeness)
-- Note: This may already have the values we need, but adding for safety
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'scraper_job_status') THEN
    CREATE TYPE scraper_job_status AS ENUM ('queued', 'processing', 'succeeded', 'failed');
  END IF;
END $$;

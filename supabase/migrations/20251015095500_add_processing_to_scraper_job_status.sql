-- Allow workers to use the newer processing status when locking jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'scraper_job_status'
      AND e.enumlabel = 'processing'
  ) THEN
    ALTER TYPE public.scraper_job_status ADD VALUE 'processing';
  END IF;
END $$;

COMMENT ON TYPE public.scraper_job_status IS 'Queue status values for scraper jobs (includes legacy running + new processing state).';

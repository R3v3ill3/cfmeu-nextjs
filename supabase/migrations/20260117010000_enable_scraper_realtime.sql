-- Enable Supabase Realtime for scraper job tables
-- This allows the UI to receive real-time updates when job status/events change

-- Add scraper_jobs table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraper_jobs;

-- Add scraper_job_events table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.scraper_job_events;

COMMENT ON TABLE public.scraper_jobs IS 'Durable job queue for scraper workers (FWC, Incolink). Realtime enabled for progress tracking.';
COMMENT ON TABLE public.scraper_job_events IS 'Audit trail for scraper job lifecycle changes. Realtime enabled for progress tracking.';

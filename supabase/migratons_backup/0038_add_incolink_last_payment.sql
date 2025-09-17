-- Track last known Incolink payment date at worker and employer level

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS last_incolink_payment date;

COMMENT ON COLUMN public.workers.last_incolink_payment IS 'Date of the most recent Incolink invoice observed for this worker.';

ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS last_incolink_payment date;

COMMENT ON COLUMN public.employers.last_incolink_payment IS 'Date of the most recent Incolink invoice observed for this employer.';



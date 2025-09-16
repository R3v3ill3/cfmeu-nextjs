-- Add Incolink member identifier to workers

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS incolink_member_id text;

-- Ensure uniqueness when present
CREATE UNIQUE INDEX IF NOT EXISTS workers_incolink_member_id_unique
  ON public.workers (incolink_member_id)
  WHERE incolink_member_id IS NOT NULL;

COMMENT ON COLUMN public.workers.incolink_member_id IS 'Membership number from Incolink; used to match/import workers from ComplianceLink invoices';



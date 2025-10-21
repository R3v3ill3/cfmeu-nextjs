-- Add source tracking and metadata for employer EBA status overrides

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'eba_status_source'
  ) THEN
    CREATE TYPE public.eba_status_source AS ENUM (
      'unknown',
      'fwc_scraper',
      'import',
      'manual'
    );
  END IF;
END $$;

ALTER TABLE public.employers
  ADD COLUMN IF NOT EXISTS eba_status_source public.eba_status_source DEFAULT 'unknown'::public.eba_status_source,
  ADD COLUMN IF NOT EXISTS eba_status_updated_at timestamptz DEFAULT timezone('utc', now()),
  ADD COLUMN IF NOT EXISTS eba_status_notes text;

COMMENT ON COLUMN public.employers.eba_status_source IS 'Provenance of the current enterprise_agreement_status value.';
COMMENT ON COLUMN public.employers.eba_status_updated_at IS 'UTC timestamp when enterprise_agreement_status was last updated.';
COMMENT ON COLUMN public.employers.eba_status_notes IS 'Optional notes explaining manual overrides or adjustments to enterprise_agreement_status.';

-- Ensure existing TRUE statuses are attributed to the scraper if we have recent certified records
WITH recent_eba AS (
  SELECT DISTINCT employer_id
  FROM public.company_eba_records r
  WHERE r.fwc_certified_date IS NOT NULL
    AND r.fwc_certified_date >= (CURRENT_DATE - INTERVAL '4 years')
)
UPDATE public.employers e
SET eba_status_source = 'fwc_scraper'
WHERE e.enterprise_agreement_status IS TRUE
  AND e.eba_status_source = 'unknown'
  AND EXISTS (SELECT 1 FROM recent_eba r WHERE r.employer_id = e.id);

-- Default remaining TRUE statuses to import
UPDATE public.employers e
SET eba_status_source = 'import'
WHERE e.enterprise_agreement_status IS TRUE
  AND e.eba_status_source = 'unknown';

-- Ensure updated timestamps are populated
UPDATE public.employers
SET eba_status_updated_at = COALESCE(eba_status_updated_at, timezone('utc', now()));

GRANT USAGE ON TYPE public.eba_status_source TO anon, authenticated, service_role;


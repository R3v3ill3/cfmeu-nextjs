-- Update refresh_employer_eba_status to respect manual overrides while using the new canonical setter

CREATE OR REPLACE FUNCTION public.refresh_employer_eba_status(p_employer_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_employer public.employers%ROWTYPE;
  v_has_recent boolean;
BEGIN
  SELECT * INTO v_employer
  FROM public.employers
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.company_eba_records r
    WHERE r.employer_id = p_employer_id
      AND r.fwc_certified_date IS NOT NULL
      AND r.fwc_certified_date >= (CURRENT_DATE - INTERVAL '4 years')
  ) INTO v_has_recent;

  IF v_has_recent THEN
    IF v_employer.enterprise_agreement_status IS DISTINCT FROM TRUE
       OR v_employer.eba_status_source IN ('unknown', 'fwc_scraper', 'import')
    THEN
      PERFORM public.set_employer_eba_status(
        p_employer_id,
        TRUE,
        'fwc_scraper',
        'Auto-updated from FWC certification refresh'
      );
    END IF;
  ELSE
    IF v_employer.enterprise_agreement_status IS TRUE
       AND v_employer.eba_status_source IN ('unknown', 'fwc_scraper', 'import')
    THEN
      PERFORM public.set_employer_eba_status(
        p_employer_id,
        FALSE,
        'fwc_scraper',
        'FWC certifications expired; auto-cleared'
      );
    END IF;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.refresh_employer_eba_status(uuid)
  IS 'Ensures enterprise_agreement_status matches recent FWC data while respecting manual overrides.';


CREATE OR REPLACE FUNCTION public.set_employer_eba_status(
  p_employer_id uuid,
  p_status boolean,
  p_source public.eba_status_source,
  p_notes text DEFAULT NULL
)
RETURNS public.employers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current public.employers%ROWTYPE;
  v_has_recent_fwc boolean;
BEGIN
  SELECT * INTO v_current
  FROM public.employers
  WHERE id = p_employer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Employer % not found', p_employer_id USING ERRCODE = 'NO_DATA_FOUND';
  END IF;

  IF v_current.enterprise_agreement_status IS TRUE
     AND p_status IS FALSE
  THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.company_eba_records r
      WHERE r.employer_id = p_employer_id
        AND r.fwc_certified_date IS NOT NULL
        AND r.fwc_certified_date >= (CURRENT_DATE - INTERVAL '4 years')
    ) INTO v_has_recent_fwc;

    IF v_has_recent_fwc THEN
      RAISE EXCEPTION 'Employer % has a recent FWC certification and cannot be downgraded without override', p_employer_id
        USING ERRCODE = 'RAISE_EXCEPTION', HINT = 'Clear FWC certification or supply manual override via notes.';
    END IF;
  END IF;

  UPDATE public.employers
  SET enterprise_agreement_status = p_status,
      eba_status_source = COALESCE(p_source, 'unknown'),
      eba_status_notes = p_notes,
      eba_status_updated_at = timezone('utc', now())
  WHERE id = p_employer_id
  RETURNING * INTO v_current;

  RETURN v_current;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_employer_eba_status(uuid, boolean, public.eba_status_source, text)
  TO anon, authenticated, service_role;


-- Retroactively sync enterprise_agreement_status for employers with existing EBA records
-- This fixes employers that had EBA records created via the manual "EBA Project Search"
-- function (in Administration -> Data Management -> Employers) before the fix was applied

DO $$
DECLARE
  v_employer_id uuid;
  v_employer_name text;
  v_updated_count integer := 0;
  v_skipped_count integer := 0;
  v_has_recent_cert boolean;
BEGIN
  RAISE NOTICE 'Starting retroactive EBA status sync for manually uploaded records...';

  -- Find all employers that have company_eba_records but enterprise_agreement_status is not TRUE
  -- This catches employers affected by the bug where the manual upload didn't set the boolean
  FOR v_employer_id, v_employer_name IN
    SELECT DISTINCT e.id, e.name
    FROM public.employers e
    INNER JOIN public.company_eba_records cer ON cer.employer_id = e.id
    WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE
    ORDER BY e.name
  LOOP
    -- Check if this employer has a recent FWC certification (within 4 years)
    SELECT EXISTS (
      SELECT 1
      FROM public.company_eba_records r
      WHERE r.employer_id = v_employer_id
        AND r.fwc_certified_date IS NOT NULL
        AND r.fwc_certified_date >= (CURRENT_DATE - INTERVAL '4 years')
    ) INTO v_has_recent_cert;

    IF v_has_recent_cert THEN
      -- Update the canonical status using the proper function
      PERFORM public.set_employer_eba_status(
        v_employer_id,
        TRUE,
        'import',  -- Use 'import' source since these were manually uploaded
        'Retroactive sync from existing EBA records (migration 20251022120000)'
      );

      v_updated_count := v_updated_count + 1;
      RAISE NOTICE 'Updated employer: % (ID: %)', v_employer_name, v_employer_id;
    ELSE
      v_skipped_count := v_skipped_count + 1;
      RAISE NOTICE 'Skipped employer (no recent cert): % (ID: %)', v_employer_name, v_employer_id;
    END IF;
  END LOOP;

  RAISE NOTICE '✅ Sync complete: % employers updated, % skipped (no recent certification)', v_updated_count, v_skipped_count;
END $$;

-- Refresh the materialized view to reflect the changes
REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;

-- Report summary
SELECT
  COUNT(*) FILTER (WHERE enterprise_agreement_status = TRUE) as employers_with_eba,
  COUNT(*) FILTER (WHERE enterprise_agreement_status IS DISTINCT FROM TRUE) as employers_without_eba,
  COUNT(*) as total_employers_with_eba_records
FROM public.employers e
WHERE EXISTS (
  SELECT 1 FROM public.company_eba_records cer WHERE cer.employer_id = e.id
);

-- Retroactively sync enterprise_agreement_status for ALL employers with existing EBA records
-- This is a less conservative approach - if they have an EBA record, mark them as having an EBA

DO $$
DECLARE
  v_employer_id uuid;
  v_employer_name text;
  v_cert_date date;
  v_comments text;
  v_updated_count integer := 0;
  v_error_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting retroactive EBA status sync (all records)...';

  -- Find all employers that have company_eba_records but enterprise_agreement_status is not TRUE
  FOR v_employer_id, v_employer_name, v_cert_date, v_comments IN
    SELECT DISTINCT
      e.id,
      e.name,
      MAX(cer.fwc_certified_date) as latest_cert_date,
      MAX(cer.comments) as latest_comments
    FROM public.employers e
    INNER JOIN public.company_eba_records cer ON cer.employer_id = e.id
    WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE
    GROUP BY e.id, e.name
    ORDER BY e.name
  LOOP
    BEGIN
      -- Determine source based on how the record was created
      DECLARE
        v_source text;
      BEGIN
        IF v_comments LIKE '%Auto-imported from FWC%' THEN
          v_source := 'fwc_scraper';
        ELSE
          v_source := 'import';  -- Manual uploads or legacy imports
        END IF;

        -- Update the canonical status using the proper function
        PERFORM public.set_employer_eba_status(
          v_employer_id,
          TRUE,
          v_source::public.eba_status_source,
          CONCAT(
            'Retroactive sync from existing EBA record (migration 20251022120001). ',
            'Cert date: ', COALESCE(v_cert_date::text, 'none')
          )
        );

        v_updated_count := v_updated_count + 1;

        IF v_cert_date IS NULL THEN
          RAISE NOTICE 'Updated employer (no cert date): % (ID: %)', v_employer_name, v_employer_id;
        ELSE
          RAISE NOTICE 'Updated employer: % (ID: %, cert: %)', v_employer_name, v_employer_id, v_cert_date;
        END IF;
      END;
    EXCEPTION
      WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Failed to update employer: % (ID: %) - Error: %', v_employer_name, v_employer_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE '✅ Sync complete: % employers updated, % errors', v_updated_count, v_error_count;
END $$;

-- Refresh the materialized view to reflect the changes
REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;

-- Report summary
DO $$
DECLARE
  v_with_eba integer;
  v_without_eba integer;
  v_total integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE e.enterprise_agreement_status = TRUE),
    COUNT(*) FILTER (WHERE e.enterprise_agreement_status IS DISTINCT FROM TRUE),
    COUNT(*)
  INTO v_with_eba, v_without_eba, v_total
  FROM public.employers e
  WHERE EXISTS (
    SELECT 1 FROM public.company_eba_records cer WHERE cer.employer_id = e.id
  );

  RAISE NOTICE '📊 Summary of employers with EBA records:';
  RAISE NOTICE '   ✅ With canonical status TRUE: %', v_with_eba;
  RAISE NOTICE '   ❌ Without canonical status: %', v_without_eba;
  RAISE NOTICE '   📝 Total employers with EBA records: %', v_total;
END $$;

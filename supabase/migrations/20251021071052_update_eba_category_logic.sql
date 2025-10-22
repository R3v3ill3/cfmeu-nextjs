-- Fix eba_category computation to use only the canonical boolean for 'active' status
-- This migration recreates the employers_search_optimized materialized view with
-- corrected logic where 'active' status comes ONLY from enterprise_agreement_status
-- FWC company_eba_records serve as evidence/provenance, not as fallback status

-- Drop dependent objects first
DROP VIEW IF EXISTS public.employers_search_view_status CASCADE;
DROP FUNCTION IF EXISTS public.refresh_employers_search_view_logged(text) CASCADE;
DROP FUNCTION IF EXISTS public.refresh_employers_search_view() CASCADE;

-- Drop and recreate the materialized view with fixed logic
DROP MATERIALIZED VIEW IF EXISTS public.employers_search_optimized CASCADE;

CREATE MATERIALIZED VIEW public.employers_search_optimized AS
SELECT
  e.id,
  e.name,
  e.abn,
  e.employer_type,
  e.website,
  e.email,
  e.phone,
  e.estimated_worker_count,
  e.incolink_id,
  e.bci_company_id,
  e.enterprise_agreement_status,
  e.eba_status_source,
  e.eba_status_updated_at,
  e.eba_status_notes,
  e.address_line_1,
  e.address_line_2,
  e.suburb,
  e.state,
  e.postcode,
  e.primary_contact_name,
  e.contact_notes,
  e.parent_employer_id,
  e.created_at,
  e.updated_at,
  (
    EXISTS(SELECT 1 FROM public.worker_placements wp WHERE wp.employer_id = e.id LIMIT 1)
    OR EXISTS(SELECT 1 FROM public.project_assignments pa WHERE pa.employer_id = e.id LIMIT 1)
  ) AS is_engaged,
  (SELECT COUNT(*)::int FROM public.worker_placements wp WHERE wp.employer_id = e.id) AS actual_worker_count,
  (SELECT COUNT(*)::int FROM public.project_assignments pa WHERE pa.employer_id = e.id) AS project_count,
  CASE
    -- eba_category now represents FWC workflow status (secondary badge)
    -- certified: FWC certification found via scraping
    -- lodged: Lodged with FWC
    -- pending: EBA negotiation in progress
    -- no_fwc_match: No FWC records found (doesn't mean no EBA)
    WHEN EXISTS(
      SELECT 1 FROM public.company_eba_records r
      WHERE r.employer_id = e.id
        AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
      LIMIT 1
    ) THEN 'certified'
    WHEN EXISTS(
      SELECT 1 FROM public.company_eba_records r
      WHERE r.employer_id = e.id
        AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
      LIMIT 1
    ) THEN 'lodged'
    WHEN EXISTS(
      SELECT 1 FROM public.company_eba_records r
      WHERE r.employer_id = e.id
        AND (
          r.date_eba_signed > (CURRENT_DATE - INTERVAL '6 months')
          OR r.date_vote_occurred > (CURRENT_DATE - INTERVAL '6 months')
          OR r.eba_data_form_received IS NOT NULL
          OR r.date_draft_signing_sent IS NOT NULL
          OR r.date_barg_docs_sent IS NOT NULL
        )
      LIMIT 1
    ) THEN 'pending'
    ELSE 'no_fwc_match'
  END AS eba_category,
  COALESCE((
    SELECT MAX(GREATEST(
      EXTRACT(EPOCH FROM r.fwc_certified_date),
      EXTRACT(EPOCH FROM r.eba_lodged_fwc),
      EXTRACT(EPOCH FROM r.date_eba_signed),
      EXTRACT(EPOCH FROM r.date_vote_occurred)
    ))
    FROM public.company_eba_records r
    WHERE r.employer_id = e.id
  ), 0) AS eba_recency_score,
  (
    SELECT MAX(GREATEST(
      r.fwc_certified_date,
      r.eba_lodged_fwc,
      r.date_eba_signed,
      r.date_vote_occurred
    ))
    FROM public.company_eba_records r
    WHERE r.employer_id = e.id
  ) AS most_recent_eba_date,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'status', r.status,
        'nominal_expiry_date', r.nominal_expiry_date,
        'fwc_certified_date', r.fwc_certified_date,
        'eba_lodged_fwc', r.eba_lodged_fwc,
        'date_eba_signed', r.date_eba_signed,
        'date_vote_occurred', r.date_vote_occurred,
        'eba_data_form_received', r.eba_data_form_received,
        'date_draft_signing_sent', r.date_draft_signing_sent,
        'date_barg_docs_sent', r.date_barg_docs_sent
      ) ORDER BY GREATEST(
        r.fwc_certified_date,
        r.eba_lodged_fwc,
        r.date_eba_signed,
        r.date_vote_occurred
      ) DESC NULLS LAST
    )
    FROM public.company_eba_records r
    WHERE r.employer_id = e.id
  ), '[]'::jsonb) AS company_eba_records_json,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', wp.id))
    FROM public.worker_placements wp
    WHERE wp.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) AS worker_placements_json,
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', pa.id))
    FROM public.project_assignments pa
    WHERE pa.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) AS project_assignments_json,
  e.incolink_last_matched,
  LOWER(e.name) AS name_lower,
  NOW() AS view_refreshed_at
FROM public.employers e;

-- Recreate indexes
CREATE UNIQUE INDEX idx_emp_search_opt_id
  ON public.employers_search_optimized(id);
CREATE INDEX idx_emp_search_opt_engaged
  ON public.employers_search_optimized(is_engaged)
  WHERE is_engaged = true;
CREATE INDEX idx_emp_search_opt_eba_category
  ON public.employers_search_optimized(eba_category);
CREATE INDEX idx_emp_search_opt_employer_type
  ON public.employers_search_optimized(employer_type);
CREATE INDEX idx_emp_search_opt_name_lower
  ON public.employers_search_optimized(name_lower);
CREATE INDEX idx_emp_search_opt_name_pattern
  ON public.employers_search_optimized(name text_pattern_ops);
CREATE INDEX idx_emp_search_opt_name_trgm
  ON public.employers_search_optimized USING gin(name gin_trgm_ops);
CREATE INDEX idx_emp_search_opt_engaged_eba_type
  ON public.employers_search_optimized(is_engaged, eba_category, employer_type)
  WHERE is_engaged = true;
CREATE INDEX idx_emp_search_opt_estimated_workers
  ON public.employers_search_optimized(estimated_worker_count DESC NULLS LAST);
CREATE INDEX idx_emp_search_opt_eba_recency
  ON public.employers_search_optimized(eba_recency_score DESC);
CREATE INDEX idx_emp_search_opt_abn
  ON public.employers_search_optimized(abn)
  WHERE abn IS NOT NULL;
CREATE INDEX idx_emp_search_opt_bci_id
  ON public.employers_search_optimized(LOWER(bci_company_id))
  WHERE bci_company_id IS NOT NULL;
CREATE INDEX idx_emp_search_opt_incolink_id
  ON public.employers_search_optimized(LOWER(incolink_id))
  WHERE incolink_id IS NOT NULL;

-- Recreate helper functions
CREATE OR REPLACE FUNCTION public.refresh_employers_search_view()
RETURNS TABLE (
  success boolean,
  duration_ms integer,
  rows_refreshed bigint,
  last_refresh timestamptz,
  message text
) AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_row_count bigint;
  v_duration_ms integer;
BEGIN
  v_start_time := clock_timestamp();

  REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

  SELECT COUNT(*) INTO v_row_count
  FROM public.employers_search_optimized;

  RAISE NOTICE 'Materialized view refreshed: % rows in %ms', v_row_count, v_duration_ms;

  IF v_duration_ms > 30000 THEN
    RAISE WARNING 'Slow materialized view refresh detected: %ms', v_duration_ms;
  END IF;

  RETURN QUERY
  SELECT
    true AS success,
    v_duration_ms AS duration_ms,
    v_row_count AS rows_refreshed,
    NOW() AS last_refresh,
    format('Refreshed %s rows in %sms', v_row_count, v_duration_ms) AS message;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to refresh materialized view: %', SQLERRM;

  RETURN QUERY
  SELECT
    false AS success,
    0 AS duration_ms,
    0::bigint AS rows_refreshed,
    NOW() AS last_refresh,
    format('Error: %s', SQLERRM) AS message;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_employers_search_view_logged(
  p_triggered_by text DEFAULT 'manual'
)
RETURNS TABLE (
  success boolean,
  duration_ms integer,
  rows_refreshed bigint,
  last_refresh timestamptz,
  message text
) AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_row_count bigint;
  v_duration_ms integer;
  v_success boolean := true;
  v_error_msg text := NULL;
BEGIN
  v_start_time := clock_timestamp();

  BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.employers_search_optimized;

    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    SELECT COUNT(*) INTO v_row_count
    FROM public.employers_search_optimized;

    INSERT INTO public.mat_view_refresh_log (
      view_name, duration_ms, rows_refreshed, success, triggered_by
    ) VALUES (
      'employers_search_optimized', v_duration_ms, v_row_count, true, p_triggered_by
    );

    RAISE NOTICE 'Materialized view refreshed: % rows in %ms (triggered by: %)',
      v_row_count, v_duration_ms, p_triggered_by;

    IF v_duration_ms > 30000 THEN
      RAISE WARNING 'Slow materialized view refresh detected: %ms', v_duration_ms;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_success := false;
    v_error_msg := SQLERRM;
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;

    INSERT INTO public.mat_view_refresh_log (
      view_name, duration_ms, success, error_message, triggered_by
    ) VALUES (
      'employers_search_optimized', v_duration_ms, false, v_error_msg, p_triggered_by
    );

    RAISE WARNING 'Failed to refresh materialized view: %', v_error_msg;
  END;

  RETURN QUERY
  SELECT
    v_success AS success,
    COALESCE(v_duration_ms, 0) AS duration_ms,
    COALESCE(v_row_count, 0::bigint) AS rows_refreshed,
    NOW() AS last_refresh,
    CASE
      WHEN v_success THEN format('Refreshed %s rows in %sms', v_row_count, v_duration_ms)
      ELSE format('Error: %s', v_error_msg)
    END AS message;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW public.employers_search_view_status AS
SELECT
  'employers_search_optimized'::text AS view_name,
  (SELECT view_refreshed_at FROM public.employers_search_optimized LIMIT 1) AS last_refresh,
  NOW() - (SELECT view_refreshed_at FROM public.employers_search_optimized LIMIT 1) AS staleness,
  pg_size_pretty(pg_total_relation_size('public.employers_search_optimized')) AS total_size,
  pg_size_pretty(pg_relation_size('public.employers_search_optimized')) AS table_size,
  pg_size_pretty(pg_total_relation_size('public.employers_search_optimized') - pg_relation_size('public.employers_search_optimized')) AS indexes_size,
  (SELECT COUNT(*) FROM public.employers_search_optimized) AS row_count,
  (SELECT COUNT(*) FROM public.employers) AS source_row_count,
  CASE
    WHEN (NOW() - (SELECT view_refreshed_at FROM public.employers_search_optimized LIMIT 1)) > INTERVAL '10 minutes'
    THEN 'STALE - Refresh needed'
    WHEN (NOW() - (SELECT view_refreshed_at FROM public.employers_search_optimized LIMIT 1)) > INTERVAL '5 minutes'
    THEN 'WARNING - Approaching stale'
    ELSE 'OK'
  END AS health_status;

-- Grant permissions
GRANT SELECT ON public.employers_search_optimized TO authenticated;
GRANT SELECT ON public.employers_search_view_status TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_employers_search_view() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refresh_employers_search_view_logged(text) TO authenticated, service_role;

-- Add comments
COMMENT ON MATERIALIZED VIEW public.employers_search_optimized IS
  'Optimized view for employer search/list with precomputed filters. EBA active status comes ONLY from enterprise_agreement_status boolean. Refresh every 5 minutes.';
COMMENT ON FUNCTION public.refresh_employers_search_view() IS
  'Refreshes the employers_search_optimized materialized view. Returns refresh statistics.';
COMMENT ON FUNCTION public.refresh_employers_search_view_logged(text) IS
  'Refreshes the employers_search_optimized materialized view and logs the outcome in mat_view_refresh_log.';
COMMENT ON VIEW public.employers_search_view_status IS
  'Monitoring view showing refresh status, staleness, and size of employers_search_optimized.';

-- Initial refresh
REFRESH MATERIALIZED VIEW public.employers_search_optimized;

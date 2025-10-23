-- ============================================================================
-- EMPLOYERS COMPREHENSIVE MATERIALIZED VIEW
-- Purpose: Single view with ALL enhanced data (projects, organisers, categories)
-- Replaces: Multiple separate queries in fetchEnhancedEmployerData()
-- Performance: 2-3s → 300-500ms (eliminates 3-4 secondary queries)
-- ============================================================================

-- Drop existing view if needed (will be recreated with enhanced data)
DROP MATERIALIZED VIEW IF EXISTS employers_list_comprehensive CASCADE;

-- ============================================================================
-- CREATE COMPREHENSIVE MATERIALIZED VIEW
-- ============================================================================

CREATE MATERIALIZED VIEW employers_list_comprehensive AS
SELECT
  -- ============================================================================
  -- BASE EMPLOYER FIELDS (from employers table)
  -- ============================================================================
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
  e.incolink_last_matched,
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

  -- ============================================================================
  -- PRECOMPUTED ANALYTICS (from current view logic)
  -- ============================================================================

  -- Engagement status
  (
    EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id LIMIT 1)
    OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id LIMIT 1)
  ) as is_engaged,

  -- Worker and project counts
  (SELECT COUNT(*)::int FROM worker_placements wp WHERE wp.employer_id = e.id)
    as actual_worker_count,
  (SELECT COUNT(*)::int FROM project_assignments pa WHERE pa.employer_id = e.id)
    as project_count,

  -- EBA category
  CASE
    WHEN e.enterprise_agreement_status = true THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
      WHERE r.employer_id = e.id
      AND r.fwc_certified_date > (CURRENT_DATE - INTERVAL '4 years')
      LIMIT 1
    ) THEN 'active'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
      WHERE r.employer_id = e.id
      AND r.eba_lodged_fwc > (CURRENT_DATE - INTERVAL '1 year')
      LIMIT 1
    ) THEN 'lodged'
    WHEN EXISTS(
      SELECT 1 FROM company_eba_records r
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
    ELSE 'no'
  END as eba_category,

  -- EBA recency score
  COALESCE((
    SELECT MAX(GREATEST(
      EXTRACT(EPOCH FROM r.fwc_certified_date),
      EXTRACT(EPOCH FROM r.eba_lodged_fwc),
      EXTRACT(EPOCH FROM r.date_eba_signed),
      EXTRACT(EPOCH FROM r.date_vote_occurred)
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), 0) as eba_recency_score,

  -- Most recent EBA date
  (
    SELECT MAX(GREATEST(
      r.fwc_certified_date,
      r.eba_lodged_fwc,
      r.date_eba_signed,
      r.date_vote_occurred
    ))
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ) as most_recent_eba_date,

  -- ============================================================================
  -- RELATIONSHIP DATA AS JSONB (from current view)
  -- ============================================================================

  -- Company EBA records
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
    FROM company_eba_records r
    WHERE r.employer_id = e.id
  ), '[]'::jsonb) as company_eba_records_json,

  -- Worker placements (just IDs)
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', wp.id))
    FROM worker_placements wp
    WHERE wp.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) as worker_placements_json,

  -- Project assignments (just IDs)
  COALESCE((
    SELECT jsonb_agg(jsonb_build_object('id', pa.id))
    FROM project_assignments pa
    WHERE pa.employer_id = e.id
    LIMIT 1000
  ), '[]'::jsonb) as project_assignments_json,

  -- ============================================================================
  -- ENHANCED DATA: PROJECTS WITH ROLES AND TRADES
  -- Replaces: fetchEnhancedEmployerData() query #2
  -- ============================================================================

  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', p.project_id,
        'name', p.project_name,
        'tier', p.tier,
        'roles', p.roles,
        'trades', p.trades
      )
    )
    FROM (
      SELECT DISTINCT
        proj.id as project_id,
        proj.name as project_name,
        proj.tier,
        -- Aggregate roles for this project
        COALESCE((
          SELECT array_agg(DISTINCT crt.code)
          FROM project_assignments pa2
          JOIN contractor_role_types crt ON pa2.contractor_role_type_id = crt.id
          WHERE pa2.employer_id = e.id
          AND pa2.project_id = proj.id
          AND pa2.assignment_type = 'contractor_role'
          AND crt.code IS NOT NULL
        ), ARRAY[]::text[]) as roles,
        -- Aggregate trades for this project
        COALESCE((
          SELECT array_agg(DISTINCT tt.code)
          FROM project_assignments pa3
          JOIN trade_types tt ON pa3.trade_type_id = tt.id
          WHERE pa3.employer_id = e.id
          AND pa3.project_id = proj.id
          AND pa3.assignment_type = 'trade_work'
          AND tt.code IS NOT NULL
        ), ARRAY[]::text[]) as trades
      FROM project_assignments pa
      JOIN projects proj ON pa.project_id = proj.id
      WHERE pa.employer_id = e.id
      GROUP BY proj.id, proj.name, proj.tier
    ) p
  ), '[]'::jsonb) as projects_json,

  -- ============================================================================
  -- ENHANCED DATA: ORGANISERS VIA PROJECTS
  -- Replaces: fetchEnhancedEmployerData() query #3
  -- ============================================================================

  COALESCE((
    SELECT jsonb_agg(DISTINCT
      jsonb_build_object(
        'id', o.id,
        'name', o.first_name || ' ' || o.last_name,
        'patch_name', pt.name
      )
    )
    FROM project_assignments pa
    JOIN job_sites js ON pa.project_id = js.project_id
    JOIN patches pt ON js.patch_id = pt.id
    JOIN organiser_patch_assignments opa ON pt.id = opa.patch_id
    JOIN organisers o ON opa.organiser_id = o.id
    WHERE pa.employer_id = e.id
    AND o.id IS NOT NULL
    AND (opa.effective_to IS NULL OR opa.effective_to > NOW())
  ), '[]'::jsonb) as organisers_json,

  -- ============================================================================
  -- ENHANCED DATA: CONTRACTOR CATEGORIES (ROLES & TRADES)
  -- Replaces: fetchEnhancedEmployerData() query #4
  -- ============================================================================

  -- Contractor roles
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', category_code,
        'name', category_name,
        'manual', source = 'manual_capability',
        'derived', source != 'manual_capability'
      )
    )
    FROM v_employer_contractor_categories
    WHERE employer_id = e.id
    AND category_type = 'contractor_role'
    AND is_current = true
  ), '[]'::jsonb) as roles_json,

  -- Trade categories
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'code', category_code,
        'name', category_name,
        'manual', source = 'manual_capability',
        'derived', source != 'manual_capability'
      )
    )
    FROM v_employer_contractor_categories
    WHERE employer_id = e.id
    AND category_type = 'trade'
    AND is_current = true
  ), '[]'::jsonb) as trades_json,

  -- ============================================================================
  -- SEARCH OPTIMIZATION
  -- ============================================================================

  LOWER(e.name) as name_lower,

  -- ============================================================================
  -- METADATA
  -- ============================================================================

  NOW() as view_refreshed_at

FROM employers e;

-- ============================================================================
-- CREATE UNIQUE INDEX (Required for CONCURRENT refresh)
-- ============================================================================

CREATE UNIQUE INDEX idx_emp_comprehensive_id
  ON employers_list_comprehensive(id);

-- ============================================================================
-- CREATE INDEXES FOR FILTERING AND SEARCHING
-- ============================================================================

-- Engagement filter
CREATE INDEX idx_emp_comprehensive_engaged
  ON employers_list_comprehensive(is_engaged)
  WHERE is_engaged = true;

-- EBA category filter
CREATE INDEX idx_emp_comprehensive_eba_category
  ON employers_list_comprehensive(eba_category);

-- Employer type filter
CREATE INDEX idx_emp_comprehensive_employer_type
  ON employers_list_comprehensive(employer_type);

-- Name search (case-insensitive)
CREATE INDEX idx_emp_comprehensive_name_lower
  ON employers_list_comprehensive(name_lower);

-- Text pattern search (for LIKE queries)
CREATE INDEX idx_emp_comprehensive_name_pattern
  ON employers_list_comprehensive(name text_pattern_ops);

-- Trigram index for fuzzy search
CREATE INDEX idx_emp_comprehensive_name_trgm
  ON employers_list_comprehensive USING gin(name gin_trgm_ops);

-- Sorting indexes
CREATE INDEX idx_emp_comprehensive_estimated_workers
  ON employers_list_comprehensive(estimated_worker_count DESC NULLS LAST);

CREATE INDEX idx_emp_comprehensive_eba_recency
  ON employers_list_comprehensive(eba_recency_score DESC);

CREATE INDEX idx_emp_comprehensive_project_count
  ON employers_list_comprehensive(project_count DESC);

-- ABN search
CREATE INDEX idx_emp_comprehensive_abn
  ON employers_list_comprehensive(abn)
  WHERE abn IS NOT NULL;

-- External ID searches
CREATE INDEX idx_emp_comprehensive_bci_id
  ON employers_list_comprehensive(LOWER(bci_company_id))
  WHERE bci_company_id IS NOT NULL;

CREATE INDEX idx_emp_comprehensive_incolink_id
  ON employers_list_comprehensive(LOWER(incolink_id))
  WHERE incolink_id IS NOT NULL;

-- ============================================================================
-- CREATE REFRESH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_employers_comprehensive_view()
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

  -- Use CONCURRENTLY to allow reads during refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY employers_list_comprehensive;

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

  SELECT COUNT(*) INTO v_row_count
  FROM employers_list_comprehensive;

  RAISE NOTICE 'Comprehensive view refreshed: % rows in %ms', v_row_count, v_duration_ms;

  IF v_duration_ms > 30000 THEN
    RAISE WARNING 'Slow materialized view refresh: %ms', v_duration_ms;
  END IF;

  RETURN QUERY
  SELECT
    true as success,
    v_duration_ms as duration_ms,
    v_row_count as rows_refreshed,
    NOW() as last_refresh,
    format('Refreshed %s rows in %sms', v_row_count, v_duration_ms) as message;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to refresh comprehensive view: %', SQLERRM;

  RETURN QUERY
  SELECT
    false as success,
    0 as duration_ms,
    0::bigint as rows_refreshed,
    NOW() as last_refresh,
    format('Error: %s', SQLERRM) as message;
END;
$$ LANGUAGE plpgsql;

-- Logged version
CREATE OR REPLACE FUNCTION refresh_employers_comprehensive_view_logged(
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
    REFRESH MATERIALIZED VIEW CONCURRENTLY employers_list_comprehensive;

    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    SELECT COUNT(*) INTO v_row_count
    FROM employers_list_comprehensive;

    -- Log to existing table
    INSERT INTO mat_view_refresh_log (
      view_name, duration_ms, rows_refreshed, success, triggered_by
    ) VALUES (
      'employers_list_comprehensive', v_duration_ms, v_row_count, true, p_triggered_by
    );

    RAISE NOTICE 'Comprehensive view refreshed: % rows in %ms (triggered by: %)',
      v_row_count, v_duration_ms, p_triggered_by;

    IF v_duration_ms > 30000 THEN
      RAISE WARNING 'Slow refresh: %ms', v_duration_ms;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    v_success := false;
    v_error_msg := SQLERRM;
    v_duration_ms := EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_start_time))::integer;

    INSERT INTO mat_view_refresh_log (
      view_name, duration_ms, success, error_message, triggered_by
    ) VALUES (
      'employers_list_comprehensive', v_duration_ms, false, v_error_msg, p_triggered_by
    );

    RAISE WARNING 'Failed to refresh: %', v_error_msg;
  END;

  RETURN QUERY
  SELECT
    v_success as success,
    COALESCE(v_duration_ms, 0) as duration_ms,
    COALESCE(v_row_count, 0::bigint) as rows_refreshed,
    NOW() as last_refresh,
    CASE
      WHEN v_success THEN format('Refreshed %s rows in %sms', v_row_count, v_duration_ms)
      ELSE format('Error: %s', v_error_msg)
    END as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING VIEW
-- ============================================================================

CREATE OR REPLACE VIEW employers_comprehensive_view_status AS
SELECT
  'employers_list_comprehensive'::text as view_name,
  (SELECT view_refreshed_at FROM employers_list_comprehensive LIMIT 1) as last_refresh,
  NOW() - (SELECT view_refreshed_at FROM employers_list_comprehensive LIMIT 1) as staleness,
  pg_size_pretty(pg_total_relation_size('employers_list_comprehensive')) as total_size,
  pg_size_pretty(pg_relation_size('employers_list_comprehensive')) as table_size,
  pg_size_pretty(pg_total_relation_size('employers_list_comprehensive') - pg_relation_size('employers_list_comprehensive')) as indexes_size,
  (SELECT COUNT(*) FROM employers_list_comprehensive) as row_count,
  (SELECT COUNT(*) FROM employers) as source_row_count,
  CASE
    WHEN (NOW() - (SELECT view_refreshed_at FROM employers_list_comprehensive LIMIT 1)) > INTERVAL '10 minutes'
    THEN 'STALE - Refresh needed'
    WHEN (NOW() - (SELECT view_refreshed_at FROM employers_list_comprehensive LIMIT 1)) > INTERVAL '5 minutes'
    THEN 'WARNING - Approaching stale'
    ELSE 'OK'
  END as health_status;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT SELECT ON employers_list_comprehensive TO authenticated, anon, service_role;
GRANT SELECT ON employers_comprehensive_view_status TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_employers_comprehensive_view() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_employers_comprehensive_view_logged(text) TO authenticated, service_role;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW employers_list_comprehensive IS
  'Comprehensive view with ALL employer data including projects, organisers, and categories. Eliminates 3-4 secondary queries.';

COMMENT ON FUNCTION refresh_employers_comprehensive_view() IS
  'Refreshes employers_list_comprehensive. Returns statistics.';

-- ============================================================================
-- INITIAL REFRESH
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Performing initial refresh of employers_list_comprehensive...';
  REFRESH MATERIALIZED VIEW employers_list_comprehensive;
  RAISE NOTICE 'Initial refresh complete!';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Initial refresh failed: %', SQLERRM;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
DECLARE
  v_count bigint;
  v_size text;
BEGIN
  SELECT COUNT(*) INTO v_count FROM employers_list_comprehensive;
  SELECT pg_size_pretty(pg_total_relation_size('employers_list_comprehensive')) INTO v_size;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Comprehensive View Created!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'View: employers_list_comprehensive';
  RAISE NOTICE 'Rows: %', v_count;
  RAISE NOTICE 'Size: %', v_size;
  RAISE NOTICE '';
  RAISE NOTICE 'Includes:';
  RAISE NOTICE '- Base employer fields';
  RAISE NOTICE '- EBA records and analytics';
  RAISE NOTICE '- Projects with roles/trades';
  RAISE NOTICE '- Organisers via job sites';
  RAISE NOTICE '- Contractor categories';
  RAISE NOTICE '';
  RAISE NOTICE 'Manual refresh: SELECT * FROM refresh_employers_comprehensive_view_logged(''manual'');';
  RAISE NOTICE 'Check status: SELECT * FROM employers_comprehensive_view_status;';
  RAISE NOTICE '========================================';
END $$;

-- ============================================================================
-- AUTOMATED MATERIALIZED VIEW REFRESH SETUP
-- Purpose: Set up database-level automated refresh for all materialized views
-- Approach: Use pg_cron for scheduled refreshes every 5 minutes
-- ============================================================================

-- ============================================================================
-- STEP 1: Enable pg_cron extension
-- ============================================================================
-- Note: pg_cron may need to be enabled at the database level by the admin
-- If this fails, we'll fall back to worker-based refresh only

DO $enable_extension$
BEGIN
  -- Try to create extension if it doesn't exist
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  RAISE NOTICE 'pg_cron extension enabled successfully';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not enable pg_cron extension: %. Falling back to worker-based refresh.', SQLERRM;
END $enable_extension$;

-- ============================================================================
-- STEP 2: Create unified refresh function for all materialized views
-- ============================================================================

-- Drop existing function if it exists (may have different signature)
DROP FUNCTION IF EXISTS refresh_all_materialized_views();

CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS TABLE (
  view_name text,
  success boolean,
  duration_ms integer,
  error_message text
) AS $$
DECLARE
  v_start_time timestamptz;
  v_end_time timestamptz;
  v_duration_ms integer;
BEGIN
  -- Refresh patch_project_mapping_view
  BEGIN
    v_start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY patch_project_mapping_view;
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    RETURN QUERY SELECT
      'patch_project_mapping_view'::text,
      true,
      v_duration_ms,
      NULL::text;

    RAISE NOTICE 'Refreshed patch_project_mapping_view in %ms', v_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh patch_project_mapping_view: %', SQLERRM;
    RETURN QUERY SELECT
      'patch_project_mapping_view'::text,
      false,
      0,
      SQLERRM::text;
  END;

  -- Refresh project_list_comprehensive_view
  BEGIN
    v_start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY project_list_comprehensive_view;
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    RETURN QUERY SELECT
      'project_list_comprehensive_view'::text,
      true,
      v_duration_ms,
      NULL::text;

    RAISE NOTICE 'Refreshed project_list_comprehensive_view in %ms', v_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh project_list_comprehensive_view: %', SQLERRM;
    RETURN QUERY SELECT
      'project_list_comprehensive_view'::text,
      false,
      0,
      SQLERRM::text;
  END;

  -- Refresh employers_search_optimized
  BEGIN
    v_start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY employers_search_optimized;
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    RETURN QUERY SELECT
      'employers_search_optimized'::text,
      true,
      v_duration_ms,
      NULL::text;

    RAISE NOTICE 'Refreshed employers_search_optimized in %ms', v_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh employers_search_optimized: %', SQLERRM;
    RETURN QUERY SELECT
      'employers_search_optimized'::text,
      false,
      0,
      SQLERRM::text;
  END;

  -- Refresh employer_list_view (if exists)
  BEGIN
    v_start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY employer_list_view;
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    RETURN QUERY SELECT
      'employer_list_view'::text,
      true,
      v_duration_ms,
      NULL::text;

    RAISE NOTICE 'Refreshed employer_list_view in %ms', v_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    -- This view might not exist, so just log a debug message
    IF SQLERRM LIKE '%does not exist%' THEN
      RAISE DEBUG 'employer_list_view does not exist, skipping';
    ELSE
      RAISE WARNING 'Failed to refresh employer_list_view: %', SQLERRM;
    END IF;
    RETURN QUERY SELECT
      'employer_list_view'::text,
      false,
      0,
      SQLERRM::text;
  END;

  -- Refresh worker_list_view (if exists)
  BEGIN
    v_start_time := clock_timestamp();
    REFRESH MATERIALIZED VIEW CONCURRENTLY worker_list_view;
    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(MILLISECONDS FROM (v_end_time - v_start_time))::integer;

    RETURN QUERY SELECT
      'worker_list_view'::text,
      true,
      v_duration_ms,
      NULL::text;

    RAISE NOTICE 'Refreshed worker_list_view in %ms', v_duration_ms;
  EXCEPTION WHEN OTHERS THEN
    -- This view might not exist, so just log a debug message
    IF SQLERRM LIKE '%does not exist%' THEN
      RAISE DEBUG 'worker_list_view does not exist, skipping';
    ELSE
      RAISE WARNING 'Failed to refresh worker_list_view: %', SQLERRM;
    END IF;
    RETURN QUERY SELECT
      'worker_list_view'::text,
      false,
      0,
      SQLERRM::text;
  END;

  RAISE NOTICE 'All materialized views refreshed at %', NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION refresh_all_materialized_views() TO authenticated, service_role;

COMMENT ON FUNCTION refresh_all_materialized_views() IS
  'Refreshes all materialized views with error handling. Returns refresh statistics for monitoring.';

-- ============================================================================
-- STEP 3: Create monitoring view for materialized view status
-- ============================================================================

CREATE OR REPLACE VIEW materialized_view_status AS
SELECT
  schemaname,
  matviewname as view_name,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||matviewname)) as data_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname) - pg_relation_size(schemaname||'.'||matviewname)) as index_size,
  -- Get approximate last refresh from stats
  GREATEST(
    (SELECT last_autovacuum FROM pg_stat_user_tables WHERE relname = matviewname),
    (SELECT last_autoanalyze FROM pg_stat_user_tables WHERE relname = matviewname),
    (SELECT last_vacuum FROM pg_stat_user_tables WHERE relname = matviewname),
    (SELECT last_analyze FROM pg_stat_user_tables WHERE relname = matviewname)
  ) as last_stats_update,
  -- Check for unique index (required for CONCURRENT refresh)
  EXISTS(
    SELECT 1 FROM pg_indexes
    WHERE schemaname = pg_matviews.schemaname
    AND tablename = matviewname
    AND indexdef LIKE '%UNIQUE%'
  ) as has_unique_index
FROM pg_matviews
WHERE schemaname = 'public'
ORDER BY matviewname;

GRANT SELECT ON materialized_view_status TO authenticated, service_role;

COMMENT ON VIEW materialized_view_status IS
  'Shows status, size, and refresh information for all materialized views in the public schema.';

-- ============================================================================
-- STEP 4: Schedule automatic refresh with pg_cron (if available)
-- ============================================================================

DO $cron_setup$
BEGIN
  -- Check if pg_cron is available
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove existing job if it exists
    BEGIN
      PERFORM cron.unschedule('refresh-materialized-views');
    EXCEPTION WHEN OTHERS THEN
      -- Job doesn't exist, that's fine
      NULL;
    END;

    -- Schedule refresh every 5 minutes
    -- Note: pg_cron uses server timezone
    PERFORM cron.schedule(
      'refresh-materialized-views',     -- job name
      '*/5 * * * *',                    -- every 5 minutes
      'SELECT refresh_all_materialized_views()'
    );

    RAISE NOTICE '✅ Scheduled materialized view refresh every 5 minutes using pg_cron';
    RAISE NOTICE 'Job name: refresh-materialized-views';
    RAISE NOTICE 'Schedule: */5 * * * * (every 5 minutes)';
  ELSE
    RAISE WARNING '⚠️  pg_cron extension not available. Materialized views will be refreshed by worker only.';
    RAISE NOTICE 'To enable pg_cron: Contact your Supabase admin or enable in database settings';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '⚠️  Could not schedule pg_cron job: %. Materialized views will be refreshed by worker only.', SQLERRM;
END $cron_setup$;

-- ============================================================================
-- STEP 5: Create view to monitor pg_cron jobs (if available)
-- ============================================================================

DO $cron_views$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Create a view to easily monitor cron jobs
    EXECUTE $$
      CREATE OR REPLACE VIEW mat_view_cron_status AS
      SELECT
        jobid,
        schedule,
        command,
        nodename,
        nodeport,
        database,
        username,
        active,
        jobname
      FROM cron.job
      WHERE jobname = 'refresh-materialized-views'
    $$;

    GRANT SELECT ON mat_view_cron_status TO authenticated, service_role;

    -- Create a view to see recent job runs
    EXECUTE $$
      CREATE OR REPLACE VIEW mat_view_cron_runs AS
      SELECT
        jr.runid,
        jr.jobid,
        j.jobname,
        jr.job_pid,
        jr.database,
        jr.username,
        jr.command,
        jr.status,
        jr.return_message,
        jr.start_time,
        jr.end_time,
        EXTRACT(MILLISECONDS FROM (jr.end_time - jr.start_time))::integer as duration_ms
      FROM cron.job_run_details jr
      LEFT JOIN cron.job j ON j.jobid = jr.jobid
      WHERE j.jobname = 'refresh-materialized-views'
      ORDER BY jr.start_time DESC
      LIMIT 100
    $$;

    GRANT SELECT ON mat_view_cron_runs TO authenticated, service_role;

    RAISE NOTICE '✅ Created monitoring views: mat_view_cron_status, mat_view_cron_runs';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE DEBUG 'Could not create cron monitoring views: %', SQLERRM;
END $cron_views$;

-- ============================================================================
-- STEP 6: Initial refresh of all views
-- ============================================================================

DO $initial_refresh$
DECLARE
  v_result RECORD;
  v_total_duration_ms integer := 0;
  v_success_count integer := 0;
  v_fail_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Performing initial refresh of all materialized views...';
  RAISE NOTICE '========================================';

  FOR v_result IN SELECT * FROM refresh_all_materialized_views()
  LOOP
    IF v_result.success THEN
      v_success_count := v_success_count + 1;
      v_total_duration_ms := v_total_duration_ms + v_result.duration_ms;
      RAISE NOTICE '✅ %: %ms', v_result.view_name, v_result.duration_ms;
    ELSE
      v_fail_count := v_fail_count + 1;
      RAISE WARNING '❌ %: %', v_result.view_name, v_result.error_message;
    END IF;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Initial refresh complete!';
  RAISE NOTICE '✅ Success: % views', v_success_count;
  RAISE NOTICE '❌ Failed: % views', v_fail_count;
  RAISE NOTICE '⏱  Total duration: %ms', v_total_duration_ms;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
END $initial_refresh$;

-- ============================================================================
-- STEP 7: Display current status
-- ============================================================================

-- Show materialized view status
SELECT
  view_name,
  total_size,
  has_unique_index,
  last_stats_update
FROM materialized_view_status;

-- Show pg_cron job status if available
DO $show_status$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'pg_cron Job Status';
    RAISE NOTICE '========================================';

    -- Display job details
    PERFORM * FROM mat_view_cron_status;
  END IF;
END $show_status$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $migration_complete$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Materialized View Auto-Refresh Setup Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'What was configured:';
  RAISE NOTICE '  ✅ Unified refresh function: refresh_all_materialized_views()';
  RAISE NOTICE '  ✅ Monitoring view: materialized_view_status';
  RAISE NOTICE '  ✅ Initial refresh completed';

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '  ✅ pg_cron scheduled job: every 5 minutes';
    RAISE NOTICE '  ✅ Cron monitoring views: mat_view_cron_status, mat_view_cron_runs';
  ELSE
    RAISE NOTICE '  ⚠️  pg_cron not available - using worker-based refresh only';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '  1. Check status: SELECT * FROM materialized_view_status;';
  RAISE NOTICE '  2. Manual refresh: SELECT * FROM refresh_all_materialized_views();';

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RAISE NOTICE '  3. Monitor cron: SELECT * FROM mat_view_cron_status;';
    RAISE NOTICE '  4. View history: SELECT * FROM mat_view_cron_runs;';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $migration_complete$;

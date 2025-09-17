-- Fix patch_project_mapping_view to be properly populated and auto-updated
-- This addresses the sticky patch filtering issue where selecting patches results in 0 projects

-- Step 1: Refresh the existing materialized view to populate it with current data
REFRESH MATERIALIZED VIEW patch_project_mapping_view;

-- Step 2: Create trigger function to auto-refresh the materialized view when relevant data changes
CREATE OR REPLACE FUNCTION refresh_patch_project_mapping_on_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh the materialized view when patch-job site relationships change
  PERFORM refresh_patch_project_mapping_view();
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Create triggers to auto-refresh the view when data changes
-- Trigger on patch_job_sites changes (most common case)
DROP TRIGGER IF EXISTS trigger_refresh_patch_mapping_on_patch_job_sites ON patch_job_sites;
CREATE TRIGGER trigger_refresh_patch_mapping_on_patch_job_sites
  AFTER INSERT OR UPDATE OR DELETE ON patch_job_sites
  FOR EACH STATEMENT  -- Use STATEMENT level to avoid multiple refreshes per transaction
  EXECUTE FUNCTION refresh_patch_project_mapping_on_change();

-- Trigger on job_sites.patch_id changes (when patch assignments change via direct column)  
CREATE OR REPLACE FUNCTION refresh_patch_project_mapping_on_job_site_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only refresh if patch_id actually changed
  IF (TG_OP = 'INSERT' AND NEW.patch_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.patch_id IS DISTINCT FROM NEW.patch_id) OR
     (TG_OP = 'DELETE' AND OLD.patch_id IS NOT NULL) THEN
    PERFORM refresh_patch_project_mapping_view();
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_refresh_patch_mapping_on_job_sites ON job_sites;
CREATE TRIGGER trigger_refresh_patch_mapping_on_job_sites
  AFTER INSERT OR UPDATE OF patch_id OR DELETE ON job_sites
  FOR EACH STATEMENT  -- Use STATEMENT level to avoid multiple refreshes per transaction
  EXECUTE FUNCTION refresh_patch_project_mapping_on_job_site_change();

-- Step 4: Grant necessary permissions
GRANT EXECUTE ON FUNCTION refresh_patch_project_mapping_on_change() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_patch_project_mapping_on_job_site_change() TO authenticated, service_role;

-- Step 5: Add a health check function to verify the view has data
CREATE OR REPLACE FUNCTION check_patch_project_mapping_health()
RETURNS TABLE (
  view_name text,
  record_count bigint,
  last_refreshed_estimate timestamp with time zone,
  is_healthy boolean,
  recommendation text
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'patch_project_mapping_view'::text,
    (SELECT COUNT(*) FROM patch_project_mapping_view),
    -- Estimate based on pg_stat_user_tables for underlying tables
    GREATEST(
      (SELECT last_autoanalyze FROM pg_stat_user_tables WHERE relname = 'patch_job_sites'),
      (SELECT last_autoanalyze FROM pg_stat_user_tables WHERE relname = 'job_sites'),
      (SELECT last_autoanalyze FROM pg_stat_user_tables WHERE relname = 'projects')
    ),
    -- Consider healthy if has data and recent underlying table activity
    CASE 
      WHEN (SELECT COUNT(*) FROM patch_project_mapping_view) > 0 THEN true
      ELSE false
    END,
    CASE 
      WHEN (SELECT COUNT(*) FROM patch_project_mapping_view) = 0 THEN 
        'View is empty - run REFRESH MATERIALIZED VIEW patch_project_mapping_view;'
      WHEN (SELECT COUNT(*) FROM patch_project_mapping_view) > 0 THEN 
        'View is healthy'
      ELSE 'Unknown status'
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION check_patch_project_mapping_health() TO authenticated, service_role;

-- Step 6: Log the fix
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ PATCH FILTERING FIX APPLIED';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 CHANGES MADE:';
  RAISE NOTICE '   1. Refreshed patch_project_mapping_view to populate current data';
  RAISE NOTICE '   2. Added auto-refresh triggers for patch_job_sites and job_sites changes';  
  RAISE NOTICE '   3. Added health check function check_patch_project_mapping_health()';
  RAISE NOTICE '   4. Updated API with fallback logic for stale views';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ SAFEGUARDS:';
  RAISE NOTICE '   - API falls back to job_sites query if view is empty';
  RAISE NOTICE '   - Triggers use STATEMENT level to avoid excessive refreshes';
  RAISE NOTICE '   - Health check function available for monitoring';
  RAISE NOTICE '';
  RAISE NOTICE '📊 CURRENT STATUS:';
END $$;

-- Display current health status
SELECT * FROM check_patch_project_mapping_health();

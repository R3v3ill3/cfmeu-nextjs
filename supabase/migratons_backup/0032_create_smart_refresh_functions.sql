-- Migration: Smart refresh functions for upload-triggered materialized view updates
-- This enables immediate consistency after data uploads

-- Create smart refresh functions that only update affected views
-- This is more efficient than refreshing everything after each upload

-- Refresh function for employer-related uploads (EBA imports, employer imports)
CREATE OR REPLACE FUNCTION refresh_employer_related_views()
RETURNS void AS $$
BEGIN
    -- Refresh views that depend on employer/EBA data
    PERFORM refresh_employer_list_view();
    
    -- Also refresh project view since it depends on employer enterprise_agreement_status
    PERFORM refresh_project_list_comprehensive_view();
    
    RAISE NOTICE 'Employer-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

-- Refresh function for worker-related uploads (worker imports, placements)
CREATE OR REPLACE FUNCTION refresh_worker_related_views()
RETURNS void AS $$
BEGIN
    -- Refresh views that depend on worker data
    PERFORM refresh_worker_list_view();
    
    -- Also refresh project view since it depends on worker counts
    PERFORM refresh_project_list_comprehensive_view();
    
    RAISE NOTICE 'Worker-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

-- Refresh function for project-related uploads (project imports, assignments)
CREATE OR REPLACE FUNCTION refresh_project_related_views()
RETURNS void AS $$
BEGIN
    -- Refresh project views and patch mappings
    PERFORM refresh_project_list_comprehensive_view();
    PERFORM refresh_patch_project_mapping_view();
    
    RAISE NOTICE 'Project-related views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

-- Refresh function for site visit uploads
CREATE OR REPLACE FUNCTION refresh_site_visit_related_views()
RETURNS void AS $$
BEGIN
    PERFORM refresh_site_visit_list_view();
    
    RAISE NOTICE 'Site visit views refreshed at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

-- Enhanced complete refresh function with timing (for manual use or daily safety net)
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
DECLARE
    start_time timestamp := clock_timestamp();
    view_count integer := 0;
BEGIN
    RAISE NOTICE 'Starting complete refresh of all materialized views at %', NOW();
    
    -- Refresh independent views in parallel-safe order
    PERFORM refresh_employer_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_worker_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_site_visit_list_view();
    view_count := view_count + 1;
    
    PERFORM refresh_patch_project_mapping_view();
    view_count := view_count + 1;
    
    -- Refresh project view last since it depends on others
    PERFORM refresh_project_list_comprehensive_view();
    view_count := view_count + 1;
    
    RAISE NOTICE 'Complete refresh finished: % views updated in % seconds', 
                 view_count, 
                 EXTRACT(EPOCH FROM clock_timestamp() - start_time);
END;
$$ LANGUAGE plpgsql;

-- Function to check materialized view staleness (for monitoring)
CREATE OR REPLACE FUNCTION check_materialized_view_staleness()
RETURNS TABLE(
    view_name text,
    record_count bigint,
    minutes_old numeric,
    needs_refresh boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.view_name::text,
        v.record_count,
        EXTRACT(EPOCH FROM (NOW() - v.last_computed)) / 60 as minutes_old,
        (EXTRACT(EPOCH FROM (NOW() - v.last_computed)) / 60) > 60 as needs_refresh
    FROM (
        SELECT 'employer_list_view' as view_name, 
               COUNT(*) as record_count, 
               MAX(computed_at) as last_computed 
        FROM employer_list_view
        UNION ALL
        SELECT 'worker_list_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM worker_list_view
        UNION ALL  
        SELECT 'project_list_comprehensive_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM project_list_comprehensive_view
        UNION ALL
        SELECT 'site_visit_list_view', 
               COUNT(*), 
               MAX(computed_at) 
        FROM site_visit_list_view
        UNION ALL
        SELECT 'patch_project_mapping_view', 
               COUNT(*), 
               NULL::timestamp with time zone
        FROM patch_project_mapping_view
    ) v;
END;
$$ LANGUAGE plpgsql;

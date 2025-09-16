-- Create missing materialized views for projects API
-- These views are expected by the server-side projects API but were not previously created

-- 1. Patch Project Mapping View
-- This view efficiently maps patches to projects for filtering
CREATE MATERIALIZED VIEW IF NOT EXISTS patch_project_mapping_view AS
SELECT DISTINCT 
    pjs.patch_id,
    js.project_id
FROM patch_job_sites pjs
JOIN job_sites js ON js.id = pjs.job_site_id
WHERE pjs.effective_to IS NULL
  AND js.project_id IS NOT NULL;

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_patch_project_mapping_patch_id 
    ON patch_project_mapping_view(patch_id);
CREATE INDEX IF NOT EXISTS idx_patch_project_mapping_project_id 
    ON patch_project_mapping_view(project_id);

-- 2. Project List Comprehensive View
-- This view combines project data with summary metrics for the API
CREATE MATERIALIZED VIEW IF NOT EXISTS project_list_comprehensive_view AS
SELECT 
    p.id,
    p.name,
    p.main_job_site_id,
    p.value,
    p.tier,
    p.organising_universe,
    p.stage_class,
    p.created_at,
    p.updated_at,
    
    -- Create searchable text field for text search
    LOWER(p.name || ' ' || COALESCE(p.organising_universe::text, '') || ' ' || COALESCE(p.stage_class::text, '')) as search_text,
    
    -- Summary data from project_dashboard_summary
    COALESCE(pds.total_workers, 0) as total_workers,
    COALESCE(pds.total_members, 0) as total_members,
    COALESCE(pds.engaged_employer_count, 0) as engaged_employer_count,
    COALESCE(pds.eba_active_employer_count, 0) as eba_active_employer_count,
    COALESCE(pds.estimated_total, 0) as estimated_total,
    pds.delegate_name,
    pds.first_patch_name,
    
    -- Organiser names (join with organiser assignments)
    (
        SELECT STRING_AGG(DISTINCT pr.full_name, ', ' ORDER BY pr.full_name)
        FROM patch_job_sites pjs
        JOIN job_sites js ON js.id = pjs.job_site_id
        JOIN organiser_patch_assignments opa ON opa.patch_id = pjs.patch_id AND opa.effective_to IS NULL
        JOIN profiles pr ON pr.id = opa.organiser_id
        WHERE js.project_id = p.id AND pjs.effective_to IS NULL
    ) as organiser_names,
    
    -- Builder status for EBA filtering
    CASE WHEN EXISTS (
        SELECT 1 FROM project_assignments pa
        WHERE pa.project_id = p.id 
        AND pa.assignment_type = 'contractor_role'
    ) THEN true ELSE false END as has_builder,
    
    CASE WHEN EXISTS (
        SELECT 1 FROM project_assignments pa
        JOIN employers e ON e.id = pa.employer_id
        WHERE pa.project_id = p.id 
        AND pa.assignment_type = 'contractor_role'
        AND e.enterprise_agreement_status = true
    ) THEN true ELSE false END as builder_has_eba,
    
    -- EBA coverage percentage
    CASE WHEN COALESCE(pds.engaged_employer_count, 0) > 0 
        THEN ROUND((COALESCE(pds.eba_active_employer_count, 0)::DECIMAL / pds.engaged_employer_count) * 100)
        ELSE 0 
    END as eba_coverage_percent,
    
    -- Project assignments data as JSON for API compatibility
    (
        SELECT COALESCE(JSON_AGG(
            JSON_BUILD_OBJECT(
                'assignment_type', pa.assignment_type,
                'employer_id', pa.employer_id,
                'contractor_role_types', 
                    CASE WHEN crt.code IS NOT NULL 
                    THEN JSON_BUILD_OBJECT('code', crt.code) 
                    ELSE NULL END,
                'trade_types',
                    CASE WHEN tt.code IS NOT NULL 
                    THEN JSON_BUILD_OBJECT('code', tt.code) 
                    ELSE NULL END,
                'employers',
                    CASE WHEN e.name IS NOT NULL
                    THEN JSON_BUILD_OBJECT(
                        'name', e.name,
                        'enterprise_agreement_status', e.enterprise_agreement_status
                    )
                    ELSE NULL END
            )
        ), '[]'::JSON)
        FROM project_assignments pa
        LEFT JOIN contractor_role_types crt ON crt.id = pa.contractor_role_type_id
        LEFT JOIN trade_types tt ON tt.id = pa.trade_type_id
        LEFT JOIN employers e ON e.id = pa.employer_id
        WHERE pa.project_id = p.id
    ) as project_assignments_data,
    
    -- Computed at timestamp for cache invalidation
    NOW() as computed_at

FROM projects p
LEFT JOIN project_dashboard_summary pds ON pds.project_id = p.id;

-- Indexes for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_name 
    ON project_list_comprehensive_view(name);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_tier 
    ON project_list_comprehensive_view(tier);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_universe 
    ON project_list_comprehensive_view(organising_universe);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_stage 
    ON project_list_comprehensive_view(stage_class);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_workers 
    ON project_list_comprehensive_view(total_workers);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_search 
    ON project_list_comprehensive_view USING gin(to_tsvector('english', search_text));
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_has_builder 
    ON project_list_comprehensive_view(has_builder);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_builder_eba 
    ON project_list_comprehensive_view(builder_has_eba);
CREATE INDEX IF NOT EXISTS idx_project_list_comprehensive_computed_at 
    ON project_list_comprehensive_view(computed_at);

-- 3. Refresh functions for the materialized views
CREATE OR REPLACE FUNCTION refresh_patch_project_mapping_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW patch_project_mapping_view;
    
    RAISE NOTICE 'Refreshed patch_project_mapping_view at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_project_list_comprehensive_view()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW project_list_comprehensive_view;
    
    RAISE NOTICE 'Refreshed project_list_comprehensive_view at % (took % seconds)', 
                 NOW(), 
                 EXTRACT(EPOCH FROM clock_timestamp() - statement_timestamp());
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT ON patch_project_mapping_view TO authenticated, service_role;
GRANT SELECT ON project_list_comprehensive_view TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION refresh_patch_project_mapping_view TO service_role;
GRANT EXECUTE ON FUNCTION refresh_project_list_comprehensive_view TO service_role;

-- Initial population of the views
SELECT refresh_patch_project_mapping_view();
SELECT refresh_project_list_comprehensive_view();

COMMENT ON MATERIALIZED VIEW patch_project_mapping_view IS 'Efficient mapping between patches and projects for filtering';
COMMENT ON MATERIALIZED VIEW project_list_comprehensive_view IS 'Comprehensive project data with summary metrics for server-side API';

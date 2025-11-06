-- Production Performance Optimization - Individual Index Statements
-- Run each CREATE INDEX statement ONE AT A TIME in Supabase SQL Editor
-- This allows you to use CONCURRENTLY if desired (run outside this file)
--
-- Copy and paste each statement individually into SQL Editor and run separately
-- This avoids transaction block issues

-- =====================================================
-- INDEX 1: Job sites spatial query optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_geom_active
ON job_sites USING GIST (geom)
WHERE geom IS NOT NULL;

-- =====================================================
-- INDEX 2: Project employer roles optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_employer_roles_project_type_fixed
ON project_employer_roles(project_id, role)
WHERE end_date IS NULL OR end_date > '1970-01-01'::date;

-- =====================================================
-- INDEX 3: User patch assignments optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organiser_patch_assignments_user_effective
ON organiser_patch_assignments(organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- =====================================================
-- INDEX 4: Lead organiser patch assignments optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_organiser_patch_assignments_user_effective
ON lead_organiser_patch_assignments(lead_organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- =====================================================
-- INDEX 5: Project creation date optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at_recent
ON projects(created_at DESC)
WHERE created_at > '2025-05-07 00:00:00+00'::timestamp with time zone;

-- =====================================================
-- INDEX 6: Project assignments employer lookup
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_employer_lookup
ON project_assignments(employer_id, status)
WHERE status = 'active';

-- =====================================================
-- INDEX 7: Job sites project lookup optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_project_id_active
ON job_sites(project_id)
WHERE project_id IS NOT NULL;

-- =====================================================
-- INDEX 8: Worker placements employer optimization
-- =====================================================
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_placements_employer_id_active
ON worker_placements(employer_id)
WHERE employer_id IS NOT NULL;

-- =====================================================
-- VERIFICATION QUERY (run after all indexes are created)
-- =====================================================
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
    AND indexname IN (
        'idx_job_sites_geom_active',
        'idx_project_employer_roles_project_type_fixed',
        'idx_organiser_patch_assignments_user_effective',
        'idx_lead_organiser_patch_assignments_user_effective',
        'idx_projects_created_at_recent',
        'idx_project_assignments_employer_lookup',
        'idx_job_sites_project_id_active',
        'idx_worker_placements_employer_id_active'
    )
ORDER BY tablename, indexname;


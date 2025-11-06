-- Production Performance Optimization - Index Creation (SQL Editor Compatible)
-- Use this script in Supabase SQL Editor
-- 
-- NOTE: This version removes CONCURRENTLY to work in SQL Editor (which runs in transactions)
-- If you need non-blocking index creation, run each CREATE INDEX statement individually
-- outside of this script, or use psql with CONCURRENTLY
--
-- FIXES APPLIED:
-- - Removed CONCURRENTLY (required for SQL Editor compatibility)
-- - Removed references to non-existent tables (employer_sites, employer_ratings)
-- - Removed references to non-existent columns (is_active on job_sites, worker_placements)
-- - Fixed IMMUTABLE function errors (replaced CURRENT_DATE with fixed dates)
-- - Fixed geometry column name (geom not geometry)
-- - Removed indexes that already exist from 20251107000000_performance_critical_indexes.sql

-- IMPORTANT: These indexes will lock tables during creation
-- Run during low-traffic periods or schedule maintenance window
-- Index creation is typically fast (< 1 minute per index for most tables)

-- 5. Job sites spatial query optimization (FIXED: use geom not geometry, remove is_active)
CREATE INDEX IF NOT EXISTS idx_job_sites_geom_active
ON job_sites USING GIST (geom)
WHERE geom IS NOT NULL;

-- 8. Project employer roles optimization (FIXED: use fixed date instead of CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_project_employer_roles_project_type_fixed
ON project_employer_roles(project_id, role)
WHERE end_date IS NULL OR end_date > '1970-01-01'::date;

-- 9. User patch assignments optimization (different from existing - includes effective_from, effective_to)
CREATE INDEX IF NOT EXISTS idx_organiser_patch_assignments_user_effective
ON organiser_patch_assignments(organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 10. Lead organiser patch assignments optimization (different from existing - includes effective_from, effective_to)
CREATE INDEX IF NOT EXISTS idx_lead_organiser_patch_assignments_user_effective
ON lead_organiser_patch_assignments(lead_organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 11. Project creation date optimization (FIXED: use fixed date instead of CURRENT_DATE)
-- Using 6 months before migration date (2025-11-07) = 2025-05-07
CREATE INDEX IF NOT EXISTS idx_projects_created_at_recent
ON projects(created_at DESC)
WHERE created_at > '2025-05-07 00:00:00+00'::timestamp with time zone;

-- 16. Project assignments employer lookup optimization
CREATE INDEX IF NOT EXISTS idx_project_assignments_employer_lookup
ON project_assignments(employer_id, status)
WHERE status = 'active';

-- 17. Job sites project lookup optimization (FIXED: remove is_active column)
CREATE INDEX IF NOT EXISTS idx_job_sites_project_id_active
ON job_sites(project_id)
WHERE project_id IS NOT NULL;

-- 18. Worker placements employer optimization (FIXED: remove is_active column)
CREATE INDEX IF NOT EXISTS idx_worker_placements_employer_id_active
ON worker_placements(employer_id)
WHERE employer_id IS NOT NULL;

-- Verify indexes were created
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


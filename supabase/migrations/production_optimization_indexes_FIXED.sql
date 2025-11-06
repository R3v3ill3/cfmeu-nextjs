-- Production Performance Optimization - Concurrent Index Creation (FIXED)
-- Use this script for production deployment during business hours
-- These indexes can be created concurrently to avoid blocking database operations
--
-- USAGE: Run this manually in Supabase SQL Editor during low-traffic periods
-- DO NOT run via `supabase db push` - this uses CONCURRENTLY which requires manual execution
--
-- FIXES APPLIED:
-- - Removed references to non-existent tables (employer_sites, employer_ratings)
-- - Removed references to non-existent columns (is_active on job_sites, worker_placements)
-- - Fixed IMMUTABLE function errors (replaced CURRENT_DATE with fixed dates)
-- - Fixed geometry column name (geom not geometry)
-- - Removed indexes that already exist from 20251107000000_performance_critical_indexes.sql

-- NOTE: Many of these indexes may already exist from the performance_critical_indexes migration
-- The IF NOT EXISTS clause will skip them safely

-- 1. Projects name search optimization (case-insensitive) - ALREADY EXISTS
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_lower
-- ON projects(LOWER(name))
-- WHERE name IS NOT NULL;

-- 2. Project assignments composite index - ALREADY EXISTS
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_employer_type
-- ON project_assignments(employer_id, assignment_type)
-- WHERE status = 'active';

-- 3. Employer final ratings date optimization
-- Note: employer_final_ratings table doesn't exist, skipped

-- 4. Patch project mapping composite index
-- NOTE: patch_project_mapping is a MATERIALIZED VIEW, indexes already exist
-- Index already exists: idx_patch_project_mapping_composite

-- 5. Job sites spatial query optimization (FIXED: use geom not geometry, remove is_active)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_geom_active
ON job_sites USING GIST (geom)
WHERE geom IS NOT NULL;

-- 6. Employer ABN lookup optimization - ALREADY EXISTS
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_abn
-- ON employers(abn)
-- WHERE abn IS NOT NULL;

-- 7. Site employers composite index - ALREADY EXISTS (as idx_site_employers_job_site)
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_employers_site_employer
-- ON site_employers(job_site_id, employer_id);

-- 8. Project employer roles optimization (FIXED: use fixed date instead of CURRENT_DATE)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_employer_roles_project_type_fixed
ON project_employer_roles(project_id, role)
WHERE end_date IS NULL OR end_date > '1970-01-01'::date;

-- 9. User patch assignments optimization (different from existing - includes effective_from, effective_to)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organiser_patch_assignments_user_effective
ON organiser_patch_assignments(organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 10. Lead organiser patch assignments optimization (different from existing - includes effective_from, effective_to)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_organiser_patch_assignments_user_effective
ON lead_organiser_patch_assignments(lead_organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 11. Project creation date optimization (FIXED: use fixed date instead of CURRENT_DATE)
-- Using 6 months before migration date (2025-11-07) = 2025-05-07
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at_recent
ON projects(created_at DESC)
WHERE created_at > '2025-05-07 00:00:00+00'::timestamp with time zone;

-- 12. Employer sites active optimization
-- SKIPPED: employer_sites table doesn't exist

-- 13. Employer ratings materialized view support
-- SKIPPED: employer_ratings table doesn't exist

-- 14. Project stages optimization - ALREADY EXISTS
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_stage_class
-- ON projects(stage_class, created_at DESC)
-- WHERE stage_class NOT IN ('archived');

-- 15. Contact information optimization - ALREADY EXISTS
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_contacts_email_phone
-- ON site_contacts(email, phone)
-- WHERE email IS NOT NULL OR phone IS NOT NULL;

-- 16. Project assignments employer lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_employer_lookup
ON project_assignments(employer_id, status)
WHERE status = 'active';

-- 17. Job sites project lookup optimization (FIXED: remove is_active column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_project_id_active
ON job_sites(project_id)
WHERE project_id IS NOT NULL;

-- 18. Worker placements employer optimization (FIXED: remove is_active column)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_placements_employer_id_active
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


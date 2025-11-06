-- Production Performance Optimization - Concurrent Index Creation
-- Use this script for production deployment during business hours
-- These indexes can be created concurrently to avoid blocking database operations
--
-- USAGE: Run this manually in production using:
-- psql -h your-db-host -U postgres -d your-database -f production_optimization_indexes.sql
--
-- OR execute via Supabase SQL Editor during low-traffic periods

-- 1. Projects name search optimization (case-insensitive)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_lower
ON projects(LOWER(name))
WHERE name IS NOT NULL;

-- 2. Project assignments composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_employer_type
ON project_assignments(employer_id, assignment_type)
WHERE status = 'active';

-- 3. Employer final ratings date optimization
-- Note: employer_final_ratings table doesn't exist, skipped for now
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employer_final_ratings_dates
-- ON employer_final_ratings(rating_date DESC, expiry_date DESC)
-- WHERE is_active = true;

-- 4. Patch project mapping composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patch_project_mapping_composite
ON patch_project_mapping(patch_id, project_id, status)
WHERE status = 'active';

-- 5. Job sites spatial query optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_location_active
ON job_sites USING GIST (geometry)
WHERE is_active = true;

-- 6. Employer ABN lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_abn
ON employers(abn)
WHERE abn IS NOT NULL;

-- 7. Site employers composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_employers_site_employer
ON site_employers(job_site_id, employer_id);

-- 8. Project employer roles optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_employer_roles_project_type
ON project_employer_roles(project_id, role)
WHERE end_date IS NULL OR end_date > CURRENT_DATE;

-- 9. User patch assignments optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organiser_patch_assignments_user_effective
ON organiser_patch_assignments(organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 10. Lead organiser patch assignments optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lead_organiser_patch_assignments_user_effective
ON lead_organiser_patch_assignments(lead_organiser_id, effective_from, effective_to)
WHERE effective_to IS NULL;

-- 11. Project creation date optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_created_at
ON projects(created_at DESC)
WHERE created_at > (CURRENT_DATE - INTERVAL '6 months');

-- 12. Employer sites active optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employer_sites_active
ON employer_sites(employer_id, is_active)
WHERE is_active = true;

-- 13. Employer ratings materialized view support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employer_ratings_employer_active
ON employer_ratings(employer_id, rating_date)
WHERE is_active = true;

-- 14. Project stages optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_stage_class
ON projects(stage_class, created_at DESC)
WHERE stage_class NOT IN ('archived');

-- 15. Contact information optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_site_contacts_email_phone
ON site_contacts(email, phone)
WHERE email IS NOT NULL OR phone IS NOT NULL;

-- 16. Project assignments employer lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_assignments_employer_lookup
ON project_assignments(employer_id, status)
WHERE status = 'active';

-- 17. Job sites project lookup optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_project_active
ON job_sites(project_id, is_active)
WHERE is_active = true;

-- 18. Worker placements employer optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_worker_placements_employer_active
ON worker_placements(employer_id, is_active)
WHERE is_active = true;

-- Verify indexes were created
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
    AND indexname IN (
        'idx_projects_name_lower',
        'idx_project_assignments_employer_type',
        'idx_patch_project_mapping_composite',
        'idx_job_sites_location_active',
        'idx_employers_abn',
        'idx_site_employers_site_employer',
        'idx_project_employer_roles_project_type',
        'idx_organiser_patch_assignments_user_effective',
        'idx_lead_organiser_patch_assignments_user_effective',
        'idx_projects_created_at',
        'idx_employer_sites_active',
        'idx_projects_stage_class',
        'idx_site_contacts_email_phone',
        'idx_project_assignments_employer_lookup',
        'idx_job_sites_project_active',
        'idx_worker_placements_employer_active'
    )
ORDER BY tablename, indexname;

-- Performance verification queries
-- You can run these after index creation to verify performance improvements:

-- 1. Test project name search performance
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, name, created_at
FROM projects
WHERE LOWER(name) LIKE '%test%'
LIMIT 10;

-- 2. Test geographic project discovery
EXPLAIN (ANALYZE, BUFFERS)
SELECT p.id, p.name
FROM projects p
JOIN patch_project_mapping ppm ON p.id = ppm.project_id
WHERE ppm.patch_id = 'your-patch-id'
    AND ppm.status = 'active'
LIMIT 20;

-- 3. Test employer project role queries
EXPLAIN (ANALYZE, BUFFERS)
SELECT pa.*, p.name as project_name
FROM project_assignments pa
JOIN projects p ON pa.project_id = p.id
WHERE pa.employer_id = 'employer-uuid-here'
    AND pa.assignment_type = 'builder'
    AND pa.is_active = true;

-- Note: Monitor database performance during index creation
-- Large tables may take several minutes to index
-- Index creation is non-blocking due to CONCURRENTLY
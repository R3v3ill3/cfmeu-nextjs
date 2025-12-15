-- Manual script: run in production to (re)build large indexes concurrently.
-- Usage:
--   psql "$DATABASE_URL" -f supabase/manual/20251201_search_indexes_concurrent.sql

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_name_trgm
ON employers USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_employers_abn_trgm
ON employers USING gin (abn gin_trgm_ops)
WHERE abn IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_name_trgm
ON projects USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_stage_trgm
ON projects USING gin (project_stage gin_trgm_ops)
WHERE project_stage IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_name_trgm
ON job_sites USING gin (name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_full_address_trgm
ON job_sites USING gin (full_address gin_trgm_ops)
WHERE full_address IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_job_sites_location_text_trgm
ON job_sites USING gin (location gin_trgm_ops);








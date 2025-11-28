-- Migration: Search Optimization Indexes - FIXED VERSION
-- Creates trigram indexes for fuzzy text search and improves PostGIS indexes
-- Date: 2025-12-01

-- Enable pg_trigram extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- STEP 1: TRIGRAM INDEXES FOR FUZZY TEXT SEARCH
-- ============================================================================

-- Trigram indexes for employers table
-- This enables fast fuzzy search on employer names
CREATE INDEX IF NOT EXISTS idx_employers_name_trgm
ON employers USING gin (name gin_trgm_ops);

-- Add additional trigram index for employer ABN search
CREATE INDEX IF NOT EXISTS idx_employers_abn_trgm
ON employers USING gin (abn gin_trgm_ops)
WHERE abn IS NOT NULL;

-- Trigram indexes for projects table
-- This enables fast fuzzy search on project names
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
ON projects USING gin (name gin_trgm_ops);

-- Add trigram index for project stage (instead of description which doesn't exist)
CREATE INDEX IF NOT EXISTS idx_projects_stage_trgm
ON projects USING gin (project_stage gin_trgm_ops)
WHERE project_stage IS NOT NULL;

-- Trigram indexes for job_sites table
-- This enables fast fuzzy search on site names and addresses
CREATE INDEX IF NOT EXISTS idx_job_sites_name_trgm
ON job_sites USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_job_sites_full_address_trgm
ON job_sites USING gin (full_address gin_trgm_ops)
WHERE full_address IS NOT NULL;

-- Trigram indexes for location text field
CREATE INDEX IF NOT EXISTS idx_job_sites_location_text_trgm
ON job_sites USING gin (location gin_trgm_ops);

-- ============================================================================
-- STEP 2: WORKER TABLE INDEXES (if workers table exists)
-- ============================================================================

-- Trigram indexes for workers table (if it exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'workers'
  ) THEN
    -- Worker name search
    CREATE INDEX IF NOT EXISTS idx_workers_first_name_trgm
    ON workers USING gin (first_name gin_trgm_ops);

    CREATE INDEX IF NOT EXISTS idx_workers_surname_trgm
    ON workers USING gin (surname gin_trgm_ops);

    -- Combined name search (first_name + surname)
    CREATE INDEX IF NOT EXISTS idx_workers_full_name_trgm
    ON workers USING gin ((first_name || ' ' || surname) gin_trgm_ops);

    -- Worker email search
    CREATE INDEX IF NOT EXISTS idx_workers_email_trgm
    ON workers USING gin (email gin_trgm_ops)
    WHERE email IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 3: POSTGIS SPATIAL INDEXES
-- ============================================================================

-- Create PostGIS GIST index on the geom column (which is the actual geometry column)
DROP INDEX IF EXISTS idx_job_sites_geom;
CREATE INDEX IF NOT EXISTS idx_job_sites_geom
ON job_sites USING GIST (geom);

-- ============================================================================
-- STEP 4: COMPOSITE INDEXES FOR COMMON QUERY PATTERNS
-- ============================================================================

-- Create clustered index on projects for better range queries
-- This helps with ordered pagination
CREATE INDEX IF NOT EXISTS idx_projects_created_at_name
ON projects (created_at DESC, name);

-- Create composite indexes for common search patterns
-- Project searches with tier filtering (guarded for environments without tier column)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'tier'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_projects_tier_created_at
    ON projects (tier, created_at DESC);
  ELSE
    RAISE NOTICE 'Skipping idx_projects_tier_created_at because projects.tier does not exist';
  END IF;
END $$;

-- Project searches with stage_class filtering
CREATE INDEX IF NOT EXISTS idx_projects_stage_class_created_at
ON projects (stage_class, created_at DESC);

-- Composite indexes for job_sites with project relationships
CREATE INDEX IF NOT EXISTS idx_job_sites_project_id_created_at
ON job_sites (project_id, created_at DESC);

-- Employer name searches (simple index)
CREATE INDEX IF NOT EXISTS idx_employers_name
ON employers (name);

-- ============================================================================
-- STEP 5: PARTIAL INDEXES FOR OPTIMIZED PERFORMANCE
-- ============================================================================

-- Active projects only (excluding archived)
CREATE INDEX IF NOT EXISTS idx_projects_active_created_at
ON projects (created_at DESC)
WHERE stage_class != 'archived';

-- Projects with locations only (using actual coordinates)
CREATE INDEX IF NOT EXISTS idx_job_sites_with_coordinates
ON job_sites (project_id, latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- ============================================================================
-- STEP 6: FULL-TEXT SEARCH INDEXES
-- ============================================================================

-- Create full-text search indexes for complex search scenarios
-- Using built-in 'english' configuration (immutable, works in indexes)
-- Note: Only including text columns (no enum casts) to ensure immutability
-- Projects full-text search (using text columns only)
CREATE INDEX IF NOT EXISTS idx_projects_fulltext
ON projects USING gin (to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(project_stage, '')
));

-- Employers full-text search
CREATE INDEX IF NOT EXISTS idx_employers_fulltext
ON employers USING gin (to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(abn, '')
));

-- Job sites full-text search
CREATE INDEX IF NOT EXISTS idx_job_sites_fulltext
ON job_sites USING gin (to_tsvector('english',
  coalesce(name, '') || ' ' ||
  coalesce(full_address, '') || ' ' ||
  coalesce(location, '')
));

-- ============================================================================
-- STEP 7: INDEX COMMENTS FOR DOCUMENTATION
-- ============================================================================

-- Add comments for documentation
COMMENT ON INDEX idx_employers_name_trgm IS 'Trigram index for fast fuzzy name search on employers';
COMMENT ON INDEX idx_projects_name_trgm IS 'Trigram index for fast fuzzy name search on projects';
COMMENT ON INDEX idx_job_sites_name_trgm IS 'Trigram index for fast fuzzy name search on job sites';
COMMENT ON INDEX idx_job_sites_full_address_trgm IS 'Trigram index for fuzzy address search on job sites';
COMMENT ON INDEX idx_job_sites_geom IS 'PostGIS GIST index for spatial queries on job sites geometry column';
COMMENT ON INDEX idx_projects_fulltext IS 'Full-text search index for projects using English dictionary';
COMMENT ON INDEX idx_employers_fulltext IS 'Full-text search index for employers using English dictionary';
COMMENT ON INDEX idx_job_sites_fulltext IS 'Full-text search index for job sites using English dictionary';

-- ============================================================================
-- STEP 8: UPDATE TABLE STATISTICS
-- ============================================================================

-- Update table statistics for better query planning
ANALYZE employers;
ANALYZE projects;
ANALYZE job_sites;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'workers'
  ) THEN
    EXECUTE 'ANALYZE workers';
  END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Search Index Migration Complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Created indexes for:';
  RAISE NOTICE '- Employer name/ABN fuzzy search';
  RAISE NOTICE '- Project name fuzzy search';
  RAISE NOTICE '- Job site name/address fuzzy search';
  RAISE NOTICE '- PostGIS spatial queries';
  RAISE NOTICE '- Composite query patterns';
  RAISE NOTICE '- Full-text search';
  RAISE NOTICE 'Run supabase/manual/20251201_search_indexes_concurrent.sql in production to rebuild critical indexes concurrently.';
  RAISE NOTICE '========================================';
END $$;
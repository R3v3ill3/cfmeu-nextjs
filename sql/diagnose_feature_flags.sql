-- Diagnostic script for feature flag configuration
-- Verifies feature flag environment variables and system state

-- 1. Check if feature flags table exists (if using database-stored flags)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name LIKE '%feature%flag%'
ORDER BY table_name, ordinal_position;

-- 2. Check environment-related configuration (if stored in database)
-- Note: This assumes a feature_flags table might exist
SELECT 
  'Feature flags are configured via environment variables (RATING_SYSTEM_ENABLED, etc.)' as note,
  'Check Vercel environment variables or .env files' as action;

-- 3. Check for rating system related tables and data
SELECT 
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t.table_name) as column_count,
  pg_size_pretty(pg_total_relation_size('public.' || table_name)) as size
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND (
    table_name LIKE '%rating%' 
    OR table_name LIKE '%assessment%'
    OR table_name LIKE '%union_respect%'
  )
ORDER BY table_name;

-- 4. Check for rating-related data (if tables exist)
-- Note: Adjust table names based on actual schema
SELECT 
  'union_respect_assessments_4point' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as records_last_7_days,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as records_last_24_hours
FROM union_respect_assessments_4point
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'union_respect_assessments_4point');

-- 5. Check employer_final_ratings table (if exists)
SELECT 
  'employer_final_ratings' as table_name,
  COUNT(*) as total_ratings,
  COUNT(*) FILTER (WHERE is_active = true) as active_ratings,
  COUNT(*) FILTER (WHERE rating_date > NOW() - INTERVAL '7 days') as ratings_last_7_days,
  COUNT(DISTINCT employer_id) as unique_employers
FROM employer_final_ratings
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employer_final_ratings');

-- 6. Check for any rating-related RPC functions
SELECT 
  routine_name,
  routine_type,
  data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND (
    routine_name LIKE '%rating%' 
    OR routine_name LIKE '%assessment%'
  )
ORDER BY routine_name;

-- 7. Summary of rating system state
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'union_respect_assessments_4point')
      THEN 'Rating tables exist'
    ELSE 'Rating tables do not exist'
  END as table_status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'employer_final_ratings')
      THEN 'Final ratings table exists'
    ELSE 'Final ratings table does not exist'
  END as ratings_table_status,
  'Check RATING_SYSTEM_ENABLED and RATING_SYSTEM_4POINT environment variables' as configuration_note;


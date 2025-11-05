-- Diagnostic script for RLS (Row Level Security) performance issues
-- Identifies slow RLS policies and potential performance bottlenecks

-- 1. Check for slow queries on key tables (requires pg_stat_statements extension)
-- Note: This requires the extension to be enabled and appropriate permissions
-- Using relname instead of tablename for compatibility
SELECT 
  schemaname,
  relname as tablename,
  seq_scan,
  seq_tup_read,
  idx_scan,
  idx_tup_fetch,
  n_tup_ins,
  n_tup_upd,
  n_tup_del,
  n_live_tup,
  n_dead_tup,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('profiles', 'projects', 'employers', 'job_sites', 'project_assignments', 'site_employers')
ORDER BY seq_scan DESC;

-- 2. Check RLS policies on key tables
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'projects', 'employers', 'job_sites', 'project_assignments', 'site_employers')
ORDER BY tablename, policyname;

-- 3. Check for missing indexes on foreign keys (can slow RLS)
SELECT
  tc.table_schema,
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  CASE 
    WHEN idx.indexname IS NULL THEN 'MISSING_INDEX'
    ELSE 'HAS_INDEX'
  END as index_status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
LEFT JOIN pg_indexes idx
  ON idx.schemaname = tc.table_schema
  AND idx.tablename = tc.table_name
  AND idx.indexdef LIKE '%' || kcu.column_name || '%'
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
  AND tc.table_name IN ('profiles', 'projects', 'employers', 'job_sites', 'project_assignments', 'site_employers')
ORDER BY tc.table_name, kcu.column_name;

-- 4. Check table sizes and dead tuples (indicates need for VACUUM)
SELECT 
  schemaname,
  relname as tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||relname)) AS size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||relname)) AS table_size,
  n_live_tup,
  n_dead_tup,
  CASE 
    WHEN n_live_tup > 0 THEN ROUND((n_dead_tup::numeric / n_live_tup::numeric) * 100, 2)
    ELSE 0
  END as dead_tuple_percentage
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('profiles', 'projects', 'employers', 'job_sites', 'project_assignments', 'site_employers')
ORDER BY n_dead_tup DESC;

-- 5. Check for long-running queries (if pg_stat_activity is accessible)
-- Note: This requires appropriate permissions
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  NOW() - query_start as duration,
  LEFT(query, 100) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query_start < NOW() - INTERVAL '5 seconds'
  AND query NOT LIKE '%pg_stat_activity%'
ORDER BY query_start;

-- 6. Check indexes on frequently queried columns
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'projects', 'employers', 'job_sites')
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;


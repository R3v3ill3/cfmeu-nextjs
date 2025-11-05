-- Diagnostic script for database connection issues
-- Checks connection pool status, active connections, and potential bottlenecks

-- 1. Check current connection count (requires pg_stat_activity access)
SELECT 
  COUNT(*) as total_connections,
  COUNT(*) FILTER (WHERE state = 'active') as active_connections,
  COUNT(*) FILTER (WHERE state = 'idle') as idle_connections,
  COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
  COUNT(*) FILTER (WHERE state = 'waiting') as waiting_connections,
  COUNT(*) FILTER (WHERE application_name LIKE '%Supabase%') as supabase_connections,
  COUNT(*) FILTER (WHERE application_name LIKE '%PostgREST%') as postgrest_connections
FROM pg_stat_activity
WHERE datname = current_database();

-- 2. Check for long-running queries
SELECT 
  pid,
  usename,
  application_name,
  client_addr,
  state,
  query_start,
  state_change,
  NOW() - query_start as duration,
  wait_event_type,
  wait_event,
  LEFT(query, 200) as query_preview
FROM pg_stat_activity
WHERE state != 'idle'
  AND query NOT LIKE '%pg_stat_activity%'
  AND query_start < NOW() - INTERVAL '10 seconds'
ORDER BY query_start;

-- 3. Check connection sources (help identify connection pool issues)
SELECT 
  application_name,
  COUNT(*) as connection_count,
  COUNT(*) FILTER (WHERE state = 'active') as active,
  COUNT(*) FILTER (WHERE state = 'idle') as idle,
  MAX(NOW() - backend_start) as oldest_connection_duration
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY application_name
ORDER BY connection_count DESC;

-- 4. Check for locks (indicates blocking queries)
SELECT 
  blocked_locks.pid AS blocked_pid,
  blocked_activity.usename AS blocked_user,
  blocking_locks.pid AS blocking_pid,
  blocking_activity.usename AS blocking_user,
  blocked_activity.query AS blocked_statement,
  blocking_activity.query AS blocking_statement,
  blocked_activity.application_name AS blocked_application,
  blocking_activity.application_name AS blocking_application,
  NOW() - blocked_activity.query_start AS blocked_duration
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
  ON blocking_locks.locktype = blocked_locks.locktype
  AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
  AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
  AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
  AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
  AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
  AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
  AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
  AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
  AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
  AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- 5. Check database size and connection limits
SELECT 
  current_database() as database_name,
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections,
  (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as current_connections,
  (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') - 
    (SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()) as available_connections;

-- 6. Check recent query performance (requires pg_stat_statements)
-- Note: This extension may not be enabled
SELECT 
  query,
  calls,
  total_exec_time,
  mean_exec_time,
  max_exec_time,
  min_exec_time,
  stddev_exec_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements
WHERE query LIKE '%profiles%' OR query LIKE '%projects%' OR query LIKE '%employers%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- 7. Check for connection pool saturation patterns
SELECT 
  DATE_TRUNC('minute', query_start) as minute,
  COUNT(*) as query_count,
  COUNT(*) FILTER (WHERE state = 'active') as active_count,
  AVG(EXTRACT(EPOCH FROM (NOW() - query_start))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (NOW() - query_start))) as max_duration_seconds
FROM pg_stat_activity
WHERE query_start > NOW() - INTERVAL '1 hour'
  AND query NOT LIKE '%pg_stat_activity%'
GROUP BY DATE_TRUNC('minute', query_start)
ORDER BY minute DESC
LIMIT 60;


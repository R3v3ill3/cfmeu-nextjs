-- Diagnostic script for authentication session issues
-- Checks active sessions, session expiry, and potential session loss
-- Note: Supabase auth.sessions table structure may vary - using available columns

-- 1. Check active sessions in auth schema (if accessible)
-- Note: auth.sessions may not be directly accessible via PostgREST
-- This query will work if you have direct database access
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  -- expires_at column may not exist in all Supabase versions
  -- Using created_at + 1 hour as approximate expiry
  created_at + INTERVAL '1 hour' as approximate_expiry,
  CASE 
    WHEN created_at < NOW() - INTERVAL '1 hour' THEN 'LIKELY_EXPIRED'
    WHEN created_at < NOW() - INTERVAL '50 minutes' THEN 'EXPIRING_SOON'
    ELSE 'ACTIVE'
  END as status
FROM auth.sessions
WHERE created_at > NOW() - INTERVAL '1 day'  -- Check sessions from last 24 hours
ORDER BY created_at DESC
LIMIT 50;

-- 2. Count sessions per user (potential session leakage)
SELECT 
  user_id,
  COUNT(*) as session_count,
  MIN(created_at) as oldest_session,
  MAX(created_at) as newest_session,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '1 hour') as likely_expired_count,
  COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as likely_active_count
FROM auth.sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) > 5  -- Flag users with many sessions
ORDER BY session_count DESC;

-- 4. Check user profiles and role assignments
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.created_at,
  p.updated_at,
  p.last_login_at,
  p.is_active,
  -- Note: Cannot directly count sessions without expires_at column
  -- Using last_login_at as proxy for recent activity
  CASE 
    WHEN p.last_login_at > NOW() - INTERVAL '1 hour' THEN 'RECENTLY_ACTIVE'
    WHEN p.last_login_at > NOW() - INTERVAL '24 hours' THEN 'ACTIVE_TODAY'
    WHEN p.last_login_at > NOW() - INTERVAL '7 days' THEN 'ACTIVE_THIS_WEEK'
    ELSE 'INACTIVE'
  END as activity_status
FROM profiles p
WHERE p.role IN ('admin', 'lead_organiser')
ORDER BY p.updated_at DESC
LIMIT 20;

-- 5. Check for users with missing roles (should not happen)
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  CASE 
    WHEN p.role IS NULL THEN 'MISSING_ROLE'
    WHEN p.role = '' THEN 'EMPTY_ROLE'
    WHEN p.role NOT IN ('admin', 'lead_organiser', 'organiser', 'delegate', 'viewer') THEN 'INVALID_ROLE'
    ELSE 'OK'
  END as role_status
FROM profiles p
WHERE p.role IS NULL OR p.role = '' OR p.role NOT IN ('admin', 'lead_organiser', 'organiser', 'delegate', 'viewer')
LIMIT 50;

-- 6. Recent authentication events (requires auth.audit_log_entries if available)
-- Note: This may not be available in all Supabase setups
SELECT 
  id,
  instance_id,
  payload->>'actor_id' as user_id,
  payload->>'action' as action,
  created_at
FROM auth.audit_log_entries
WHERE created_at > NOW() - INTERVAL '1 day'
  AND payload->>'action' IN ('user_logged_in', 'user_logged_out', 'token_refreshed', 'token_revoked')
ORDER BY created_at DESC
LIMIT 100;


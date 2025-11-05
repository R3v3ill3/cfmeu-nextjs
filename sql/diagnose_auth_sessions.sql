-- Diagnostic script for authentication session issues
-- Checks active sessions, session expiry, and potential session loss

-- 1. Check active sessions in auth schema
SELECT 
  id,
  user_id,
  created_at,
  updated_at,
  expires_at,
  token_type,
  EXTRACT(EPOCH FROM (expires_at - NOW())) as seconds_until_expiry,
  CASE 
    WHEN expires_at < NOW() THEN 'EXPIRED'
    WHEN expires_at < NOW() + INTERVAL '1 hour' THEN 'EXPIRING_SOON'
    ELSE 'ACTIVE'
  END as status
FROM auth.sessions
WHERE expires_at > NOW() - INTERVAL '1 day'  -- Check sessions from last 24 hours
ORDER BY expires_at DESC
LIMIT 50;

-- 2. Count sessions per user (potential session leakage)
SELECT 
  user_id,
  COUNT(*) as session_count,
  MIN(created_at) as oldest_session,
  MAX(created_at) as newest_session,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired_count,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_count
FROM auth.sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY user_id
HAVING COUNT(*) > 5  -- Flag users with many sessions
ORDER BY session_count DESC;

-- 3. Check for session expiry patterns
SELECT 
  DATE_TRUNC('hour', expires_at) as expiry_hour,
  COUNT(*) as session_count,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active
FROM auth.sessions
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', expires_at)
ORDER BY expiry_hour DESC;

-- 4. Check user profiles and role assignments
SELECT 
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.created_at,
  p.updated_at,
  (SELECT COUNT(*) FROM auth.sessions WHERE user_id = p.id AND expires_at > NOW()) as active_sessions
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


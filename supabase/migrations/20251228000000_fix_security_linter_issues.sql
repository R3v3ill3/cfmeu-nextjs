-- ============================================================================
-- SECURITY LINTER REMEDIATION
-- Migration: 2025-12-28
--
-- Context:
-- - Platform serves 30-50 prescreened trusted internal users
-- - External security (preventing unauthenticated access) is the focus
-- - Internal restrictions are for UX simplification, not security
--
-- This migration addresses:
-- 1. auth_users_exposed: employer_change_history view exposes auth.users to anon
-- 2. rls_disabled_in_public: 5 tables without RLS enabled
--
-- NOT addressed (intentionally):
-- - 45 security_definer_view warnings - these views intentionally bypass RLS
--   for dashboard aggregation and reporting across patch boundaries
-- ============================================================================

-- ============================================================================
-- PART 1: FIX AUTH.USERS EXPOSURE IN employer_change_history
-- ============================================================================
-- Issue: The view joins auth.users directly, exposing user data to anon role
-- Fix: Replace auth.users with public.profiles (which has RLS) and add security_invoker
-- Note: Must DROP first because column type changes from varchar(255) to text

DROP VIEW IF EXISTS public.employer_change_history;

CREATE VIEW public.employer_change_history 
WITH (security_invoker = true) AS
SELECT
  eca.*,
  e.name as employer_name,
  p.full_name as changed_by_name,
  p.email::varchar(255) as changed_by_email,  -- Cast to preserve original type
  CASE
    WHEN eca.conflict_with_change_id IS NOT NULL THEN true
    ELSE false
  END as has_conflict
FROM public.employer_change_audit eca
JOIN public.employers e ON eca.employer_id = e.id
LEFT JOIN public.profiles p ON eca.changed_by = p.id
ORDER BY eca.changed_at DESC;

COMMENT ON VIEW public.employer_change_history IS 
'Shows employer change audit history with user details from profiles table. 
Uses security_invoker=true to respect RLS policies of the querying user.';

-- ============================================================================
-- PART 2: ENABLE RLS ON TABLES (PREVENT ANONYMOUS ACCESS)
-- ============================================================================
-- These policies allow full access to authenticated users
-- They only block unauthenticated (anon) requests

-- ----------------------------------------------------------------------------
-- 2.1: spatial_ref_sys (PostGIS system table)
-- ----------------------------------------------------------------------------
-- This is a PostGIS metadata table. We revoke access from anon/authenticated
-- and only allow service_role access. The table is used internally by PostGIS.

DO $$
BEGIN
  -- Check if table exists before modifying permissions
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'spatial_ref_sys' AND table_schema = 'public') THEN
    -- Revoke all permissions from anon and authenticated
    REVOKE ALL ON public.spatial_ref_sys FROM anon, authenticated;
    -- Grant SELECT to service_role (needed for PostGIS operations)
    GRANT SELECT ON public.spatial_ref_sys TO service_role;
    RAISE NOTICE 'spatial_ref_sys: Revoked access from anon/authenticated, granted to service_role';
  ELSE
    RAISE NOTICE 'spatial_ref_sys: Table does not exist, skipping';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.2: mat_view_refresh_log (Materialized view refresh logging)
-- ----------------------------------------------------------------------------
-- Contains refresh timestamps and metrics - not sensitive but should be protected

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mat_view_refresh_log' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE public.mat_view_refresh_log ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "mat_view_refresh_log_authenticated_read" ON public.mat_view_refresh_log;
    DROP POLICY IF EXISTS "mat_view_refresh_log_authenticated_all" ON public.mat_view_refresh_log;
    
    -- Allow all authenticated users to read (for monitoring dashboards)
    CREATE POLICY "mat_view_refresh_log_authenticated_read" ON public.mat_view_refresh_log
      FOR SELECT TO authenticated USING (true);
    
    -- Allow all authenticated users to insert (for refresh functions)
    CREATE POLICY "mat_view_refresh_log_authenticated_all" ON public.mat_view_refresh_log
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'mat_view_refresh_log: RLS enabled with authenticated access';
  ELSE
    RAISE NOTICE 'mat_view_refresh_log: Table does not exist, skipping';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.3: employer_canonical_audit (Canonical name promotion audit trail)
-- ----------------------------------------------------------------------------
-- Contains decision history for canonical name changes

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employer_canonical_audit' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE public.employer_canonical_audit ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "employer_canonical_audit_authenticated_all" ON public.employer_canonical_audit;
    
    -- Allow all authenticated users full access
    CREATE POLICY "employer_canonical_audit_authenticated_all" ON public.employer_canonical_audit
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'employer_canonical_audit: RLS enabled with authenticated access';
  ELSE
    RAISE NOTICE 'employer_canonical_audit: Table does not exist, skipping';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.4: search_performance_log (Search performance metrics)
-- ----------------------------------------------------------------------------
-- Contains search timing and performance data

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'search_performance_log' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE public.search_performance_log ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "search_performance_log_authenticated_all" ON public.search_performance_log;
    
    -- Allow all authenticated users full access
    CREATE POLICY "search_performance_log_authenticated_all" ON public.search_performance_log
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'search_performance_log: RLS enabled with authenticated access';
  ELSE
    RAISE NOTICE 'search_performance_log: Table does not exist, skipping';
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 2.5: employer_change_log (Employer change tracking for incremental refresh)
-- ----------------------------------------------------------------------------
-- Contains change tracking data for materialized view incremental refresh

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'employer_change_log' AND table_schema = 'public') THEN
    -- Enable RLS
    ALTER TABLE public.employer_change_log ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "employer_change_log_authenticated_all" ON public.employer_change_log;
    
    -- Allow all authenticated users full access
    -- Note: Triggers insert via table owner context, which bypasses RLS
    CREATE POLICY "employer_change_log_authenticated_all" ON public.employer_change_log
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
    
    RAISE NOTICE 'employer_change_log: RLS enabled with authenticated access';
  ELSE
    RAISE NOTICE 'employer_change_log: Table does not exist, skipping';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
  v_view_exists boolean;
  v_uses_auth_users boolean;
BEGIN
  -- Verify employer_change_history no longer references auth.users
  SELECT EXISTS (
    SELECT 1 FROM pg_views 
    WHERE viewname = 'employer_change_history' 
    AND schemaname = 'public'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    SELECT definition LIKE '%auth.users%' 
    FROM pg_views 
    WHERE viewname = 'employer_change_history' 
    AND schemaname = 'public'
    INTO v_uses_auth_users;
    
    IF v_uses_auth_users THEN
      RAISE WARNING 'employer_change_history still references auth.users!';
    ELSE
      RAISE NOTICE 'VERIFIED: employer_change_history no longer references auth.users';
    END IF;
  END IF;
END $$;

-- Log completion
DO $$
BEGIN
  RAISE NOTICE '============================================================';
  RAISE NOTICE 'Security linter remediation migration completed successfully';
  RAISE NOTICE '- Fixed: auth_users_exposed (employer_change_history)';
  RAISE NOTICE '- Fixed: RLS enabled on mat_view_refresh_log';
  RAISE NOTICE '- Fixed: RLS enabled on employer_canonical_audit';
  RAISE NOTICE '- Fixed: RLS enabled on search_performance_log';
  RAISE NOTICE '- Fixed: RLS enabled on employer_change_log';
  RAISE NOTICE '- Fixed: spatial_ref_sys permissions restricted';
  RAISE NOTICE '- Accepted: 45 security_definer_view warnings (intentional)';
  RAISE NOTICE '============================================================';
END $$;


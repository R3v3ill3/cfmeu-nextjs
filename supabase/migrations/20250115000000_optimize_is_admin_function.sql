-- Migration: Optimize is_admin() function to prevent RLS circular dependencies
-- Description: Makes is_admin() SECURITY DEFINER to bypass RLS when checking admin status
-- This prevents circular dependencies where profiles RLS policy calls is_admin() which queries profiles
-- Risk Level: LOW - Function only checks admin status, doesn't modify data
-- Impact: SAFE - Improves performance and prevents race conditions

BEGIN;

-- Recreate is_admin() as SECURITY DEFINER using CREATE OR REPLACE
-- This preserves existing dependencies (RLS policies) while updating the function
-- SECURITY DEFINER allows the function to bypass RLS when checking admin status, preventing circular dependencies
CREATE OR REPLACE FUNCTION "public"."is_admin"() 
RETURNS boolean
LANGUAGE "sql" 
STABLE 
SECURITY DEFINER
SET "search_path" TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION "public"."is_admin"() TO authenticated;

-- Add comment explaining the SECURITY DEFINER usage
COMMENT ON FUNCTION "public"."is_admin"() IS 
'Checks if the current authenticated user has admin role. Uses SECURITY DEFINER to bypass RLS and prevent circular dependencies when used in RLS policies.';

COMMIT;

-- Log the migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration 20250115000000 completed successfully: Optimized is_admin() function with SECURITY DEFINER';
  RAISE NOTICE 'This prevents circular dependencies in RLS policies and improves performance';
END $$;


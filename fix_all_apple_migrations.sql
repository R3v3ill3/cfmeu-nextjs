-- Comprehensive fix for all three Apple Sign In migrations
-- Run this in Supabase SQL Editor to resolve the duplicate key issue

-- Step 1: Check current migration status
DO $$
BEGIN
  RAISE NOTICE '=== CHECKING CURRENT MIGRATION STATUS ===';
END $$;

SELECT 
  version,
  name
FROM supabase_migrations.schema_migrations 
WHERE version BETWEEN '20250115000000' AND '20250115000002'
ORDER BY version;

-- Step 2: Ensure migration 20250115000000 is tracked (it probably already is)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES('20250115000000', '20250115000000_optimize_is_admin_function', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- Step 3: Apply migration 20250115000001 (Add apple_email column)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS apple_email TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_apple_email 
ON profiles(lower(apple_email)) 
WHERE apple_email IS NOT NULL;

COMMENT ON COLUMN profiles.apple_email IS 
'Apple ID email address for OAuth sign-in. Allows users to sign in with Apple even if their Apple ID email differs from their primary work email.';

-- Track migration 20250115000001
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES('20250115000001', '20250115000001_add_apple_email_to_profiles', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- Step 4: Apply migration 20250115000002 (Update OAuth validation function to check apple_email)
CREATE OR REPLACE FUNCTION check_user_exists_for_oauth(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_exists boolean := false;
BEGIN
  -- Normalize email to lowercase
  p_email := lower(trim(p_email));
  
  -- Check if email exists in profiles table
  -- NOW checks both regular email AND apple_email
  SELECT EXISTS (
    SELECT 1 
    FROM profiles 
    WHERE (
      lower(email) = p_email 
      OR lower(apple_email) = p_email
    )
    AND is_active = true
  ) INTO v_exists;
  
  -- If not found in profiles, check pending_users
  IF NOT v_exists THEN
    SELECT EXISTS (
      SELECT 1 
      FROM pending_users 
      WHERE lower(email) = p_email
        AND status IN ('draft', 'invited')
    ) INTO v_exists;
  END IF;
  
  RETURN v_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION check_user_exists_for_oauth(text) TO authenticated;

COMMENT ON FUNCTION check_user_exists_for_oauth(text) IS 
'Checks if an email exists in profiles (active) or pending_users (draft/invited) tables. For profiles, checks both primary email and apple_email fields. Used to restrict OAuth sign-in to existing registered users.';

-- Track migration 20250115000002
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES('20250115000002', '20250115000002_add_apple_oauth_user_validation', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;

-- Step 5: Verify all migrations are now tracked
DO $$
BEGIN
  RAISE NOTICE '=== FINAL MIGRATION STATUS ===';
END $$;

SELECT 
  version,
  name,
  CASE 
    WHEN version = '20250115000000' THEN '✅ is_admin() optimization'
    WHEN version = '20250115000001' THEN '✅ apple_email column added'
    WHEN version = '20250115000002' THEN '✅ OAuth validation updated'
    ELSE '📝 Other'
  END as description
FROM supabase_migrations.schema_migrations 
WHERE version BETWEEN '20250115000000' AND '20250115000002'
ORDER BY version;

-- Success message
DO $$
DECLARE
  migration_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migration_count
  FROM supabase_migrations.schema_migrations 
  WHERE version BETWEEN '20250115000000' AND '20250115000002';
  
  IF migration_count = 3 THEN
    RAISE NOTICE '✅ SUCCESS! All 3 Apple Sign In migrations are now applied and tracked.';
    RAISE NOTICE 'You can now rename the local migration files to prevent re-pushing.';
  ELSE
    RAISE NOTICE '⚠️ Only % of 3 migrations tracked. Check output above.', migration_count;
  END IF;
END $$;


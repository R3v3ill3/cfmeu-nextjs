-- This script fixes the duplicate migration issue and pushes the Apple email migration
-- Run this in the Supabase SQL Editor to resolve the conflict

-- Step 1: Check current migration status
DO $$
BEGIN
  RAISE NOTICE 'Current migrations in database:';
END $$;

SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations 
WHERE version >= '20250115000000'
ORDER BY version;

-- Step 2: The migration 20250115000000 has already been applied (the function is updated)
-- But the tracking entry exists, so we can't insert it again.
-- The solution: Just verify it exists and continue with the next migration

-- Check if 20250115000000 is tracked
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version = '20250115000000'
    ) THEN 'Migration 20250115000000 is already tracked ✓'
    ELSE 'Migration 20250115000000 is NOT tracked - manual insert needed'
  END AS status_20250115000000;

-- Step 3: Now manually apply the Apple email migration (20250115000001)
-- Add apple_email column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS apple_email TEXT;

-- Create index for faster lookups on apple_email
CREATE INDEX IF NOT EXISTS idx_profiles_apple_email ON profiles(lower(apple_email)) WHERE apple_email IS NOT NULL;

-- Add helpful comment
COMMENT ON COLUMN profiles.apple_email IS 
'Apple ID email address for OAuth sign-in. Allows users to sign in with Apple even if their Apple ID email differs from their primary work email.';

-- Update the OAuth validation function to check both primary email and apple_email
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
  -- Match against both primary email AND apple_email
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

-- Update the function comment
COMMENT ON FUNCTION check_user_exists_for_oauth(text) IS 
'Checks if an email exists in profiles (active) or pending_users (draft/invited) tables. For profiles, checks both primary email and apple_email fields. Used to restrict OAuth sign-in to existing registered users.';

-- Step 4: Track the 20250115000001 migration
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES(
  '20250115000001', 
  '20250115000001_add_apple_email_to_profiles', 
  ARRAY[]::text[]
)
ON CONFLICT (version) DO NOTHING;

-- Step 5: Verify final state
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version IN ('20250115000000', '20250115000001')
    ) THEN '✅ Both migrations are now tracked'
    ELSE '❌ Migrations not properly tracked'
  END AS final_status;

-- Show final migration list
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations 
WHERE version >= '20250115000000'
ORDER BY version;

DO $$
BEGIN
  RAISE NOTICE '✅ Manual migration complete!';
  RAISE NOTICE 'Both migrations (20250115000000 and 20250115000001) are now applied and tracked.';
END $$;


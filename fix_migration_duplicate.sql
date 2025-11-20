-- Fix for duplicate migration tracking issue
-- Problem: Migration 20250115000000 was applied but tracking insert failed
-- This SQL checks and fixes the tracking table

-- Step 1: Check if migration is tracked
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations 
      WHERE version = '20250115000000'
    ) THEN '✅ Migration 20250115000000 is already tracked - no action needed'
    ELSE '⚠️ Migration 20250115000000 is NOT tracked - needs manual insert'
  END AS migration_status;

-- Step 2: If migration is NOT tracked, insert it manually
-- (Run this ONLY if the above query shows it's NOT tracked)
INSERT INTO supabase_migrations.schema_migrations(version, name, statements)
VALUES(
  '20250115000000', 
  '20250115000000_optimize_is_admin_function', 
  ARRAY[]::text[]
)
ON CONFLICT (version) DO NOTHING;

-- Step 3: Verify it's now tracked
SELECT version, name, inserted_at
FROM supabase_migrations.schema_migrations 
WHERE version IN ('20250115000000', '20250115000001')
ORDER BY version;

-- Fix for duplicate migration error
-- This removes the failed migration from schema_migrations so we can retry

-- Step 1: Check what migrations are registered
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '20251022000000'
ORDER BY version;

-- Step 2: Remove the failed migration entry
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20251022000000';

-- Step 3: Verify it's removed
SELECT version, name FROM supabase_migrations.schema_migrations
WHERE version >= '20251022000000'
ORDER BY version;

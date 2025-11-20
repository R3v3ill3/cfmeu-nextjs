-- Quick diagnostic query to see what migrations are tracked in your database
-- Copy this into Supabase SQL Editor to see your current migration state

SELECT 
  version,
  name,
  inserted_at,
  CASE 
    WHEN version = '20250115000000' THEN '✅ This one exists (causing the duplicate error)'
    WHEN version = '20250115000001' THEN '✅ Apple email migration'
    ELSE '📝 Other migration'
  END as notes
FROM supabase_migrations.schema_migrations 
WHERE version >= '20250115000000'
ORDER BY version DESC;

-- If you see 20250115000000 but NOT 20250115000001, then:
-- 1. The first migration is tracked (that's why you get the duplicate error)
-- 2. The second migration needs to be applied manually


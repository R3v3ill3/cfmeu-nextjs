-- Migration: Fix categories catalog to show ALL available categories
-- This migration updates v_contractor_categories_catalog to show all trades/roles
-- from reference tables, not just those currently assigned to employers

-- ============================================================================
-- PROBLEM: Current view only shows categories that have employers assigned
-- SOLUTION: Query reference tables and LEFT JOIN to get counts
-- ============================================================================

-- Drop and recreate the view to show ALL available categories
CREATE OR REPLACE VIEW public.v_contractor_categories_catalog AS
-- All trades from reference table (with counts from actual usage)
SELECT
  'trade'::text as category_type,
  tt.code as category_code,
  tt.name as category_name,
  COALESCE(usage.current_employers, 0)::bigint as current_employers,
  COALESCE(usage.total_employers, 0)::bigint as total_employers
FROM public.trade_types tt
LEFT JOIN (
  SELECT 
    category_code,
    COUNT(DISTINCT employer_id) FILTER (WHERE is_current = true) AS current_employers,
    COUNT(DISTINCT employer_id) AS total_employers
  FROM public.v_employer_contractor_categories
  WHERE category_type = 'trade'
  GROUP BY category_code
) usage ON usage.category_code = tt.code
WHERE tt.is_active = true

UNION ALL

-- All contractor roles from reference table (with counts from actual usage)
SELECT
  'contractor_role'::text as category_type,
  crt.code as category_code,
  crt.name as category_name,
  COALESCE(usage.current_employers, 0)::bigint as current_employers,
  COALESCE(usage.total_employers, 0)::bigint as total_employers
FROM public.contractor_role_types crt
LEFT JOIN (
  SELECT 
    category_code,
    COUNT(DISTINCT employer_id) FILTER (WHERE is_current = true) AS current_employers,
    COUNT(DISTINCT employer_id) AS total_employers
  FROM public.v_employer_contractor_categories
  WHERE category_type = 'contractor_role'
  GROUP BY category_code
) usage ON usage.category_code = crt.code
WHERE crt.is_active = true

ORDER BY category_type, category_code;

COMMENT ON VIEW public.v_contractor_categories_catalog IS 
  'Complete catalog of ALL available contractor categories (roles and trades) from reference tables, with employer usage counts. Shows ALL categories even if no employers assigned (count = 0). Updated 2025-10-21 to fix dropdown limitation.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_total_categories INTEGER;
  v_trade_categories INTEGER;
  v_role_categories INTEGER;
  v_categories_with_zero_employers INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_categories 
  FROM v_contractor_categories_catalog;
  
  SELECT COUNT(*) INTO v_trade_categories 
  FROM v_contractor_categories_catalog 
  WHERE category_type = 'trade';
  
  SELECT COUNT(*) INTO v_role_categories 
  FROM v_contractor_categories_catalog 
  WHERE category_type = 'contractor_role';
  
  SELECT COUNT(*) INTO v_categories_with_zero_employers
  FROM v_contractor_categories_catalog
  WHERE total_employers = 0;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Categories Catalog Update Summary ===';
  RAISE NOTICE 'Total categories in catalog: %', v_total_categories;
  RAISE NOTICE 'Trade categories: %', v_trade_categories;
  RAISE NOTICE 'Contractor role categories: %', v_role_categories;
  RAISE NOTICE 'Categories with 0 employers (now visible): %', v_categories_with_zero_employers;
  RAISE NOTICE '';
  
  -- Verify critical trades
  IF EXISTS(
    SELECT 1 FROM v_contractor_categories_catalog 
    WHERE category_type = 'trade' AND category_code = 'cleaning'
  ) THEN
    RAISE NOTICE '✓ "cleaning" now visible in dropdown';
  ELSE
    RAISE WARNING '✗ "cleaning" STILL not in dropdown - check trade_types table!';
  END IF;
  
  IF EXISTS(
    SELECT 1 FROM v_contractor_categories_catalog 
    WHERE category_type = 'trade' AND category_code = 'final_clean'
  ) THEN
    RAISE NOTICE '✓ "final_clean" now visible in dropdown';
  ELSE
    RAISE WARNING '✗ "final_clean" STILL not in dropdown - check trade_types table!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Categories catalog view updated successfully!';
  RAISE NOTICE 'All active trades and roles now visible in dropdowns, regardless of usage.';
END $$;




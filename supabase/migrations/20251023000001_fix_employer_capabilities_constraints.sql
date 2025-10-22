-- Migration: Fix employer_capabilities unique constraints for ON CONFLICT support
-- Problem: Partial unique indexes cannot be used directly in Supabase JS onConflict clauses
-- Solution: Replace partial unique indexes with actual unique constraints
--
-- PostgreSQL's unique constraints allow multiple NULL values, which gives us the same
-- behavior as the partial indexes but with proper ON CONFLICT support.

-- ============================================================================
-- STEP 1: Drop existing partial unique indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_employer_capabilities_role_unique;
DROP INDEX IF EXISTS idx_employer_capabilities_trade_unique;

-- ============================================================================
-- STEP 2: Add proper unique constraints
-- ============================================================================

-- Unique constraint for contractor_role entries
-- This allows multiple rows with same employer_id + capability_type when contractor_role_type_id is NULL
-- because PostgreSQL allows multiple NULLs in unique constraints
ALTER TABLE employer_capabilities
  ADD CONSTRAINT employer_capabilities_role_unique
  UNIQUE (employer_id, capability_type, contractor_role_type_id);

-- Unique constraint for trade entries
-- This allows multiple rows with same employer_id + capability_type when trade_type_id is NULL
ALTER TABLE employer_capabilities
  ADD CONSTRAINT employer_capabilities_trade_unique
  UNIQUE (employer_id, capability_type, trade_type_id);

-- ============================================================================
-- STEP 3: Add comments
-- ============================================================================

COMMENT ON CONSTRAINT employer_capabilities_role_unique ON employer_capabilities IS
  'Ensures unique contractor role capabilities per employer. Multiple NULLs allowed for trade-type records.';

COMMENT ON CONSTRAINT employer_capabilities_trade_unique ON employer_capabilities IS
  'Ensures unique trade capabilities per employer. Multiple NULLs allowed for contractor-role-type records.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Unique constraints added to support Supabase upsert operations.';
  RAISE NOTICE 'The API onConflict parameter can now properly reference these constraints.';
END $$;

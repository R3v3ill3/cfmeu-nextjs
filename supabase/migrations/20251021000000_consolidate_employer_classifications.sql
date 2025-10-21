-- Migration: Consolidate employer classifications to employer_capabilities
-- Phase 2: Data Migration
-- This migration consolidates employer_role_tags and contractor_trade_capabilities
-- into the unified employer_capabilities table.

-- ============================================================================
-- STEP 1: Migrate employer_role_tags → employer_capabilities
-- ============================================================================

DO $$
DECLARE
  v_inserted_roles INTEGER := 0;
  v_skipped_roles INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting migration of employer_role_tags to employer_capabilities...';
  
  -- Insert role tags as employer_capabilities
  -- Map 'builder' and 'head_contractor' tags to contractor_role_types
  INSERT INTO employer_capabilities (
    employer_id,
    capability_type,
    contractor_role_type_id,
    trade_type_id,
    is_primary,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    ert.employer_id,
    'contractor_role'::text,
    crt.id,
    NULL::uuid,
    false,
    ert.created_at,
    ert.updated_at
  FROM employer_role_tags ert
  INNER JOIN contractor_role_types crt ON crt.code = ert.tag::text
  WHERE NOT EXISTS (
    -- Don't insert if already exists in employer_capabilities
    SELECT 1 
    FROM employer_capabilities ec
    WHERE ec.employer_id = ert.employer_id
      AND ec.capability_type = 'contractor_role'
      AND ec.contractor_role_type_id = crt.id
  );
  
  GET DIAGNOSTICS v_inserted_roles = ROW_COUNT;
  
  -- Count skipped (already exist)
  SELECT COUNT(*) INTO v_skipped_roles
  FROM employer_role_tags ert
  INNER JOIN contractor_role_types crt ON crt.code = ert.tag::text
  INNER JOIN employer_capabilities ec ON ec.employer_id = ert.employer_id
    AND ec.capability_type = 'contractor_role'
    AND ec.contractor_role_type_id = crt.id;
  
  RAISE NOTICE 'employer_role_tags migration: % inserted, % already existed', 
    v_inserted_roles, v_skipped_roles;
END $$;

-- ============================================================================
-- STEP 2: Migrate contractor_trade_capabilities → employer_capabilities
-- ============================================================================

DO $$
DECLARE
  v_inserted_trades INTEGER := 0;
  v_skipped_trades INTEGER := 0;
BEGIN
  RAISE NOTICE 'Starting migration of contractor_trade_capabilities to employer_capabilities...';
  
  -- Insert trade capabilities
  -- Map trade_type enum values to trade_types table
  INSERT INTO employer_capabilities (
    employer_id,
    capability_type,
    contractor_role_type_id,
    trade_type_id,
    is_primary,
    created_at,
    updated_at
  )
  SELECT DISTINCT
    ctc.employer_id,
    'trade'::text,
    NULL::uuid,
    tt.id,
    COALESCE(ctc.is_primary, false),
    ctc.created_at,
    ctc.updated_at
  FROM contractor_trade_capabilities ctc
  INNER JOIN trade_types tt ON tt.code = ctc.trade_type::text
  WHERE NOT EXISTS (
    -- Don't insert if already exists in employer_capabilities
    SELECT 1 
    FROM employer_capabilities ec
    WHERE ec.employer_id = ctc.employer_id
      AND ec.capability_type = 'trade'
      AND ec.trade_type_id = tt.id
  );
  
  GET DIAGNOSTICS v_inserted_trades = ROW_COUNT;
  
  -- Count skipped (already exist)
  SELECT COUNT(*) INTO v_skipped_trades
  FROM contractor_trade_capabilities ctc
  INNER JOIN trade_types tt ON tt.code = ctc.trade_type::text
  INNER JOIN employer_capabilities ec ON ec.employer_id = ctc.employer_id
    AND ec.capability_type = 'trade'
    AND ec.trade_type_id = tt.id;
  
  RAISE NOTICE 'contractor_trade_capabilities migration: % inserted, % already existed', 
    v_inserted_trades, v_skipped_trades;
END $$;

-- ============================================================================
-- STEP 3: Add unique indexes to employer_capabilities if not exist
-- ============================================================================

-- For partial unique constraints (with WHERE clause), we must use CREATE UNIQUE INDEX
-- instead of ALTER TABLE ADD CONSTRAINT

-- Unique index for contractor_role entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_capabilities_role_unique
  ON employer_capabilities(employer_id, capability_type, contractor_role_type_id)
  WHERE contractor_role_type_id IS NOT NULL;

-- Unique index for trade entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_employer_capabilities_trade_unique
  ON employer_capabilities(employer_id, capability_type, trade_type_id)
  WHERE trade_type_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_employer_capabilities_employer_role
  ON employer_capabilities(employer_id, contractor_role_type_id)
  WHERE capability_type = 'contractor_role';

CREATE INDEX IF NOT EXISTS idx_employer_capabilities_employer_trade
  ON employer_capabilities(employer_id, trade_type_id)
  WHERE capability_type = 'trade';

CREATE INDEX IF NOT EXISTS idx_employer_capabilities_role_type
  ON employer_capabilities(contractor_role_type_id)
  WHERE capability_type = 'contractor_role';

CREATE INDEX IF NOT EXISTS idx_employer_capabilities_trade_type
  ON employer_capabilities(trade_type_id)
  WHERE capability_type = 'trade';

-- ============================================================================
-- STEP 5: Add comments to document the migration
-- ============================================================================

COMMENT ON TABLE employer_capabilities IS 
  'Unified employer capabilities table. Consolidates employer_role_tags and contractor_trade_capabilities. Migration completed 2025-10-21. Uniqueness enforced by partial indexes idx_employer_capabilities_role_unique and idx_employer_capabilities_trade_unique.';

COMMENT ON COLUMN employer_capabilities.capability_type IS 
  'Type of capability: contractor_role (references contractor_role_types) or trade (references trade_types)';

COMMENT ON COLUMN employer_capabilities.contractor_role_type_id IS 
  'FK to contractor_role_types. Non-null when capability_type = contractor_role. Replaces employer_role_tags table.';

COMMENT ON COLUMN employer_capabilities.trade_type_id IS 
  'FK to trade_types. Non-null when capability_type = trade. Replaces contractor_trade_capabilities table.';

-- ============================================================================
-- STEP 6: Verification queries
-- ============================================================================

DO $$
DECLARE
  v_total_caps INTEGER;
  v_role_caps INTEGER;
  v_trade_caps INTEGER;
  v_unique_employers INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_caps FROM employer_capabilities;
  SELECT COUNT(*) INTO v_role_caps FROM employer_capabilities WHERE capability_type = 'contractor_role';
  SELECT COUNT(*) INTO v_trade_caps FROM employer_capabilities WHERE capability_type = 'trade';
  SELECT COUNT(DISTINCT employer_id) INTO v_unique_employers FROM employer_capabilities;
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Migration Summary ===';
  RAISE NOTICE 'Total capabilities: %', v_total_caps;
  RAISE NOTICE 'Role capabilities: %', v_role_caps;
  RAISE NOTICE 'Trade capabilities: %', v_trade_caps;
  RAISE NOTICE 'Unique employers with capabilities: %', v_unique_employers;
  RAISE NOTICE '';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Old tables (employer_role_tags, contractor_trade_capabilities) remain for backward compatibility.';
  RAISE NOTICE 'They will be deprecated in a future migration after full system transition.';
END $$;



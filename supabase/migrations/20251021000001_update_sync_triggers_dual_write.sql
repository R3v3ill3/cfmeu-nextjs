-- Migration: Update sync triggers for dual-write mode
-- Phase 5: Update Triggers
-- This migration updates the sync triggers to write to BOTH the old tables
-- and the new employer_capabilities table during the transition period.

-- ============================================================================
-- STEP 1: Update sync_employer_role_tag_from_per trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_employer_role_tag_from_per()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND (NEW.role::text = 'builder' OR NEW.role::text = 'head_contractor') THEN
    
    -- NEW: Write to employer_capabilities (primary system)
    INSERT INTO public.employer_capabilities (
      employer_id,
      capability_type,
      contractor_role_type_id,
      trade_type_id,
      is_primary
    )
    SELECT 
      NEW.employer_id,
      'contractor_role',
      crt.id,
      NULL::uuid,
      false
    FROM public.contractor_role_types crt
    WHERE crt.code = NEW.role::text
    ON CONFLICT (employer_id, capability_type, contractor_role_type_id) 
    DO NOTHING;
    
    -- COMPATIBILITY: Also write to old table (for backward compatibility during transition)
    INSERT INTO public.employer_role_tags (employer_id, tag)
    VALUES (NEW.employer_id, NEW.role::text::public.employer_role_tag)
    ON CONFLICT (employer_id, tag) 
    DO NOTHING;
    
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_employer_role_tag_from_per() IS 
  'Auto-syncs employer roles from project_employer_roles to both employer_capabilities (primary) and employer_role_tags (legacy compatibility). Dual-write mode during migration.';

-- ============================================================================
-- STEP 2: Update sync_trade_capability_from_pct trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_trade_capability_from_pct()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.employer_id IS NOT NULL AND NEW.trade_type IS NOT NULL THEN
    
    -- NEW: Write to employer_capabilities (primary system)
    INSERT INTO public.employer_capabilities (
      employer_id,
      capability_type,
      contractor_role_type_id,
      trade_type_id,
      is_primary
    )
    SELECT 
      NEW.employer_id,
      'trade',
      NULL::uuid,
      tt.id,
      false
    FROM public.trade_types tt
    WHERE tt.code = NEW.trade_type::text
    ON CONFLICT (employer_id, capability_type, trade_type_id) 
    DO NOTHING;
    
    -- COMPATIBILITY: Also write to old table (for backward compatibility during transition)
    INSERT INTO public.contractor_trade_capabilities (
      employer_id,
      trade_type,
      is_primary
    )
    SELECT 
      NEW.employer_id,
      NEW.trade_type::public.trade_type,
      false
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.contractor_trade_capabilities c
      WHERE c.employer_id = NEW.employer_id
        AND c.trade_type = NEW.trade_type::public.trade_type
    );
    
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_trade_capability_from_pct() IS 
  'Auto-syncs trade capabilities from project_contractor_trades to both employer_capabilities (primary) and contractor_trade_capabilities (legacy compatibility). Dual-write mode during migration.';

-- ============================================================================
-- STEP 3: Verify triggers are still attached
-- ============================================================================

DO $$
BEGIN
  -- Check project_employer_roles triggers
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_per_sync_role_tags_ins'
      AND tgrelid = 'public.project_employer_roles'::regclass
  ) THEN
    RAISE WARNING 'Trigger trg_per_sync_role_tags_ins not found on project_employer_roles';
  ELSE
    RAISE NOTICE 'Trigger trg_per_sync_role_tags_ins verified on project_employer_roles';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_per_sync_role_tags_upd'
      AND tgrelid = 'public.project_employer_roles'::regclass
  ) THEN
    RAISE WARNING 'Trigger trg_per_sync_role_tags_upd not found on project_employer_roles';
  ELSE
    RAISE NOTICE 'Trigger trg_per_sync_role_tags_upd verified on project_employer_roles';
  END IF;
  
  -- Check project_contractor_trades trigger
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_project_contractor_trades_sync_caps'
      AND tgrelid = 'public.project_contractor_trades'::regclass
  ) THEN
    RAISE WARNING 'Trigger trg_project_contractor_trades_sync_caps not found on project_contractor_trades';
  ELSE
    RAISE NOTICE 'Trigger trg_project_contractor_trades_sync_caps verified on project_contractor_trades';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Trigger functions updated to dual-write mode successfully!';
END $$;



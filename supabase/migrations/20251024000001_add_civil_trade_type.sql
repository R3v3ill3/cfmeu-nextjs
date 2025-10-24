-- Migration: Add "civil" trade type
-- Purpose: Add a distinct "civil" trade type separate from "civil_infrastructure"
-- for EBA trade import mapping

-- Insert the new civil trade type
INSERT INTO public.trade_types (code, name, category, sort_order, is_active, description)
VALUES (
  'civil',
  'Civil',
  'structure',
  8,
  true,
  'Civil construction and earthworks'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();

-- Verification
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM trade_types WHERE code = 'civil') THEN
    RAISE NOTICE '✓ Trade type "civil" successfully added/updated';
  ELSE
    RAISE WARNING '✗ Trade type "civil" NOT found - check migration!';
  END IF;
END $$;

COMMENT ON TABLE trade_types IS 'Reference table for all trade types. Updated 2025-10-24 to add "civil" trade type for EBA import.';

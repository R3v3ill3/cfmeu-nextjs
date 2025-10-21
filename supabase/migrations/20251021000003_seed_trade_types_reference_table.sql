-- Migration: Seed trade_types reference table
-- This migration populates the trade_types table with all 53 trades from the trade_type enum
-- to ensure consistency across Edit form (uses TRADE_OPTIONS) and Categories/Filters (use trade_types table)

-- ============================================================================
-- CRITICAL FIX: Populate trade_types table with all enum values
-- ============================================================================

-- Insert all 53 trade types with proper metadata
-- Using UPSERT (INSERT ... ON CONFLICT) to be idempotent
INSERT INTO public.trade_types (code, name, category, sort_order, is_active, description)
VALUES
  -- Crane & Rigging (Equipment)
  ('tower_crane', 'Tower Crane', 'equipment', 1, true, 'Tower crane operations'),
  ('mobile_crane', 'Mobile Crane', 'equipment', 2, true, 'Mobile crane operations'),
  ('crane_and_rigging', 'Crane & Rigging', 'equipment', 3, true, 'General crane and rigging services'),
  
  -- Early Works
  ('demolition', 'Demolition', 'early_works', 10, true, 'Demolition work'),
  ('earthworks', 'Earthworks', 'early_works', 11, true, 'Earthworks and excavation'),
  ('piling', 'Piling', 'early_works', 12, true, 'Piling and foundation work'),
  ('excavations', 'Excavations', 'early_works', 13, true, 'Excavation services'),
  ('traffic_control', 'Traffic Control', 'early_works', 14, true, 'Traffic control and management'),
  ('traffic_management', 'Traffic Management', 'early_works', 15, true, 'Traffic management services'),
  ('waste_management', 'Waste Management', 'early_works', 16, true, 'Waste management and removal'),
  ('labour_hire', 'Labour Hire', 'early_works', 17, true, 'General labour hire'),
  
  -- Structure
  ('scaffolding', 'Scaffolding', 'structure', 20, true, 'Scaffolding installation and services'),
  ('concrete', 'Concrete', 'structure', 21, true, 'Concrete work'),
  ('concreting', 'Concreting', 'structure', 22, true, 'Concreting services'),
  ('form_work', 'Formwork', 'structure', 23, true, 'Formwork and falsework'),
  ('reinforcing_steel', 'Reinforcing Steel', 'structure', 24, true, 'Steel reinforcement'),
  ('steel_fixing', 'Steel Fixing', 'structure', 25, true, 'Steel fixing services'),
  ('post_tensioning', 'Post-Tensioning', 'structure', 26, true, 'Post-tensioning work'),
  ('structural_steel', 'Structural Steel', 'structure', 27, true, 'Structural steel erection'),
  ('bricklaying', 'Bricklaying', 'structure', 28, true, 'Bricklaying and masonry'),
  ('foundations', 'Foundations', 'structure', 29, true, 'Foundation work'),
  
  -- Finishing
  ('carpentry', 'Carpentry', 'finishing', 40, true, 'Carpentry and joinery'),
  ('electrical', 'Electrical', 'finishing', 41, true, 'Electrical services'),
  ('plumbing', 'Plumbing', 'finishing', 42, true, 'Plumbing services'),
  ('painting', 'Painting', 'finishing', 43, true, 'Painting and decorating'),
  ('plastering', 'Plastering', 'finishing', 44, true, 'Plastering and rendering'),
  ('waterproofing', 'Waterproofing', 'finishing', 45, true, 'Waterproofing services'),
  ('tiling', 'Tiling', 'finishing', 46, true, 'Tiling services'),
  ('flooring', 'Flooring', 'finishing', 47, true, 'Flooring installation'),
  ('roofing', 'Roofing', 'finishing', 48, true, 'Roofing services'),
  ('windows', 'Windows', 'finishing', 49, true, 'Window installation'),
  ('facade', 'Facade', 'finishing', 50, true, 'Facade work'),
  ('glazing', 'Glazing', 'finishing', 51, true, 'Glazing services'),
  ('kitchens', 'Kitchens', 'finishing', 52, true, 'Kitchen installation'),
  ('landscaping', 'Landscaping', 'finishing', 53, true, 'Landscaping services'),
  ('insulation', 'Insulation', 'finishing', 54, true, 'Insulation installation'),
  ('internal_walls', 'Internal Walls', 'finishing', 55, true, 'Internal wall construction'),
  ('ceilings', 'Ceilings', 'finishing', 56, true, 'Ceiling installation'),
  ('stairs_balustrades', 'Stairs & Balustrades', 'finishing', 57, true, 'Stairs and balustrade installation'),
  ('cleaning', 'Cleaning', 'finishing', 58, true, 'Cleaning services'),  -- ← CRITICAL!
  ('final_clean', 'Final Clean', 'finishing', 59, true, 'Final cleaning and handover clean'),
  
  -- Services & Equipment
  ('mechanical_services', 'Mechanical Services', 'services', 60, true, 'Mechanical services and HVAC'),
  ('fire_protection', 'Fire Protection', 'services', 61, true, 'Fire protection systems'),
  ('security_systems', 'Security Systems', 'services', 62, true, 'Security system installation'),
  ('plant_and_equipment', 'Plant & Equipment', 'equipment', 63, true, 'Plant and equipment hire'),
  ('hoist', 'Hoist', 'equipment', 64, true, 'Hoist installation and operation'),
  ('edge_protection', 'Edge Protection', 'equipment', 65, true, 'Edge protection systems'),
  ('building_services', 'Building Services', 'services', 66, true, 'General building services'),
  
  -- Specialized
  ('civil_infrastructure', 'Civil Infrastructure', 'specialized', 70, true, 'Civil infrastructure work'),
  ('fitout', 'Fitout', 'specialized', 71, true, 'Building fitout'),
  ('technology', 'Technology', 'specialized', 72, true, 'Technology systems'),
  ('pools', 'Swimming Pools', 'specialized', 73, true, 'Swimming pool construction'),
  ('pipeline', 'Pipeline', 'specialized', 74, true, 'Pipeline installation'),
  
  -- General
  ('general_construction', 'General Construction', 'general', 90, true, 'General construction work'),
  ('other', 'Other', 'general', 99, true, 'Other trade work')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- Add the same for contractor_role_types to ensure completeness
-- ============================================================================

INSERT INTO public.contractor_role_types (code, name, category, hierarchy_level, is_active, description)
VALUES
  ('builder', 'Builder', 'senior', 1, true, 'Main builder / principal contractor'),
  ('head_contractor', 'Head Contractor', 'senior', 1, true, 'Head contractor / managing contractor'),
  ('building_contractor', 'Building Contractor', 'senior', 2, true, 'Building contractor'),
  ('construction_manager', 'Construction Manager', 'senior', 2, true, 'Construction manager'),
  ('managing_contractor', 'Managing Contractor', 'senior', 2, true, 'Managing contractor'),
  ('contractor', 'Contractor', 'general', 3, true, 'General contractor'),
  ('fitout_contractor', 'Fitout Contractor', 'specialist', 4, true, 'Fitout contractor'),
  ('piling_foundation_contractor', 'Piling & Foundation Contractor', 'specialist', 4, true, 'Piling and foundation contractor'),
  ('road_work_contractor', 'Road Work Contractor', 'specialist', 3, true, 'Road work contractor'),
  ('superstructure_contractor', 'Superstructure Contractor', 'specialist', 4, true, 'Superstructure contractor'),
  ('turnkey_contractor', 'Turnkey Contractor', 'senior', 1, true, 'Turnkey contractor'),
  ('civil_contractor', 'Civil Contractor', 'specialist', 3, true, 'Civil works contractor'),
  ('mechanical_contractor', 'Mechanical Contractor', 'specialist', 4, true, 'Mechanical contractor'),
  ('demolition_contractor', 'Demolition Contractor', 'specialist', 4, true, 'Demolition contractor'),
  ('excavation_contractor', 'Excavation Contractor', 'specialist', 4, true, 'Excavation contractor'),
  ('project_manager', 'Project Manager', 'senior', 2, true, 'Project manager')

ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  hierarchy_level = EXCLUDED.hierarchy_level,
  is_active = EXCLUDED.is_active,
  description = EXCLUDED.description,
  updated_at = now();

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
DECLARE
  v_trade_count INTEGER;
  v_role_count INTEGER;
  v_missing_trades INTEGER;
  v_missing_roles INTEGER;
BEGIN
  -- Count trades in table
  SELECT COUNT(*) INTO v_trade_count FROM trade_types WHERE is_active = true;
  
  -- Count roles in table  
  SELECT COUNT(*) INTO v_role_count FROM contractor_role_types WHERE is_active = true;
  
  -- Count enum values not in table (trades)
  SELECT COUNT(*) INTO v_missing_trades
  FROM pg_enum e
  WHERE e.enumtypid = 'trade_type'::regtype
    AND NOT EXISTS (SELECT 1 FROM trade_types tt WHERE tt.code = e.enumlabel);
  
  -- Count enum values not in table (roles) - won't work as contractor roles aren't an enum
  -- But we can count what we expect
  
  RAISE NOTICE '';
  RAISE NOTICE '=== Reference Tables Seeding Summary ===';
  RAISE NOTICE 'trade_types: % active rows', v_trade_count;
  RAISE NOTICE 'contractor_role_types: % active rows', v_role_count;
  
  IF v_missing_trades > 0 THEN
    RAISE WARNING '% trade_type enum values still missing from trade_types table!', v_missing_trades;
  ELSE
    RAISE NOTICE 'All trade_type enum values present in trade_types table ✓';
  END IF;
  
  -- Verify critical trades
  IF EXISTS(SELECT 1 FROM trade_types WHERE code = 'cleaning') THEN
    RAISE NOTICE 'Critical trade "cleaning" verified in table ✓';
  ELSE
    RAISE WARNING 'Critical trade "cleaning" STILL MISSING!';
  END IF;
  
  IF EXISTS(SELECT 1 FROM trade_types WHERE code = 'final_clean') THEN
    RAISE NOTICE 'Critical trade "final_clean" verified in table ✓';
  ELSE
    RAISE WARNING 'Critical trade "final_clean" STILL MISSING!';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE 'Reference tables seeded successfully!';
END $$;




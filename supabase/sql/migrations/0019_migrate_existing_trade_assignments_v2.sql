-- Migrate existing trade type assignments to use canonical mappings
-- Simple, safe approach that avoids complex PL/pgSQL type issues

-- Step 1: Show current state
SELECT 'BEFORE MIGRATION - Project Contractor Trades:' as info;
SELECT trade_type, COUNT(*) as count 
FROM project_contractor_trades 
GROUP BY trade_type 
ORDER BY count DESC;

SELECT 'BEFORE MIGRATION - Site Contractor Trades:' as info;
SELECT trade_type, COUNT(*) as count 
FROM site_contractor_trades 
GROUP BY trade_type 
ORDER BY count DESC;

-- Step 2: Simple direct updates for clear cases (no complex logic)
-- Update obvious landscape companies
UPDATE project_contractor_trades 
SET trade_type = 'landscaping'
FROM employers e 
WHERE project_contractor_trades.employer_id = e.id 
  AND e.name ILIKE '%landscape%'
  AND project_contractor_trades.trade_type = 'general_construction';

UPDATE site_contractor_trades 
SET trade_type = 'landscaping'
FROM employers e 
WHERE site_contractor_trades.employer_id = e.id 
  AND e.name ILIKE '%landscape%'
  AND site_contractor_trades.trade_type = 'general_construction';

-- Update obvious waste management companies
UPDATE project_contractor_trades 
SET trade_type = 'waste_management'
FROM employers e 
WHERE project_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%skip%' OR e.name ILIKE '%waste%' OR e.name ILIKE '%recycl%')
  AND project_contractor_trades.trade_type = 'general_construction';

UPDATE site_contractor_trades 
SET trade_type = 'waste_management'
FROM employers e 
WHERE site_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%skip%' OR e.name ILIKE '%waste%' OR e.name ILIKE '%recycl%')
  AND site_contractor_trades.trade_type = 'general_construction';

-- Update civil infrastructure companies
UPDATE project_contractor_trades 
SET trade_type = 'civil_infrastructure'
FROM employers e 
WHERE project_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%civil%' OR e.name ILIKE '%bridge%')
  AND project_contractor_trades.trade_type = 'general_construction';

UPDATE site_contractor_trades 
SET trade_type = 'civil_infrastructure'
FROM employers e 
WHERE site_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%civil%' OR e.name ILIKE '%bridge%')
  AND site_contractor_trades.trade_type = 'general_construction';

-- Update aluminium/structural steel companies
UPDATE project_contractor_trades 
SET trade_type = 'structural_steel'
FROM employers e 
WHERE project_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%aluminium%' OR (e.name ILIKE '%steel%' AND e.name ILIKE '%struct%'))
  AND project_contractor_trades.trade_type = 'general_construction';

UPDATE site_contractor_trades 
SET trade_type = 'structural_steel'
FROM employers e 
WHERE site_contractor_trades.employer_id = e.id 
  AND (e.name ILIKE '%aluminium%' OR (e.name ILIKE '%steel%' AND e.name ILIKE '%struct%'))
  AND site_contractor_trades.trade_type = 'general_construction';

-- Update stages for all records based on canonical mappings
UPDATE project_contractor_trades SET stage = 'early_works' 
WHERE trade_type IN ('demolition', 'earthworks', 'piling', 'excavations', 'scaffolding', 'traffic_control', 'traffic_management', 'waste_management', 'cleaning', 'labour_hire')
  AND (stage IS NULL OR stage = 'other');

UPDATE project_contractor_trades SET stage = 'structure'
WHERE trade_type IN ('tower_crane', 'mobile_crane', 'crane_and_rigging', 'concrete', 'concreting', 'form_work', 'reinforcing_steel', 'steel_fixing', 'post_tensioning', 'structural_steel', 'bricklaying', 'foundations')
  AND (stage IS NULL OR stage = 'other');

UPDATE project_contractor_trades SET stage = 'finishing'
WHERE trade_type IN ('carpentry', 'electrical', 'plumbing', 'mechanical_services', 'painting', 'plastering', 'waterproofing', 'tiling', 'flooring', 'roofing', 'windows', 'facade', 'glazing', 'kitchens', 'landscaping', 'final_clean', 'insulation', 'ceilings', 'stairs_balustrades', 'fire_protection', 'security_systems', 'building_services', 'fitout', 'technology')
  AND (stage IS NULL OR stage = 'other');

-- Step 3: Show results
SELECT 'AFTER MIGRATION - Project Contractor Trades:' as info;
SELECT trade_type, COUNT(*) as count 
FROM project_contractor_trades 
GROUP BY trade_type 
ORDER BY count DESC;

SELECT 'AFTER MIGRATION - Site Contractor Trades:' as info;
SELECT trade_type, COUNT(*) as count 
FROM site_contractor_trades 
GROUP BY trade_type 
ORDER BY count DESC;

-- Show employers still mapped to general_construction for manual review
SELECT 'Employers still needing manual review:' as info;
SELECT DISTINCT e.name as employer_name, pct.trade_type
FROM project_contractor_trades pct
JOIN employers e ON e.id = pct.employer_id
WHERE pct.trade_type = 'general_construction'
ORDER BY e.name
LIMIT 20;

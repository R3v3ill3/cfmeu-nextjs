-- Step 4: Preview specific changes before applying
-- Run this to see exactly what would change

-- Show projects that WOULD change (not new assignments)
SELECT 
  name as "Project Name",
  tier as "Tier",
  current_universe as "Current",
  calculated_universe as "→ Calculated",
  builder_name as "Builder",
  builder_has_eba as "Builder EBA",
  has_patch_assignment as "Has Patch",
  value as "Project Value"
FROM organising_universe_impact_analysis 
WHERE change_type = 'WOULD_CHANGE'
ORDER BY tier, name
LIMIT 20;

-- Show projects that would get NEW assignments
SELECT 
  name as "Project Name", 
  tier as "Tier",
  calculated_universe as "→ New Universe",
  builder_name as "Builder",
  builder_has_eba as "Builder EBA", 
  has_patch_assignment as "Has Patch",
  value as "Project Value"
FROM organising_universe_impact_analysis 
WHERE change_type = 'NEW_ASSIGNMENT'
ORDER BY tier, name
LIMIT 20;

-- Summary by tier and universe
SELECT 
  tier as "Tier",
  calculated_universe as "Universe",
  COUNT(*) as "Project Count",
  ROUND(AVG(value)/1000000, 1) as "Avg Value (M)",
  COUNT(CASE WHEN builder_has_eba THEN 1 END) as "With EBA Builder",
  COUNT(CASE WHEN has_patch_assignment THEN 1 END) as "With Patch"
FROM organising_universe_impact_analysis 
WHERE tier IS NOT NULL
GROUP BY tier, calculated_universe
ORDER BY 
  CASE tier 
    WHEN 'tier_1' THEN 1 
    WHEN 'tier_2' THEN 2 
    WHEN 'tier_3' THEN 3 
  END,
  CASE calculated_universe 
    WHEN 'active' THEN 1 
    WHEN 'potential' THEN 2 
    WHEN 'excluded' THEN 3 
  END;

-- Manual override analysis
SELECT 
  'Manual Overrides (Protected)' as "Category",
  COUNT(*) as "Count",
  STRING_AGG(DISTINCT organising_universe::text, ', ') as "Current Values"
FROM projects 
WHERE organising_universe_manual_override = TRUE;

-- Projects without tiers (edge cases)
SELECT 
  'Projects Without Tier' as "Category",
  COUNT(*) as "Count",
  STRING_AGG(DISTINCT COALESCE(organising_universe::text, 'NULL'), ', ') as "Current Values"
FROM projects 
WHERE tier IS NULL;

-- Show impact by change type
SELECT 
  change_type as "Change Type",
  COUNT(*) as "Project Count",
  ROUND(COUNT(*)::DECIMAL / (SELECT COUNT(*) FROM projects WHERE tier IS NOT NULL) * 100, 1) as "Percentage"
FROM organising_universe_impact_analysis
GROUP BY change_type
ORDER BY 
  CASE change_type 
    WHEN 'NO_CHANGE' THEN 1
    WHEN 'WOULD_CHANGE' THEN 2  
    WHEN 'NEW_ASSIGNMENT' THEN 3
  END;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📋 PREVIEW COMPLETE - Review the results above';
  RAISE NOTICE '⚠️  Key things to check:';
  RAISE NOTICE '   1. Are the tier→universe mappings correct?';
  RAISE NOTICE '   2. Do the EBA builder detections look right?';
  RAISE NOTICE '   3. Are patch assignments accurate?';
  RAISE NOTICE '   4. Any unexpected changes in the WOULD_CHANGE list?';
  RAISE NOTICE '';
  RAISE NOTICE '✅ If results look good, proceed to Step 5';
  RAISE NOTICE '🛑 If not, review business logic in Step 2';
END $$;

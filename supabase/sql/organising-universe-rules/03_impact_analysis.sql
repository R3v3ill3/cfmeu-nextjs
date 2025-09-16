-- Step 3: Impact analysis - Preview what would change
-- Run this to see what the rules would do before applying them

-- Create a view to analyze proposed changes
CREATE OR REPLACE VIEW organising_universe_impact_analysis AS
SELECT 
  p.id,
  p.name,
  p.tier,
  p.value,
  p.organising_universe as current_universe,
  calculate_default_organising_universe(p.id) as calculated_universe,
  
  -- Change indicator
  CASE 
    WHEN p.organising_universe IS NULL THEN 'NEW_ASSIGNMENT'
    WHEN p.organising_universe::text = calculate_default_organising_universe(p.id) THEN 'NO_CHANGE'
    ELSE 'WOULD_CHANGE'
  END as change_type,
  
  -- Builder info
  (
    SELECT e.name
    FROM project_assignments pa
    JOIN employers e ON e.id = pa.employer_id
    WHERE pa.project_id = p.id 
    AND pa.assignment_type = 'contractor_role'
    AND pa.is_primary_for_role = true
    LIMIT 1
  ) as builder_name,
  
  -- EBA status
  EXISTS (
    SELECT 1 
    FROM project_assignments pa
    JOIN company_eba_records cer ON cer.employer_id = pa.employer_id
    WHERE pa.project_id = p.id 
    AND pa.assignment_type = 'contractor_role'
    AND pa.is_primary_for_role = true
    AND cer.fwc_certified_date IS NOT NULL
  ) as builder_has_eba,
  
  -- Patch assignment
  EXISTS (
    SELECT 1 
    FROM patch_job_sites pjs
    JOIN job_sites js ON js.id = pjs.job_site_id
    WHERE js.project_id = p.id
    AND pjs.effective_to IS NULL
  ) as has_patch_assignment,
  
  -- Manual override status
  p.organising_universe_manual_override,
  
  -- When it would be updated
  should_auto_update_organising_universe(p.id) as would_be_updated

FROM projects p
WHERE p.tier IS NOT NULL -- Only analyze projects with tiers
ORDER BY p.tier, p.name;

-- Summary statistics
DO $$
DECLARE
  total_projects INTEGER;
  projects_with_tier INTEGER;
  would_change INTEGER;
  new_assignments INTEGER;
  manual_overrides INTEGER;
  tier1_active INTEGER;
  tier2_tier3_active INTEGER;
  tier2_tier3_potential INTEGER;
  tier3_excluded INTEGER;
BEGIN
  -- Get counts
  SELECT COUNT(*) INTO total_projects FROM projects;
  SELECT COUNT(*) INTO projects_with_tier FROM projects WHERE tier IS NOT NULL;
  
  SELECT COUNT(*) INTO would_change 
  FROM organising_universe_impact_analysis 
  WHERE change_type = 'WOULD_CHANGE';
  
  SELECT COUNT(*) INTO new_assignments 
  FROM organising_universe_impact_analysis 
  WHERE change_type = 'NEW_ASSIGNMENT';
  
  SELECT COUNT(*) INTO manual_overrides 
  FROM projects 
  WHERE organising_universe_manual_override = TRUE;
  
  -- Get tier-based projections
  SELECT COUNT(*) INTO tier1_active 
  FROM organising_universe_impact_analysis 
  WHERE tier = 'tier_1' AND calculated_universe = 'active';
  
  SELECT COUNT(*) INTO tier2_tier3_active 
  FROM organising_universe_impact_analysis 
  WHERE tier IN ('tier_2', 'tier_3') AND calculated_universe = 'active';
  
  SELECT COUNT(*) INTO tier2_tier3_potential 
  FROM organising_universe_impact_analysis 
  WHERE tier IN ('tier_2', 'tier_3') AND calculated_universe = 'potential';
  
  SELECT COUNT(*) INTO tier3_excluded 
  FROM organising_universe_impact_analysis 
  WHERE tier = 'tier_3' AND calculated_universe = 'excluded';

  -- Display impact summary
  RAISE NOTICE '';
  RAISE NOTICE '📊 ORGANIZING UNIVERSE RULES - IMPACT ANALYSIS';
  RAISE NOTICE '================================================';
  RAISE NOTICE '';
  RAISE NOTICE '📈 OVERALL STATISTICS:';
  RAISE NOTICE '   Total Projects: %', total_projects;
  RAISE NOTICE '   Projects with Tier: %', projects_with_tier;
  RAISE NOTICE '   Would Change: %', would_change;
  RAISE NOTICE '   New Assignments: %', new_assignments;
  RAISE NOTICE '   Manual Overrides (protected): %', manual_overrides;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 PROJECTED UNIVERSE DISTRIBUTION:';
  RAISE NOTICE '   Tier 1 → Active: %', tier1_active;
  RAISE NOTICE '   Tier 2/3 → Active: %', tier2_tier3_active;
  RAISE NOTICE '   Tier 2/3 → Potential: %', tier2_tier3_potential;
  RAISE NOTICE '   Tier 3 → Excluded: %', tier3_excluded;
  RAISE NOTICE '';
  RAISE NOTICE '🔍 DETAILED ANALYSIS:';
  RAISE NOTICE '   View: SELECT * FROM organising_universe_impact_analysis';
  RAISE NOTICE '   Filter changes: WHERE change_type = ''WOULD_CHANGE''';
  RAISE NOTICE '   Filter new: WHERE change_type = ''NEW_ASSIGNMENT''';
  RAISE NOTICE '';
END $$;

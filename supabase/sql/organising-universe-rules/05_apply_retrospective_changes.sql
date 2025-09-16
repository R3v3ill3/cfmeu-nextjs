-- Step 5: Apply organizing universe rules retrospectively
-- This updates existing projects based on the business rules

-- Function to apply rules to all eligible projects
CREATE OR REPLACE FUNCTION apply_organising_universe_rules_retrospectively(
  p_dry_run BOOLEAN DEFAULT TRUE,
  p_applied_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  project_record RECORD;
  update_result JSONB;
  total_updated INTEGER := 0;
  total_eligible INTEGER := 0;
  results JSONB := '[]'::JSONB;
  summary JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚀 APPLYING ORGANIZING UNIVERSE RULES';
  RAISE NOTICE '================================';
  RAISE NOTICE 'Dry Run: %', p_dry_run;
  RAISE NOTICE '';
  
  -- Process each eligible project
  FOR project_record IN 
    SELECT id, name, tier, organising_universe
    FROM projects 
    ORDER BY name -- Process all projects for debugging
  LOOP
    total_eligible := total_eligible + 1;

    -- VERBOSE LOGGING
    RAISE NOTICE 'Project: "%", Current Universe: %, Tier: %', 
      project_record.name, 
      COALESCE(project_record.organising_universe, 'NULL'), 
      COALESCE(project_record.tier, 'NULL');

    IF should_auto_update_organising_universe(project_record.id) THEN
      RAISE NOTICE ' -> Should update: YES';
      
      IF NOT p_dry_run THEN
        -- Actually apply the update
        update_result := update_organising_universe_with_rules(
          project_record.id, 
          TRUE, -- Respect manual overrides
          p_applied_by
        );
        
        IF (update_result->>'updated')::BOOLEAN THEN
          total_updated := total_updated + 1;
          results := results || jsonb_build_array(update_result);
        END IF;
      ELSE
        -- Dry run - just log what would happen
        update_result := jsonb_build_object(
          'project_id', project_record.id,
          'project_name', project_record.name,
          'current_value', project_record.organising_universe,
          'calculated_value', calculate_default_organising_universe(project_record.id),
          'would_update', true
        );
        
        results := results || jsonb_build_array(update_result);
        total_updated := total_updated + 1;
        
        RAISE NOTICE ' -> DRY RUN: New value would be %', 
          calculate_default_organising_universe(project_record.id);
      END IF;
    ELSE
      RAISE NOTICE ' -> Should update: NO';
    END IF;
  END LOOP;
  
  -- Create summary
  summary := jsonb_build_object(
    'dry_run', p_dry_run,
    'total_eligible', total_eligible,
    'total_updated', total_updated,
    'applied_by', p_applied_by,
    'applied_at', NOW(),
    'changes', results
  );
  
  RAISE NOTICE '';
  RAISE NOTICE '📊 SUMMARY:';
  RAISE NOTICE '   Eligible Projects: %', total_eligible;
  RAISE NOTICE '   % Updated: %', 
    CASE WHEN p_dry_run THEN 'Would Be' ELSE 'Actually' END,
    total_updated;
  RAISE NOTICE '';
  
  IF p_dry_run THEN
    RAISE NOTICE '💡 This was a DRY RUN - no changes were made';
    RAISE NOTICE '✅ To apply for real, run:';
    RAISE NOTICE '   SELECT apply_organising_universe_rules_retrospectively(FALSE, auth.uid());';
  ELSE
    RAISE NOTICE '✅ CHANGES APPLIED SUCCESSFULLY';
    RAISE NOTICE '📋 Check audit log: SELECT * FROM organising_universe_change_log ORDER BY applied_at DESC;';
  END IF;
  
  RETURN summary;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION apply_organising_universe_rules_retrospectively TO authenticated, service_role;

-- Run impact analysis (DRY RUN by default)
DO $$
DECLARE
  result JSONB;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧪 RUNNING IMPACT ANALYSIS (DRY RUN)';
  RAISE NOTICE '=====================================';
  
  result := apply_organising_universe_rules_retrospectively(TRUE);
  
  RAISE NOTICE '';
  RAISE NOTICE '📋 To see detailed analysis, run:';
  RAISE NOTICE '   SELECT * FROM organising_universe_impact_analysis WHERE change_type != ''NO_CHANGE'';';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 To apply changes for real, run:';
  RAISE NOTICE '   SELECT apply_organising_universe_rules_retrospectively(FALSE, auth.uid());';
  RAISE NOTICE '';
END $$;

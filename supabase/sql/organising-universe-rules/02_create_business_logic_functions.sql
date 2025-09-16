-- Step 2: Create business logic functions for organizing universe rules
-- These implement the tier-based classification logic

-- Function to determine organizing universe based on business rules
CREATE OR REPLACE FUNCTION calculate_default_organising_universe(
  p_project_id UUID
) RETURNS TEXT AS $$
DECLARE
  project_tier TEXT;
  project_name TEXT;
  has_eba_builder BOOLEAN := FALSE;
  has_patch_assignment BOOLEAN := FALSE;
  result_universe TEXT;
  builder_name TEXT;
BEGIN
  -- Get project details
  SELECT tier, name INTO project_tier, project_name 
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_tier IS NULL THEN
    RAISE NOTICE 'Project % has no tier - cannot calculate organizing universe', project_name;
    RETURN 'potential'; -- Default for projects without tier
  END IF;
  
  -- Check for EBA active builder/main contractor
  SELECT EXISTS (
    SELECT 1 
    FROM project_assignments pa
    JOIN company_eba_records cer ON cer.employer_id = pa.employer_id
    WHERE pa.project_id = p_project_id 
    AND pa.assignment_type = 'contractor_role'
    AND pa.is_primary_for_role = true
    AND cer.fwc_certified_date IS NOT NULL
  ) INTO has_eba_builder;
  
  -- Get builder name for logging
  SELECT e.name INTO builder_name
  FROM project_assignments pa
  JOIN employers e ON e.id = pa.employer_id
  WHERE pa.project_id = p_project_id 
  AND pa.assignment_type = 'contractor_role'
  AND pa.is_primary_for_role = true
  LIMIT 1;
  
  -- Check for patch assignment
  SELECT EXISTS (
    SELECT 1 
    FROM patch_job_sites pjs
    JOIN job_sites js ON js.id = pjs.job_site_id
    WHERE js.project_id = p_project_id
    AND pjs.effective_to IS NULL
  ) INTO has_patch_assignment;
  
  -- Apply business rules
  CASE 
    WHEN project_tier = 'tier_1' THEN
      result_universe := 'active';
      
    WHEN project_tier IN ('tier_2', 'tier_3') AND has_eba_builder AND has_patch_assignment THEN
      result_universe := 'active';
      
    WHEN project_tier IN ('tier_2', 'tier_3') AND has_patch_assignment AND NOT has_eba_builder THEN
      result_universe := 'potential';
      
    WHEN project_tier = 'tier_3' AND NOT has_eba_builder AND NOT has_patch_assignment THEN
      result_universe := 'excluded';
      
    ELSE
      -- Default fallback for edge cases (tier 2 without patch assignment)
      result_universe := 'potential';
  END CASE;
  
  -- Log the decision for debugging
  RAISE DEBUG 'Project %: tier=%, builder=%, eba=%, patch=% → %', 
    project_name, project_tier, builder_name, has_eba_builder, has_patch_assignment, result_universe;
  
  RETURN result_universe;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if project should be auto-updated
CREATE OR REPLACE FUNCTION should_auto_update_organising_universe(
  p_project_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
  manual_override BOOLEAN;
  current_value TEXT;
  calculated_value TEXT;
BEGIN
  -- Get current state
  SELECT 
    organising_universe_manual_override,
    organising_universe
  INTO manual_override, current_value
  FROM projects 
  WHERE id = p_project_id;
  
  -- Never update if user has manually overridden
  IF manual_override = TRUE THEN
    RETURN FALSE;
  END IF;
  
  -- Get calculated value
  calculated_value := calculate_default_organising_universe(p_project_id);
  
  -- Only update if different from current value
  RETURN (current_value IS NULL OR current_value != calculated_value);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to safely update organizing universe with full tracking
CREATE OR REPLACE FUNCTION update_organising_universe_with_rules(
  p_project_id UUID,
  p_respect_manual_override BOOLEAN DEFAULT TRUE,
  p_applied_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  current_value TEXT;
  calculated_value TEXT;
  project_name TEXT;
  change_reason TEXT;
  should_update BOOLEAN;
  result JSONB;
BEGIN
  -- Get current state
  SELECT organising_universe, name 
  INTO current_value, project_name
  FROM projects 
  WHERE id = p_project_id;
  
  -- Check if should update
  IF p_respect_manual_override THEN
    should_update := should_auto_update_organising_universe(p_project_id);
  ELSE
    should_update := TRUE; -- Force update (admin override)
  END IF;
  
  IF NOT should_update THEN
    RETURN jsonb_build_object(
      'updated', false,
      'reason', 'Manual override or no change needed',
      'current_value', current_value
    );
  END IF;
  
  -- Calculate new value
  calculated_value := calculate_default_organising_universe(p_project_id);
  
  -- Build change reason
  change_reason := format(
    'Auto-assigned based on tier and EBA/patch rules (was: %s)',
    COALESCE(current_value, 'NULL')
  );
  
  -- Apply the update
  UPDATE projects 
  SET 
    organising_universe = calculated_value::public.organising_universe,
    organising_universe_auto_assigned = TRUE,
    organising_universe_last_auto_update = NOW(),
    organising_universe_change_reason = change_reason,
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the change
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by
  ) VALUES (
    p_project_id,
    current_value,
    calculated_value,
    change_reason,
    'tier_eba_patch_rules',
    p_applied_by
  );
  
  result := jsonb_build_object(
    'updated', true,
    'project_name', project_name,
    'old_value', current_value,
    'new_value', calculated_value,
    'change_reason', change_reason
  );
  
  RAISE NOTICE 'Updated project %: % → %', project_name, current_value, calculated_value;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_default_organising_universe TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION should_auto_update_organising_universe TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_organising_universe_with_rules TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Step 2 Complete: Business logic functions created';
  RAISE NOTICE '🔧 Functions available:';
  RAISE NOTICE '   - calculate_default_organising_universe(project_id)';
  RAISE NOTICE '   - should_auto_update_organising_universe(project_id)';
  RAISE NOTICE '   - update_organising_universe_with_rules(project_id, respect_override, applied_by)';
END $$;

-- Step 7: Manual override functions for user control
-- These allow users to override automatic assignments

-- Function to manually set organizing universe (preserves user choice)
CREATE OR REPLACE FUNCTION set_organising_universe_manual(
  p_project_id UUID,
  p_universe TEXT,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  project_name TEXT;
  old_value TEXT;
  new_value TEXT := p_universe;
BEGIN
  -- Get current state
  SELECT name, organising_universe 
  INTO project_name, old_value
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;
  
  -- Validate universe value
  IF p_universe NOT IN ('active', 'potential', 'excluded') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid universe value. Must be: active, potential, or excluded'
    );
  END IF;
  
  -- Update the project with manual override flag
  UPDATE projects 
  SET 
    organising_universe = new_value::public.organising_universe,
    organising_universe_manual_override = TRUE,
    organising_universe_auto_assigned = FALSE,
    organising_universe_change_reason = COALESCE(p_reason, format('Manually set to %s by user', new_value)),
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Log the manual change
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by,
    was_manual_override
  ) VALUES (
    p_project_id,
    old_value,
    new_value,
    COALESCE(p_reason, 'Manual override by user'),
    'manual_override',
    p_user_id,
    TRUE
  );
  
  RAISE NOTICE 'Manual override applied for project %: % → %', project_name, old_value, new_value;
  
  RETURN jsonb_build_object(
    'success', true,
    'project_name', project_name,
    'old_value', old_value,
    'new_value', new_value,
    'message', format('Successfully set organizing universe to %s', new_value)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to remove manual override (allow auto-assignment again)
CREATE OR REPLACE FUNCTION remove_organising_universe_manual_override(
  p_project_id UUID,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  project_name TEXT;
  current_value TEXT;
  calculated_value TEXT;
  update_result JSONB;
BEGIN
  -- Get current state
  SELECT name, organising_universe 
  INTO project_name, current_value
  FROM projects 
  WHERE id = p_project_id;
  
  IF project_name IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Project not found'
    );
  END IF;
  
  -- Remove manual override flag
  UPDATE projects 
  SET 
    organising_universe_manual_override = FALSE,
    organising_universe_change_reason = COALESCE(p_reason, 'Manual override removed - allowing auto-assignment'),
    updated_at = NOW()
  WHERE id = p_project_id;
  
  -- Now apply automatic rules
  update_result := update_organising_universe_with_rules(p_project_id, FALSE, p_user_id);
  
  calculated_value := update_result->>'new_value';
  
  -- Log the override removal
  INSERT INTO organising_universe_change_log (
    project_id,
    old_value,
    new_value,
    change_reason,
    rule_applied,
    applied_by,
    was_manual_override
  ) VALUES (
    p_project_id,
    current_value,
    calculated_value,
    COALESCE(p_reason, 'Manual override removed, auto-rules applied'),
    'remove_manual_override',
    p_user_id,
    FALSE
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'project_name', project_name,
    'old_value', current_value,
    'new_value', calculated_value,
    'message', format('Removed manual override, auto-assigned to %s', calculated_value)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to bulk update multiple projects
CREATE OR REPLACE FUNCTION bulk_set_organising_universe_manual(
  p_project_ids UUID[],
  p_universe TEXT,
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  project_id UUID;
  result JSONB;
  results JSONB := '[]'::JSONB;
  success_count INTEGER := 0;
  error_count INTEGER := 0;
BEGIN
  FOREACH project_id IN ARRAY p_project_ids
  LOOP
    result := set_organising_universe_manual(project_id, p_universe, p_user_id, p_reason);
    
    IF (result->>'success')::BOOLEAN THEN
      success_count := success_count + 1;
    ELSE
      error_count := error_count + 1;
    END IF;
    
    results := results || jsonb_build_array(result);
  END LOOP;
  
  RETURN jsonb_build_object(
    'total_projects', array_length(p_project_ids, 1),
    'success_count', success_count,
    'error_count', error_count,
    'results', results
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION set_organising_universe_manual TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION remove_organising_universe_manual_override TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION bulk_set_organising_universe_manual TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Step 7 Complete: Manual override functions created';
  RAISE NOTICE '';
  RAISE NOTICE '🎛️ MANUAL CONTROL FUNCTIONS:';
  RAISE NOTICE '   set_organising_universe_manual(project_id, universe, user_id, reason)';
  RAISE NOTICE '   remove_organising_universe_manual_override(project_id, user_id, reason)';
  RAISE NOTICE '   bulk_set_organising_universe_manual(project_ids[], universe, user_id, reason)';
  RAISE NOTICE '';
  RAISE NOTICE '📝 EXAMPLE USAGE:';
  RAISE NOTICE '   -- Set project to active manually';
  RAISE NOTICE '   SELECT set_organising_universe_manual(';
  RAISE NOTICE '     ''project-uuid'', ''active'', auth.uid(), ''Strategic priority project''';
  RAISE NOTICE '   );';
  RAISE NOTICE '';
  RAISE NOTICE '   -- Remove override and let auto-rules apply';
  RAISE NOTICE '   SELECT remove_organising_universe_manual_override(';
  RAISE NOTICE '     ''project-uuid'', auth.uid(), ''Let system determine classification''';
  RAISE NOTICE '   );';
END $$;

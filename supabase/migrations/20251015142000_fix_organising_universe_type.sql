-- Fix set_organising_universe_manual to use correct type name
-- The type is 'project_organising_universe', not 'organising_universe'

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
  -- FIXED: Changed organising_universe to project_organising_universe
  UPDATE projects
  SET
    organising_universe = new_value::project_organising_universe,
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

COMMENT ON FUNCTION set_organising_universe_manual(uuid, text, uuid, text) IS
  'Manually set organizing universe for a project. Fixed type cast to use project_organising_universe instead of organising_universe.';

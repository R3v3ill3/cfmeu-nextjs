-- Step 8: Rollback and recovery functions
-- Safety net for undoing changes if needed

-- Function to rollback all organizing universe changes
CREATE OR REPLACE FUNCTION rollback_organising_universe_changes(
  p_confirm_rollback BOOLEAN DEFAULT FALSE,
  p_applied_by UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  rollback_count INTEGER;
  backup_count INTEGER;
  project_record RECORD;
BEGIN
  -- Safety check
  IF p_confirm_rollback IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rollback not confirmed. Set p_confirm_rollback = TRUE to proceed'
    );
  END IF;
  
  -- Check if backup exists
  SELECT COUNT(*) INTO backup_count FROM projects_organising_universe_backup;
  
  IF backup_count = 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No backup found. Cannot rollback safely.'
    );
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '🔄 ROLLING BACK ORGANIZING UNIVERSE CHANGES';
  RAISE NOTICE '==========================================';
  RAISE NOTICE '';
  
  -- Restore from backup
  FOR project_record IN 
    SELECT 
      p.id,
      p.name,
      p.organising_universe as current_value,
      b.organising_universe as backup_value
    FROM projects p
    JOIN projects_organising_universe_backup b ON b.id = p.id
    WHERE p.organising_universe::text IS DISTINCT FROM b.organising_universe::text
  LOOP
    -- Update project
    UPDATE projects 
    SET 
      organising_universe = project_record.backup_value::public.organising_universe,
      organising_universe_auto_assigned = FALSE,
      organising_universe_manual_override = TRUE, -- Mark as manual to prevent re-auto-assignment
      organising_universe_change_reason = 'Restored from backup via rollback function',
      organising_universe_last_auto_update = NULL,
      updated_at = NOW()
    WHERE id = project_record.id;
    
    -- Log the rollback
    INSERT INTO organising_universe_change_log (
      project_id,
      old_value,
      new_value,
      change_reason,
      rule_applied,
      applied_by
    ) VALUES (
      project_record.id,
      project_record.current_value,
      project_record.backup_value,
      'Rollback to original value',
      'rollback_function',
      p_applied_by
    );
    
    rollback_count := rollback_count + 1;
    
    RAISE NOTICE 'Rolled back %: % → %', 
      project_record.name, 
      project_record.current_value, 
      project_record.backup_value;
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '✅ Rollback complete: % projects restored', rollback_count;
  RAISE NOTICE '';
  
  RETURN jsonb_build_object(
    'success', true,
    'rollback_count', rollback_count,
    'backup_count', backup_count,
    'message', format('Successfully rolled back %s projects to original values', rollback_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clear all organizing universe automation
CREATE OR REPLACE FUNCTION clear_organising_universe_automation(
  p_confirm_clear BOOLEAN DEFAULT FALSE
) RETURNS JSONB AS $$
DECLARE
  clear_count INTEGER;
BEGIN
  IF p_confirm_clear IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Clear not confirmed. Set p_confirm_clear = TRUE to proceed'
    );
  END IF;
  
  -- Reset all automation flags
  UPDATE projects 
  SET 
    organising_universe_auto_assigned = FALSE,
    organising_universe_manual_override = FALSE,
    organising_universe_last_auto_update = NULL,
    organising_universe_change_reason = NULL;
  
  GET DIAGNOSTICS clear_count = ROW_COUNT;
  
  -- Clear audit log
  DELETE FROM organising_universe_change_log;
  
  RAISE NOTICE 'Cleared automation settings for % projects', clear_count;
  
  RETURN jsonb_build_object(
    'success', true,
    'cleared_count', clear_count,
    'message', 'All organizing universe automation cleared'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION rollback_organising_universe_changes TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION clear_organising_universe_automation TO authenticated, service_role;

-- Create emergency rollback view
CREATE OR REPLACE VIEW emergency_rollback_info AS
SELECT 
  'Current State' as info_type,
  COUNT(*) as project_count,
  STRING_AGG(DISTINCT organising_universe::text, ', ') as universe_values
FROM projects
WHERE organising_universe IS NOT NULL

UNION ALL

SELECT 
  'Backup State' as info_type,
  COUNT(*) as project_count,
  STRING_AGG(DISTINCT organising_universe::text, ', ') as universe_values
FROM projects_organising_universe_backup
WHERE organising_universe IS NOT NULL

UNION ALL

SELECT 
  'Would Rollback' as info_type,
  COUNT(*) as project_count,
  STRING_AGG(DISTINCT p.organising_universe::text, ', ') as universe_values
FROM projects p
JOIN projects_organising_universe_backup b ON b.id = p.id
WHERE p.organising_universe::text IS DISTINCT FROM b.organising_universe::text;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Step 8 Complete: Rollback and recovery functions created';
  RAISE NOTICE '';
  RAISE NOTICE '🆘 EMERGENCY FUNCTIONS:';
  RAISE NOTICE '   rollback_organising_universe_changes(TRUE, auth.uid())';
  RAISE NOTICE '   clear_organising_universe_automation(TRUE)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Check status: SELECT * FROM emergency_rollback_info;';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  IMPORTANT: These functions are destructive!';
  RAISE NOTICE '   Only use if you need to completely undo the automation';
END $$;

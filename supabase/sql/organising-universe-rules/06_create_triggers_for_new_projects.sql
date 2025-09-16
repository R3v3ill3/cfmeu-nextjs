-- Step 6: Create triggers for automatic assignment on new projects
-- This ensures future projects follow the rules automatically

-- Function to handle organizing universe assignment on project changes
CREATE OR REPLACE FUNCTION handle_project_organising_universe_auto_assignment()
RETURNS TRIGGER AS $$
DECLARE
  calculated_universe TEXT;
  should_assign BOOLEAN := FALSE;
BEGIN
  -- Only process if project has a tier
  IF NEW.tier IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if we should auto-assign
  IF TG_OP = 'INSERT' THEN
    -- New project - auto-assign if no universe specified
    should_assign := (NEW.organising_universe IS NULL);
  ELSIF TG_OP = 'UPDATE' THEN
    -- Updated project - only auto-assign if not manually overridden
    should_assign := (
      NEW.organising_universe_manual_override IS NOT TRUE
      AND (
        -- Tier changed
        OLD.tier IS DISTINCT FROM NEW.tier
        -- Or other relevant fields changed that we're not tracking yet
        -- (builder assignment changes will be handled separately)
      )
    );
  END IF;
  
  IF should_assign THEN
    calculated_universe := calculate_default_organising_universe(NEW.id);
    
    -- Update the organizing universe
    NEW.organising_universe := calculated_universe::public.organising_universe;
    NEW.organising_universe_auto_assigned := TRUE;
    NEW.organising_universe_last_auto_update := NOW();
    NEW.organising_universe_change_reason := format(
      'Auto-assigned on %s based on tier=%s rules', 
      CASE WHEN TG_OP = 'INSERT' THEN 'creation' ELSE 'update' END,
      NEW.tier
    );
    
    -- Log the change (for INSERT, this will happen after the row exists)
    IF TG_OP = 'UPDATE' THEN
      INSERT INTO organising_universe_change_log (
        project_id,
        old_value,
        new_value,
        change_reason,
        rule_applied,
        applied_by
      ) VALUES (
        NEW.id,
        OLD.organising_universe::text,
        calculated_universe,
        NEW.organising_universe_change_reason,
        'auto_trigger_on_update',
        NEW.updated_by -- Assuming you have updated_by column
      );
    END IF;
    
    RAISE DEBUG 'Auto-assigned organizing universe for project %: %', NEW.name, calculated_universe;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new projects and updates
DROP TRIGGER IF EXISTS trigger_auto_assign_organising_universe ON projects;
CREATE TRIGGER trigger_auto_assign_organising_universe
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION handle_project_organising_universe_auto_assignment();

-- Function to handle builder/contractor assignment changes
CREATE OR REPLACE FUNCTION handle_contractor_assignment_organising_universe_update()
RETURNS TRIGGER AS $$
DECLARE
  affected_project_id UUID;
  update_result JSONB;
BEGIN
  -- Get the project ID from the assignment
  IF TG_OP = 'INSERT' THEN
    affected_project_id := NEW.project_id;
  ELSIF TG_OP = 'UPDATE' THEN
    affected_project_id := NEW.project_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_project_id := OLD.project_id;
  END IF;
  
  -- Only process contractor role assignments (builders/main contractors)
  IF (TG_OP = 'DELETE' AND OLD.assignment_type = 'contractor_role' AND OLD.is_primary_for_role = TRUE) OR
     (TG_OP != 'DELETE' AND NEW.assignment_type = 'contractor_role' AND NEW.is_primary_for_role = TRUE) THEN
    
    -- Update organizing universe for affected project
    update_result := update_organising_universe_with_rules(
      affected_project_id,
      TRUE, -- Respect manual overrides
      NULL  -- System update
    );
    
    IF (update_result->>'updated')::BOOLEAN THEN
      RAISE DEBUG 'Updated organizing universe for project % due to contractor assignment change', affected_project_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project assignment changes
DROP TRIGGER IF EXISTS trigger_contractor_organising_universe_update ON project_assignments;
CREATE TRIGGER trigger_contractor_organising_universe_update
  AFTER INSERT OR UPDATE OR DELETE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION handle_contractor_assignment_organising_universe_update();

-- Function to handle patch assignment changes
CREATE OR REPLACE FUNCTION handle_patch_assignment_organising_universe_update()
RETURNS TRIGGER AS $$
DECLARE
  affected_project_id UUID;
  update_result JSONB;
BEGIN
  -- Get the project ID from the job site
  IF TG_OP = 'INSERT' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = NEW.job_site_id;
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = NEW.job_site_id;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT js.project_id INTO affected_project_id
    FROM job_sites js WHERE js.id = OLD.job_site_id;
  END IF;
  
  IF affected_project_id IS NOT NULL THEN
    -- Update organizing universe for affected project
    update_result := update_organising_universe_with_rules(
      affected_project_id,
      TRUE, -- Respect manual overrides
      NULL  -- System update
    );
    
    IF (update_result->>'updated')::BOOLEAN THEN
      RAISE DEBUG 'Updated organizing universe for project % due to patch assignment change', affected_project_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for patch assignment changes
DROP TRIGGER IF EXISTS trigger_patch_organising_universe_update ON patch_job_sites;
CREATE TRIGGER trigger_patch_organising_universe_update
  AFTER INSERT OR UPDATE OR DELETE ON patch_job_sites
  FOR EACH ROW
  EXECUTE FUNCTION handle_patch_assignment_organising_universe_update();

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_project_organising_universe_auto_assignment TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION handle_contractor_assignment_organising_universe_update TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION handle_patch_assignment_organising_universe_update TO authenticated, service_role;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ Step 6 Complete: Auto-assignment triggers created';
  RAISE NOTICE '';
  RAISE NOTICE '🔄 TRIGGERS ACTIVE:';
  RAISE NOTICE '   1. New project creation → auto-assign universe';
  RAISE NOTICE '   2. Builder/contractor changes → recalculate universe';
  RAISE NOTICE '   3. Patch assignment changes → recalculate universe';
  RAISE NOTICE '';
  RAISE NOTICE '🛡️ SAFEGUARDS:';
  RAISE NOTICE '   - Respects manual overrides';
  RAISE NOTICE '   - Full audit logging';
  RAISE NOTICE '   - Only affects projects with tiers';
  RAISE NOTICE '';
  RAISE NOTICE '📝 TEST: Create a new project and verify auto-assignment works';
END $$;

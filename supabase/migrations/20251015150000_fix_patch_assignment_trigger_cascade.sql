-- Fix trigger cascade that blocks BCI imports during project creation
-- 
-- Problem: When BCI import creates a project with job_site and coordinates,
-- the patch assignment trigger tries to update the project's organising_universe
-- while the project is still being created, causing a blocking cascade.
--
-- Solution: Skip the organising universe update if the project is in the middle
-- of initial creation (main_job_site_id not yet set and created within last second).
-- This is a surgical fix that only affects the exact import scenario.

CREATE OR REPLACE FUNCTION public.handle_patch_assignment_organising_universe_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected_project_id UUID;
  project_created_at TIMESTAMPTZ;
  project_main_site_id UUID;
  update_result JSONB;
BEGIN
  -- Get the project ID and critical fields from the job site
  IF TG_OP = 'INSERT' THEN
    SELECT js.project_id, p.created_at, p.main_job_site_id
    INTO affected_project_id, project_created_at, project_main_site_id
    FROM job_sites js 
    JOIN projects p ON p.id = js.project_id
    WHERE js.id = NEW.job_site_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    SELECT js.project_id, p.created_at, p.main_job_site_id
    INTO affected_project_id, project_created_at, project_main_site_id
    FROM job_sites js
    JOIN projects p ON p.id = js.project_id
    WHERE js.id = NEW.job_site_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    SELECT js.project_id, p.created_at, p.main_job_site_id
    INTO affected_project_id, project_created_at, project_main_site_id
    FROM job_sites js
    JOIN projects p ON p.id = js.project_id
    WHERE js.id = OLD.job_site_id;
  END IF;
  
  IF affected_project_id IS NOT NULL THEN
    -- CRITICAL FIX: Skip if project is still in initial creation phase
    -- This prevents trigger cascade during BCI imports where:
    -- 1. Project is inserted
    -- 2. Job site is inserted with coordinates (triggers patch assignment)
    -- 3. Patch assignment tries to update project that's still being created
    -- 4. BCI import then tries to update project.main_job_site_id
    --
    -- The check: main_job_site_id is NULL AND project was created < 1 second ago
    -- This is very specific to the import flow and won't affect legitimate updates
    IF project_main_site_id IS NULL AND project_created_at > (NOW() - INTERVAL '1 second') THEN
      RAISE DEBUG 'Skipping organising universe update for project % still in initial creation (created_at: %, main_job_site_id: NULL)', 
        affected_project_id, project_created_at;
      RETURN COALESCE(NEW, OLD);
    END IF;
    
    -- Normal operation: Update organizing universe for affected project
    update_result := update_organising_universe_with_rules(
      affected_project_id,
      TRUE, -- Respect manual overrides
      NULL  -- System update
    );
    
    IF (update_result->>'updated')::BOOLEAN THEN
      RAISE DEBUG 'Updated organizing universe for project % due to patch assignment change', 
        affected_project_id;
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Add comment explaining the fix
COMMENT ON FUNCTION public.handle_patch_assignment_organising_universe_update() IS 
'Handles organizing universe updates when patches are assigned to job sites. 
Includes fix for BCI import trigger cascade: skips update if project is still 
in initial creation phase (main_job_site_id NULL and created < 1 second ago).';


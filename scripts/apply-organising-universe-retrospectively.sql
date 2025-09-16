-- =================================================================
-- Retrospectively Apply Organising Universe Rules
-- =================================================================
--
-- Author:      Your Name/AI Assistant
-- Date:        2025-09-15
-- Description: This script applies the organising universe business rules
--              to all existing projects that have not been manually 
--              overridden. It uses the `apply_organising_universe_rules_retrospectively`
--              function to ensure changes are logged and applied safely.
--
-- Usage:       Run this script via the Supabase SQL editor or a psql
--              client connected to your database. It's recommended to
--              first run with `dry_run = TRUE` to preview changes.
--
-- =================================================================

DO $$
DECLARE
  -- Configuration
  dry_run BOOLEAN := FALSE; -- SET TO TRUE TO PREVIEW CHANGES, FALSE TO APPLY THEM
  user_id UUID := auth.uid(); -- Assumes the script is run by an authenticated user
  
  -- Variables
  result JSONB;
BEGIN
  RAISE NOTICE 'Starting retrospective application of organising universe rules...';
  RAISE NOTICE 'Dry run mode: %', dry_run;

  -- Before running, you can preview the impact using the analysis view:
  -- SELECT * FROM organising_universe_impact_analysis WHERE change_type != 'NO_CHANGE';

  -- Execute the main function
  result := apply_organising_universe_rules_retrospectively(dry_run, user_id);

  -- Output the results
  RAISE NOTICE '----------------------------------------------------------';
  RAISE NOTICE 'Retrospective application complete.';
  RAISE NOTICE 'Projects updated: %', result->>'projects_updated';
  RAISE NOTICE 'Total projects checked: %', result->>'total_projects_checked';
  RAISE NOTICE 'Manual overrides skipped: %', result->>'manual_overrides_skipped';
  RAISE NOTICE '----------------------------------------------------------';
  
  -- For details of what changed, check the log table:
  -- SELECT * FROM organising_universe_change_log ORDER BY applied_at DESC LIMIT 50;

END $$;

-- =================================================================
-- Retrospectively Fix Project stage_class Data
-- =================================================================
--
-- Author:      AI Assistant
-- Date:        2025-09-15
-- Description: This script corrects the `stage_class` for all existing
--              projects. It applies the corrected derivation logic
--              based on the raw `project_stage` and `project_status`
--              columns. This fixes a bug where "Pre-Construction"
--              projects were incorrectly classified as "Construction".
--
-- Usage:       Run this script via the Supabase SQL editor or a psql
--              client connected to your database to fix historical data.
--
-- =================================================================

DO $$
DECLARE
  updated_rows INTEGER;
BEGIN
  RAISE NOTICE 'Starting retrospective fix for project stage_class...';

  WITH corrected_stages AS (
    SELECT
      id,
      CASE
        WHEN lower(project_status) ~ '(cancel|complete|abandon|defer|hold)' OR lower(project_stage) ~ '(complete|cancel|abandon|defer|hold)' THEN 'archived'
        WHEN lower(project_stage) LIKE '%pre-construction%' THEN 'pre_construction'
        WHEN lower(project_stage) LIKE '%construction%' THEN 'construction'
        WHEN lower(project_stage) LIKE '%future%' THEN 'future'
        WHEN lower(project_stage) ~ '(design|tender|award|planning|document)' THEN 'pre_construction'
        ELSE 'pre_construction'
      END::project_stage_class AS new_stage_class
    FROM projects
  )
  UPDATE projects p
  SET stage_class = cs.new_stage_class
  FROM corrected_stages cs
  WHERE p.id = cs.id AND p.stage_class IS DISTINCT FROM cs.new_stage_class;

  GET DIAGNOSTICS updated_rows = ROW_COUNT;

  RAISE NOTICE '----------------------------------------------------------';
  RAISE NOTICE '✅ Retrospective fix complete.';
  RAISE NOTICE 'Rows updated: %', updated_rows;
  RAISE NOTICE '----------------------------------------------------------';

  -- After running, you may need to refresh any materialized views
  -- that depend on the `stage_class` column.
  RAISE NOTICE '💡 Recommended next step:';
  RAISE NOTICE '   REFRESH MATERIALIZED VIEW project_list_comprehensive_view;';

END $$;

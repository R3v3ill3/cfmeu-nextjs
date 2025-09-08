-- Project classification: organising_universe and stage_class

-- Create enum types if they don't already exist
DO $$ BEGIN
  CREATE TYPE project_organising_universe AS ENUM ('active','potential','excluded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE project_stage_class AS ENUM ('future','pre_construction','construction','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add columns to projects
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS organising_universe project_organising_universe NOT NULL DEFAULT 'potential',
  ADD COLUMN IF NOT EXISTS stage_class project_stage_class NOT NULL DEFAULT 'pre_construction';

-- Ensure BCI metadata columns exist (used for defaulting and mapping)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS bci_project_id text,
  ADD COLUMN IF NOT EXISTS project_stage text,
  ADD COLUMN IF NOT EXISTS project_status text,
  ADD COLUMN IF NOT EXISTS last_update_date date;

-- Indexes for filters
CREATE INDEX IF NOT EXISTS idx_projects_organising_universe ON projects(organising_universe);
CREATE INDEX IF NOT EXISTS idx_projects_stage_class ON projects(stage_class);

-- One-time backfill: derive stage_class and organising_universe from existing BCI stage/status where not already set
WITH inferred AS (
  SELECT
    id,
    CASE
      WHEN COALESCE(lower(project_status), '') ~ '(cancel|complete|abandon|defer|hold)'
        OR COALESCE(lower(project_stage), '') ~ '(complete|cancel|abandon|defer|hold)'
        THEN 'archived'
      WHEN COALESCE(lower(project_stage), '') LIKE '%construction%'
        THEN 'construction'
      WHEN COALESCE(lower(project_stage), '') LIKE '%future%'
        THEN 'future'
      WHEN COALESCE(lower(project_stage), '') ~ '(design|tender|award|planning|document)'
        THEN 'pre_construction'
      ELSE 'pre_construction'
    END::project_stage_class AS inferred_stage_class
  FROM projects
)
UPDATE projects p
SET
  stage_class = COALESCE(p.stage_class, i.inferred_stage_class),
  organising_universe = COALESCE(
    p.organising_universe,
    CASE
      WHEN i.inferred_stage_class = 'construction' THEN 'active'
      WHEN i.inferred_stage_class = 'archived' THEN 'excluded'
      ELSE 'potential'
    END::project_organising_universe
  )
FROM inferred i
WHERE p.id = i.id;

-- Optional: Trigger to infer stage_class and organising_universe on insert based on BCI fields and value
CREATE OR REPLACE FUNCTION infer_project_classifications()
RETURNS trigger AS $$
DECLARE
  s text;
  st text;
BEGIN
  -- Derive stage_class if not provided, using BCI stage/status text
  IF NEW.stage_class IS NULL THEN
    s := COALESCE(lower(NEW.project_stage), '');
    st := COALESCE(lower(NEW.project_status), '');
    IF st ~ '(cancel|complete|abandon|defer|hold)' OR s ~ '(complete|cancel|abandon|defer|hold)' THEN
      NEW.stage_class := 'archived';
    ELSIF s LIKE '%construction%' THEN
      NEW.stage_class := 'construction';
    ELSIF s LIKE '%future%' THEN
      NEW.stage_class := 'future';
    ELSIF s ~ '(design|tender|award|planning|document)' THEN
      NEW.stage_class := 'pre_construction';
    ELSE
      NEW.stage_class := 'pre_construction';
    END IF;
  END IF;

  -- Derive organising_universe if not provided
  IF NEW.organising_universe IS NULL THEN
    -- User-specified rule: Active if value > $20M and stage is construction
    IF NEW.value IS NOT NULL AND NEW.value > 20000000 AND (
         NEW.stage_class = 'construction'
         OR COALESCE(lower(NEW.project_stage), '') LIKE '%construction%'
       ) THEN
      NEW.organising_universe := 'active';
    ELSE
      -- Otherwise default by stage_class
      IF NEW.stage_class = 'construction' THEN
        NEW.organising_universe := 'active';
      ELSIF NEW.stage_class = 'archived' THEN
        NEW.organising_universe := 'excluded';
      ELSE
        NEW.organising_universe := 'potential';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_infer_project_classifications ON projects;
CREATE TRIGGER trg_infer_project_classifications
BEFORE INSERT ON projects
FOR EACH ROW
EXECUTE FUNCTION infer_project_classifications();



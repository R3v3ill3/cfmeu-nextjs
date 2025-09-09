-- Add funding type fields for BCI project imports
-- These fields map to the CSV columns: "Funding Type Primary" and "Owner Type Level 1 Primary"

-- Add funding type columns to projects table
ALTER TABLE projects 
  ADD COLUMN IF NOT EXISTS funding_type_primary text,
  ADD COLUMN IF NOT EXISTS owner_type_level_1 text;

-- Add indexes for efficient filtering
CREATE INDEX IF NOT EXISTS idx_projects_funding_type ON projects(funding_type_primary) 
WHERE funding_type_primary IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_projects_owner_type ON projects(owner_type_level_1) 
WHERE owner_type_level_1 IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN projects.funding_type_primary IS 
'Primary funding source from BCI data: Federal, Federal State, Federal state local, local, state, state local, or blank';

COMMENT ON COLUMN projects.owner_type_level_1 IS 
'Primary owner type from BCI data: Government, or blank';

-- Update the project classification trigger to handle the new fields
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
    -- Enhanced rule: Consider government projects with higher value threshold
    IF NEW.value IS NOT NULL AND (
         (NEW.value > 20000000 AND NEW.stage_class = 'construction') OR
         (NEW.value > 50000000 AND COALESCE(lower(NEW.owner_type_level_1), '') = 'government' AND NEW.stage_class IN ('construction', 'pre_construction'))
       ) THEN
      NEW.organising_universe := 'active';
    ELSE
      -- Default by stage_class
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

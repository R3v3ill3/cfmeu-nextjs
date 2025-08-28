-- Project Tier Rating System
-- Adds computed tier field based on project value

-- Add the tier column as a generated column
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS tier text GENERATED ALWAYS AS (
  CASE 
    WHEN value >= 500000000 THEN 'tier_1'
    WHEN value >= 100000000 THEN 'tier_2' 
    WHEN value IS NOT NULL THEN 'tier_3'
    ELSE NULL
  END
) STORED;

-- Create an index on tier for efficient filtering and sorting
CREATE INDEX IF NOT EXISTS idx_projects_tier ON projects(tier);

-- Create a function to get tier label for display
CREATE OR REPLACE FUNCTION get_project_tier_label(tier_value text)
RETURNS text AS $$
BEGIN
  RETURN CASE tier_value
    WHEN 'tier_1' THEN 'Tier 1'
    WHEN 'tier_2' THEN 'Tier 2'
    WHEN 'tier_3' THEN 'Tier 3'
    ELSE 'Unknown'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to get tier color for UI
CREATE OR REPLACE FUNCTION get_project_tier_color(tier_value text)
RETURNS text AS $$
BEGIN
  RETURN CASE tier_value
    WHEN 'tier_1' THEN 'red'
    WHEN 'tier_2' THEN 'orange'
    WHEN 'tier_3' THEN 'blue'
    ELSE 'gray'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add RLS policy for tier column if RLS is enabled
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'projects' 
    AND schemaname = 'public'
  ) THEN
    -- RLS is enabled, ensure tier column is accessible
    -- (This should work automatically with existing policies)
    NULL;
  END IF;
END $$;

-- Update existing projects to ensure tier is calculated
-- This is handled automatically by the generated column
-- but we can force a refresh if needed
UPDATE projects SET updated_at = updated_at WHERE tier IS NULL;

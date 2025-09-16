-- Step 1: Add tracking columns for organizing universe automation
-- This preserves user control and tracks automated changes

-- Add tracking columns to projects table
ALTER TABLE projects 
ADD COLUMN IF NOT EXISTS organising_universe_auto_assigned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS organising_universe_manual_override BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS organising_universe_last_auto_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS organising_universe_change_reason TEXT;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_organising_universe_auto 
  ON projects(organising_universe_auto_assigned);
CREATE INDEX IF NOT EXISTS idx_projects_organising_universe_manual_override 
  ON projects(organising_universe_manual_override);

-- Create backup table for current state
CREATE TABLE IF NOT EXISTS projects_organising_universe_backup AS 
SELECT 
  id, 
  organising_universe, 
  tier, 
  name,
  value,
  created_at, 
  updated_at 
FROM projects;

-- Create audit log table
CREATE TABLE IF NOT EXISTS organising_universe_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  old_value TEXT,
  new_value TEXT,
  change_reason TEXT,
  rule_applied TEXT,
  applied_by UUID REFERENCES profiles(id),
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  was_manual_override BOOLEAN DEFAULT FALSE
);

-- Grant permissions
GRANT SELECT, INSERT ON organising_universe_change_log TO authenticated, service_role;
GRANT SELECT ON projects_organising_universe_backup TO authenticated, service_role;

-- Mark existing projects as manually set (if they have a value)
UPDATE projects 
SET organising_universe_manual_override = TRUE
WHERE organising_universe IS NOT NULL;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Step 1 Complete: Tracking columns and backup tables created';
  RAISE NOTICE 'ℹ️  Existing projects marked as manually set to preserve user choices';
  RAISE NOTICE '📊 Backup table created: projects_organising_universe_backup';
END $$;

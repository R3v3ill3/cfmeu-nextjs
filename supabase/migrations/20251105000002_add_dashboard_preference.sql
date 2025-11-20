-- Add dashboard preference system
-- Allows admin to set default dashboard and users to override

-- Add dashboard_preference column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS dashboard_preference TEXT 
CHECK (dashboard_preference IN ('legacy', 'new', 'auto'))
DEFAULT NULL;

-- Add index for filtering
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_preference 
  ON profiles(dashboard_preference) 
  WHERE dashboard_preference IS NOT NULL;

-- Add default_dashboard setting to app_settings (admin config)
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'default_dashboard',
  '"legacy"',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add comment
COMMENT ON COLUMN profiles.dashboard_preference IS 
  'User dashboard preference: legacy (old dashboard), new (new dashboard), auto (use admin default)';

COMMENT ON TABLE app_settings IS 
  'Application-wide settings. Includes navigation_visibility and default_dashboard (admin config)';





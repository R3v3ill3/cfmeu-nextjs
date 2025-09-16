-- Navigation Visibility Settings
-- Adds default navigation visibility settings to app_settings table

-- Insert default navigation visibility settings if not exists
INSERT INTO app_settings (key, value, updated_at)
VALUES (
  'navigation_visibility',
  '{"patch": true, "employers": true, "workers": true, "map": true, "site_visits": true, "campaigns": true}',
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Add a comment to document the setting
COMMENT ON TABLE app_settings IS 'Application-wide settings stored as key-value pairs';

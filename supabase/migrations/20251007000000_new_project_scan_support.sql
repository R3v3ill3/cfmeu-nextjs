-- ============================================================================
-- Mapping Sheet Scanner Enhancements: Support new project upload workflow
-- ============================================================================

-- Allow mapping sheet scans without an existing project context
ALTER TABLE mapping_sheet_scans
  ALTER COLUMN project_id DROP NOT NULL;

-- Expand status lifecycle to cover new-project uploads
DO $$
BEGIN
  ALTER TABLE mapping_sheet_scans
    DROP CONSTRAINT IF EXISTS valid_status;

  ALTER TABLE mapping_sheet_scans
    ADD CONSTRAINT valid_status CHECK (
      status IN (
        'pending',
        'pending_new_project',
        'processing',
        'completed',
        'review_new_project',
        'under_review',
        'confirmed',
        'rejected',
        'failed'
      )
    );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Track how the scan was initiated and the project created from it (if any)
ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS upload_mode TEXT;

ALTER TABLE mapping_sheet_scans
  ADD CONSTRAINT IF NOT EXISTS valid_upload_mode CHECK (
    upload_mode IN ('existing_project', 'new_project')
  );

ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS created_project_id UUID REFERENCES projects(id);

ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS intended_role_defaults JSONB;

-- Ensure historic rows have the expected mode value
UPDATE mapping_sheet_scans
SET upload_mode = 'existing_project'
WHERE upload_mode IS NULL;

-- Helpful indexes for new workflow queries
CREATE INDEX IF NOT EXISTS idx_mapping_sheet_scans_created_project_id
  ON mapping_sheet_scans(created_project_id);

CREATE INDEX IF NOT EXISTS idx_mapping_sheet_scans_upload_mode
  ON mapping_sheet_scans(upload_mode);

-- Broaden read access so uploaders can review scans created without a project
DROP POLICY IF EXISTS "Users can view scans for accessible projects" ON mapping_sheet_scans;

CREATE POLICY "Users can view scans for accessible projects"
  ON mapping_sheet_scans FOR SELECT
  USING (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mapping_sheet_scans.project_id
    ))
    OR auth.uid() = uploaded_by
  );

-- Function to prevent concurrent new-project scans per uploader
CREATE OR REPLACE FUNCTION user_has_pending_new_project_scan(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mapping_sheet_scans
    WHERE uploaded_by = p_user_id
      AND upload_mode = 'new_project'
      AND status IN ('pending_new_project', 'processing', 'review_new_project', 'under_review')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update helper to include new statuses for existing-project scans
CREATE OR REPLACE FUNCTION project_has_pending_scan(p_project_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM mapping_sheet_scans
    WHERE project_id = p_project_id
      AND status IN ('pending', 'processing', 'under_review')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quick project search view to power new-project scan matching
CREATE OR REPLACE VIEW public.projects_quick_search AS
SELECT
  p.id,
  p.name,
  COALESCE(js.full_address, js.location) AS full_address,
  e.name AS builder_name,
  to_tsvector('simple', unaccent(coalesce(p.name, ''))) ||
  to_tsvector('simple', unaccent(coalesce(js.full_address, ''))) ||
  to_tsvector('simple', unaccent(coalesce(e.name, ''))) AS search_vector
FROM projects p
LEFT JOIN job_sites js ON js.id = p.main_job_site_id
LEFT JOIN employers e ON e.id = p.builder_id
WHERE p.deleted_at IS NULL;

GRANT SELECT ON public.projects_quick_search TO authenticated;

COMMENT ON VIEW public.projects_quick_search IS 'Simplified project search (name/address/builder) for mapping sheet scan quick matching.';

-- RPC used by frontend quick finder dialog
CREATE OR REPLACE FUNCTION search_projects_basic(p_query TEXT, p_limit INT DEFAULT 20)
RETURNS TABLE(
  id UUID,
  name TEXT,
  full_address TEXT,
  builder_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.name, q.full_address, q.builder_name
  FROM public.projects_quick_search q
  WHERE (
    p_query IS NULL
    OR p_query = ''
    OR q.search_vector @@ plainto_tsquery('simple', unaccent(p_query))
  )
  ORDER BY similarity(unaccent(q.name), unaccent(p_query)) DESC NULLS LAST,
           q.name
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION search_projects_basic(TEXT, INT) TO authenticated;



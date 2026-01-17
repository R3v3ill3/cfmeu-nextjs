-- ============================================================================
-- Create Organiser Project Claims Table
-- ============================================================================
-- Purpose: Allow organisers to "claim" projects that are unassigned (no patch
-- or patch has no organiser), creating a personal user-to-project relationship
-- independent of patch assignments.
--
-- This supports the Site Visit Wizard workflow where organisers can see nearby
-- projects and claim unassigned ones for their work.
-- ============================================================================

-- 1. Create the claims table
CREATE TABLE IF NOT EXISTS organiser_project_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organiser_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,  -- NULL = active claim, set when claim is released
  created_by UUID REFERENCES profiles(id),
  notes TEXT,  -- Optional notes about why the project was claimed
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create unique constraint for active claims (one active claim per organiser-project pair)
CREATE UNIQUE INDEX IF NOT EXISTS organiser_project_claims_active_uidx 
  ON organiser_project_claims (organiser_id, project_id) 
  WHERE (released_at IS NULL);

-- 3. Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_organiser_project_claims_organiser 
  ON organiser_project_claims (organiser_id) 
  WHERE (released_at IS NULL);

CREATE INDEX IF NOT EXISTS idx_organiser_project_claims_project 
  ON organiser_project_claims (project_id) 
  WHERE (released_at IS NULL);

-- 4. Enable Row Level Security
ALTER TABLE organiser_project_claims ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS policies

-- Users can view their own claims, admins can view all
CREATE POLICY "claims_select" ON organiser_project_claims
  FOR SELECT TO authenticated
  USING (
    organiser_id = auth.uid() 
    OR is_admin()
    -- Lead organisers can see claims from organisers in their patches
    OR EXISTS (
      SELECT 1 FROM lead_organiser_patch_assignments lopa
      JOIN organiser_patch_assignments opa ON opa.patch_id = lopa.patch_id
      WHERE lopa.lead_organiser_id = auth.uid()
        AND lopa.effective_to IS NULL
        AND opa.organiser_id = organiser_project_claims.organiser_id
        AND opa.effective_to IS NULL
    )
  );

-- Users can create claims for themselves
CREATE POLICY "claims_insert" ON organiser_project_claims
  FOR INSERT TO authenticated
  WITH CHECK (
    organiser_id = auth.uid()
    AND created_by = auth.uid()
  );

-- Users can update their own claims (e.g., to release them)
CREATE POLICY "claims_update" ON organiser_project_claims
  FOR UPDATE TO authenticated
  USING (organiser_id = auth.uid() OR is_admin())
  WITH CHECK (organiser_id = auth.uid() OR is_admin());

-- Users can delete their own claims, admins can delete any
CREATE POLICY "claims_delete" ON organiser_project_claims
  FOR DELETE TO authenticated
  USING (organiser_id = auth.uid() OR is_admin());

-- 6. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_organiser_project_claims_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_organiser_project_claims_updated_at 
  ON organiser_project_claims;
CREATE TRIGGER trigger_update_organiser_project_claims_updated_at
  BEFORE UPDATE ON organiser_project_claims
  FOR EACH ROW
  EXECUTE FUNCTION update_organiser_project_claims_updated_at();

-- 7. Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON organiser_project_claims TO authenticated;
GRANT ALL ON organiser_project_claims TO service_role;

-- 8. Add table comment
COMMENT ON TABLE organiser_project_claims IS 
  'Tracks organiser claims on projects that are not assigned via patch. Allows organisers to work on projects outside their patch assignments.';

COMMENT ON COLUMN organiser_project_claims.released_at IS 
  'When set, indicates the claim has been released. NULL means the claim is active.';

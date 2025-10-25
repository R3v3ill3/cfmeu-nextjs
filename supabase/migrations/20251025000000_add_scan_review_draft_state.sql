-- Add review_data field to store user's draft decisions during scan review
-- This enables "Save & Continue Later" functionality

-- Add the review_data column to store draft state
ALTER TABLE mapping_sheet_scans
ADD COLUMN IF NOT EXISTS review_data JSONB DEFAULT NULL;

-- Create index for performance when checking for drafts
CREATE INDEX IF NOT EXISTS idx_mapping_sheet_scans_review_data
  ON mapping_sheet_scans((review_data IS NOT NULL))
  WHERE review_data IS NOT NULL;

-- Add comment explaining the field
COMMENT ON COLUMN mapping_sheet_scans.review_data IS
  'Stores user review decisions and draft state before final import. Structure: { projectDecisions: {}, contactsDecisions: [], subcontractorDecisions: [], visitedTabs: [], savedAt: ISO timestamp }. Allows "Save & Continue Later" functionality. Cleared after successful import.';

-- Grant permissions (users need to update their own review drafts)
-- RLS policies already exist for mapping_sheet_scans table

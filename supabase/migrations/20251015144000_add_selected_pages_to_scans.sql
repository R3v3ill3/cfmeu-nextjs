-- Add selected_pages column to mapping_sheet_scans
-- This stores which pages the user selected for processing

ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS selected_pages integer[] DEFAULT NULL;

-- Add retry_attempt tracking
ALTER TABLE mapping_sheet_scans
  ADD COLUMN IF NOT EXISTS retry_attempt integer DEFAULT 0;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_mapping_sheet_scans_retry_attempt
  ON mapping_sheet_scans(retry_attempt);

COMMENT ON COLUMN mapping_sheet_scans.selected_pages IS
  'Array of page numbers selected by user for processing (1-indexed). NULL means all pages.';

COMMENT ON COLUMN mapping_sheet_scans.retry_attempt IS
  'Number of times this scan has been retried after failure. 0 = first attempt.';

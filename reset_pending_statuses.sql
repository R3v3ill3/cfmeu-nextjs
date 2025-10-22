-- Reset any 'create_new' or 'matched' statuses back to 'pending'
-- This ensures they go through proper duplicate detection on next import

UPDATE pending_employers
SET
  import_status = 'pending',
  matched_employer_id = NULL
WHERE import_status IN ('create_new', 'matched');

-- Show how many were reset
SELECT
  import_status,
  COUNT(*) as count
FROM pending_employers
GROUP BY import_status;

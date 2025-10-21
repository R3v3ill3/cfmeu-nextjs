-- Add new status values to pending_employers.import_status
-- This allows tracking of manual match decisions and workflow states

-- Drop existing constraint
ALTER TABLE public.pending_employers 
DROP CONSTRAINT IF EXISTS pending_employers_import_status_check;

-- Add updated constraint with new status values
ALTER TABLE public.pending_employers 
ADD CONSTRAINT pending_employers_import_status_check 
CHECK (import_status IN (
  'pending',        -- Default state, awaiting review
  'imported',       -- Successfully imported into employers table
  'skipped',        -- User chose to skip (hidden from default view)
  'error',          -- Import failed with error
  'matched',        -- User manually matched to existing employer
  'create_new'      -- User confirmed to create as new employer
));

-- Add column for storing matched employer ID (if not exists)
ALTER TABLE public.pending_employers
ADD COLUMN IF NOT EXISTS matched_employer_id uuid REFERENCES public.employers(id);

-- Add index for matched employer lookups
CREATE INDEX IF NOT EXISTS idx_pending_employers_matched_employer 
  ON public.pending_employers(matched_employer_id) 
  WHERE matched_employer_id IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.pending_employers.import_status IS 
'Import workflow status: pending (default), imported (completed), skipped (user hidden), error (failed), matched (user selected existing employer), create_new (user confirmed new)';

COMMENT ON COLUMN public.pending_employers.matched_employer_id IS 
'When user manually matches to existing employer, stores the target employer ID';



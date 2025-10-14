-- Add 'scanned_mapping_sheet' as a valid source value for project_assignments
-- This is needed for the create_project_from_scan function

ALTER TABLE project_assignments
DROP CONSTRAINT IF EXISTS project_assignments_source_check;

ALTER TABLE project_assignments
ADD CONSTRAINT project_assignments_source_check
CHECK (source = ANY (ARRAY['manual'::text, 'bci_import'::text, 'other_import'::text, 'scanned_mapping_sheet'::text]));

COMMENT ON CONSTRAINT project_assignments_source_check ON project_assignments IS
  'Valid source values: manual, bci_import, other_import, scanned_mapping_sheet';

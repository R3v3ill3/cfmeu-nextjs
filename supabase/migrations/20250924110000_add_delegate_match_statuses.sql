-- Add support for delegate match status values
-- match_status is a text field, so we need to update any check constraints

-- Drop existing match_status constraint if it exists and add new one with delegate values
DO $$
BEGIN
    -- Try to drop existing constraint (ignore error if it doesn't exist)
    BEGIN
        ALTER TABLE project_assignments DROP CONSTRAINT IF EXISTS project_assignments_match_status_check;
        RAISE NOTICE 'Dropped existing project_assignments match_status constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No existing project_assignments match_status constraint to drop';
    END;
    
    -- Add new constraint allowing delegate statuses
    ALTER TABLE project_assignments 
    ADD CONSTRAINT project_assignments_match_status_check 
    CHECK (match_status IN ('auto_matched', 'confirmed', 'needs_review', 'manual', 'delegate_confirmed', 'incorrect_via_delegate'));
    
    RAISE NOTICE 'Added new project_assignments match_status constraint with delegate values';
END $$;

-- Do the same for project_contractor_trades table
DO $$
BEGIN
    -- Try to drop existing constraint (ignore error if it doesn't exist)
    BEGIN
        ALTER TABLE project_contractor_trades DROP CONSTRAINT IF EXISTS project_contractor_trades_match_status_check;
        RAISE NOTICE 'Dropped existing project_contractor_trades match_status constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'No existing project_contractor_trades match_status constraint to drop';
    END;
    
    -- Add new constraint allowing delegate statuses
    ALTER TABLE project_contractor_trades 
    ADD CONSTRAINT project_contractor_trades_match_status_check 
    CHECK (match_status IN ('auto_matched', 'confirmed', 'needs_review', 'manual', 'delegate_confirmed', 'incorrect_via_delegate'));
    
    RAISE NOTICE 'Added new project_contractor_trades match_status constraint with delegate values';
END $$;

-- Update comments for documentation
COMMENT ON COLUMN project_assignments.match_status IS 'Match status including delegate confirmations: auto_matched, confirmed, needs_review, manual, delegate_confirmed, incorrect_via_delegate';
COMMENT ON COLUMN project_contractor_trades.match_status IS 'Match status including delegate confirmations: auto_matched, confirmed, needs_review, manual, delegate_confirmed, incorrect_via_delegate';
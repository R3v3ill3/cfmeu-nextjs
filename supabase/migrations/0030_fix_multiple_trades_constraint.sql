-- Fix critical regression: Allow multiple trades per employer per project
-- This undoes the wrong constraint from migration 0029

-- 1. Drop the incorrect unique constraint that prevents multiple trades
DROP INDEX IF EXISTS idx_project_contractor_trades_unique;

-- 2. Create the CORRECT constraint - prevent duplicate (project, employer, trade) combinations
-- This allows: Employer can have electrical AND plumbing trades on same project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contractor_trades_unique 
ON project_contractor_trades (project_id, employer_id, trade_type);

-- 3. Replace the wrong RPC function with a correct one
DROP FUNCTION IF EXISTS assign_contractor_trade(uuid,uuid,text,text);

-- Create correct function that allows multiple trades per employer per project
CREATE OR REPLACE FUNCTION assign_contractor_trade(
  p_project_id UUID,
  p_employer_id UUID,
  p_trade_type TEXT,
  p_company_name TEXT
) RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Simple insert with conflict handling - allows multiple trades per employer
  INSERT INTO project_contractor_trades (project_id, employer_id, trade_type)
  VALUES (p_project_id, p_employer_id, p_trade_type)
  ON CONFLICT (project_id, employer_id, trade_type) DO NOTHING;
  
  -- Check if the record exists (either just inserted or already existed)
  IF EXISTS (
    SELECT 1 FROM project_contractor_trades 
    WHERE project_id = p_project_id 
      AND employer_id = p_employer_id 
      AND trade_type = p_trade_type
  ) THEN
    RETURN QUERY SELECT TRUE, format('Assigned %s to %s trade on project', p_company_name, p_trade_type);
  ELSE
    RETURN QUERY SELECT FALSE, format('Failed to assign %s to %s trade', p_company_name, p_trade_type);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 4. Add helpful comment
COMMENT ON FUNCTION assign_contractor_trade IS 'Assigns trade types to contractors, allows multiple trades per employer per project, prevents duplicate assignments';

-- 5. Verify the fix with some example data structure
-- This should now be possible:
-- Employer A on Project 1: electrical, plumbing, carpentry
-- Employer A on Project 2: electrical, demolition  
-- Employer B on Project 1: electrical (same trade as A, different employer)

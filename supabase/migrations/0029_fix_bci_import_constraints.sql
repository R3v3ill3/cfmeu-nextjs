-- Fix critical BCI import constraint issues

-- 1. Drop existing function if it exists, then create the correct one
DROP FUNCTION IF EXISTS assign_bci_builder(uuid,uuid,text);

-- Create the assign_bci_builder function
CREATE OR REPLACE FUNCTION assign_bci_builder(
  p_project_id UUID,
  p_employer_id UUID,
  p_company_name TEXT
) RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
BEGIN
  -- Check if this employer is already assigned as builder
  IF EXISTS (
    SELECT 1 FROM projects 
    WHERE id = p_project_id AND builder_id = p_employer_id
  ) THEN
    RETURN QUERY SELECT TRUE, 'Builder already assigned to this project';
    RETURN;
  END IF;

  -- Check if project already has a different builder
  IF EXISTS (
    SELECT 1 FROM projects 
    WHERE id = p_project_id AND builder_id IS NOT NULL AND builder_id != p_employer_id
  ) THEN
    -- Project already has a different builder - add this one as head contractor instead
    INSERT INTO project_employer_roles (project_id, employer_id, role)
    VALUES (p_project_id, p_employer_id, 'head_contractor')
    ON CONFLICT (project_id, employer_id, role) DO NOTHING;
    
    RETURN QUERY SELECT TRUE, format('Added %s as additional head contractor (project already has a builder)', p_company_name);
    RETURN;
  END IF;

  -- Assign as primary builder
  UPDATE projects 
  SET builder_id = p_employer_id 
  WHERE id = p_project_id;

  RETURN QUERY SELECT TRUE, format('Assigned %s as primary builder', p_company_name);
END;
$$ LANGUAGE plpgsql;

-- 2. Drop existing function if it exists, then create function to handle multiple trade types
DROP FUNCTION IF EXISTS assign_contractor_trade(uuid,uuid,text,text);

-- Create function to handle multiple trade types for same employer on same project
CREATE OR REPLACE FUNCTION assign_contractor_trade(
  p_project_id UUID,
  p_employer_id UUID,
  p_trade_type TEXT,
  p_company_name TEXT
) RETURNS TABLE(success BOOLEAN, message TEXT) AS $$
DECLARE
  existing_trade TEXT;
BEGIN
  -- Check if this employer already has a trade assignment on this project
  SELECT trade_type INTO existing_trade
  FROM project_contractor_trades
  WHERE project_id = p_project_id AND employer_id = p_employer_id
  LIMIT 1;

  IF existing_trade IS NOT NULL THEN
    -- Employer already has a trade on this project
    IF existing_trade = p_trade_type THEN
      -- Same trade type, no action needed
      RETURN QUERY SELECT TRUE, format('%s already assigned to %s trade', p_company_name, p_trade_type);
    ELSE
      -- Different trade type - update to more general category or keep existing
      -- Priority: general_construction can be overridden, others are kept
      IF existing_trade = 'general_construction' AND p_trade_type != 'general_construction' THEN
        UPDATE project_contractor_trades 
        SET trade_type = p_trade_type
        WHERE project_id = p_project_id AND employer_id = p_employer_id;
        
        RETURN QUERY SELECT TRUE, format('Updated %s from %s to %s trade', p_company_name, existing_trade, p_trade_type);
      ELSE
        -- Keep existing trade, don't create conflict
        RETURN QUERY SELECT TRUE, format('%s kept existing %s trade (not overridden by %s)', p_company_name, existing_trade, p_trade_type);
      END IF;
    END IF;
  ELSE
    -- No existing trade, insert new one
    INSERT INTO project_contractor_trades (project_id, employer_id, trade_type)
    VALUES (p_project_id, p_employer_id, p_trade_type);
    
    RETURN QUERY SELECT TRUE, format('Assigned %s to %s trade', p_company_name, p_trade_type);
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Add unique constraint that allows multiple builders via different mechanisms
-- Remove any conflicting constraints and add proper ones
DROP INDEX IF EXISTS idx_project_employer_roles_unique;

-- Create proper unique constraint for project_employer_roles
ALTER TABLE project_employer_roles 
DROP CONSTRAINT IF EXISTS project_employer_roles_project_id_employer_id_role_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_employer_roles_unique 
ON project_employer_roles (project_id, employer_id, role);

-- 4. Clean up existing duplicates in project_contractor_trades before adding constraint
-- First, identify and remove duplicate records, keeping the most recent one
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY project_id, employer_id 
           ORDER BY created_at DESC NULLS LAST, id DESC
         ) as rn
  FROM project_contractor_trades
)
DELETE FROM project_contractor_trades 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Drop any existing constraint
ALTER TABLE project_contractor_trades 
DROP CONSTRAINT IF EXISTS project_contractor_trades_project_id_employer_id_key;

-- Create unique constraint to prevent multiple trades for same employer on same project
CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contractor_trades_unique 
ON project_contractor_trades (project_id, employer_id);

-- 5. Add helpful comments
COMMENT ON FUNCTION assign_bci_builder IS 'Assigns builders to projects, handling multiple builders by making additional ones head contractors';
COMMENT ON FUNCTION assign_contractor_trade IS 'Assigns trade types to contractors, resolving conflicts by keeping most specific trade';

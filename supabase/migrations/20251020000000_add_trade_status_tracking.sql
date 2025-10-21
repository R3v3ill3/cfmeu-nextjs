-- ============================================================================
-- Trade Status Tracking Enhancement
-- ============================================================================
-- Purpose: Add comprehensive status tracking for contractor assignments
-- including tendering phases and status update timestamps
-- ============================================================================

-- 1. Update project_assignments status constraint to include tendering phases
ALTER TABLE project_assignments 
  DROP CONSTRAINT IF EXISTS project_assignments_status_check;

ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_status_check 
  CHECK (status IN (
    'planned',           -- Contract signed, not yet started
    'tendering',         -- Out to tender (RFT/RFQ issued)
    'not_yet_tendered',  -- Planned but tender not yet issued
    'unknown',           -- Status not yet determined (NEW - for imports)
    'active',            -- Currently on site working (DEFAULT)
    'completed',         -- Work finished and signed off
    'cancelled',         -- Contract cancelled/terminated
    'on_hold'            -- Work temporarily paused
  ));

-- 2. Add status tracking metadata to project_assignments
ALTER TABLE project_assignments
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES auth.users(id);

-- Create index for status queries (performance)
CREATE INDEX IF NOT EXISTS idx_project_assignments_status 
  ON project_assignments(status) 
  WHERE status IN ('active', 'tendering', 'not_yet_tendered');

-- Create index for status updates (audit trail queries)
CREATE INDEX IF NOT EXISTS idx_project_assignments_status_updated 
  ON project_assignments(status_updated_at DESC NULLS LAST)
  WHERE status_updated_at IS NOT NULL;

-- 3. Add status field to legacy project_contractor_trades table
ALTER TABLE project_contractor_trades
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active'
  CHECK (status IN (
    'planned',
    'tendering',
    'not_yet_tendered',
    'unknown',
    'active',
    'completed',
    'cancelled',
    'on_hold'
  ));

ALTER TABLE project_contractor_trades
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_project_contractor_trades_status
  ON project_contractor_trades(status);

-- 4. Create trigger to auto-update status_updated_at when status changes
CREATE OR REPLACE FUNCTION update_assignment_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update timestamp if status actually changed
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.status_updated_at = now();
    -- If status_updated_by not explicitly set, keep existing
    IF NEW.status_updated_by IS NULL THEN
      NEW.status_updated_by = auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply trigger to both tables
DROP TRIGGER IF EXISTS trigger_project_assignments_status_timestamp ON project_assignments;
CREATE TRIGGER trigger_project_assignments_status_timestamp
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status_timestamp();

DROP TRIGGER IF EXISTS trigger_project_contractor_trades_status_timestamp ON project_contractor_trades;
CREATE TRIGGER trigger_project_contractor_trades_status_timestamp
  BEFORE UPDATE ON project_contractor_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status_timestamp();

-- 5. Backfill existing assignments with 'active' status and timestamps
-- This ensures existing data has proper defaults
UPDATE project_assignments
SET 
  status = CASE
    WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN 'completed'
    WHEN start_date IS NOT NULL AND start_date > CURRENT_DATE THEN 'planned'
    ELSE 'active'
  END,
  status_updated_at = updated_at  -- Use existing updated_at as baseline
WHERE status IS NULL OR status_updated_at IS NULL;

UPDATE project_contractor_trades
SET 
  status = CASE
    WHEN end_date IS NOT NULL AND end_date < CURRENT_DATE THEN 'completed'
    WHEN start_date IS NOT NULL AND start_date > CURRENT_DATE THEN 'planned'
    ELSE 'active'
  END,
  status_updated_at = updated_at
WHERE status IS NULL OR status_updated_at IS NULL;

-- 6. Create RPC function for bulk "Mark Project Complete"
CREATE OR REPLACE FUNCTION mark_project_complete(
  p_project_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignments_updated integer := 0;
  v_legacy_updated integer := 0;
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Update all active/planned/tendering assignments to completed
  UPDATE project_assignments
  SET 
    status = 'completed',
    status_updated_at = now(),
    status_updated_by = p_user_id,
    end_date = COALESCE(end_date, CURRENT_DATE)  -- Set end_date if not already set
  WHERE project_id = p_project_id
    AND status IN ('active', 'planned', 'tendering', 'not_yet_tendered', 'unknown', 'on_hold');
  
  GET DIAGNOSTICS v_assignments_updated = ROW_COUNT;

  -- Also update legacy table if records exist
  UPDATE project_contractor_trades
  SET 
    status = 'completed',
    status_updated_at = now(),
    status_updated_by = p_user_id,
    end_date = COALESCE(end_date, CURRENT_DATE)
  WHERE project_id = p_project_id
    AND status IN ('active', 'planned', 'tendering', 'not_yet_tendered', 'unknown', 'on_hold');
  
  GET DIAGNOSTICS v_legacy_updated = ROW_COUNT;

  -- Optionally update project's finish date if not set
  UPDATE projects
  SET 
    proposed_finish_date = COALESCE(proposed_finish_date, CURRENT_DATE),
    updated_at = now()
  WHERE id = p_project_id
    AND proposed_finish_date IS NULL;

  RETURN jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'assignments_updated', v_assignments_updated,
    'legacy_trades_updated', v_legacy_updated,
    'total_updated', v_assignments_updated + v_legacy_updated
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'status', 500
    );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_project_complete(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION mark_project_complete(uuid, uuid) IS 
  'Marks all active trade assignments on a project as completed. Updates both project_assignments and project_contractor_trades tables. Also sets end_date if not already set.';

-- 7. Create helper function to get status statistics for a project
CREATE OR REPLACE FUNCTION get_project_trade_status_summary(p_project_id uuid)
RETURNS TABLE(
  status text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    COALESCE(status, 'unknown') as status,
    COUNT(*) as count
  FROM (
    -- Combine both tables
    SELECT status FROM project_assignments 
    WHERE project_id = p_project_id AND assignment_type = 'trade_work'
    UNION ALL
    SELECT status FROM project_contractor_trades
    WHERE project_id = p_project_id
  ) combined
  GROUP BY status
  ORDER BY 
    CASE status
      WHEN 'tendering' THEN 1
      WHEN 'not_yet_tendered' THEN 2
      WHEN 'planned' THEN 3
      WHEN 'active' THEN 4
      WHEN 'on_hold' THEN 5
      WHEN 'completed' THEN 6
      WHEN 'cancelled' THEN 7
      ELSE 8
    END;
$$;

GRANT EXECUTE ON FUNCTION get_project_trade_status_summary(uuid) TO authenticated;

COMMENT ON FUNCTION get_project_trade_status_summary(uuid) IS
  'Returns count of trade assignments grouped by status for a given project. Useful for dashboard stats and filtering.';

-- ============================================================================
-- Migration complete
-- ============================================================================
-- Summary of changes:
-- 1. Extended status enum to include 'tendering', 'not_yet_tendered', 'unknown'
-- 2. Added status_updated_at and status_updated_by to both tables
-- 3. Created auto-update trigger for timestamps
-- 4. Backfilled existing data with intelligent defaults
-- 5. Created mark_project_complete() bulk operation function
-- 6. Created get_project_trade_status_summary() stats function
-- 7. Added performance indexes
-- ============================================================================


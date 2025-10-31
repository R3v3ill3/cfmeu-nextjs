-- Add worker breakdown fields to project_contractor_trades and project_assignments tables
-- This enables project-specific worker estimates broken down by employment type
-- and membership tracking at the contractor level

-- Add new columns for worker breakdown to project_contractor_trades
ALTER TABLE project_contractor_trades
ADD COLUMN estimated_full_time_workers numeric,
ADD COLUMN estimated_casual_workers numeric,
ADD COLUMN estimated_abn_workers numeric,
ADD COLUMN membership_checked boolean default false,
ADD COLUMN estimated_members numeric,
ADD COLUMN worker_breakdown_updated_at timestamptz,
ADD COLUMN worker_breakdown_updated_by uuid references auth.users(id);

-- Add new columns for worker breakdown to project_assignments
ALTER TABLE project_assignments
ADD COLUMN estimated_full_time_workers numeric,
ADD COLUMN estimated_casual_workers numeric,
ADD COLUMN estimated_abn_workers numeric,
ADD COLUMN membership_checked boolean default false,
ADD COLUMN estimated_members numeric,
ADD COLUMN worker_breakdown_updated_at timestamptz,
ADD COLUMN worker_breakdown_updated_by uuid references auth.users(id);

-- Add comments to explain the new fields for project_contractor_trades
COMMENT ON COLUMN project_contractor_trades.estimated_full_time_workers IS 'Estimated number of full-time workers for this contractor on this project';
COMMENT ON COLUMN project_contractor_trades.estimated_casual_workers IS 'Estimated number of casual workers for this contractor on this project';
COMMENT ON COLUMN project_contractor_trades.estimated_abn_workers IS 'Estimated number of ABN holders/subcontractors for this contractor on this project';
COMMENT ON COLUMN project_contractor_trades.membership_checked IS 'Whether union membership has been verified for workers on this project';
COMMENT ON COLUMN project_contractor_trades.estimated_members IS 'Estimated number of union members among the workforce for this contractor on this project';
COMMENT ON COLUMN project_contractor_trades.worker_breakdown_updated_at IS 'Timestamp when worker breakdown data was last updated';
COMMENT ON COLUMN project_contractor_trades.worker_breakdown_updated_by IS 'User who last updated the worker breakdown data';

-- Add comments to explain the new fields for project_assignments
COMMENT ON COLUMN project_assignments.estimated_full_time_workers IS 'Estimated number of full-time workers for this contractor on this project';
COMMENT ON COLUMN project_assignments.estimated_casual_workers IS 'Estimated number of casual workers for this contractor on this project';
COMMENT ON COLUMN project_assignments.estimated_abn_workers IS 'Estimated number of ABN holders/subcontractors for this contractor on this project';
COMMENT ON COLUMN project_assignments.membership_checked IS 'Whether union membership has been verified for workers on this project';
COMMENT ON COLUMN project_assignments.estimated_members IS 'Estimated number of union members among the workforce for this contractor on this project';
COMMENT ON COLUMN project_assignments.worker_breakdown_updated_at IS 'Timestamp when worker breakdown data was last updated';
COMMENT ON COLUMN project_assignments.worker_breakdown_updated_by IS 'User who last updated the worker breakdown data';

-- Create indexes on the new boolean fields for performance
CREATE INDEX idx_project_contractor_trades_membership_checked ON project_contractor_trades(membership_checked);
CREATE INDEX idx_project_assignments_membership_checked ON project_assignments(membership_checked);

-- Add check constraints to ensure worker counts are non-negative
ALTER TABLE project_contractor_trades
ADD CONSTRAINT check_non_negative_workers_pct
CHECK (
  (estimated_full_time_workers IS NULL OR estimated_full_time_workers >= 0) AND
  (estimated_casual_workers IS NULL OR estimated_casual_workers >= 0) AND
  (estimated_abn_workers IS NULL OR estimated_abn_workers >= 0) AND
  (estimated_members IS NULL OR estimated_members >= 0)
);

ALTER TABLE project_assignments
ADD CONSTRAINT check_non_negative_workers_pa
CHECK (
  (estimated_full_time_workers IS NULL OR estimated_full_time_workers >= 0) AND
  (estimated_casual_workers IS NULL OR estimated_casual_workers >= 0) AND
  (estimated_abn_workers IS NULL OR estimated_abn_workers >= 0) AND
  (estimated_members IS NULL OR estimated_members >= 0)
);

-- Create a trigger function to automatically update the worker_breakdown_updated_at timestamp
CREATE OR REPLACE FUNCTION update_worker_breakdown_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update the timestamp if worker breakdown fields actually changed
  IF
    OLD.estimated_full_time_workers IS DISTINCT FROM NEW.estimated_full_time_workers OR
    OLD.estimated_casual_workers IS DISTINCT FROM NEW.estimated_casual_workers OR
    OLD.estimated_abn_workers IS DISTINCT FROM NEW.estimated_abn_workers OR
    OLD.membership_checked IS DISTINCT FROM NEW.membership_checked OR
    OLD.estimated_members IS DISTINCT FROM NEW.estimated_members
  THEN
    NEW.worker_breakdown_updated_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the triggers for both tables
CREATE TRIGGER trigger_update_worker_breakdown_timestamp_pct
  BEFORE UPDATE ON project_contractor_trades
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_breakdown_timestamp();

CREATE TRIGGER trigger_update_worker_breakdown_timestamp_pa
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_breakdown_timestamp();

-- Create a view to calculate worker totals with breakdown
-- This helps maintain backwards compatibility and provides easy aggregation
CREATE OR REPLACE VIEW project_contractor_trades_with_totals AS
SELECT
  pct.*,
  -- Calculate total estimated workers as sum of breakdown (fallback to existing field)
  COALESCE(
    COALESCE(pct.estimated_full_time_workers, 0) +
    COALESCE(pct.estimated_casual_workers, 0) +
    COALESCE(pct.estimated_abn_workers, 0),
    pct.estimated_project_workforce
  ) as calculated_total_workers,
  -- Calculate membership percentage
  CASE
    WHEN COALESCE(
      COALESCE(pct.estimated_full_time_workers, 0) +
      COALESCE(pct.estimated_casual_workers, 0) +
      COALESCE(pct.estimated_abn_workers, 0),
      pct.estimated_project_workforce,
      0
    ) > 0 THEN
      ROUND(
        (COALESCE(pct.estimated_members, 0) * 100.0 /
         COALESCE(
           COALESCE(pct.estimated_full_time_workers, 0) +
           COALESCE(pct.estimated_casual_workers, 0) +
           COALESCE(pct.estimated_abn_workers, 0),
           pct.estimated_project_workforce,
           1
         )), 2
      )
    ELSE 0
  END as membership_percentage
FROM project_contractor_trades pct;

-- Add comment for the view
COMMENT ON VIEW project_contractor_trades_with_totals IS 'Enhanced view of project contractor trades with calculated worker totals and membership percentages';

-- Grant necessary permissions to the service role for the new functionality
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE ON project_contractor_trades TO service_role;
GRANT SELECT ON project_contractor_trades_with_totals TO service_role;
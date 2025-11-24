-- Migration: Add detailed worker estimate columns to project_assignments and project_contractor_trades
-- Description: Adds columns to track full-time, casual, ABN workers, and membership data
-- for detailed workforce breakdown tracking on mapping sheets

-- Add columns to project_assignments table
ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS estimated_full_time_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_casual_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_abn_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_members integer,
  ADD COLUMN IF NOT EXISTS membership_checked boolean DEFAULT false;

-- Add check constraints to project_assignments using DO block for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_assignments_estimated_full_time_workers_check'
  ) THEN
    ALTER TABLE public.project_assignments
      ADD CONSTRAINT project_assignments_estimated_full_time_workers_check 
        CHECK (estimated_full_time_workers IS NULL OR estimated_full_time_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_assignments_estimated_casual_workers_check'
  ) THEN
    ALTER TABLE public.project_assignments
      ADD CONSTRAINT project_assignments_estimated_casual_workers_check 
        CHECK (estimated_casual_workers IS NULL OR estimated_casual_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_assignments_estimated_abn_workers_check'
  ) THEN
    ALTER TABLE public.project_assignments
      ADD CONSTRAINT project_assignments_estimated_abn_workers_check 
        CHECK (estimated_abn_workers IS NULL OR estimated_abn_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_assignments_estimated_members_check'
  ) THEN
    ALTER TABLE public.project_assignments
      ADD CONSTRAINT project_assignments_estimated_members_check 
        CHECK (estimated_members IS NULL OR estimated_members >= 0);
  END IF;
END $$;

-- Add columns to project_contractor_trades table
ALTER TABLE public.project_contractor_trades
  ADD COLUMN IF NOT EXISTS estimated_full_time_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_casual_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_abn_workers integer,
  ADD COLUMN IF NOT EXISTS estimated_members integer,
  ADD COLUMN IF NOT EXISTS membership_checked boolean DEFAULT false;

-- Add check constraints to project_contractor_trades using DO block for idempotency
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_contractor_trades_estimated_full_time_workers_check'
  ) THEN
    ALTER TABLE public.project_contractor_trades
      ADD CONSTRAINT project_contractor_trades_estimated_full_time_workers_check 
        CHECK (estimated_full_time_workers IS NULL OR estimated_full_time_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_contractor_trades_estimated_casual_workers_check'
  ) THEN
    ALTER TABLE public.project_contractor_trades
      ADD CONSTRAINT project_contractor_trades_estimated_casual_workers_check 
        CHECK (estimated_casual_workers IS NULL OR estimated_casual_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_contractor_trades_estimated_abn_workers_check'
  ) THEN
    ALTER TABLE public.project_contractor_trades
      ADD CONSTRAINT project_contractor_trades_estimated_abn_workers_check 
        CHECK (estimated_abn_workers IS NULL OR estimated_abn_workers >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_contractor_trades_estimated_members_check'
  ) THEN
    ALTER TABLE public.project_contractor_trades
      ADD CONSTRAINT project_contractor_trades_estimated_members_check 
        CHECK (estimated_members IS NULL OR estimated_members >= 0);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN public.project_assignments.estimated_full_time_workers IS 
  'Estimated number of full-time workers for this assignment';

COMMENT ON COLUMN public.project_assignments.estimated_casual_workers IS 
  'Estimated number of casual workers for this assignment';

COMMENT ON COLUMN public.project_assignments.estimated_abn_workers IS 
  'Estimated number of ABN/contractor workers for this assignment';

COMMENT ON COLUMN public.project_assignments.estimated_members IS 
  'Estimated number of union members among workers for this assignment';

COMMENT ON COLUMN public.project_assignments.membership_checked IS 
  'Whether membership status has been verified for this assignment';

COMMENT ON COLUMN public.project_contractor_trades.estimated_full_time_workers IS 
  'Estimated number of full-time workers for this trade';

COMMENT ON COLUMN public.project_contractor_trades.estimated_casual_workers IS 
  'Estimated number of casual workers for this trade';

COMMENT ON COLUMN public.project_contractor_trades.estimated_abn_workers IS 
  'Estimated number of ABN/contractor workers for this trade';

COMMENT ON COLUMN public.project_contractor_trades.estimated_members IS 
  'Estimated number of union members among workers for this trade';

COMMENT ON COLUMN public.project_contractor_trades.membership_checked IS 
  'Whether membership status has been verified for this trade';


-- Add 'unknown' status to union_membership_status enum
-- This is needed to properly handle Incolink workers whose union status is unknown

ALTER TYPE public.union_membership_status ADD VALUE 'unknown';

-- Update workers table to allow null union_membership_status (keep existing default)
-- Note: NULL and 'unknown' will both be treated as unknown status in the application
-- NULL = completely unknown, 'unknown' = explicitly marked as unknown

COMMENT ON TYPE public.union_membership_status IS 'Union membership status: member, non_member, potential, declined, unknown';

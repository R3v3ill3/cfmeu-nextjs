-- Fix employer_aliases: Add updated_at column and activate all inactive aliases
-- This migration addresses two issues:
-- 1. Missing updated_at column causing errors when updating aliases
-- 2. Many aliases marked as inactive (is_authoritative = false) from bulk imports

-- Add updated_at column to employer_aliases table
ALTER TABLE public.employer_aliases
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Set updated_at for existing rows to created_at if not set
UPDATE public.employer_aliases
SET updated_at = created_at
WHERE updated_at IS NULL;

-- Create trigger function to automatically update updated_at on row updates
CREATE OR REPLACE FUNCTION public.update_employer_aliases_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop trigger if it exists and create new one
DROP TRIGGER IF EXISTS update_employer_aliases_updated_at ON public.employer_aliases;
CREATE TRIGGER update_employer_aliases_updated_at
  BEFORE UPDATE ON public.employer_aliases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_employer_aliases_updated_at();

-- Activate all inactive aliases (set is_authoritative = true)
-- This makes all existing aliases available for matching
UPDATE public.employer_aliases
SET 
  is_authoritative = true,
  updated_at = now()
WHERE is_authoritative = false;

-- Add comment explaining the change
COMMENT ON COLUMN public.employer_aliases.updated_at IS 'Timestamp when the alias was last updated. Automatically maintained by trigger.';
COMMENT ON COLUMN public.employer_aliases.is_authoritative IS 'Whether this alias should be used for matching. All aliases are now active by default.';


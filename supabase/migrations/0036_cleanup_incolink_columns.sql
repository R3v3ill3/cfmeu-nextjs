-- Cleanup duplicate incolink columns in employers table
-- Keep incolink_employer_id and drop incolink_company_id
-- Rename for simpler CSV mapping: incolink_employer_id -> incolink_id

-- First, drop the unused incolink_company_id column
ALTER TABLE public.employers DROP COLUMN IF EXISTS incolink_company_id;

-- Rename incolink_employer_id to incolink_id to match CSV format
ALTER TABLE public.employers RENAME COLUMN incolink_employer_id TO incolink_id;

-- Add unique constraint to ensure no duplicate Incolink IDs
ALTER TABLE public.employers DROP CONSTRAINT IF EXISTS employers_incolink_id_unique;
ALTER TABLE public.employers ADD CONSTRAINT employers_incolink_id_unique 
  UNIQUE (incolink_id);

-- Create index for better performance on lookups
CREATE INDEX IF NOT EXISTS idx_employers_incolink_id 
  ON public.employers(incolink_id) 
  WHERE incolink_id IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.employers.incolink_id IS 'Unique identifier from Incolink system for employer matching and integration';
COMMENT ON COLUMN public.employers.incolink_last_matched IS 'Date when this employer was last matched/updated with Incolink data';

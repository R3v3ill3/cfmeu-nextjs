-- Fix RLS policy for scraper_jobs to allow authenticated users to create mapping_sheet_scan jobs
-- Drop existing restrictive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON scraper_jobs;

-- Create new policy that allows authenticated users to insert mapping_sheet_scan jobs
CREATE POLICY "Authenticated users can create mapping_sheet_scan jobs"
  ON scraper_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    job_type = 'mapping_sheet_scan'
  );

-- Also ensure existing job types can still be created (if needed)
CREATE POLICY "Authenticated users can create other job types"
  ON scraper_jobs FOR INSERT
  WITH CHECK (
    auth.role() = 'authenticated' AND
    job_type IN ('fwc_lookup', 'incolink_sync')
  );

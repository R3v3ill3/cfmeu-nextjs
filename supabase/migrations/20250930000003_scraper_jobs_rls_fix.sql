-- Drop all existing INSERT policies on scraper_jobs
DO $$ 
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'scraper_jobs' 
        AND cmd = 'INSERT'
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || pol.policyname || '" ON scraper_jobs';
    END LOOP;
END $$;

-- Create single permissive INSERT policy for authenticated users
CREATE POLICY "Authenticated users can insert scraper jobs"
  ON scraper_jobs FOR INSERT
  TO authenticated
  WITH CHECK (true);

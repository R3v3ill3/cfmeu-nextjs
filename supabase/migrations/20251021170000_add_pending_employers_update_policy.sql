-- Add missing UPDATE policy for pending_employers table
-- This was blocking import_status updates from succeeding

CREATE POLICY "allow_update_authenticated"
ON "public"."pending_employers"
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "allow_update_authenticated" ON "public"."pending_employers"
IS 'Allow authenticated users to update pending employer records (e.g., setting import_status to imported)';

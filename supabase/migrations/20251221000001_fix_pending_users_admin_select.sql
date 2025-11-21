-- Fix admin access to pending_users SELECT
-- Ensure admin users can see all pending users, not just ones they created

-- Drop the conflicting policy if it exists
DROP POLICY IF EXISTS "pending_users_select" ON "public"."pending_users";

-- Create a comprehensive SELECT policy that allows:
-- 1. Admins to see all pending users
-- 2. Lead organisers to see all pending users  
-- 3. Users to see pending users they created
CREATE POLICY "pending_users_select" 
ON "public"."pending_users" 
FOR SELECT 
TO "authenticated" 
USING (
  EXISTS (
    SELECT 1 FROM "public"."profiles" "p"
    WHERE "p"."id" = auth.uid() AND "p"."role" = 'admin'
  )
  OR EXISTS (
    SELECT 1 FROM "public"."profiles" "p"
    WHERE "p"."id" = auth.uid() AND "p"."role" = 'lead_organiser'
  )
  OR "created_by" = auth.uid()
  OR "public"."is_admin"()
);

-- Ensure the pu_select policy (if it exists) also works correctly
-- This policy uses is_admin() function which should work for admins
-- But we'll keep both for redundancy


-- Fix admin access to organiser_patch_assignments and lead_organiser_patch_assignments
-- This allows admin users to update patch assignments via RPC functions and direct updates

-- Add admin write policies for organiser_patch_assignments
DROP POLICY IF EXISTS "p_write_organiser_patch_assignments_admin" ON "public"."organiser_patch_assignments";
CREATE POLICY "p_write_organiser_patch_assignments_admin" 
ON "public"."organiser_patch_assignments" 
FOR ALL 
TO "authenticated"
USING (
  EXISTS (
    SELECT 1 FROM "public"."profiles" p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."profiles" p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Add admin write policies for lead_organiser_patch_assignments
DROP POLICY IF EXISTS "p_write_lead_organiser_patch_assignments_admin" ON "public"."lead_organiser_patch_assignments";
CREATE POLICY "p_write_lead_organiser_patch_assignments_admin" 
ON "public"."lead_organiser_patch_assignments" 
FOR ALL 
TO "authenticated"
USING (
  EXISTS (
    SELECT 1 FROM "public"."profiles" p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM "public"."profiles" p 
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Make RPC functions SECURITY DEFINER so they bypass RLS
-- This ensures they work even if RLS policies change

CREATE OR REPLACE FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") 
RETURNS "void"
LANGUAGE "sql"
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE organiser_patch_assignments
  SET effective_to = now()
  WHERE organiser_id = p_org 
    AND patch_id = p_patch 
    AND effective_to IS NULL;
$$;

CREATE OR REPLACE FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") 
RETURNS "void"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO organiser_patch_assignments(organiser_id, patch_id) 
  VALUES (p_org, p_patch)
  ON CONFLICT (organiser_id, patch_id) 
  WHERE effective_to IS NULL 
  DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") 
RETURNS "void"
LANGUAGE "sql"
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE lead_organiser_patch_assignments
  SET effective_to = now()
  WHERE lead_organiser_id = p_lead 
    AND patch_id = p_patch 
    AND effective_to IS NULL;
$$;

CREATE OR REPLACE FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") 
RETURNS "void"
LANGUAGE "plpgsql"
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO lead_organiser_patch_assignments(lead_organiser_id, patch_id) 
  VALUES (p_lead, p_patch)
  ON CONFLICT (lead_organiser_id, patch_id) 
  WHERE effective_to IS NULL 
  DO NOTHING;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION "public"."close_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."upsert_organiser_patch"("p_org" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."close_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."upsert_lead_patch"("p_lead" "uuid", "p_patch" "uuid") TO "authenticated";


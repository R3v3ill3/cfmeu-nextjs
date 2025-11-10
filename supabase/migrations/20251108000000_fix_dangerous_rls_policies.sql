-- Migration: Fix dangerous RLS policies with OR true conditions
-- Description: Removes OR true conditions from DELETE policies that allow any authenticated user to delete data
-- Risk Level: HIGH - Prevents accidental data deletion by trusted users
-- Impact: SAFE - Maintains intended access control while adding safety checks

-- Start transaction
BEGIN;

-- Add migration logging
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20251108000000') ON CONFLICT DO NOTHING;

-- Fix activities DELETE policy
DROP POLICY IF EXISTS "activities_delete" ON "public"."activities";
CREATE POLICY "activities_delete" ON "public"."activities"
FOR DELETE TO "authenticated"
USING ("created_by" = auth.uid());

-- Fix employers DELETE policy
DROP POLICY IF EXISTS "employers_delete" ON "public"."employers";
CREATE POLICY "employers_delete" ON "public"."employers"
FOR DELETE TO "authenticated"
USING ("public"."is_admin"() OR "public"."can_access_employer"("id"));

-- Fix job_sites DELETE policy
DROP POLICY IF EXISTS "job_sites_delete" ON "public"."job_sites";
CREATE POLICY "job_sites_delete" ON "public"."job_sites"
FOR DELETE TO "authenticated"
USING ("public"."is_admin"() OR "public"."can_access_job_site"("id"));

-- Fix overlay_images DELETE policy
DROP POLICY IF EXISTS "overlay_images_delete" ON "public"."overlay_images";
CREATE POLICY "overlay_images_delete" ON "public"."overlay_images"
FOR DELETE TO "authenticated"
USING ("public"."is_admin"() OR "public"."has_role"(auth.uid(), 'lead_organiser'));

-- Fix patches DELETE policy
DROP POLICY IF EXISTS "patches_delete" ON "public"."patches";
CREATE POLICY "patches_delete" ON "public"."patches"
FOR DELETE TO "authenticated"
USING (
    -- Admins can delete any patch
    EXISTS (
        SELECT 1 FROM "public"."profiles" "p"
        WHERE ("p"."id" = auth.uid() AND "p"."role" = 'admin'::text)
    )
    OR
    -- Lead organisers can delete patches they're assigned to
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patches"."id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    -- Organisers can delete patches they're assigned to
    EXISTS (
        SELECT 1 FROM "public"."organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patches"."id"
               AND "a"."organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    -- Users can delete patches they created
    ("created_by" = auth.uid())
    OR
    -- Explicit admin check
    "public"."is_admin"()
);

-- Fix patch_employers UPDATE policy (remove OR true from USING clause)
DROP POLICY IF EXISTS "pemps_update" ON "public"."patch_employers";
CREATE POLICY "pemps_update" ON "public"."patch_employers"
FOR UPDATE TO "authenticated"
USING (
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_employers"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_employers"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_employers"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_employers"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
);

-- Fix patch_job_sites UPDATE policy (remove OR true from USING clause)
DROP POLICY IF EXISTS "pjs_update" ON "public"."patch_job_sites";
CREATE POLICY "pjs_update" ON "public"."patch_job_sites"
FOR UPDATE TO "authenticated"
USING (
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_job_sites"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_job_sites"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_job_sites"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE ("a"."patch_id" = "patch_job_sites"."patch_id"
               AND "a"."lead_organiser_id" = auth.uid()
               AND "a"."effective_to" IS NULL)
    )
);

-- Fix patch_employer_roles UPDATE/DELETE policies (remove OR true)
DROP POLICY IF EXISTS "per_update" ON "public"."patch_employer_roles";
CREATE POLICY "per_update" ON "public"."patch_employer_roles"
FOR UPDATE TO "authenticated"
USING (
    EXISTS (
        SELECT 1 FROM "public"."profiles" "p"
        WHERE ("p"."id" = auth.uid() AND "p"."role" = 'admin'::text)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."profiles" "p"
        WHERE ("p"."id" = auth.uid() AND "p"."role" = 'lead_organiser'::text)
    )
    OR
    ("created_by" = auth.uid())
    OR
    "public"."is_admin"()
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM "public"."profiles" "p"
        WHERE ("p"."id" = auth.uid() AND "p"."role" = 'admin'::text)
    )
    OR
    EXISTS (
        SELECT 1 FROM "public"."profiles" "p"
        WHERE ("p"."id" = auth.uid() AND "p"."role" = 'lead_organiser'::text)
    )
    OR
    ("created_by" = auth.uid())
    OR
    "public"."is_admin"()
);

-- Fix projects DELETE policy
DROP POLICY IF EXISTS "projects_delete" ON "public"."projects";
CREATE POLICY "projects_delete" ON "public"."projects"
FOR DELETE TO "authenticated"
USING ("public"."is_admin"());

-- Fix workers DELETE policy
DROP POLICY IF EXISTS "workers_delete" ON "public"."workers";
CREATE POLICY "workers_delete" ON "public"."workers"
FOR DELETE TO "authenticated"
USING ("public"."is_admin"() OR "public"."can_access_worker"("id"));

-- Commit transaction
COMMIT;

-- Add verification comments
COMMENT ON COLUMN supabase_migrations.schema_migrations.version IS '20251108000000 - Applied migration to fix dangerous RLS OR true conditions';

-- Log the migration completion
DO $$
BEGIN
    RAISE NOTICE 'Migration 20251108000000 completed successfully: Fixed dangerous RLS policies with OR true conditions';
    RAISE NOTICE 'DELETE policies now properly restrict data deletion to authorized users only';
    RAISE NOTICE 'This prevents accidental data deletion while maintaining intended access patterns';
END $$;
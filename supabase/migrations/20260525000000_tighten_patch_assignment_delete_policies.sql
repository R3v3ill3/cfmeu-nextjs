-- Tightens the DELETE policies that were missed by 20251108000000_fix_dangerous_rls_policies.sql.
-- pjs_lead_write_del and pemps_lead_write_del previously used `USING (true)` which
-- permitted any authenticated user to delete any patch_job_sites / patch_employers row.
-- This migration restricts DELETE to admins and lead organisers assigned to the patch,
-- matching the intent of the adjacent pemps_update / pjs_update policies tightened by
-- the earlier migration.
--
-- See docs/CONNECTION_STABILITY_REMEDIATION_PLAN.md P0-7.

BEGIN;

DROP POLICY IF EXISTS "pjs_lead_write_del" ON "public"."patch_job_sites";
CREATE POLICY "pjs_lead_write_del" ON "public"."patch_job_sites"
FOR DELETE TO "authenticated"
USING (
    "public"."is_admin"()
    OR EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE "a"."patch_id" = "patch_job_sites"."patch_id"
          AND "a"."lead_organiser_id" = auth.uid()
          AND "a"."effective_to" IS NULL
    )
);

DROP POLICY IF EXISTS "pemps_lead_write_del" ON "public"."patch_employers";
CREATE POLICY "pemps_lead_write_del" ON "public"."patch_employers"
FOR DELETE TO "authenticated"
USING (
    "public"."is_admin"()
    OR EXISTS (
        SELECT 1 FROM "public"."lead_organiser_patch_assignments" "a"
        WHERE "a"."patch_id" = "patch_employers"."patch_id"
          AND "a"."lead_organiser_id" = auth.uid()
          AND "a"."effective_to" IS NULL
    )
);

COMMIT;

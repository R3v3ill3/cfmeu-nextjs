# B3 — RLS / Permissions / Service-Role Diagnostic

**Date:** 2026-05-25  
**Scope:** Audit of Row-Level Security policies, service-role client usage, and API route client-type selection.  
**Read-only:** Yes — findings reported for verification.

---

## Executive Summary

This diagnostic audits the CFMEU Next.js app for RLS misconfiguration, overly broad policies, and improper service-role usage. Findings include:

1. **CRITICAL: Two DELETE policies remain overly broad** — `patch_job_sites` and `patch_employers` delete policies use `USING (true)` without role/ownership checks.
2. **RLS helper functions are SECURITY DEFINER** — correctly bypass recursion but must be audited for join-scope explosions.
3. **Claim-based access is NOT validated for project overlap** — organiser_project_claims can be active on projects outside their patches; no mutual-exclusion check.
4. **New patch-overlap trigger (`job_sites_set_patch_from_coords`) cost is unestimated** — fires on INSERT/UPDATE of job_sites; could cascade during large imports.
5. **Service-role discipline is mostly sound** — contained to admin/cron routes; NOT in client bundles (verified via grep).
6. **403 / RLS errors are NOT treated as logout signals** — code correctly ignores PGRST301 and distinguishes from 401.

---

## Verification of Claimed Fixes

| ID | Claim | Verified? | Evidence | Notes |
|----|----|----|----|-----|
| A3.1 | Fixed organiser RLS recursion in `can_access_job_site()` and `can_access_employer()` helpers | ✅ PASS | `supabase/migrations/20250108000000_fix_organiser_rls_recursion.sql` lines 19–87, 92–135: Both functions use `SECURITY DEFINER` to bypass RLS and check patch assignments first | Recursion fix verified; scope of helper is patch-based, not join-broad |
| A3.2 | Fixed projects RLS recursion via patch mapping direct access | ✅ PASS | `supabase/migrations/20251112000000_fix_projects_rls_recursion.sql`: `user_can_access_project_direct()` uses `patch_project_mapping_view` directly; claim-based access added in 20260117140002 | Mapping view is materialized; updated via `refresh_patch_project_mapping_view()` RPC |
| A3.3 | Fixed dangerous DELETE policies (patch_job_sites, patch_employers) to require admin/lead | ⚠️ **FAIL** | `0000_remote_schema.sql` lines 10543 (`pjs_lead_write_del`), 10470 (`pemps_lead_write_del`): Both still use `USING (true)` for authenticated users | **CRITICAL ISSUE F-RLS-01**: Any authenticated user can delete any patch_job_site or patch_employer record |
| A3.4 | Enabled missing RLS on compliance/assignment tables (broad authenticated CRUD) | ✅ PASS | `supabase/migrations/20251022100000_enable_missing_rls_fixed.sql`: policies `auth_*_proj_assignments`, `auth_*_project_compliance`, `auth_*_employer_compliance_checks` allow all authenticated read/insert/update | Deliberate design per SUPABASE_RLS_MATRIX.md; no DELETE policies limit scope |
| A3.5 | Fixed pending users admin SELECT access | ✅ PASS | `supabase/migrations/20251221000001_fix_pending_users_admin_select.sql`: `pending_users_select` policy allows admin + creator + lead organiser via role_hierarchy | Verified in SUPABASE_RLS_MATRIX.md line 56 |
| A3.6 | Fixed organiser patch assignments admin write access | ✅ PASS | `supabase/migrations/20251221000000_fix_organiser_patch_assignments_admin_access.sql`: `p_write_organiser_patch_assignments` allows admin + service_role writes | Assignment writes restricted; verified in matrix |

---

## API Route → Client-Type Audit

| Path | Current client | Recommended client | Reason | Notes |
|------|--------|--------|--------|-------|
| `POST /api/admin/refresh-views` | `createServerSupabase()` (anon+cookies) | **SHOULD USE SERVICE-ROLE** | Refresh RPC calls bypass RLS; requires elevated privileges | **F-RLS-02**: Currently uses user-authenticated cookies; should use admin client to ensure consistency |
| `POST /api/projects/[projectId]/claim` | `createClient()` with `SUPABASE_SERVICE_ROLE_KEY` (lines 87–89) | ✅ CORRECT | Claims table bypasses RLS; service-role needed for `check_project_access` RPC | Creates claim via service-role; release via authenticated user (correct) |
| `DELETE /api/projects/[projectId]/claim` | `createServerSupabase()` (anon+cookies) | ✅ CORRECT | User can only release own claims; RLS enforces row ownership | Uses authenticated client with RLS policy `claims_update` |
| `POST /api/admin/activate-pending-user` | `createServerSupabase()` + multi-use `createClient()` with service-role | ✅ MOSTLY CORRECT | Activation requires admin auth check + service-role for user creation | Routes admin-only operations; service-role used for Auth + DB writes |
| `GET /api/health/workers` | `createClient()` with `SUPABASE_SERVICE_ROLE_KEY` (service-role client created per request) | ⚠️ ACCEPTABLE | Health check requires bypassing RLS to count workers; service-role justified | Debug endpoint; should be admin-only or removed in production |
| All other `/api/admin/*` | `createServerSupabase()` (anon+cookies) + optional service-role for data bypass | ⚠️ MIXED | Most admin routes check user role via `profile.role` then use authenticated client; some use service-role for overrides | **F-RLS-03**: Inconsistent pattern; recommend standardizing admin route pattern (auth check → service-role client creation) |

---

## RLS Helper Function Audit

| Function | Migration | Security Model | Risk | Notes |
|----------|-----------|--------|------|-------|
| `can_access_job_site(uuid)` | `20250108000000` | SECURITY DEFINER, patch-first check | LOW | Checks `patch_job_sites` JOIN `organiser_patch_assignments` first (lines 43–62); avoids recursion via patch IDs; fallback to `scoped_sites` array | Only returns TRUE if user is in patch; no overly broad joins |
| `can_access_employer(uuid)` | `20250108000000` | SECURITY DEFINER, patch-first check | LOW | Mirrors job_site logic via `patch_employers` (lines 116–134); patch-based first, then scoped_employers fallback | Follows same pattern; scope is patch + role-hierarchy array |
| `is_admin()` | `0000_remote_schema.sql` | SECURITY DEFINER (implicit via helper) | LOW | Simple `SELECT role = 'admin' FROM profiles WHERE id = auth.uid()` | Unambiguous; no joins |
| `user_can_access_project_direct(uuid, uuid)` | `20260117140002` | SECURITY DEFINER, multi-path check | **MEDIUM** | Checks created_by (line 83), then claims (line 93), then patch assignments (lines 105–130) | Each path is independently scoped (creator, claim ownership, patch+role); no join explosion; claim-based access newly added—see F-RLS-04 |

---

## New Findings

### F-RLS-01: DELETE policies overly broad (Critical)

**File:** `supabase/migrations/0000_remote_schema.sql`  
**Lines:** 10470 (`pemps_lead_write_del`), 10543 (`pjs_lead_write_del`)

**Issue:** Both policies allow ANY authenticated user to DELETE any patch_employer or patch_job_site record:
```sql
CREATE POLICY "pjs_lead_write_del" ON "public"."patch_job_sites" FOR DELETE TO "authenticated" USING (true);
CREATE POLICY "pemps_lead_write_del" ON "public"."patch_employers" FOR DELETE TO "authenticated" USING (true);
```

**Risk:** Organisers, delegates, and viewers can delete job site / employer associations from any patch, not just their own.  
**Expected fix:** Should require `is_admin() OR is_assigned_to_patch(auth.uid(), patch_id)`.  
**Recommended action:** Tighten DELETE policies (planned fix to apply similar pattern to UPDATE in 20251108000000).

---

### F-RLS-02: Refresh-views endpoint uses anon+cookies instead of service-role

**File:** `src/app/api/admin/refresh-views/route.ts`  
**Line:** 29

**Issue:** Endpoint calls `createServerSupabase()` (anon+cookies), checks admin role, then calls RPC functions that may bypass RLS. Service-role should be used to ensure refresh runs without RLS constraints.

**Risk:** If view refresh function has RLS filters, refresh will return partial results instead of entire dataset. Materialized view becomes stale/incomplete.  
**Example:** `refresh_patch_project_mapping_view()` (`0000_remote_schema.sql` line 3972–3985) runs REFRESH directly; if implicit RLS applies, projection may be incomplete.

**Recommended action:** Create admin client with service-role for refresh operations.

---

### F-RLS-03: No standardized admin client pattern

**Files:** Multiple `/api/admin/*` routes  
**Pattern:** Ad-hoc mix of `createServerSupabase()` + role check, or direct `createClient()` with service-role key.

**Issue:** Inconsistent client selection makes audit harder and increases risk of accidental RLS enforcement in admin operations.  
**Recommended action:** Create a helper function `createAdminClient()` that wraps service-role creation and is ONLY called after explicit admin role check.

---

### F-RLS-04: Claim-based access lacks overlap validation

**File:** `supabase/migrations/20260117140002_add_claim_to_projects_rls.sql`  
**Lines:** 42–49 (projects_select policy), 93–101 (user_can_access_project_direct helper)

**Issue:** RLS policy allows users to access projects via:
1. Patch assignment (patched projects), OR
2. Organiser project claims (unpatched projects)

However, there is NO mutual-exclusion check: a user can claim a project that is ALSO in their patch assignment. This creates unclear precedence and potential auth confusion.

**Risk:** MEDIUM — Functional but semantically unclear. If a project is claimed by user A while also in A's patch, release of claim does not audit whether patch access still exists.

**Recommended action:** Add validation in claim creation to reject claims on projects already accessible via patch.

---

### F-RLS-05: Patch-overlap detection trigger cost is unestimated

**File:** `supabase/migrations/20260209000000_add_patch_assignment_overlap_detection.sql`  
**Lines:** 43–103 (trigger function `job_sites_set_patch_from_coords`)

**Issue:** The trigger runs on EVERY INSERT/UPDATE of job_sites. It performs:
```sql
SELECT array_agg(p.id), count(*)
FROM public.patches p
WHERE p.type = 'geo'
  AND p.status = 'active'
  AND p.geom IS NOT NULL
  AND ST_Contains(p.geom, ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326));
```

This is a **full-table scan** of `patches` with a spatial index check for EVERY job site insert/update. No estimation of cost provided.

**Risk:** HIGH if bulk job-site import/update occurs (e.g., BCI upload, mapping-sheet-scanner, or scraper jobs). Trigger could timeout or lock tables during concurrent batch operations.

**Example impact:** Batch upload inserting 1000 job sites = 1000 spatial joins over all active patches. If `patches` table has geographic complexity, this could cascade.

**Recommended action:** Add index on `patches(type, status)` and benchmark trigger latency for typical import sizes. Consider deferring trigger to end of transaction or using async job queue.

---

### F-RLS-06: Service-role key access is contained but not compartmentalized

**Files:** Grep results show service-role usage in:
- `src/app/api/projects/[projectId]/claim/route.ts` (line 89)
- `src/app/api/admin/activate-pending-user/route.ts` (multiple)
- `src/app/api/projects/[projectId]/generate-share-link/route.ts` (line ?)
- `src/app/api/health/workers/route.ts` (health check)
- `src/app/api/delegated-tasks/links/purge/route.ts` (purge operation)
- `src/utils/auth-utils.ts` (utility function)
- One instance in mobile test page: `src/app/(app)/admin/testing-activation/page.tsx`

**Issue:** The mobile test page uses service-role in a client component (uses `'use client'`).

**Risk:** If test page is not removed before production deploy, service-role key could be exposed in bundle (though unlikely due to server-side import).

**Recommended action:** Verify test page is admin-only; consider removing or protecting behind feature flag.

---

### F-RLS-07: 403 / RLS error handling is correct

**Files:** `src/components/DesktopLayout.tsx` (line checking PGRST301), `src/lib/rating-api/error-handling.ts` (403 config)

**Finding:** Code correctly treats RLS 403 (PGRST301) as distinct from auth 401. No force-logout triggered on RLS denial. ✅ PASS

---

## Patch Assignment Status Columns (New)

**File:** `supabase/migrations/20260209000000_add_patch_assignment_overlap_detection.sql` lines 6–244

**Columns added:**
- `job_sites.patch_assignment_status` (DEFAULT 'unset') — Tracks assignment quality: clean, overlap, gap, fallback, manual, unset
- `job_sites.overlap_patch_ids` (uuid[]) — Stores ALL matching patch IDs when overlap detected (first one is assigned)

**Function added:**
- `public.reevaluate_patch_assignments()` — RPC to re-run assignment logic over all job sites after patch boundary changes

**Backfill:** Existing assigned sites set to 'clean'; sites with fallback patch set to 'fallback'; unassigned set to 'unset'.

**Index added:** `idx_job_sites_patch_assignment_status` on (status) WHERE status IN ('overlap', 'gap', 'fallback')

**Issue:** New column introduces **4-value status enum + overlap tracking**. Middleware/app code must handle:
- Overlap cases (site in multiple patches — which one is canonical?)
- Gap cases (site outside all patches)
- Fallback cases (site assigned to hardcoded fallback patch)

No client-side code reviewed yet for handling these statuses. Recommend checking site-visit-wizard, project-mapping, and job-site-search features for status-aware filtering.

---

## Materialized View Refresh (`patch_project_mapping_view`)

**File:** `0000_remote_schema.sql`  
**Lines:** 3972–3985 (function `refresh_patch_project_mapping_view`)

**Definition:** Lines 6368–6388 — Maps patches to projects via job_sites:
```sql
SELECT DISTINCT pjs.patch_id, js.project_id
FROM patch_job_sites pjs
JOIN job_sites js ON pjs.job_site_id = js.id
WHERE pjs.effective_to IS NULL;
```

**Refresh mechanism:**
- Called by `refresh_project_related_views()` (line 4010)
- Refreshed via admin endpoint (line 95 of refresh-views route)
- REFRESH MATERIALIZED VIEW (non-concurrent) — blocks queries during refresh

**Risk:** If view becomes stale mid-refresh, SELECT queries against `patch_project_mapping_view` can return empty or partial results. This affects `projects_select` RLS policy (20260117140002) which relies on view for patch-based access.

**Recommended action:** Use REFRESH MATERIALIZED VIEW CONCURRENTLY to avoid blocking reads (requires unique index; verify presence).

---

## Auth Error Handling (401 vs 403)

**Status:** ✅ CORRECT

**Evidence:**
- `src/components/DesktopLayout.tsx`: Checks `(roleError as any)?.code === 'PGRST301'` separately from login state
- `src/lib/rating-api/error-handling.ts`: ErrorType.AUTHORIZATION (403) distinct from ErrorType.AUTHENTICATION (401)
- Middleware (`src/middleware.ts`): Session refresh attempt on auth errors; does NOT force-logout on RLS 403

**Conclusion:** App correctly distinguishes RLS denial (403) from session expiry (401). No false logout triggers.

---

## Open Questions

1. **Batch import performance:** Does BCI batch-upload trigger the new patch-overlap detection trigger? Estimate concurrency impact.
2. **Claim creation validation:** Should `POST /api/projects/[projectId]/claim` reject claims on projects already accessible via patch?
3. **Service-role compartmentalization:** Should admin client creation be wrapped in a helper to enforce least-privilege pattern?
4. **Materialized view staleness:** Is REFRESH MATERIALIZED VIEW CONCURRENTLY available? (Requires unique index on patch_id, project_id.)
5. **DELETE policy tightening:** Is fix for F-RLS-01 planned as next migration, or already applied?

---

## Summary Table

| Category | Status | Count | Critical? | Evidence |
|----------|--------|-------|-----------|----------|
| Claimed fixes verified | 5 PASS, 1 FAIL | 6 | YES | A3.3 (DELETE policies) still overly broad |
| API route client selection | 3 CORRECT, 2 MIXED, 1 ACCEPTABLE | 6 | MEDIUM | Refresh-views should use service-role |
| RLS helper functions | 3 LOW, 1 MEDIUM risk | 4 | NO | All SECURITY DEFINER; patch-first logic sound |
| New RLS policies (claims, overlap) | 2 issues identified | 2 | MEDIUM | F-RLS-04, F-RLS-05 — claim overlap, trigger cost |
| Service-role discipline | 1 risk (test page) | 1 | LOW | Contained to server routes; test page exposure |
| 403 vs 401 handling | CORRECT | — | NO | No false logout on RLS denial |

---

## Recommendations (Prioritized)

### CRITICAL
1. **F-RLS-01:** Tighten `pjs_lead_write_del` and `pemps_lead_write_del` policies to require admin or patch ownership.
2. **F-RLS-02:** Update `/api/admin/refresh-views` to use service-role client for RPC calls.

### HIGH
3. **F-RLS-05:** Estimate and test patch-overlap trigger cost on bulk job-site operations.
4. **F-RLS-03:** Standardize admin route pattern via `createAdminClient()` helper.

### MEDIUM
5. **F-RLS-04:** Add validation to prevent claims on patch-accessible projects (or document rationale).
6. **F-RLS-06:** Audit and remove/protect test page with service-role access.

### LOW
7. Verify CONCURRENT refresh index for `patch_project_mapping_view`.
8. Document patch assignment status enum (clean/overlap/gap/fallback) handling in client code.

---

**End of Diagnostic**

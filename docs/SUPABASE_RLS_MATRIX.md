# Supabase RLS matrix (app roles × CRUD)

This document summarizes **effective Row Level Security (RLS) behaviour** for the main user-facing tables in the CFMEU organising database.

It’s intended as a fast “who can do what” reference during debugging, not a replacement for inspecting `pg_policies` in the live Supabase database.

## How to read this

- Supabase Postgres roles are usually `anon` vs `authenticated`.
- **App roles** (`admin`, `lead_organiser`, `organiser`, `delegate`, `viewer`) are stored in `public.profiles.role` and checked via helpers like `public.has_role()` / `public.get_user_role()` / `public.is_admin()`.
- RLS decisions are controlled by:
  - **policy role targets** (`TO authenticated`, `TO service_role`, etc.)
  - **policy predicates** (`USING (...)`, `WITH CHECK (...)`)
  - helper functions like `public.can_access_job_site()` and `public.can_access_employer()` (patch/scoped access).

### Legend

- **R** = SELECT (read)
- **C** = INSERT (create)
- **U** = UPDATE
- **D** = DELETE
- **\*** = conditional (scope-limited, self-only, patch-limited, or “team” access)
- **—** = no direct access via RLS policies (app role cannot do that operation with the anon/authenticated key)

## Sources (migrations)

These migrations are the primary sources for the matrix below:

- Baseline schema/policies: `supabase/migrations/0000_remote_schema.sql`
- Patch-first access checks (avoids recursion): `supabase/migrations/20250108000000_fix_organiser_rls_recursion.sql`
- Projects select recursion fix (patch mapping direct access): `supabase/migrations/20251112000000_fix_projects_rls_recursion.sql`
- Dangerous policy fixes (notably DELETE): `supabase/migrations/20251108000000_fix_dangerous_rls_policies.sql`
- “Enable missing RLS” (broad authenticated CRUD on some tables): `supabase/migrations/20251022100000_enable_missing_rls_fixed.sql`
- Public tokens table + baseline policies: `supabase/migrations/20250924100000_create_secure_access_tokens.sql`
- Delegated-tasks analytics + secure token visibility expansion: `supabase/migrations/20251112105313_enhance_delegated_tasks_tracking.sql`
- Mapping sheet scanner schema + job queue policies: `supabase/migrations/20250930000000_mapping_sheet_scanner.sql`
- Mapping sheet scan read broadening (own uploads / project-visible): `supabase/migrations/20251007000000_new_project_scan_support.sql`
- Pending users admin/lead SELECT fix: `supabase/migrations/20251221000001_fix_pending_users_admin_select.sql`
- Admin patch assignment writes: `supabase/migrations/20251221000000_fix_organiser_patch_assignments_admin_access.sql`

## Role × CRUD matrix (core tables)

> Notes are intentionally blunt: if a policy is effectively “all authenticated users”, the matrix reflects that even if it’s not least-privileged.

| Table | Admin | Lead organiser | Organiser | Delegate | Viewer | Notes / important policy sources |
|---|---|---|---|---|---|---|
| `projects` | **R C U D** | **R\* C U\*** | **R\* C U\*** | **U\*** | **U\*** | **SELECT** is patch-based (no `delegate/viewer` project read) via `projects_select` in `20251112000000_fix_projects_rls_recursion.sql`. **INSERT** is admin/lead/organiser-only (`projects_insert_ins` in `0000_remote_schema.sql`). **DELETE** admin-only (`20251108000000_fix_dangerous_rls_policies.sql`). **UPDATE** requires admin/lead/organiser *or* `can_access_job_site()` via a job site on the project (`projects_update` in `0000_remote_schema.sql`). |
| `job_sites` | **R C U D** | **R C U\* D\*** | **R C U\* D\*** | **R U\* D\*** | **R U\* D\*** | **SELECT** is effectively all authenticated due to `job_sites_map_read` (`USING (true)` in `0000_remote_schema.sql`). **INSERT** admin/lead/organiser-only (`job_sites_insert_ins` in `0000_remote_schema.sql`). **UPDATE/DELETE** admin or `can_access_job_site()` (`20251108000000_fix_dangerous_rls_policies.sql` + `0000_remote_schema.sql`). |
| `employers` | **R C U D** | **R\* C U\* D\*** | **R\* C U\* D\*** | **R\* U\* D\*** | **R\* U\* D\*** | **SELECT** is via `can_access_employer(id)` (`employers_select` in `0000_remote_schema.sql`, helper updated in `20250108000000_fix_organiser_rls_recursion.sql`). **INSERT** admin/lead/organiser-only (`employers_insert_ins` in `0000_remote_schema.sql`). **DELETE** admin or `can_access_employer()` (`20251108000000_fix_dangerous_rls_policies.sql`). **UPDATE** requires admin/lead/organiser *or* `can_access_employer()` (`employers_update` in `0000_remote_schema.sql`). |
| `patches` | **R C U D** | **R C U D** | **R D\*** | **R** | **R** | **SELECT** is effectively all authenticated due to `patches_read` containing `USING (true OR …)` (`0000_remote_schema.sql`). **ALL** for lead/admin via `patches_modify` (`0000_remote_schema.sql`). **DELETE** also explicitly defined in `20251108000000_fix_dangerous_rls_policies.sql`, but `patches_modify` already grants lead delete. Organiser delete is conditional (e.g., assigned/creator) depending on `patches_delete` logic. |
| `patch_job_sites` | **R\* C U D** | **R\* C\* U\* D** | **R\*** | **D** | **D** | **READ** restricted to admins + lead/organiser assigned to the patch (`pjs_read` in `0000_remote_schema.sql`). **INSERT/UPDATE** restricted to admin or lead assigned to patch (`pjs_admin_write` + `pjs_lead_write_ins`, and update tightened in `20251108000000_fix_dangerous_rls_policies.sql`). **DELETE** is effectively all authenticated due to `pjs_lead_write_del … USING (true)` (`0000_remote_schema.sql`). |
| `patch_employers` | **R\* C U D** | **R\* C\* U\* D** | **R\*** | **D** | **D** | Same shape as `patch_job_sites` (`pemps_*` policies in `0000_remote_schema.sql`; update tightened in `20251108000000_fix_dangerous_rls_policies.sql`; delete is `USING (true)`). |
| `organiser_patch_assignments` | **R C U D** | **R** | **R** | **R** | **R** | **SELECT** is open to authenticated (`p_select_organiser_patch_assignments` in `0000_remote_schema.sql`). **Writes** are `service_role` + admin (`p_write_organiser_patch_assignments` in `0000_remote_schema.sql`, admin policy added in `20251221000000_fix_organiser_patch_assignments_admin_access.sql`). |
| `lead_organiser_patch_assignments` | **R C U D** | **R** | **R** | **R** | **R** | Same shape as `organiser_patch_assignments` (`0000_remote_schema.sql` + `20251221000000_fix_organiser_patch_assignments_admin_access.sql`). |
| `profiles` | **R U** | **R\*** | **R\*** | **R\*** | **R\*** | **SELECT** is self, admin, or “parent” via `role_hierarchy` (`profiles_self_select` in `0000_remote_schema.sql`). **UPDATE** is self or admin (`profiles_self_update` in `0000_remote_schema.sql`). |
| `pending_users` | **R C U D** | **R C U D** | **R\* C U D** | **R\* C U D** | **R\* C U D** | **SELECT** is admin/lead or creator (`pending_users_select` in `20251221000001_fix_pending_users_admin_select.sql`). **INSERT/UPDATE/DELETE** are effectively all authenticated due to `USING/WITH CHECK … OR true` (`pending_users_self_insert_*` and `pending_users_update` in `0000_remote_schema.sql`). |

## Role × CRUD matrix (mapping / compliance / ops)

| Table | Admin | Lead organiser | Organiser | Delegate | Viewer | Notes / important policy sources |
|---|---|---|---|---|---|---|
| `project_assignments` | **R C U D** | **R C U D** | **R C U D** | **R C U D** | **R C U D** | Broad authenticated CRUD from `20251022100000_enable_missing_rls_fixed.sql` (`auth_*_proj_assignments` policies). |
| `project_compliance` | **R C U** | **R C U** | **R C U** | **R C U** | **R C U** | Broad authenticated read/insert/update from `20251022100000_enable_missing_rls_fixed.sql`. (No delete policy.) |
| `employer_compliance_checks` | **R C U** | **R C U** | **R C U** | **R C U** | **R C U** | Broad authenticated read/insert/update from `20251022100000_enable_missing_rls_fixed.sql`. (No delete policy.) |
| `site_visit` | **R C U D** | **R** | **R C U D** | **R** | **R** | Everyone authenticated can **read** (`Authenticated users can view site visits`). **Manage** is admin+organiser (`Admins and organisers can manage site visits`) in `0000_remote_schema.sql`. |
| `site_employers` | **R C U D** | **R** | **R C U D** | **R** | **R** | Same pattern: authenticated read + admin/organiser manage in `0000_remote_schema.sql`. |
| `project_employer_roles` | **R C U D** | **R** | **R C U D** | **R** | **R** | Authenticated read + admin/organiser manage in `0000_remote_schema.sql` (“Authenticated users can view …” + “Admins and organisers can manage …”). |
| `project_contractor_trades` | **R C U D** | **R** | **R C U D** | **R** | **R** | Authenticated read + admin/organiser manage in `0000_remote_schema.sql`. |

## Role × CRUD matrix (delegated tasks / public tokens)

| Table | Admin | Lead organiser | Organiser | Delegate | Viewer | Notes / important policy sources |
|---|---|---|---|---|---|---|
| `secure_access_tokens` | **R C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **SELECT**: creator (`20251112105313_enhance_delegated_tasks_tracking.sql`), lead organiser can view team tokens (`role_hierarchy`), admin can view all. **INSERT/UPDATE** are creator-only (`20250924100000_create_secure_access_tokens.sql`). **Public token validation** allows unauthenticated SELECT (`20250924100000_create_secure_access_tokens.sql`). No delete policy. |

## Role × CRUD matrix (job queue / scanner)

| Table | Admin | Lead organiser | Organiser | Delegate | Viewer | Notes / important policy sources |
|---|---|---|---|---|---|---|
| `scraper_jobs` | **R C** | **R C** | **R C** | **R C** | **R C** | Insert/select policies are effectively “any authenticated” in `20250930000000_mapping_sheet_scanner.sql` (note: **read** policy does not scope to creator in the SQL as written). Workers typically use `service_role` for job reservation. |
| `mapping_sheet_scans` | **R\* C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **R\* C\* U\*** | **INSERT**: uploader only (`Authenticated users can create scans`). **SELECT**: visible if project is visible under `projects` RLS *or* if uploader (`20251007000000_new_project_scan_support.sql`). **UPDATE**: uploader/reviewer, plus admin/organiser (`20250930000000_mapping_sheet_scanner.sql`). |

## “Scope” primitives referenced by policies (where to look)

- **Patch-based project access**: `patch_project_mapping_view` (materialized) in `0000_remote_schema.sql`
- **Access helper functions**:
  - `public.can_access_job_site(uuid)` and `public.can_access_employer(uuid)` (patch-first, recursion-safe): `20250108000000_fix_organiser_rls_recursion.sql`
  - `public.user_can_access_project_direct(uuid, uuid)` and `projects_select`: `20251112000000_fix_projects_rls_recursion.sql`
  - `public.has_role(uuid, text)`, `public.get_user_role(uuid)`, `public.is_admin()`: `0000_remote_schema.sql`



# Connection & Stability Remediation Plan

> **Compiled:** 2026-05-25
> **Scope:** Diagnose root causes of recurring Supabase timeouts, connection drops, permission errors, and lost user identification on the client. Propose fixes only — no code changes in this pass.
> **Method:** Multi-agent diagnostic review (Phase A inventory + 5 parallel Phase B agents + Phase C synthesis), cross-referenced against the peer-platform troubleshooting report at `docs/NEXTJS_SUPABASE_VERCEL_TROUBLESHOOTING_REPORT.md`.
> **Working files:** `docs/_diagnostic/01_auth_session.md`, `02_api_vercel.md`, `03_rls_permissions.md`, `04_data_plane.md`, `05_mobile_pwa.md`, `06_synthesis.md`. These are the audit trail — delete after this plan is approved.

---

## 1. Executive summary

Five root causes account for the bulk of the user-reported symptoms. All five have direct evidence in this codebase (file:line) and three of them were independently flagged by ≥2 diagnostic agents.

| # | Root cause | One-line rationale | Symptoms |
|---|---|---|---|
| **RC-1** | No `coordinatedRefreshSession()` mutex across middleware, visibility handler, and recovery | Three call sites refresh the single-use refresh token without serialisation — token can be rotated twice concurrently, corrupting auth | "Invalid Refresh Token: Already Used"; logout after background-tab return |
| **RC-2** | Browser client uses default `navigatorLock` (cross-tab steal) instead of `processLock` | `src/lib/supabase/client.ts:89` passes no `auth.lock` option — second tab steals lock, first tab's `getSession`/`getUser` aborts | Multi-tab inconsistency; random spinners on tab switch |
| **RC-3** | No fetch timeouts on Supabase auth calls or on client-side `/api/*` fetches | `refreshSession`/`getSession`/`signOut` and 20+ `fetch('/api/...')` callers have no `AbortController` — any hang propagates as infinite UI spinner | Silent spinners on admin patch-assignment, Incolink, batch upload; "app crashed" reports |
| **RC-4** | `recoveryAttemptedRef` is one-shot for AuthProvider lifetime | Once recovery fails, it cannot retry until a fresh session arrives — even after the network is restored | Sticky session loss requiring full app restart (matches user reports) |
| **RC-5** | iOS PWA `pendingReload` flag set but never consumed | `src/app/providers.tsx:476` sets the flag; no reader exists, so the deferred SW reload never executes | iOS PWA stuck on stale code after deploy; chunk-not-found, ghost auth state |

**These are not five unrelated bugs.** RC-1 through RC-3 are three faces of one architectural gap — orchestration of bounded async operations through the auth layer. Fixing them in concert (P0-1 through P0-5 below) addresses the majority of user-visible instability. RC-4 and RC-5 explain why recovery is unreliable when the first three slip through.

**Beyond root causes**, the audit surfaced two further structural issues that have not yet caused user symptoms but are latent failure modes:

- **P0-6:** the cron route `/api/admin/refresh-views` rejects Vercel cron (no `CRON_SECRET`, uses `getUser()`); materialised views are silently going stale.
- **P0-7:** two DELETE policies (`pjs_lead_write_del`, `pemps_lead_write_del`) still use `USING (true)` in `supabase/migrations/0000_remote_schema.sql:10470, 10543`, contradicting a claimed fix from migration `20251108000000_fix_dangerous_rls_policies.sql`. Any authenticated user can delete patch assignments — confirm against live `pg_policies` before assuming the migration ran.

---

## 2. Claimed-fix verification

The team has documented 34 fixes across `AUTH_SESSION_LOSS_INVESTIGATION.md`, `SESSION_LOSS_INVESTIGATION_FINDINGS.md`, and `docs/SESSION_LOSS_FIX_SUMMARY.md`. Verification status:

| Status | Count | Notes |
|---|---|---|
| **Live and complete** | 23 | TOKEN_REFRESHED cache isolation, centralised AuthProvider, `withTimeout` removal, visibility refresh, hadSessionRef persistence, iOS SecurityError handling, SW network-first, navigation signals (sender + receiver), etc. |
| **Live but incomplete** | 2 | A1.10 / A5.3 — iOS PWA defer-reload **is set** but never **flushed** (`pendingReload` has no consumer) |
| **Contradicted (claim disagrees with code)** | 2 | A3.3 DELETE policies (still `USING (true)` in base schema); `coordinatedRefreshSession()` referenced in A1.1 narrative but symbol absent from `src/` |
| **Unverified (file not found at expected path)** | 5 | A2.3 cross-route-group ratings nav, A2.4 new-scan-review reload, A2.5 ratings-4point 401, A6.1 RatingsView Dialog, A6.2 InlineAssessmentFlow |
| **Likely live, needs visual confirmation** | 2 | A5.5 Sentry tunnel + allow-list, A1.12 Sentry breadcrumbs |

**Two conflicts noted in the inventory are resolved:**
- Service worker version: **2.4.0** confirmed live (`public/sw.js:3-5`).
- Middleware excludes `/api/*`: confirmed live (`src/middleware.ts:413`).

The five unverified items mostly cluster around the ratings pages. If those files were renamed or route-grouped under different paths, the documented fixes may still be live elsewhere — needs user confirmation (see open question 3).

---

## 3. Prioritised fix list

Fixes are ordered by structural impact, not by effort. P0 items should be sequenced first because each one removes silent-failure paths that mask the others.

### P0 — Structural (system-wide). 8 items.

#### P0-1 — Add `coordinatedRefreshSession()` mutex
- **Evidence:** `src/middleware.ts:200`, `src/hooks/useAuth.tsx:296, 650`. No mutex symbol in `src/`.
- **Symptom addressed:** RC-1. "Invalid Refresh Token: Already Used" errors; logout after background-tab return.
- **Fix:** Introduce a singleton async mutex (Promise singleton or `p-limit(1)`) that wraps every `supabase.auth.refreshSession()` call. All three call sites (middleware refresh fallback, useAuth recovery, useAuth visibility handler) await the same singleton. Mirrors OA's commit `8aa3907` analogue.
- **OA cross-ref:** Issue 1 root cause #1; lesson 1.
- **Risk:** High — touches auth-critical paths.
- **Rollout:** Staged — deploy behind verbose Sentry breadcrumbs first, watch for dedup signal in production, then enable.

#### P0-2 — Configure `processLock` and disable SDK auto-refresh on browser client
- **Evidence:** `src/lib/supabase/client.ts:89` — `createBrowserClient(url, key)` with no `auth` option.
- **Symptom addressed:** RC-2. Multi-tab inconsistency; random `getSession` aborts.
- **Fix:** Pass `{ auth: { lock: processLock, autoRefreshToken: false } }`, importing `processLock` from `@supabase/supabase-js`. Document rationale inline (cross-tab steal trade-off).
- **OA cross-ref:** Issue 1 §B; lessons 2 + 3; commit `8aa3907`.
- **Risk:** High — multi-tab regression possible.
- **Rollout:** Staged — run the multi-tab matrix from §5 on staging before prod.

#### P0-3 — Wrap Supabase auth ops with timeouts (do not escalate to forced logout)
- **Evidence:** `useAuth.tsx:296, 417, 626, 650, 721`; `middleware.ts:156, 200` — bare `await supabase.auth.refreshSession/getSession/signOut`.
- **Symptom addressed:** RC-3 (auth half). Visibility handler blocks; logout hangs.
- **Fix:** Wrap each call with `withTimeout(promise, 12_000)` (OA's `SUPABASE_AUTH_OP_TIMEOUT_MS`). On `signOut` timeout, fall through to the cookie-clear path that `hardReset.ts` already provides. **Critical:** do not escalate refresh/getSession timeout to forced logout — the existing soft-fail behaviour (return on timeout, let next 401 drive recovery) is correct and must be preserved (OA lesson 6 / commit `a64f520`).
- **OA cross-ref:** Issue 1 §C lesson 5; commit `a64f520`.
- **Risk:** Medium — additive, but must verify soft-fail semantics.
- **Rollout:** Direct.

#### P0-4 — Introduce `fetchApi()` wrapper for client-side `/api/*` calls
- **Evidence:** 20+ unwrapped `fetch('/api/...')` call sites including `src/components/employers/IncolinkActionModal.tsx`, `src/components/projects/BatchManagementDashboard.tsx`, `src/app/(app)/admin/page.tsx`. No `src/lib/api/fetch-api.ts` exists.
- **Symptom addressed:** RC-3 (Lane 2 half). Silent infinite spinners on admin patch / Incolink / batch upload (anchor b); background-tab → wake → first request never returns (anchor c).
- **Fix:** Create `src/lib/api/fetch-api.ts` mirroring OA's pattern — `AbortController` + 60s default / 120s long-op / 600s SSE, plus `X-Request-Id` header per request. Migrate callers in groups: admin first (covers patch-assignment anchor), then employer/project, then misc.
- **OA cross-ref:** Issue 2 §"fetchApi"; commit `4cca512`.
- **Risk:** Medium — must not break existing upload/error paths.
- **Rollout:** Staged per route group.

#### P0-5 — Add `statement_timeout` and client-side timeouts to long-running RPCs
- **Evidence:** `src/components/admin/PatchAssignmentIssues.tsx` (call to `reevaluate_patch_assignments`); RPCs `calculate_final_employer_rating`, `calculate_project_compliance_rating`, `refresh_employers_search_view_*`, `detect_employer_conflicts_detailed`, `search_employers_with_aliases`, `approve_employer` all lack `SET LOCAL statement_timeout`.
- **Symptom addressed:** Admin patch-assignment work hangs at Vercel 60s ceiling with no toast (anchor b); rating queries can run minutes.
- **Fix:** Migration: add `SET LOCAL statement_timeout = '20s'` (or per-RPC budget) at the top of each RPC body. UI: wrap the RPC call in P0-4's `fetchApi` with a 15-20s budget and surface a clear timeout toast.
- **OA cross-ref:** Issue 1 §C — timeouts at every layer.
- **Risk:** Medium — must coordinate DB + client.
- **Rollout:** Migration first (safe — only narrows allowed runtime), then targeted client wrap.

#### P0-6 — Fix cron `/api/admin/refresh-views` auth and client type
- **Evidence:** `src/app/api/admin/refresh-views/route.ts:25-53` does `getUser()` and uses anon+cookies; `vercel.json:2-6` wires the cron schedule.
- **Symptom addressed:** Materialised views (`patch_project_mapping_view`, etc.) are not being refreshed automatically — dashboards / admin views silently operate on stale data.
- **Fix:** Reorder the handler: (1) check `request.headers.get('Authorization')` against `process.env.CRON_SECRET`; (2) if header absent, fall back to the existing admin role check for manual triggers; (3) use a service-role client (`createClient(URL, SERVICE_ROLE_KEY)`) for the refresh RPC. Provision `CRON_SECRET` on Vercel and add it to `vercel.json` cron headers.
- **OA cross-ref:** Issue 2 §CRON_SECRET; Issue 4 lesson 2.
- **Risk:** High — currently broken; the fix unblocks automated refresh.
- **Rollout:** Direct after `CRON_SECRET` is provisioned; verify via Vercel cron log.

#### P0-7 — Verify and tighten DELETE policies on `patch_job_sites` / `patch_employers`
- **Evidence:** `supabase/migrations/0000_remote_schema.sql:10470, 10543` — `pjs_lead_write_del` and `pemps_lead_write_del` show `USING (true)`. Claim A3.3 in `AUTH_SESSION_LOSS_INVESTIGATION.md` states this is fixed by `20251108000000_fix_dangerous_rls_policies.sql`.
- **Symptom addressed:** Any authenticated user can delete patch-assignment rows. Data-integrity risk; no observed user reports yet.
- **Fix:** First, inspect live `pg_policies` to determine whether the tightening migration actually ran. If still permissive, apply a migration replacing the DELETE policy with `USING (public.is_admin() OR public.is_assigned_to_patch(auth.uid(), patch_id))`.
- **OA cross-ref:** Issue 4 lesson 4 — RLS helper SQL deserves unit tests.
- **Risk:** High (data integrity); low (rollout, since the change is restrictive).
- **Rollout:** Verify against prod first; if confirmed-live, apply tightening migration directly.

#### P0-8 — Reset `recoveryAttemptedRef` after cooldown
- **Evidence:** `src/hooks/useAuth.tsx:157, 279, 285, 479` — flag set once, only cleared on `SIGNED_IN`.
- **Symptom addressed:** RC-4. Sticky session loss requiring full app restart (matches user-reported "browser restart fixes it"; especially painful on iOS PWA — anchor a, c).
- **Fix:** Either (a) reset the flag on success in the visibility handler, or (b) record a `lastRecoveryAttemptAt` timestamp and permit re-entry after 30 s, reusing the existing `SESSION_RECOVERY_TIMEOUT` constant at `useAuth.tsx:12`.
- **OA cross-ref:** Issue 1 §D — graduated recovery + 30s circuit breaker.
- **Risk:** Medium — must avoid recovery cascades; the OA pattern's 30s window is the proven envelope.
- **Rollout:** Staged with Sentry breadcrumbs on every recovery attempt.

### P1 — Page-scoped / bounded. 8 items.

#### P1-1 — Flush deferred SW reload on iOS PWA
- **Evidence:** `src/app/providers.tsx:476` sets `pendingReload = true`; no read site found.
- **Symptom:** RC-5. iOS PWA organisers running old app code after deploy (anchor a).
- **Fix:** Consume `pendingReload` on the next user-initiated navigation, or on the `NAVIGATION_END` SW message that `useNavigationLoading.tsx:80, 178` already sends. Trigger `window.location.reload()` only when no navigation is in flight, so the reload happens at a safe moment.
- **Risk:** Medium — iOS PWA UX.
- **Rollout:** Feature-flag the flush logic and monitor controllerchange → reload latency.

#### P1-2 — Bound dashboard worker fetches and add circuit breaker
- **Evidence:** `src/hooks/useEmployersServerSide.ts:86-200`; same pattern in `useProjectsServerSide`, `useCoverageLadders`, `useNewDashboardData`.
- **Symptom:** UI hangs ~60 s when Railway worker is down; affects employers/projects list pages.
- **Fix:** Wrap worker `fetch` in `fetchApi` (P0-4) with a 5–8 s budget; on `AbortError` fall through to the existing `/api/employers` / `/api/projects` direct path. Add a 3-strike open-circuit so the worker is skipped for N minutes after repeated failures.
- **Risk:** Low — fallback path already exists.
- **Rollout:** Direct once `fetchApi` lands.

#### P1-3 — Split `/api/*` Cache-Control by sensitivity
- **Evidence:** `next.config.mjs:84-89` applies `public, max-age=60, stale-while-revalidate=300` to every `/api/*` route.
- **Symptom:** Auth-denied responses may be served from edge cache to other users; 5-minute staleness window for mutations.
- **Fix:** Split the rule:
  - `/api/health`, `/api/ping`: keep `public, max-age=60`.
  - `/api/admin/*`, `/api/user/*`, `/api/employers/*`, `/api/ratings/*`, `/api/projects/*`: `no-store, must-revalidate`.
  - Remaining routes: `private, max-age=0`.
- **Risk:** Medium — may expose existing skew issues that were masked by caching.
- **Rollout:** Config-only; verify with load test on staging.

#### P1-4 — Pair `/api/admin/refresh-views` with service-role client
- **Evidence:** `src/app/api/admin/refresh-views/route.ts:29` uses `createServerSupabase()` (anon+cookies).
- **Symptom:** Refresh RPCs may run under-privileged; materialised view projection may be incomplete.
- **Fix:** Fold into P0-6 — after `CRON_SECRET` or admin-role check passes, build the admin client with `createClient(URL, SERVICE_ROLE_KEY)`.
- **Rollout:** Bundle with P0-6.

#### P1-5 — Route-level timeout escape for long-running upstream operations
- **Evidence:** `src/app/api/fwc-search/route.ts` (Puppeteer), `src/app/api/incolink/export/route.ts`, `src/app/api/help/chat/route.ts` (Anthropic streaming) — no AbortController on the upstream call.
- **Symptom:** 504 with no body; billable Vercel function-duration spent on a hung upstream.
- **Fix:** Per route, wrap the upstream operation in an `AbortController` capped at ~55 s; on timeout abort upstream and return a structured 504 with `X-Request-Id`.
- **Rollout:** Per-route; FWC + Incolink first.

#### P1-6 — Show loading state in `EditProjectDialog.loadRelations()`
- **Evidence:** `src/components/projects/EditProjectDialog.tsx:90-150` — 3–4 sequential awaits with no UI indicator.
- **Symptom:** Admin patch-assignment dialog appears blank while loading (anchor b).
- **Fix:** Show a skeleton/spinner while `loadingRelations` is true; consider migrating to React Query + Suspense.
- **Rollout:** Direct.

#### P1-7 — Explicit `autoRefreshToken: false` on browser client
- **Evidence:** `src/lib/supabase/client.ts:89` — no `auth` option, so SDK default is in effect.
- **Symptom:** Exacerbates RC-1 if the SDK's own auto-refresh ever fires concurrently with middleware/visibility refresh.
- **Fix:** Bundle with P0-2 — pass `auth: { autoRefreshToken: false }` alongside `lock: processLock`.
- **Rollout:** Bundle with P0-2.

#### P1-8 — Benchmark and (only then) optimise the patch-overlap trigger
- **Evidence:** `supabase/migrations/20260209000000_add_patch_assignment_overlap_detection.sql:43-103` — `job_sites_set_patch_from_coords` runs spatial join on every `job_sites` INSERT/UPDATE.
- **Symptom:** Bulk BCI / mapping-sheet-scanner / scraper imports may stall (anchor b on bulk paths).
- **Fix:** **Benchmark first** on a representative dataset (size to be confirmed — see open question 8). Only if hot, add partial spatial index, batch the trigger, or move assignment to an async job queue. Do not change before benchmark.
- **Rollout:** Benchmark gate.

### P2 — Hygiene / instrumentation. 10 items.

| ID | Title | Evidence | Action |
|---|---|---|---|
| **P2-1** | Clear `cfmeu-had-session` in `hardReset.ts` | `src/lib/auth/hardReset.ts:28-39` | Add `localStorage.removeItem(HAD_SESSION_STORAGE_KEY)` before reload |
| **P2-2** | Move Anthropic init out of module scope | `src/app/api/help/chat/route.ts:7` | Construct `new Anthropic(...)` inside the POST handler |
| **P2-3** | Add `/api/ping` zero-dependency smoke route | new file | Returns `{ status: 'ok' }`; isolates Vercel routing from app/DB latency |
| **P2-4** | Verify `db-connection-monitor.ts` exists | `src/middleware.ts:4`, `src/lib/supabase/client.ts:6` import it | B4 reported it missing; CI would otherwise fail — suspect read mistake. Confirm presence and document |
| **P2-5** | Re-evaluate global `staleTime: 30000` | `src/app/providers.tsx:195-207` | Raise per-page on stable data (>5 min); keep 30 s for true dashboards only |
| **P2-6** | Verify Sentry tunnel + `networkDetailAllowUrls` | `next.config.mjs`, `sentry.client.config.ts` | Confirm tunnel `/monitoring` and Supabase URL in allow-list |
| **P2-7** | Extend `MOBILE_REGRESSION_CHECKLIST.md` | `docs/MOBILE_REGRESSION_CHECKLIST.md` | Add PWA, session-persistence, background-tab, large-RPC sections using the reproduction scripts in §5 |
| **P2-8** | Add `createAdminClient()` helper | `/api/admin/*` ad-hoc | Standardise service-role construction with mandatory prior admin role check |
| **P2-9** | Use `REFRESH MATERIALIZED VIEW CONCURRENTLY` for `patch_project_mapping_view` | `0000_remote_schema.sql:3972-3985` | Verify unique index exists; switch refresh statement |
| **P2-10** | Audit `'use client'` service-role import | `src/app/(app)/admin/testing-activation/page.tsx` | Confirm the import is in a server-only file or remove the test page before any production cut |

---

## 4. Two-lane symptom map

The OA report's "two-lane" model maps cleanly onto CFMEU's symptoms. When the user reports something is broken, this flowchart triages the failure domain:

```
                      ┌────────────────────────────────┐
                      │ User reports: "stuck loading"  │
                      └─────────────┬──────────────────┘
                                    │
              ┌─────────────────────┴─────────────────────┐
              │ DevTools Network: what's pending?         │
              └─────────────┬──────────────┬──────────────┘
                            │              │
                ┌───────────▼─────┐ ┌──────▼─────────────┐
                │ *.supabase.co   │ │ same-origin /api/*  │
                │ (Lane 1)        │ │ (Lane 2)            │
                └───────┬─────────┘ └──────┬──────────────┘
                        │                  │
        ┌───────────────▼──┐      ┌────────▼─────────────┐
        │ Auth / RLS /     │      │ Vercel func / worker │
        │ refresh race     │      │ / external SDK hang  │
        │ (RC-1, RC-2,     │      │ (RC-3 Lane 2,        │
        │  RC-3 auth half) │      │  P0-5, P1-5)         │
        └───────┬──────────┘      └────────┬─────────────┘
                │                          │
        Check console [connection-monitor], │
        Sentry recent token_refresh events, │
        Supabase auth logs                  │
                                            │
                              Check Vercel function logs filtered
                              by X-Request-Id (P0-4 enables this);
                              check Railway worker /api/health/workers
```

**Re-login fixing the issue → session skew (Lane 2 server `getUser()` out of sync with browser cookies). Direct Supabase requests still returning 401/403 → RLS or auth.** Knowing the lane before changing code is the single biggest time-saver for these reports.

---

## 5. Reproduction & verification harness

Three reproduction scripts, one per user-confirmed anchor. Each produces a checkable artefact.

### 5.1 Two-lane curl matrix (run on prod + Vercel preview)

```bash
# Lane 1 — direct Supabase. Replace SUPABASE_URL / ANON_KEY.
curl -i -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANON_KEY" \
  "$SUPABASE_URL/rest/v1/projects?select=id&limit=1"

# Lane 2 — same-origin API
curl -i "$APP_URL/api/health"           # should return 200 immediately
curl -i "$APP_URL/api/ping"             # P2-3 — currently missing
curl -i "$APP_URL/api/admin/refresh-views"  # currently fails for cron-style auth (P0-6)
```

**Pass criteria:** both lanes return < 1 s. If Lane 1 succeeds and Lane 2 hangs, the problem is Vercel / middleware / handler, not Supabase.

### 5.2 Browser repro scripts

**Anchor (a) — Organiser on iOS PWA (Patch → Site Visits → Project → back × 5):**
1. Sign in on iPhone 13+ Safari, add to Home Screen, open from icon.
2. Navigate: Patch → Site Visits → Project → back → Patch. Repeat 5×.
3. Switch to another app for 5 minutes, return.
4. Capture: console `[connection-monitor]` events, profile data on Settings page, Sentry trace.
**Expected after fixes:** profile persists, no silent spinners, no "tap to recover" prompts.

**Anchor (b) — Admin patch-assignment work:**
1. Sign in as admin.
2. Open Admin → SpatialAssignmentTool → trigger `reevaluate_patch_assignments`.
3. Open EditProjectDialog on a project with many sites.
4. Capture: timing on each RPC, dialog blank-time, any 504.
**Expected after fixes:** RPC bounded ≤ 20 s with explicit timeout toast (P0-5); dialog shows skeleton (P1-6); no 504s.

**Anchor (c) — Background-tab / idle / sleep-wake:**
1. Open the app, navigate to dashboard, leave tab in background for 30 min.
2. Return to tab; observe console for `[connection-monitor]` events.
3. Repeat with laptop sleep (close lid 30 min, reopen).
4. Open a second tab on the same site (multi-tab matrix).
**Expected after fixes:** visibility handler completes within 12 s budget without forced logout; no "Invalid Refresh Token" in Sentry; second tab does not steal lock.

### 5.3 Diagnostic signals to capture per repro

Adapted from the OA intake template:
- UTC timestamp
- Lane (1 or 2)
- Pending Network row (URL, status, duration)
- Console `[connection-monitor]` event types in the last 60 s
- Session age (from `cfmeu-had-session` localStorage entry)
- Tab background/sleep state during the failure
- Deployment SHA (`process.env.VERCEL_GIT_COMMIT_SHA`)
- Sentry trace ID (after P0-4's `X-Request-Id` lands)
- Supabase Auth logs slice (Supabase dashboard → Auth → Logs)

### 5.4 Exit criteria for each P0

| Fix | Exit criterion |
|---|---|
| P0-1 mutex | Zero "Invalid Refresh Token: Already Used" in Sentry over 7 days |
| P0-2 processLock | Multi-tab matrix passes (both tabs hold session, no aborts) |
| P0-3 auth timeouts | No `getSession`/`refreshSession` calls exceed 12 s in Sentry breadcrumbs |
| P0-4 fetchApi | Zero `/api/*` fetch operations exceed configured timeout without a user-visible abort |
| P0-5 RPC timeouts | `reevaluate_patch_assignments` returns ≤ 20 s or shows timeout toast 100 % of the time |
| P0-6 cron auth | Vercel cron log shows successful nightly refresh; materialised view `last_refresh` advances daily |
| P0-7 DELETE policies | Manual test as `organiser` role fails to delete a `patch_job_sites` row |
| P0-8 recovery cooldown | Recovery retries observed in Sentry breadcrumbs after the 30 s window |

---

## 6. Open questions for the user

These cannot be resolved from code alone:

1. **Was `coordinatedRefreshSession()` ever implemented or only documented?** Inventory entry A1.1 refers to it; the symbol is absent from `src/`. If it was reverted, why?
2. **Is the absence of `auth.lock` configuration in `src/lib/supabase/client.ts:89` deliberate, or an oversight that survived prior rounds?**
3. **Are the "file not found" claimed fixes (A2.3 ratings nav, A2.4 new-scan-review, A2.5 ratings-4point API, A6.1/A6.2 RatingsView Dialog) actually deployed?** Renamed, route-grouped elsewhere, or never landed?
4. **Is `CRON_SECRET` set on Vercel production, and is the `vercel.json` cron actually wired up and firing?** (Required input for P0-6.)
5. **Has migration `20251108000000_fix_dangerous_rls_policies.sql` been applied to the live Supabase project?** Base-schema dump still shows `USING (true)`. (Required input for P0-7.)
6. **Does `src/lib/db-connection-monitor.ts` exist?** Imports point to it; B4 reported it missing — likely a B4 search mistake but needs ≤ 30 s to confirm.
7. **Production Sentry — any "Invalid Refresh Token: Already Used" errors in the last 30 days?** Confirms whether RC-1 is firing in the wild and prioritises P0-1 above all else.
8. **What is the typical dataset size for `reevaluate_patch_assignments()`?** Drives whether P0-5 needs batching/pagination (>10k sites) or just a timeout escape (<2k sites).
9. **What is `NEXT_PUBLIC_DASHBOARD_WORKER_URL` set to in production?** Drives whether P1-2's missing timeout is currently affecting users or dormant.
10. **Are Vercel preview deploys hitting the `public, max-age=60` cache rule?** Confirms whether P1-3's leak risk is actively occurring or theoretical.
11. **Is `staleTime: 30000` intentional dashboard freshness, or carried over from prototype?** Determines whether P2-5 is a real tuning target.

---

## 7. Recommended next step

Approve a follow-up implementation plan that bundles the P0 items in this sequence:

1. **P0-7 verify** (1 hour) — inspect live `pg_policies`; if DELETE policies are still permissive, the data-integrity fix is most urgent. If already tightened, mark closed and move on.
2. **P0-6 cron** (½ day) — `CRON_SECRET` + service-role; once green, the materialised view starts refreshing again and several downstream dashboard issues may resolve.
3. **P0-4 fetchApi** (1 day) — landing the wrapper first because P0-5 and P1-2 both depend on it.
4. **P0-2 + P1-7 processLock + autoRefreshToken: false** (½ day) — one commit; this is where the OA platform saw the largest reduction in production reports.
5. **P0-3 auth timeouts** (½ day) — additive, preserves soft-fail.
6. **P0-1 mutex** (1 day, staged) — the architecturally riskiest change; deploy with Sentry breadcrumbs first.
7. **P0-5 statement_timeouts + client wrap** (½ day for migration, ½ day for UI) — closes the admin anchor.
8. **P0-8 recovery cooldown** (½ day) — last because P0-1/P0-2 may reduce the recovery hit rate enough that P0-8 becomes lower-priority.

Total P0 budget: ~5 working days for one engineer, two if a second is available to parallelise the migration work. P1 items can ride along behind P0-4 once the `fetchApi` wrapper exists.

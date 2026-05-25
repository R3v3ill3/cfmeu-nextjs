# 06 — Synthesis: Cross-agent diagnostic findings

**Date:** 2026-05-25
**Phase:** C (Synthesis)
**Inputs:** Phase A inventory + B1 (auth) + B2 (API/Vercel) + B3 (RLS) + B4 (data plane) + B5 (mobile/PWA) + OA peer-platform report
**Scope rule:** Conservative — fix proposed only when the codebase shows the symptom (file:line). OA report is context, not a checklist. No code edits.

---

## 1. Likely root causes (top 5)

### RC-1 — Refresh-token race: no `coordinatedRefreshSession()` mutex across middleware, visibility, recovery
- **Statement:** Three independent code paths call `supabase.auth.refreshSession()` with no documented serialization, so a single-use refresh token can be rotated twice concurrently, corrupting auth state.
- **Evidence:**
  - B1 F-AUTH-11: refresh callers at `src/middleware.ts:200` (refresh on stale JWT), `src/hooks/useAuth.tsx:296` (recovery), `src/hooks/useAuth.tsx:650` (visibility). `coordinatedRefreshSession` is referenced in inventory A1.1 but not present in code.
  - B4 Open Q1 + B4 §"processLock": no `coordinatedRefreshSession` symbol found anywhere in src/.
  - B5 F-MOBILE-04: visibility refresh races middleware refresh on navigation.
  - OA Issue 1 root cause #1 + lesson 1: "one mutex, many entry points."
- **Symptoms explained:** intermittent "Invalid Refresh Token: Already Used" errors, unexpected logouts on background-tab return, organiser logged out mid-session after navigation + visibility race (anchor a + c).

### RC-2 — Browser-client lock strategy unconfigured (default `navigatorLock`, not `processLock`)
- **Statement:** OA team explicitly chose `processLock` to avoid cross-tab Web-Lock stealing, but the CFMEU `createBrowserClient()` call in `src/lib/supabase/client.ts:89` passes no `auth.lock` option, leaving the SDK on the cross-tab `navigatorLock` default.
- **Evidence:**
  - B1 F-AUTH-07: no `processLock` import/usage in `client.ts`; no `auth: { lock: ... }` option.
  - B4 Open Q1 + recommendation P1.6: same gap, flagged independently.
  - OA Issue 1 §B + lesson 2/3: cross-tab steal causes production-only failures.
- **Symptoms explained:** multi-tab inconsistency (second tab's `getSession`/`getUser` aborts), random spinners on tab switch, "app feels disconnected" reports.

### RC-3 — No fetch timeouts on Supabase auth calls *or* on client-side `/api/*` calls
- **Statement:** `refreshSession()`, `getSession()`, `getUser()`, `signOut()` and 20+ client `fetch('/api/...')` calls have no `AbortController` / timeout wrapper, so any hang propagates as an infinite UI spinner.
- **Evidence:**
  - B1 F-AUTH-08/09/10: bare `await supabase.auth.refreshSession/getSession/signOut` calls in `useAuth.tsx:296, 417, 626, 650, 721` and `middleware.ts:156, 200`.
  - B2 F-API-04: `grep` finds 20+ unbounded client `fetch('/api/...')` calls; no `fetchApi()` wrapper exists in the CFMEU codebase.
  - B5 F-MOBILE-02: same issue concretely manifesting at `PatchAssignmentIssues.tsx` reevaluate RPC.
  - OA Issue 1 lesson 5 + Issue 2 §"fetchApi": fix pattern is canonical in peer platform.
- **Symptoms explained:** silent infinite spinners on patch-assignment work (anchor b), background-tab → wake → request never returns (anchor c), perceived "app crashed."

### RC-4 — `recoveryAttemptedRef` is a one-shot flag with no time-window reset
- **Statement:** Once `attemptSessionRecovery()` runs and fails (e.g. transient network blip), `recoveryAttemptedRef.current = true` (`useAuth.tsx:285`) and is only reset on a *new* session arriving — meaning recovery cannot retry for the AuthProvider's lifetime even when network/cookies are restored.
- **Evidence:**
  - B1 F-AUTH-03: refs at `useAuth.tsx:157, 279, 285, 479`. No time-window or retry cooldown.
  - B5 §B.1: visibility handler observed to set recoveryAttemptedRef without resetting on subsequent visibility events.
  - OA Issue 1 §D: graduated recovery + 30s circuit breaker (CFMEU has the circuit breaker constant but not the retry-cooldown).
- **Symptoms explained:** sticky session loss requiring full app restart (matches user-reported "browser restart fixes it"); particularly bad on iOS PWA where the user can't easily clear state (anchor a).

### RC-5 — `pendingReload` SW deferral has no consumer; iOS PWA gets stuck on old SW indefinitely
- **Statement:** On iOS PWA controllerchange, `providers.tsx:476` sets `pendingReload = true` and returns — but no code path ever inspects `pendingReload` to actually flush the deferred reload. A complementary issue: `useNavigationLoading.tsx` does send `NAVIGATION_START/END` (B5 confirmed) but the SW message handler tying that to `skipWaiting()` isn't fully traced.
- **Evidence:**
  - B5 F-MOBILE-01: `grep -r pendingReload src/` returns only the assignment; no read site.
  - B1 F-AUTH-04: SW receivers present at `public/sw.js:256-279`, but B1 (initial pass) couldn't locate the sender; B5 found `useNavigationLoading.tsx:80-82, 178-181` *does* send signals — partially mitigating this — but the deferred-reload flush remains absent.
- **Symptoms explained:** iOS PWA organisers running outdated app code after SW update (chunk-not-found, stale schema assumptions, ghost auth state). Pairs with anchor a (Organiser on iOS PWA).

---

## 2. Cross-agent corroboration matrix

| # | Finding theme | B1 | B2 | B3 | B4 | B5 | Multi-agent? | Verdict |
|---|---|----|----|----|----|----|-----|-----|
| C1 | No `coordinatedRefreshSession` mutex | F-AUTH-11 | — | — | Open Q1 / P1.6 | F-MOBILE-04 | **3 agents** | Structural P0 |
| C2 | `processLock` not configured on browser client | F-AUTH-07 | — | — | Open Q1, P1.6 | — | **2 agents** | Structural P0 |
| C3 | No timeouts on Supabase auth calls | F-AUTH-08, F-AUTH-09, F-AUTH-10 | — | — | — | §B.1 (noted) | **2 agents** | Structural P0 |
| C4 | No timeouts on client `/api/*` fetches | — | F-API-04 | — | — | F-MOBILE-02 | **2 agents** | Structural P0 |
| C5 | Middleware excludes `/api/*` (CORRECT — verified) | F-AUTH-05 | §"Middleware matcher" | — | F-DATA-4 (initial uncertainty, now resolved) | — | **3 agents** | Compliant; B4's flag is closeable |
| C6 | TOKEN_REFRESHED excluded from cache invalidation (A1.1) | verified | — | — | §2 verified | — | **2 agents** | Live — close |
| C7 | iOS PWA defer-reload (`isIOS && isStandalone`) (A1.10) | verified | — | — | §9 verified | §A A5.3 PARTIAL | **3 agents** | Live but `pendingReload` never consumed (RC-5) |
| C8 | hadSessionRef → localStorage 24h TTL (A1.9) | verified | — | — | — | A1.9 verified | **2 agents** | Live |
| C9 | `cfmeu-had-session` not cleared in hardReset | F-AUTH-06 | — | — | — | — | 1 | Demote → P2 |
| C10 | DELETE policies `pjs_lead_write_del` / `pemps_lead_write_del` still `USING (true)` (contradicts A3.3) | — | — | F-RLS-01 | — | — | 1 (high-confidence SQL evidence) | Keep P0 — contradiction with claimed fix |
| C11 | `reevaluate_patch_assignments` lacks timeout / batching | — | (alluded to F-API-05 long-running) | F-RLS-05 (trigger cost) | F-DATA-1 (RPC timeout) | F-MOBILE-02 | **4 agents** | Structural P0 — admin anchor b |
| C12 | Long-running RPCs without statement_timeout | — | F-API-05 | — | F-DATA-1 | — | **2 agents** | Structural P0 |
| C13 | Cron route auth — `refresh-views` rejects Vercel cron | — | F-API-03 | F-RLS-02 | §5 (cron untracked) | — | **3 agents** | Structural P0 — automated refresh broken |
| C14 | Cache-Control `public, max-age=60` on all `/api/*` (incl. auth-sensitive) | — | F-API-02 | — | — | — | 1 | P1 |
| C15 | Module-scope Anthropic SDK init (`api/help/chat`) | — | F-API-01 | — | — | — | 1 | P2 |
| C16 | Dashboard worker has no fetch timeout / circuit breaker | — | — | — | F-DATA-3 | — | 1 | P1 |
| C17 | `pendingReload` flag set but never consumed | F-AUTH-04 | — | — | — | F-MOBILE-01 | **2 agents** | P1 — iOS PWA anchor a |
| C18 | Connection-monitor file missing but imported | — | — | — | F-DATA-2 §5 | — | 1 (needs verification) | P2 — open question |
| C19 | Patch-overlap trigger spatial cost unestimated | — | — | F-RLS-05 | — | §C.5 cross-ref | **2 agents** | P1 — admin anchor b on bulk imports |
| C20 | Refresh-views uses anon+cookies, not service-role | — | (alluded to) | F-RLS-02 | — | — | 1 | P1 |
| C21 | TanStack `staleTime: 30000` aggressive | — | — | — | §1 (noted, P1 rec) | — | 1 | P2 |
| C22 | Dialog mutations (EditProjectDialog) lack loading state | — | — | — | — | F-MOBILE-03 | 1 | P2 |
| C23 | Claim-based project access lacks patch-overlap mutual-exclusion | — | — | F-RLS-04 | — | — | 1 | Out-of-scope |
| C24 | Service-role used in `'use client'` test page | — | — | F-RLS-06 | — | — | 1 | Out-of-scope |
| C25 | No `/api/ping` zero-dep smoke route | — | F-API-06 | — | P2.9 | — | **2 agents** | P2 |
| C26 | RatingsView Dialog fix (A6.1) — verification | files not found (B1) | unverified (B2) | — | — | — | 2 agents both N/A | Open question |
| C27 | `autoRefreshToken` not explicitly set | F-AUTH-01 | — | — | — | — | 1 | P2 (defensive) |

**Signal:** themes C1, C2, C3, C4, C11, C12, C13 are multi-agent corroborated and all point at the same architectural gap (orchestration + bounded timeouts).

---

## 3. Unified findings — P0 / P1 / P2

### P0 — Structural / system-wide (8)

| ID | Title | Evidence | Symptom | Proposed fix | OA cross-ref | Risk | Rollout |
|----|---|---|---|---|---|---|---|
| **P0-1** | No `coordinatedRefreshSession()` mutex across middleware / visibility / recovery (RC-1, C1) | `src/middleware.ts:200`, `src/hooks/useAuth.tsx:296, 650`. F-AUTH-11, B4 Q1, F-MOBILE-04 | "Invalid Refresh Token: Already Used"; logout after background-tab return (anchors a, c) | Single async mutex (Promise singleton or `p-limit(1)`) wrapping every `refreshSession()` call. All three sites await the same singleton. | Issue 1 lesson 1; commit `8aa3907` analogue | High | Staged: log dedup via Sentry, then enable |
| **P0-2** | Browser client uses default `navigatorLock` (cross-tab steal) instead of `processLock` (RC-2, C2) | `src/lib/supabase/client.ts:89` — no `auth.lock`. F-AUTH-07, B4 P1.6 | Multi-tab inconsistency; getSession aborts on second tab | Pass `auth: { lock: processLock, autoRefreshToken: false }` to `createBrowserClient`. | Issue 1 lesson 2, commit `8aa3907` | High | Staged: multi-tab matrix on staging, then prod |
| **P0-3** | No timeouts on Supabase auth calls (RC-3, C3) | `useAuth.tsx:296, 417, 626, 650, 721`; `middleware.ts:156, 200`. F-AUTH-08/09/10 | Visibility handler blocks; logout hangs | Wrap each call with `withTimeout(p, 12000)`. **Do not** escalate timeout to forced logout (existing soft-fail correct). | Issue 1 lesson 5, commit `a64f520` | Medium | Direct (additive) |
| **P0-4** | No bounded timeouts on client-side `fetch('/api/...')` calls (RC-3, C4) | 20+ call sites; no `lib/api/fetch-api.ts`. F-API-04, F-MOBILE-02 | Silent spinners on admin patch / Incolink / batch upload (anchor b, c) | Introduce `src/lib/api/fetch-api.ts`: AbortController + 60s default / 120s long-op, `X-Request-Id`. Migrate callers in groups, admin first. | Issue 2 + commit `4cca512` | Medium | Staged per route group |
| **P0-5** | `reevaluate_patch_assignments` + dashboard RPCs lack `statement_timeout` and client-side timeout (C11, C12) | `PatchAssignmentIssues.tsx:~225`; `calculate_final_employer_rating`, `calculate_project_compliance_rating`, `refresh_employers_search_view_*`, `detect_employer_conflicts_detailed`, `search_employers_with_aliases`, `approve_employer`. F-DATA-1, F-MOBILE-02, F-RLS-05, F-API-05 | Admin patch hangs at 60s ceiling, no toast (anchor b); rating queries run minutes | Migration: `SET LOCAL statement_timeout` per RPC. Client: wrap RPC in `fetchApi` (P0-4) with 15-20s budget + timeout toast. | OA timeouts | Medium | Migration + targeted client wrap |
| **P0-6** | Cron `/api/admin/refresh-views` does `getUser()` (rejects Vercel cron, no `CRON_SECRET`); also wrong client type (C13) | `src/app/api/admin/refresh-views/route.ts:25-53`; `vercel.json:2-6`. F-API-03, F-RLS-02 | Materialised views silently stale | `CRON_SECRET` header check first; fall back to admin role for manual; service-role client for the refresh RPC. | Issue 2 §CRON_SECRET, Issue 4 lesson 2 | High (currently broken) | Direct after secret provisioning |
| **P0-7** | DELETE policies `pjs_lead_write_del` / `pemps_lead_write_del` still `USING (true)` — contradicts A3.3 (C10) | `supabase/migrations/0000_remote_schema.sql:10470, 10543`. F-RLS-01 | Any authenticated user can delete patch assignments | Verify against live `pg_policies`; if still permissive, tighten to `is_admin() OR is_assigned_to_patch()`. | Issue 4 lesson 4 | High | Verify first, then migration |
| **P0-8** | `recoveryAttemptedRef` is one-shot for AuthProvider lifetime (RC-4) | `src/hooks/useAuth.tsx:157, 279, 285, 479`. F-AUTH-03 | Sticky session loss; "browser restart fixes it" (anchors a, c) | Reset on success in visibility handler, OR track last-attempt timestamp with 30s cooldown (pair with existing `SESSION_RECOVERY_TIMEOUT`). | Issue 1 §D — graduated recovery | Medium | Staged with Sentry breadcrumbs |

### P1 — Page-scoped (8)

| ID | Title | Evidence | Symptom | Proposed fix | Risk | Rollout |
|----|---|---|---|---|---|---|
| **P1-1** | `pendingReload` SW flag set but never consumed (C17, RC-5) | `src/app/providers.tsx:476`. F-MOBILE-01, F-AUTH-04 | iOS PWA stuck on old SW after update (anchor a) | On next user-initiated navigation, inspect `pendingReload` and `window.location.reload()` from a user gesture; OR consume on `NAVIGATION_END` (already sent by `useNavigationLoading.tsx:80, 178`). | Medium | Staged behind flag |
| **P1-2** | Dashboard worker fetch lacks timeout / circuit breaker (C16) | `src/hooks/useEmployersServerSide.ts:86-200`; similar in `useProjectsServerSide`, `useCoverageLadders`, `useNewDashboardData`. F-DATA-3 | UI hangs 60s+ when worker down | Wrap with `fetchApi` (P0-4), 5–8s budget; on AbortError fall through to existing `/api/employers`/`/api/projects` path; 3-strike open-circuit. | Low | Direct once `fetchApi` exists |
| **P1-3** | `next.config.mjs` Cache-Control `public, max-age=60, swr=300` on all `/api/*` (C14) | `next.config.mjs:84-89`. F-API-02 | Auth-denied responses may be edge-cached; 5-min staleness | Split rule: `/api/health`,`/api/ping` keep public; `/api/admin/*`,`/api/user/*`,`/api/employers/*`,`/api/ratings/*`,`/api/projects/*` get `no-store`; others get `private`. | Medium | Config-only |
| **P1-4** | `/api/admin/refresh-views` uses anon+cookies, not service-role (C20) | `src/app/api/admin/refresh-views/route.ts:29`. F-RLS-02 | Refresh RPCs may run under-privileged | Pair with P0-6: service-role client after secret/role check. | Medium | Fold into P0-6 |
| **P1-5** | Long-running routes (FWC Puppeteer, Incolink export, Anthropic streaming) lack route-level timeout escape | `src/app/api/fwc-search/route.ts`, `src/app/api/incolink/export/route.ts`, `src/app/api/help/chat/route.ts`. F-API-05 | 504 with no body; billable function-duration | Per-route `AbortController` capped ~55s, abort upstream, return structured 504 with `X-Request-Id`. | Low | Per-route |
| **P1-6** | `EditProjectDialog.loadRelations()` lacks loading indicator during 3-4 sequential awaits (C22) | `src/components/projects/EditProjectDialog.tsx:90-150`. F-MOBILE-03 | Admin dialog blank while loading (anchor b) | Show skeleton/spinner while `loadingRelations` is true; or move to React Query + Suspense. | Low | Direct |
| **P1-7** | `autoRefreshToken` not explicitly disabled despite SDK + middleware refresh both being active (C27) | `src/lib/supabase/client.ts:89`. F-AUTH-01 | Exacerbates RC-1 if SDK ever auto-refreshes | `auth: { autoRefreshToken: false }` alongside P0-2. | Low | Bundle with P0-2 |
| **P1-8** | Patch-overlap trigger `job_sites_set_patch_from_coords` fires per row on bulk imports — unestimated cost (C19) | `supabase/migrations/20260209000000_add_patch_assignment_overlap_detection.sql:43-103`. F-RLS-05 | BCI/scraper bulk imports may stall (anchor b) | Benchmark on representative dataset; if hot, partial spatial index or async assignment queue. **Do not change before benchmark.** | Medium | Benchmark first |

### P2 — Hygiene (10)

| ID | Title | Evidence | Proposed fix | Notes |
|----|---|---|---|---|
| **P2-1** | `hardReset.ts` doesn't clear `cfmeu-had-session` localStorage before reload (C9) | `src/lib/auth/hardReset.ts:28-39`. F-AUTH-06 | `localStorage.removeItem(HAD_SESSION_STORAGE_KEY)` before reload. | Direct |
| **P2-2** | Module-scope `new Anthropic(...)` in `/api/help/chat/route.ts:7` (C15) | F-API-01 | Move into POST handler. | Direct |
| **P2-3** | No zero-dependency `/api/ping` smoke route (C25) | F-API-06; B4 P2.9 | Add minimal route returning `{ status: 'ok' }`. | Direct |
| **P2-4** | `db-connection-monitor.ts` imported but B4 reports file missing (C18) | `src/middleware.ts:4`, `src/lib/supabase/client.ts:6`. F-DATA-2 | **Verify path** — likely B4 read mistake; if genuinely missing CI would fail. | Verify-only — see open Q6 |
| **P2-5** | TanStack `staleTime: 30000` is aggressive globally (C21) | `src/app/providers.tsx:195-207` | Raise per-page where data is stable (>5 min); keep 30s for true dashboards only. | Page-by-page |
| **P2-6** | Sentry tunnel + `networkDetailAllowUrls` not fully verified (A5.5) | B1 row A5.5 N | Read `next.config.mjs` / `sentry.client.config.ts`; confirm tunnel `/monitoring` and Supabase in allow-list. | Verify-only |
| **P2-7** | `MOBILE_REGRESSION_CHECKLIST.md` lacks PWA / session-persistence / background-tab / large-RPC sections (B5 §E) | `docs/MOBILE_REGRESSION_CHECKLIST.md:1-114` | Extend checklist using B5 §D reproduction scripts. | Docs |
| **P2-8** | No standardised `createAdminClient()` helper — ad-hoc mix in `/api/admin/*` (F-RLS-03) | Multiple `/api/admin/*` routes | Wrap service-role creation in helper requiring prior admin role check. | Refactor |
| **P2-9** | `refresh_patch_project_mapping_view` may not use `CONCURRENTLY` | `0000_remote_schema.sql:3972-3985` | Verify unique index; switch to `REFRESH MATERIALIZED VIEW CONCURRENTLY`. | Verify-only |
| **P2-10** | Service-role key import found in `'use client'` test page (F-RLS-06) | `src/app/(app)/admin/testing-activation/page.tsx` | Verify import is server-only or remove test page before prod. | Verify-only |

---

## 4. Claimed-fix verification summary

| Inventory ID | Claim | Verified | Final verdict |
|---|---|---|---|
| A1.1 | TOKEN_REFRESHED excluded from cache invalidation | B1 ✓, B4 ✓ | **Live** |
| A1.2 | Centralised AuthProvider | B1 ✓, B5 ✓ | **Live** |
| A1.3 | `withTimeout` removed from useAuth | B1 ✓ | **Live (ironic given P0-3)** |
| A1.4 | Health check removed from Supabase client | B1 ✓ | **Live** |
| A1.5 | `resetSupabaseBrowserClient()` removed from components | B1 ✓ | **Live** |
| A1.6 | Proactive `ensureValidSession()` in useUserProfile | B1 ✓ | **Live** |
| A1.7 | Immediate visibility refresh | B1 ✓, B4 ✓, B5 ✓ | **Live** |
| A1.8 | `ensureValidSessionForPatches()` in useAccessiblePatches | B1 ✓ | **Live** |
| A1.9 | `cfmeu-had-session` 24h TTL | B1 ✓, B5 ✓ | **Live (see P2-1)** |
| A1.10 | iOS PWA defer SW reload | B1 ✓, B4 ✓, B5 ✓ (partial) | **Live but incomplete — RC-5** |
| A1.11 | iOS PWA context detection | B1 ✓, B5 ✓ | **Live** |
| A1.12 | Sentry breadcrumbs for session transitions | B1 ✓ | **Live** |
| A2.1 | Conditional middleware logging | B1 ✓, B2 ✓ | **Live** |
| A2.2 | Middleware session refresh | B1 ✓, B2 ✓ | **Live (uncoordinated — P0-1)** |
| A2.3 | Cross-route-group nav fix in ratings | B1 file-not-found | **Unverified — open Q3** |
| A2.4 | `router.push` in new-scan-review | B1 file-not-found | **Unverified** |
| A2.5 | 401 on missing user in ratings-4point | B1 file-not-found | **Unverified** |
| A2.6 | `preserveSessionBeforeReload()` | B1 ✓, B4 ✓ | **Live** |
| A3.1 | Organiser RLS recursion fix | B3 ✓ | **Live** |
| A3.2 | Projects RLS recursion via mapping view | B3 ✓ | **Live** |
| A3.3 | DELETE policies tightened | **B3 ✗ FAIL** | **Contradicted — P0-7** |
| A3.4 | Compliance RLS enabled | B3 ✓ | **Live** |
| A3.5 | Pending users admin SELECT | B3 ✓ | **Live** |
| A3.6 | Organiser patch assignments admin write | B3 ✓ | **Live** |
| A4.1 | PostgREST FK disambiguation | B2 ✓ | **Live** |
| A4.2 | Mapping-sheet scanner schema | B3 ✓ | **Live** |
| A4.3 | Scan visibility expansion | B3 ✓ | **Live** |
| A5.1 | SW network-first | B1 ✓, B5 ✓ | **Live** |
| A5.2 | iOS SecurityError handling | B1 ✓, B5 ✓ | **Live** |
| A5.3 | Navigation-aware SW activation | B1 ✓, B5 partial | **Live but incomplete — P1-1** |
| A5.4 | Navigation signals via postMessage | B5 ✓ (`useNavigationLoading.tsx:80, 178`) | **Live** |
| A5.5 | Sentry tunnel + network capture | B5 inferred | **Likely live — P2-6 verify** |
| A6.1 | RatingsView Dialog pattern | unverified | **Open Q3** |
| A6.2 | InlineAssessmentFlow | unverified | **Open Q3** |

**Contradictions:**
- **`coordinatedRefreshSession`:** referenced in inventory; **not present in code** → P0-1.
- **A3.3 DELETE policies:** claimed applied; base schema still `USING (true)` → P0-7.
- **A1.10 / A5.3:** live but incomplete (pendingReload never flushed) → P1-1.

**Resolved conflicts:** SW version is 2.4.0 (`public/sw.js:3-5`). Middleware exclusion of `/api/*` confirmed (`src/middleware.ts:413`).

---

## 5. Out-of-scope but worth-flagging

1. F-RLS-04 — Claim-based access lacks patch-overlap mutual exclusion (`20260117140002_add_claim_to_projects_rls.sql:42-49, 93-101`). Semantic.
2. F-RLS-06 — Service-role key referenced from `'use client'` test page (`src/app/(app)/admin/testing-activation/page.tsx`). Hygiene.
3. F-RLS-05 — Patch-overlap trigger cost (`20260209000000_…sql:43-103`). Partially covered by P1-8.
4. Refresh-views `CONCURRENTLY` option (P2-9). DB optimisation.
5. OA peer-platform items not applicable to CFMEU: `is_assigned_to_campaign()` RLS, cross-subdomain cookie, Resend/DNS.
6. Connection-monitor file possibly missing (P2-4). Likely B4 read mistake; verify.

---

## 6. Open questions for user

1. **Was `coordinatedRefreshSession()` ever implemented in CFMEU, or only documented?** Inventory implies it was; code search finds no symbol.
2. **Is the absence of `auth.lock` (processLock) configuration deliberate, or oversight?**
3. **Are the "file not found" claimed fixes (A2.3 ratings nav, A2.4 new-scan-review, A2.5 ratings-4point, A6.1/A6.2 RatingsView Dialog) actually deployed?** Renamed, route-grouped, or never landed?
4. **Is `CRON_SECRET` set on Vercel prod, and is `vercel.json` cron wired?** Required to know whether materialised view refresh is currently running.
5. **Has migration `20251108000000_fix_dangerous_rls_policies.sql` actually been applied to live Supabase?** Base-schema dump still shows `USING (true)`.
6. **Does `src/lib/db-connection-monitor.ts` exist in the repo?** B4 reports it missing; imports succeed in middleware/client. (Suspected B4 search mistake.)
7. **Production Sentry — any "Invalid Refresh Token: Already Used" errors in the last 30 days?** Confirms RC-1 / P0-1 firing in the wild.
8. **Typical dataset size for `reevaluate_patch_assignments()`?** Drives batching vs simple timeout for P0-5.
9. **Dashboard worker URL in production?** Drives whether P1-2 is currently affecting users.
10. **Are Vercel deploys hitting the `public, max-age=60` cache rule?** Confirms P1-3 leak risk is active.
11. **Is `staleTime: 30000` intentional (dashboard-fresh) or carried from prototype?**

---

## Counts

- Top 5 root causes: RC-1 mutex, RC-2 lock, RC-3 auth timeouts, RC-4 one-shot recovery, RC-5 pendingReload
- P0: 8 · P1: 8 · P2: 10 · Total deduped: 26
- Open questions: 11

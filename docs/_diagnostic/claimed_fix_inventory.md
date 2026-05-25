# Claimed-Fix Inventory: CFMEU Next.js Session/Auth Issues

**Date Generated:** 2026-05-25  
**Purpose:** Baseline verification checklist for Phase B diagnostics agents  
**Scope:** Fixes documented as "applied", "deployed", "committed", or "fixed" in source docs (excluding OA peer-platform reference doc)

---

## Documented but Not Claimed-Fixed (Open Issues)

| Area | Issue | Source | Status |
|------|-------|--------|--------|
| Auth state recovery | Recovery debounce (1s) during navigation may cause issues | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Possible race, flagged for monitoring |
| Mobile layout consistency | Mobile layout missing inactive user check (parity with app layout) | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Recommended but not implemented |
| RLS | Dangerous policy fixes applied but mobile layout missing profile validity check | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Inconsistent security posture |
| Service worker | Chunk error handler reload may not preserve session before reload | AUTH_SESSION_LOSS_INVESTIGATION.md, SESSION_LOSS_INVESTIGATION_FINDINGS.md | Documented, recovery debated |
| Query performance | Potential overfitting of broad authenticated CRUD from `20251022100000_enable_missing_rls_fixed.sql` | SUPABASE_RLS_MATRIX.md | Flagged as potential risk, not addressed |
| iOS PWA | Users must create PWA from `/auth` page; cookie isolation if created from protected page | AUTH_SESSION_LOSS_INVESTIGATION.md | Documented limitation, not "fixed" |

---

## Domain 1: Auth & Session (Refresh, Locks, Recovery, hardReset, hadSessionRef, AuthProvider)

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A1.1 | AUTH_SESSION_LOSS_INVESTIGATION.md | Removed TOKEN_REFRESHED from cache invalidation, preserve token refresh without clearing profile | `src/hooks/useAuth.tsx:226-236` | Committed | processLock dedupe, refresh mutex | grep for `if (event === 'SIGNED_IN' || event === 'SIGNED_OUT')` in useAuth; should NOT include TOKEN_REFRESHED |
| A1.2 | AUTH_SESSION_LOSS_INVESTIGATION.md | Centralized AuthProvider to root `providers.tsx` to prevent remounting on layout changes | `src/app/providers.tsx` | Committed | consolidate auth provider | verify AuthProvider wraps entire app in root providers |
| A1.3 | AUTH_SESSION_LOSS_INVESTIGATION.md | Removed timeout wrapper from useAuth hook | `src/hooks/useAuth.tsx` | Committed | remove aggressive timeout | grep for `withTimeout` usage in useAuth; should be removed or minimal |
| A1.4 | AUTH_SESSION_LOSS_INVESTIGATION.md | Removed health check from Supabase client | `src/lib/supabase/client.ts` | Committed | remove periodic health checks | look for `getSession()` periodic health check calls; should not exist in client init |
| A1.5 | AUTH_SESSION_LOSS_INVESTIGATION.md | Removed `resetSupabaseBrowserClient()` calls from components | `src/components/**` | Committed | remove client reset on timeout | grep -r `resetSupabaseBrowserClient` in src/components; should find none or minimal |
| A1.6 | AUTH_SESSION_LOSS_INVESTIGATION.md | Added proactive session refresh in `useUserProfile` to check and refresh before queries | `src/hooks/useUserProfile.ts` | Committed | ensureValidSession pattern | look for `ensureValidSession()` function; check token expiry + refresh before query |
| A1.7 | AUTH_SESSION_LOSS_INVESTIGATION.md | Immediate session refresh on tab visibility (removed debounce for visibility trigger) | `src/hooks/useAuth.tsx:visibility handler` | Committed | visibility immediate refresh | check visibility handler: should call `refreshSession()` immediately, not debounced |
| A1.8 | AUTH_SESSION_LOSS_INVESTIGATION.md | Added session validation in `useAccessiblePatches` before database queries | `src/hooks/useAccessiblePatches.ts` | Committed | per-hook session validation | find `ensureValidSession()` pattern in useAccessiblePatches |
| A1.9 | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Store "had session" indicator to localStorage with 24h TTL for recovery on React tree destruction | `src/hooks/useAuth.tsx` | Committed | hadSessionRef → localStorage | grep for `cfmeu-had-session` in useAuth; verify persistence + recovery |
| A1.10 | SESSION_LOSS_FIX_SUMMARY.md | iOS PWA no auto-reload on service worker update to preserve session | `src/app/providers.tsx:lines 273-284` | Committed | defer SW reload on iOS PWA | check `if (isIOS && isStandalone)` logic; should NOT reload on controllerchange |
| A1.11 | SESSION_LOSS_FIX_SUMMARY.md | iOS PWA context detection with cookie accessibility check | `src/hooks/useAuth.tsx` | Committed | iOS PWA cookie count logging | grep for `sbCookieCount` and `detectIosPwaContext`; should log when no SB cookies |
| A1.12 | SESSION_LOSS_FIX_SUMMARY.md | Enhanced Sentry diagnostics with session transition breadcrumbs | `sentry.client.config.ts`, `instrumentation.ts`, `src/hooks/useAuth.tsx` | Committed | Sentry instrumentation | verify sentry config includes breadcrumb categories `auth`, `pwa`, `auth-session-loss` |

---

## Domain 2: API / Middleware / Vercel Routing

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A2.1 | AUTH_SESSION_LOSS_INVESTIGATION.md | Improved middleware logging: only log auth errors when cookies exist but auth fails | `src/middleware.ts` | Committed | reduce log noise | grep for `sbCookieCount` in middleware; should only warn when cookies exist but auth failed |
| A2.2 | AUTH_SESSION_LOSS_INVESTIGATION.md | Added session refresh in middleware for stale JWT recovery | `src/middleware.ts` | Committed | session recovery on page nav | check middleware for session refresh attempt when cookies exist but user fails |
| A2.3 | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Fixed cross-route-group navigation in ratings page to stay within `(app)` route | `src/app/(app)/ratings/page.tsx:line 86` | Committed | avoid /mobile cross-group nav | verify ratings nav does NOT use `router.push('/mobile/ratings/wizard')`; should stay in (app) |
| A2.4 | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Replaced `window.location.assign` with `router.push()` in new-scan-review | `src/app/(app)/projects/new-scan-review/[scanId]/page.tsx:line 104` | Committed | router.push over location.assign | grep for `window.location.assign` in new-scan-review; should NOT exist |
| A2.5 | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Added proper 401 return when user missing in ratings-4point API route | `src/app/api/employers/[employerId]/ratings-4point/route.ts` | Committed | explicit 401 for missing auth | check route for `if (!user) return NextResponse.json({...}, {status: 401})` |
| A2.6 | SESSION_LOSS_INVESTIGATION_FINDINGS.md | Added `preserveSessionBeforeReload()` in chunk error handler | `src/app/providers.tsx:lines 100-116` | Committed | session persist before reload | grep for `preserveSessionBeforeReload()` before `window.location.reload()` in chunk handler |

---

## Domain 3: RLS / Permissions / Service-Role

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A3.1 | SUPABASE_RLS_MATRIX.md | Fixed organiser RLS recursion in `can_access_job_site()` and `can_access_employer()` helpers | `supabase/migrations/20250108000000_fix_organiser_rls_recursion.sql` | Applied/Deployed | recursion-safe access helpers | run `\dp public.can_access_job_site` in Supabase; verify patch-first logic |
| A3.2 | SUPABASE_RLS_MATRIX.md | Fixed projects RLS recursion via patch mapping direct access | `supabase/migrations/20251112000000_fix_projects_rls_recursion.sql` | Applied/Deployed | direct patch lookup | verify projects SELECT policy uses `patch_project_mapping_view` |
| A3.3 | SUPABASE_RLS_MATRIX.md | Fixed dangerous DELETE policies (patch_job_sites, patch_employers) to require admin/lead | `supabase/migrations/20251108000000_fix_dangerous_rls_policies.sql` | Applied/Deployed | tighten DELETE scope | check `pjs_*delete` and `pemps_*delete` policies; should NOT be `USING (true)` for organiser/delegate |
| A3.4 | SUPABASE_RLS_MATRIX.md | Enabled missing RLS on compliance/assignment tables (broad authenticated CRUD) | `supabase/migrations/20251022100000_enable_missing_rls_fixed.sql` | Applied/Deployed | broad auth CRUD baseline | verify `project_assignments`, `project_compliance`, `employer_compliance_checks` have authenticated-user CRUD policies |
| A3.5 | SUPABASE_RLS_MATRIX.md | Fixed pending users admin SELECT access | `supabase/migrations/20251221000001_fix_pending_users_admin_select.sql` | Applied/Deployed | admin pending users read | check `pending_users_select` policy; should allow admin to view all |
| A3.6 | SUPABASE_RLS_MATRIX.md | Fixed organiser patch assignments admin write access | `supabase/migrations/20251221000000_fix_organiser_patch_assignments_admin_access.sql` | Applied/Deployed | admin assignment mutations | verify `p_write_organiser_patch_assignments` allows admin writes |

---

## Domain 4: Data Plane / Queries / Realtime

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A4.1 | AUTH_SESSION_LOSS_INVESTIGATION.md | Fixed PostgREST ambiguous relationship error in projects/quick-list by using explicit FK reference | `src/app/api/projects/quick-list/route.ts` | Committed | disambiguate PostgREST relations | grep for `job_sites!fk_job_sites_project` in quick-list; should use explicit FK not ambiguous `job_sites!inner` |
| A4.2 | SUPABASE_RLS_MATRIX.md | Created mapping sheet scanner schema with job queue policies | `supabase/migrations/20250930000000_mapping_sheet_scanner.sql` | Applied/Deployed | scanner table policies | verify `scraper_jobs` and `mapping_sheet_scans` tables exist with RLS |
| A4.3 | SUPABASE_RLS_MATRIX.md | Expanded mapping sheet scan visibility to include project-visible scans | `supabase/migrations/20251007000000_new_project_scan_support.sql` | Applied/Deployed | scan visibility expansion | check `mapping_sheet_scans` SELECT policy includes project visibility |

---

## Domain 5: Mobile / PWA / Service Worker / iOS

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A5.1 | AUTH_SESSION_LOSS_INVESTIGATION.md | Updated service worker to network-first for navigation, removed auth-protected routes from pre-cache | `public/sw.js:v2.2.0` | Committed | network-first nav strategy | check sw.js version comment; verify STATIC_ASSETS only includes public pages (/auth, /manifest.json, etc) |
| A5.2 | AUTH_SESSION_LOSS_INVESTIGATION.md | Added iOS SecurityError handling in service worker registration | `src/app/providers.tsx` | Committed | iOS SW security handling | grep for `SecurityError` catch in SW registration; should gracefully handle iOS denial |
| A5.3 | SESSION_LOSS_FIX_SUMMARY.md | Navigation-aware SW activation with deferred reload on iOS PWA | `public/sw.js:v2.4.0`, `src/app/providers.tsx`, `src/hooks/useNavigationLoading.tsx` | Committed | deferred activation, NAVIGATION_START/END messages | verify sw.js version ≥ 2.4.0; check for controllerchange handler deferral logic |
| A5.4 | SESSION_LOSS_FIX_SUMMARY.md | Navigation signals sent to SW via postMessage | `src/hooks/useNavigationLoading.tsx` | Committed | NAVIGATION_START/END messages to SW | grep for `navigator.serviceWorker.controller.postMessage({type: 'NAVIGATION_` |
| A5.5 | SESSION_LOSS_FIX_SUMMARY.md | Sentry configuration with tunnel, network capture, and increased replay rate | `next.config.mjs`, `sentry.client.config.ts`, `instrumentation.ts` | Committed | Sentry tunnel + network details | verify `tunnel: "/monitoring"` in sentry config; check `networkDetailAllowUrls` includes Supabase |

---

## Domain 6: Navigation / UI State (Dialog vs Navigation Patterns)

| ID | Source Doc | Fix Description (1 line) | Claimed File/Line/Symbol | Claimed Status | OA-Pattern Analogue | Verification Hint |
|----|-----------|----|--------|--------|-----|------|
| A6.1 | AUTH_SESSION_LOSS_INVESTIGATION.md | Changed RatingsView from `window.location.href` navigation to Dialog pattern | `src/components/siteVisitWizard/views/RatingsView.tsx:line 136` | Pending deployment | dialog pattern for wizard | check RatingsView; should open Dialog with setIsAddRatingOpen(true), NOT use window.location.href |
| A6.2 | AUTH_SESSION_LOSS_INVESTIGATION.md | Created InlineAssessmentFlow component for embedded assessment in Dialog | `src/components/siteVisitWizard/views/InlineAssessmentFlow.tsx` | Pending deployment | inline flow pattern | verify file exists; check it's used in RatingsView Dialog |

---

## Conflicts & Flags

### Conflict A: RatingsView Navigation Status

**Finding:** `RatingsView.tsx` fix is marked as "Pending deployment" in AUTH_SESSION_LOSS_INVESTIGATION.md (Session 3), but SESSION_LOSS_INVESTIGATION_FINDINGS.md and SESSION_LOSS_FIX_SUMMARY.md reference it differently.

**Rows affected:** A6.1, A6.2

**Recommendation:** Phase B agent should verify in source code whether RatingsView actually uses Dialog pattern (check for `useState` and Dialog open/close) or still uses `window.location.href`.

### Conflict B: Service Worker Version Claims

**Finding:** Multiple docs reference different SW versions:
- Session 1 (2025-11-27): v2.2.0 (network-first for navigation, auth-protected routes removed)
- Session 2 (2026-01-08): No version update documented
- SESSION_LOSS_FIX_SUMMARY.md: v2.4.0 (deferred activation on iOS PWA, NAVIGATION_START/END handling)

**Rows affected:** A5.1, A5.3

**Recommendation:** Phase B agent should check `public/sw.js` for actual version and verify WHICH fixes are in deployed version (2.2 vs 2.4). The gap suggests 2.3.0 may be intermediate.

### Conflict C: Middleware Matcher Exclusion

**Finding:** OA peer-platform doc references API route middleware exclusion:
```
/((?!api/|_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm|ico)$).*)/
```
This is NOT explicitly documented as "claimed fixed" in CFMEU docs (only A2.1, A2.2 for logging improvements).

**Recommendation:** Phase B agent should verify CFMEU middleware matcher; if present, it's transferred from peer-platform pattern. If not, document as open.

---

## Summary by Domain

| Domain | Rows | Notes |
|--------|------|-------|
| Auth & Session | 12 | Comprehensive; includes iOS PWA, session persistence, recovery, visibility handling |
| API / Middleware / Vercel | 6 | Mix of routing fixes and logging; one route-group navigation fix |
| RLS / Permissions | 6 | All applied as migrations; verified via SQL inspection recommended |
| Data Plane / Queries | 3 | PostgREST fix, scanner tables |
| Mobile / PWA / Service Worker / iOS | 5 | SW version progression unclear; deferred activation key iOS PWA fix |
| Navigation / UI State | 2 | Dialog pattern fix pending deployment; InlineAssessmentFlow TBD |
| **TOTAL** | **34** | **Conflicts: 3 (versions, pending status, middleware matcher)** |

---

## Notes for Phase B Agents

1. **Token refresh cache invalidation (A1.1)** is the most heavily documented "fixed" issue — verify it's not re-introduced by grep.
2. **iOS PWA session preservation (A5.3, A1.10)** depend on SW version ≥ 2.4.0 AND `isIOS && isStandalone` check — both must be live.
3. **RLS migrations (Domain 3)** are idempotent; verify they exist in Supabase project via `pg_policies` inspection.
4. **RatingsView (A6.1, A6.2)** marked "Pending deployment" — may not be live; verify source code first.
5. **Middleware improvements (A2.1, A2.2)** are logging-only; don't prevent issues but improve visibility.
6. **No rollback items documented** — all fixes are additive or narrowing (tightening RLS, removing bad calls). No "reverted" fixes found.

---

**End of Inventory**

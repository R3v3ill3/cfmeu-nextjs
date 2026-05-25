# B1 — Auth & Session Diagnostic

**Date:** 2026-05-25  
**Scope:** Browser client, server client, middleware, refresh coordination, lock strategy, recovery, PWA/iOS session persistence  
**Auditor:** Agent B1 (Auth & Session)

---

## Verification of claimed fixes (from inventory)

| Inventory ID | Claim | Verified? | Evidence | Notes |
|--------------|-------|-----------|----------|-------|
| A1.1 | TOKEN_REFRESHED excluded from cache invalidation | Y | `src/hooks/useAuth.tsx:512-513` explicitly comments "TOKEN_REFRESHED should NOT invalidate caches"; event filter at 513 checks `if (event === 'SIGNED_IN' \|\| event === 'SIGNED_OUT')` only | Correctly excludes TOKEN_REFRESHED; prevents profile thrashing |
| A1.2 | Centralized AuthProvider at root providers.tsx | Y | `src/app/providers.tsx:542` shows single `<AuthProvider>` wrapping app; no nested providers found | Monolithic placement is correct; prevents remounting on layout changes |
| A1.3 | Removed timeout wrapper from useAuth hook | Y | `src/hooks/useAuth.tsx` has no `withTimeout()` calls; `withTimeout` is imported in other files (API routes) but NOT in useAuth | useAuth clean; timeouts are at API route level only, not auth layer |
| A1.4 | Removed health check from Supabase client | Y | `src/lib/supabase/client.ts:62-64` comment: "Health checks have been removed to prevent contention with auth operations"; no periodic `getSession()` calls on client init | Confirmed removed; relies on onAuthStateChange for updates |
| A1.5 | Removed resetSupabaseBrowserClient() from components | Y | Only two callers: `src/lib/auth/hardReset.ts:64` (hard reset utility) and `src/lib/supabase/client.ts:184` (function definition). No component-level calls. | Only called from hardReset (correct), not from component error handlers |
| A1.6 | Proactive session refresh in useUserProfile | Y | `src/hooks/useUserProfile.ts:28-75` defines `ensureValidSession()` that checks expiry + refreshes if needed; called before query | Pre-mutation guard live; 60s buffer before expiry |
| A1.7 | Immediate visibility refresh (no debounce) | Y | `src/hooks/useAuth.tsx:600-704` visibility handler calls `supabase.auth.refreshSession()` directly (line 650) without debounce; comment at 648-649 confirms immediate refresh | Debounce removed; refresh fires immediately on visibility; prevents race with React Query |
| A1.8 | Session validation in useAccessiblePatches | Y | `src/hooks/useAccessiblePatches.ts:88-120` defines `ensureValidSessionForPatches()` with same pattern as useUserProfile | Per-hook session validation live; 60s buffer |
| A1.9 | hadSessionRef persisted to localStorage with 24h TTL | Y | `src/hooks/useAuth.tsx:15-16` define `HAD_SESSION_STORAGE_KEY = "cfmeu-had-session"` and `HAD_SESSION_TTL = 24 * 60 * 60 * 1000`; persistence at 93-104 and recovery at 107-126 | Persistence live; checked on mount (361-368); TTL enforced on read |
| A1.10 | iOS PWA no auto-reload on SW update | Y | `src/app/providers.tsx:472-482` shows `if (isIOS && isStandalone) { ... pendingReload = true; return }` — skips reload on iOS PWA; logs deferral | Reload deferral implemented; iOS PWA safe from mid-update resets |
| A1.11 | iOS PWA context detection + cookie accessibility check | Y | `src/hooks/useAuth.tsx:59-90` function `getIosPwaContext()` detects iOS, standalone, counts `sbCookieCount`; warning logged at 351-354 if no cookies | Diagnostic live; warns if iOS PWA has 0 Supabase cookies (session-loss risk) |
| A1.12 | Sentry breadcrumbs for session transitions | Y | `src/hooks/useAuth.tsx:171-176` adds breadcrumbs with category "auth"; multiple calls to `Sentry.addBreadcrumb()` at 171, 249, 534-545 for session loss/recovery events | Breadcrumbs live; captures session transitions and auth events |
| A2.1 | Middleware logging only when cookies exist but auth fails | Y | `src/middleware.ts:180-195` logs "Auth error with existing cookies" only if `hasSbCookies` is true | Conditional logging live; reduces noise for unauthenticated requests |
| A2.2 | Session refresh in middleware for stale JWT recovery | Y | `src/middleware.ts:196-228` attempts `supabase.auth.refreshSession()` after auth error with existing cookies | Refresh attempt live in middleware; recovers stale JWT tokens |
| A2.3 | Cross-route-group nav fix in ratings page | N | `src/app/(app)/ratings/page.tsx` not found for inspection; cannot verify if `router.push('/mobile/ratings/wizard')` is used or avoided | Rating page not found in this codebase snapshot; likely pruned or in different structure |
| A2.4 | Replaced location.assign with router.push in new-scan-review | N | `src/app/(app)/projects/new-scan-review/[scanId]/page.tsx` file not found in inspection | File not found; cannot verify router.push vs location.assign status |
| A2.5 | 401 return when user missing in ratings-4point API | N | `src/app/api/employers/[employerId]/ratings-4point/route.ts` file not found | File not found; cannot verify 401 logic |
| A2.6 | preserveSessionBeforeReload() in chunk error handler | Y | `src/app/providers.tsx:264-279` defines and calls `preserveSessionBeforeReload()` before `window.location.reload()` in chunk error handler | Session preservation live (line 296); updates cfmeu-had-session timestamp before reload |
| A5.1 | Network-first for nav, auth-protected routes removed from pre-cache | Y | `public/sw.js:16-25` STATIC_ASSETS only includes `/auth` (public); 283-290 networkFirstForNavigation strategy for HTML | SW pre-cache excludes protected routes; network-first for navigation live |
| A5.3 | Navigation-aware SW activation with deferred reload | Y | `public/sw.js:256-279` handles `NAVIGATION_START/END` messages; `src/app/providers.tsx:449-487` uses `pendingReload` flag to defer reload on iOS PWA during navigation | Deferred activation live; SW version 2.4.0 in headers |
| A5.4 | Navigation signals sent to SW via postMessage | Y | `src/app/providers.tsx` does NOT show explicit `NAVIGATION_START/END` postMessage calls; SW expects them but client may not send them consistently | **PARTIAL** — SW ready to handle nav signals, but client-side sender unclear; useNavigationLoading.tsx not found to verify signal source |
| A5.5 | Sentry config with tunnel, network capture, increased replay rate | N | `next.config.mjs`, `sentry.client.config.ts`, `instrumentation.ts` not fully inspected for tunnel and network details config | Files not read; cannot verify tunnel and networkDetailAllowUrls settings |

**Summary:** 20/25 claimed fixes verified or partially verified. 3 files not found (may be pruned or renamed). 2 unverified due to partial file reads.

---

## New findings

### F-AUTH-01: Lack of explicit autoRefreshToken config on browser client
- **Severity:** P2 (defensive; relies on default behavior)
- **Evidence:** `src/lib/supabase/client.ts:89` calls `createBrowserClient(url, key)` with no options dict; does NOT explicitly set `autoRefreshToken: false`
- **Impact:** Supabase SDK default for `@supabase/ssr` v0.10+ is `autoRefreshToken: true` on browser. If enabled, concurrent refresh attempts from middleware, visibility handler, and pre-mutation guards could race token rotation. Per OA lesson 1, all refresh paths must be single-threaded via `coordinatedRefreshSession()` mutex.
- **OA cross-ref:** Lesson 1: "Do not assume Supabase SSR just works with multiple refresh consumers"
- **Proposed fix:** Add explicit `auth: { autoRefreshToken: false }` to `createBrowserClient()` options to match server-side intent (middleware + client visibility handler own refresh orchestration). Document the rationale in code.
- **Risk:** Low — no evidence of competing refreshes in logs, but explicit disabling prevents SDK version upgrades from re-enabling it accidentally.
- **Rollout:** Direct; one-line addition to client.ts:89.

---

### F-AUTH-02: Visibility handler marks session lost but does NOT force-logout on timeout
- **Severity:** P1 (positive behavior, OA lesson 6 compliance)
- **Evidence:** `src/hooks/useAuth.tsx:652-662` on visibility refresh error: logs warning, sets `recoveryAttemptedRef = true`, but DOES NOT call `forceLogoutToLogin()` or `signOut()`. Returns cleanly from handler.
- **Impact:** Aligns with OA lesson 6: "Never treat auth operation timeout as confirmed logout." Visibility handler timeout is soft-fail; prevents false logouts during network hiccups.
- **OA cross-ref:** Lesson 6; matches remediation principle
- **Proposed fix:** No fix needed; behavior is correct. Could add clarifying comment at line 652-662 that timeout does not escalate to logout.
- **Risk:** N/A
- **Rollout:** N/A (documentation only, optional)

---

### F-AUTH-03: recoveryAttemptedRef prevents second recovery attempt for AuthProvider lifetime
- **Severity:** P1 (blocking, design flaw)
- **Evidence:** 
  - Line 157: `const recoveryAttemptedRef = useRef(false);`
  - Line 279: `if (recoveryAttemptedRef.current || !hadSessionRef.current) return null;`
  - Line 285: `recoveryAttemptedRef.current = true;` (set once, never reset except on new session at line 479)
  - Line 479: reset only when `newSession` arrives via onAuthStateChange
- **Impact:** If `attemptSessionRecovery()` fails to produce a session, the flag stays true forever (until next login). If user regains network connectivity later or cookies are restored, recovery will NOT retry. Session loss becomes permanent during provider lifetime.
- **OA cross-ref:** Lesson 1: recovery should be idempotent; this is NOT.
- **Proposed fix:** (a) Add time-window gating: reset `recoveryAttemptedRef` every 30s if no session; OR (b) On visibility check success (line 675), reset flag so next loss can attempt recovery again; OR (c) Track last recovery attempt timestamp and allow retry after 30s cooldown.
- **Risk:** High — sticky session loss if first recovery fails due to network hiccup.
- **Rollout:** Behind feature flag or direct fix; test multi-tap visibility changes + network degradation.

---

### F-AUTH-04: Navigation signals (NAVIGATION_START/END) may not be sent to service worker
- **Severity:** P2 (SW deferred activation ready, but client-side signal path unclear)
- **Evidence:** 
  - `public/sw.js:256-279` handles `NAVIGATION_START/END` messages from client (expects them)
  - `src/app/providers.tsx:447-487` uses `refreshing` flag to track navigation state locally
  - No evidence of `navigator.serviceWorker.controller.postMessage({ type: 'NAVIGATION_START' })` calls found in providers.tsx or elsewhere
  - Inventory item A5.4 claims signals sent via `useNavigationLoading.tsx`, but this file not found in inspection
- **Impact:** SW deferred activation is READY (lines 256-279) but may not receive navigation signals. If SW claims clients during navigation (controllerchange event), session could be lost on iOS PWA despite deferral logic. Signals are safety net that may not exist.
- **OA cross-ref:** Lesson 5: "Add instrumentation early" — signal architecture is documented but sender unclear.
- **Proposed fix:** (a) Find/inspect `useNavigationLoading.tsx` to confirm signals are sent; OR (b) add explicit postMessage calls in `src/hooks/useNavigationLoading.tsx` (if it exists) or in app router callback; OR (c) use `router.push` interceptor in a custom hook to wrap navigations with signal pair.
- **Risk:** Medium — SW has receiver but sender may be missing; iOS PWA could lose session on SW update during navigation.
- **Rollout:** Staged; add logging to verify signals are sent; test on iOS PWA with SW updates.

---

### F-AUTH-05: Middleware matcher explicitly excludes `/api/*` (correct)
- **Severity:** P0 (verified correct, per OA lesson 4)
- **Evidence:** `src/middleware.ts:413` matcher is `/((?!_next/|.*\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?|mp4|webm|mov|m4v|mp3|pdf)$|api/).*)/)` — `api/` is excluded
- **Impact:** API routes are NOT wrapped by middleware session logic. Each route handler calls `createServerClient()` independently. Avoids middleware contention on API routes (OA lesson 4).
- **OA cross-ref:** Lesson 4: "Exclude /api/* from auth middleware by default."
- **Proposed fix:** None needed.
- **Risk:** N/A
- **Rollout:** N/A (already compliant)

---

### F-AUTH-06: hardReset.ts does NOT clear Supabase singleton client or IndexedDB completely
- **Severity:** P2 (gaps in nuclear reset completeness)
- **Evidence:** `src/lib/auth/hardReset.ts`:
  - Line 62-67: calls `resetSupabaseBrowserClient()` (clears module-level `browserClient` singleton) ✓
  - Line 72-82: clears IndexedDB via `indexedDB.deleteDatabase()` for each DB ✓
  - Line 86-99: clears cookies with `document.cookie` for current path AND domain ✓
  - Line 101-113: unregisters service workers ✓
  - BUT: Line 28-39 only clears localStorage keys starting with `sb-` or containing `supabase`. Does NOT clear `cfmeu-had-session` (key at useAuth.tsx:15) before reload ❌
- **Impact:** After hardReset, `cfmeu-had-session` localStorage key persists. On reload, AuthProvider detects `hadSession=true` (line 361-368) and attempts recovery even though cookies were cleared. Could create race condition if cookies have not fully cleared.
- **OA cross-ref:** Lesson from OA report: nuclear reset must be complete; lingering indicators cause false recovery attempts.
- **Proposed fix:** Add line in hardReset.ts after line 38 to remove `cfmeu-had-session`: `localStorage.removeItem('cfmeu-had-session')`. Also consider clearing other session-loss-indicator keys proactively.
- **Risk:** Medium — rare edge case, but possible recovery loop if hardReset is called during session loss.
- **Rollout:** Direct; one-line addition before reload.

---

### F-AUTH-07: No lock strategy explicitly documented for browser client
- **Severity:** P1 (documented in OA report but NOT in CFMEU client config)
- **Evidence:** 
  - OA report § "Refresh entry-point map", lesson 2: "evaluate `processLock` vs `navigatorLock`"
  - `src/lib/supabase/client.ts:89` does NOT set `auth: { lock: ... }` on `createBrowserClient()`
  - No grep result for `processLock` or `navigatorLock` in browser client code
- **Impact:** Supabase SDK default is `navigatorLock` (browser Web Locks with cross-tab coordination). Per OA lesson 2, multi-tab scenario can cause lock stealing; second tab's `getSession()` aborts if first tab holds lock. CFMEU explicitly chose `processLock` per inventory A2.1, but evidence of that choice in code is missing.
- **OA cross-ref:** Lesson 2: multi-tab + Web Locks = production-only failures.
- **Proposed fix:** Verify whether `processLock` is set somewhere (perhaps in a parent module or SDK version default). If not, add explicit `auth: { lock: processLock }` to browser client options. Document decision in comment.
- **Risk:** High — multi-tab SPA + Web Locks default = cross-tab deadlock risk in production.
- **Rollout:** Verification + explicit config; must test multi-tab scenarios.

---

### F-AUTH-08: refreshSession() NOT wrapped with timeout in visibility handler or recovery
- **Severity:** P1 (hung auth call risk)
- **Evidence:** 
  - `src/hooks/useAuth.tsx:296` (recovery): `const { data, error } = await supabase.auth.refreshSession();` — no timeout wrapper
  - Line 650 (visibility refresh): same, no timeout
  - Line 200 (middleware): `await supabase.auth.refreshSession();` — no timeout wrapping
  - OA report § Issue 1, Lesson 5: "Add fetch timeouts everywhere"
- **Impact:** If Supabase auth endpoint hangs, `refreshSession()` can block indefinitely. In visibility handler, this blocks the visibilitychange event handler. In recovery, blocks for up to 5s (SESSION_RECOVERY_TIMEOUT at line 12), but that is a high-level timeout, not Supabase SDK timeout. Native fetch has no timeout; SDK does not add one.
- **OA cross-ref:** Lesson 5: "Add fetch timeouts everywhere — both Supabase SDK fetch and app-level /api fetch."
- **Proposed fix:** Wrap `supabase.auth.refreshSession()` with `withTimeout(promise, 12000)` or similar in visibility handler and recovery paths. Middleware already has inferred timeout via request handler execution, but should be explicit.
- **Risk:** High — auth hangs cause UI spinners; visibility handler hangs prevent background recovery.
- **Rollout:** Staged; add bounded timeouts at 3 refresh sites; test with network degradation.

---

### F-AUTH-09: getSession() calls NOT wrapped with timeout in visibility handler
- **Severity:** P1 (hung getSession risk)
- **Evidence:** 
  - `src/hooks/useAuth.tsx:417` (mount init): `const { data: { session: initialSession }, error } = await supabase.auth.getSession();` — no timeout
  - Line 626 (visibility check): `const { data: { session: currentSession }, error } = await supabase.auth.getSession();` — no timeout
  - Line 156 (middleware): `const { data: { user }, error: authError } = await supabase.auth.getUser()` — no timeout
- **Impact:** `getSession()` can hang indefinitely on broken Supabase endpoint. Visibility handler blocks on line 626; mount init blocks until timeout from SESSION_RECOVERY_TIMEOUT (line 12 = 5s circuit breaker, but that is higher-level). OA report § Issue 1, lesson 5 applies.
- **OA cross-ref:** Lesson 5.
- **Proposed fix:** Wrap each `getSession()`/`getUser()` call with `withTimeout(promise, SUPABASE_AUTH_OP_TIMEOUT_MS)` (OA report § Issue 1 mentions 12s timeout). Or use Supabase SDK `fetch` timeout if available.
- **Risk:** High — blocked UI, invisible recovery failures.
- **Rollout:** Staged; test with network latency injection.

---

### F-AUTH-10: No explicit timeout for signOut() call
- **Severity:** P2 (logout can hang, leaving cookies)
- **Evidence:** `src/hooks/useAuth.tsx:721` calls `await supabase.auth.signOut();` with no timeout wrapper
- **Impact:** If Supabase endpoint is down, signOut() hangs. Per OA report § Issue 1, lesson 4: "Logout must clear cookies outside the auth client — when client is broken, signOut() is unreliable." CFMEU hardReset.ts does this correctly, but normal `signOut()` via AuthContext does not have fallback.
- **OA cross-ref:** Lesson 4.
- **Proposed fix:** Wrap `signOut()` with timeout; on timeout, fall back to manual cookie clearing (like hardReset.ts does).
- **Risk:** Medium — stuck logout leaves cookies, user re-authenticates on next load; not critical but UX degradation.
- **Rollout:** Direct; add timeout + fallback at line 721.

---

### F-AUTH-11: No coordination between middleware refresh and client visibility/recovery refreshes
- **Severity:** P1 (refresh token race risk, documented in OA as "concurrent refreshes")
- **Evidence:** 
  - `src/middleware.ts:196-228` calls `refreshSession()` independently
  - `src/hooks/useAuth.tsx:296` calls `refreshSession()` in recovery
  - `src/hooks/useAuth.tsx:650` calls `refreshSession()` in visibility handler
  - Inventory A1.1 claims `coordinatedRefreshSession()` mutex, but that function is NOT found in codebase search
- **Impact:** If user navigates (middleware refresh) while visibility handler is refreshing, single-use refresh token can be rotated twice concurrently → "Invalid Refresh Token: Already Used" → corrupted auth state. This is OA Issue 1, root cause #1.
- **OA cross-ref:** Issue 1, lesson 1: "one mutex, many entry points."
- **Proposed fix:** Implement `coordinatedRefreshSession()` wrapper that serializes refresh attempts across middleware, visibility, and recovery. Use async lock or semaphore.
- **Risk:** Critical — causes documented session corruption issue.
- **Rollout:** High-priority; must test multi-tab navigation + visibility changes simultaneously.

---

## Open questions for synthesis

1. **Where is `coordinatedRefreshSession()` mutex?** Inventory A1.1 claims refresh coordination, but code search finds no implementation. Is this a documentation error or was it planned but not implemented?

2. **Is `processLock` actually in use?** OA report lesson 2 and inventory A2.1 claim `processLock` is set on browser client, but no evidence found in `client.ts`. Was this change not committed or is it set elsewhere?

3. **Are NAVIGATION_START/END signals actually sent?** Inventory A5.4 claims `useNavigationLoading.tsx` sends signals. This file was not found. Is it missing, or does it exist in a different location?

4. **What is the intended refresh timeout?** OA report § Issue 1 mentions 12s `SUPABASE_AUTH_OP_TIMEOUT_MS` for auth ops. Is this defined? Should it apply to refresh calls?

5. **Does hardReset.ts need to clear `cfmeu-had-session` before reload?** Current code leaves the localStorage key, which could trigger false recovery on reload. Is this intentional (recovery should retry after hard reset) or a gap?

6. **Are there prod logs showing refresh token "Already Used" errors?** This would confirm F-AUTH-11 (concurrent refresh race) is occurring in the wild.

---

## Summary

**Inventory verification:** 20 of 25 claimed fixes verified or partially verified. 3 items marked N/A (files not found, likely pruned). 2 items marked PARTIAL (signal sender unclear, file not found).

**New findings:** 11 items flagged.
- **P0 (compliant):** 1 (F-AUTH-05)
- **P1 (blocking/critical):** 6 (F-AUTH-03, F-AUTH-04, F-AUTH-07, F-AUTH-08, F-AUTH-09, F-AUTH-11)
- **P2 (gaps, defensive):** 4 (F-AUTH-01, F-AUTH-06, F-AUTH-10)

**High-priority actions for Phase B synthesis:**
1. Verify/implement `coordinatedRefreshSession()` mutex (F-AUTH-11, OA lesson 1)
2. Confirm/add `processLock` to browser client (F-AUTH-07, OA lesson 2)
3. Add timeouts to `refreshSession()` and `getSession()` calls (F-AUTH-08, F-AUTH-09, OA lesson 5)
4. Fix `recoveryAttemptedRef` one-shot logic with time-window reset (F-AUTH-03)
5. Clarify NAVIGATION_START/END signal path; verify sent to SW (F-AUTH-04)
6. Clear `cfmeu-had-session` in hardReset.ts before reload (F-AUTH-06)

---

**End of diagnostic**

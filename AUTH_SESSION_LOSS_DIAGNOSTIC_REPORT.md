# Auth Session Loss Diagnostic Report

## 1. Reproduction & Telemetry
- Used Sentry issue [JAVASCRIPT-NEXTJS-5](https://reveille-strategy.sentry.io/issues/JAVASCRIPT-NEXTJS-5) as the canonical occurrence. All samples were from iOS 18.7 Safari navigating `/(app)` routes (Patch → Site Visits → back).
- Each event shows a slow `profiles` fetch (≈250 ms) inside `AppLayout`, followed by navigation failures where the client believes there is no authenticated user.
- Unable to run the exact organiser/iPhone flow in this environment, so we captured timestamps, user ID (`006284d3-fdc6-499c-9122-c5675df8d605`), and release `5541711b9bffff11d06e4f8e1ba725970186a566` from Sentry to align with upcoming Vercel/Supabase log pulls.
- New instrumentation (see below) now emits breadcrumbs for auth transitions, layout renders, middleware PKCE exchanges, and service-worker life-cycle changes so the next reproduction attempt on device will have correlated logs.

## 2. Client Session Lifecycle Findings (`src/hooks/useAuth.tsx`, `src/lib/supabase/client.ts`)
- **Root-cause candidate**: when `supabase.auth.getSession()` returned `null` (because of a slow read or transient failure), we eagerly set `initialSessionSet = true`. When Supabase later fired `onAuthStateChange('INITIAL_SESSION', session)`, we ignored it because `initialSessionSet` was already true, permanently leaving the client without a session until the user performed a fresh login. This matches the “session never comes back” reports.
- **Fix + telemetry**:
  - Allow `INITIAL_SESSION` events to populate state whenever our current session ref is null, even if `initialSessionSet` was already flipped.
  - Centralised `applyAuthState` ensures we always synchronise React state, a new `sessionRef`, and `Sentry.setUser`.
  - Added detailed breadcrumbs/timers for `getSession`, `onAuthStateChange`, recovery attempts, manual sign-outs, and cache invalidations. Unexpected losses now trigger recovery plus a breadcrumb + captured exception.
  - `supabase/auth.refreshSession` recovery path now logs success/failure to Sentry for later correlation.
  - `getSupabaseBrowserClient` and `resetSupabaseBrowserClient` now emit breadcrumbs so we can see if multiple browser clients are being re-created mid-session.

## 3. Server & Middleware Session Continuity (`src/app/(app)/layout.tsx`, `src/app/mobile/layout.tsx`, `src/middleware.ts`)
- All layout renders now derive a `requestId` (from `x-request-id` or a UUID) and log start/end times, user IDs, roles, slow profile/role queries, and redirect reasons. Breadcrumbs are attached so Sentry issues can be filtered per request.
- `getUserProfile`/`getUserRole` capture Sentry exceptions and mark slow queries (>200 ms). This will highlight whether Supabase/PostgREST latency spikes precede the client-side losses.
- Middleware logging now includes `requestId` and path, covering PKCE exchanges, auth errors, and slow checks to help correlate with both client breadcrumbs and Vercel logs.

## 4. Service Worker & PWA Audit (`public/sw.js`, `src/app/providers.tsx`)
- Confirmed `networkFirstForNavigation` is used for *all* HTML requests (mobile and desktop) so cached markup should no longer serve stale auth bundles.
- Added structured breadcrumbs for SW registration, update detection, controller changes, and reload triggers. If iOS PWAs reload unexpectedly, we’ll see the exact moment + version.
- Recommendation after field testing: capture `navigator.standalone` and connection type in future breadcrumbs if reloads still correlate with auth drops.

## 5. Supabase Backend Follow-ups (manual actions required)
1. **Auth & PostgREST logs**: export `edge_logs` / `postgres_logs` for user `006284d3-fdc6-499c-9122-c5675df8d605` around the failing timestamps (UTC 2025‑11‑26 05:55–06:10). Look for `auth.rate_limit`, refresh failures, or `permission denied` errors that match our new `requestId`s.
2. **Profiles index validation**: run the snippet below on Supabase to ensure `profiles.id` remains the primary key and is backed by a btree index.
   ```sql
   select indexname, indexdef
   from pg_indexes
   where schemaname = 'public' and tablename = 'profiles';
   ```
   If no explicit `profiles_pkey` exists, create one to prevent the slow fetches noted in Sentry.
3. **Existing SQL helpers**: `sql/diagnose_auth_sessions.sql` and `sql/diagnose_rls_performance.sql` already gather auth/session stats. Run them with `:user_id := '006284d3-fdc6-499c-9122-c5675df8d605'` to cross-check RLS latency.
4. **Background RPCs**: confirm `apply_pending_user_on_login` does not revoke roles mid-session (audit via Supabase dashboard or `select * from pending_users where email = ...`).

## 6. Validation / Test Plan
- Trigger the organiser iPhone workflow again (Patch → Site Visit → nested menu → back track). Capture timestamps plus browser console output—the new breadcrumbs will appear in Sentry automatically.
- Run `npm run test:mobile:iphone` locally to ensure no regressions in navigation overlays while the auth provider logs additional data.
- After Supabase index confirmation, repeat the flow to confirm `AppLayout` no longer logs “slow profile fetch” warnings.

## 7. Next Steps
1. Monitor Sentry for:
   - `Session state updated (initial_session_event)` breadcrumbs appearing shortly before failures (should now show a recovered session).
   - New `requestId` tags on layout/middleware events to align with serverless logs.
2. If session drops persist, capture Supabase `sb-` cookie values and compare before/after navigation to rule out iOS PWA storage eviction.
3. Once stable, add a targeted Playwright test that repeatedly navigates Patch ↔ Site Visits to ensure `useAuth` never transitions from `user` → `null` without `SIGNED_OUT`.

With these changes we now have both a mitigation (initial-session handling) and the telemetry necessary to confirm whether any remaining losses come from Supabase backend events, service-worker reloads, or role mutations. Please run the Supabase-side diagnostics next so we can close the loop.


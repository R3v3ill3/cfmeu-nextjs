# Auth Session Loss Investigation

## Problem Summary

**Issue**: Users with role "organiser" experience intermittent permission errors and authentication loss when navigating between pages (e.g., Projects → Patch). The session/user becomes null, causing RLS permission errors and data failing to load.

**Environment**: 
- Production deployed on Vercel (main app) + Railway (workers)
- Occurs in both desktop and mobile browser views
- Also affects PWA (home screen web app)

**User Impact**: Navigation between pages causes loss of user identification, requiring page refresh or re-login to restore session.

---

## Original Console Errors

```
[SupabaseClient] Health check failed (not resetting immediately) {timestamp: '2025-11-26T04:48:19.427Z'}

[useAuth] Session fetch timeout (attempt 1/3), retrying in 1000ms...

[useAuth] Safety timeout: onAuthStateChange did not fire, setting loading=false

[withTimeout] Timeout occurred for fetch my role {timeoutMs: 10000, actualDuration: 10003, label: 'fetch my role', timestamp: '2025-11-26T05:25:49.358Z'}

[SupabaseClient] Resetting browser client {timestamp: '2025-11-26T05:25:49.360Z'}
[SupabaseClient] Creating new browser client {timestamp: '2025-11-26T05:25:49.360Z'}
```

---

## Root Cause Analysis

### Identified Issues

1. **AuthProvider Remounting**: `AuthProvider` was placed in multiple route group layouts (`(app)/layout.tsx`, `mobile/layout.tsx`, `page.tsx`), causing it to remount on every navigation between route groups. Each remount triggered fresh `getSession()` calls.

2. **Aggressive Timeout Logic**: The `useAuth` hook had a custom timeout wrapper around `getSession()` calls with retry logic. If Supabase was slow to respond (which happens under load), the timeout would fire before Supabase completed, setting session to null.

3. **Health Check Contention**: `getSupabaseBrowserClient()` was performing periodic health checks that called `getSession()`, creating contention with auth operations.

4. **Component-Level Client Reset**: `EmployerDetailModal.tsx` and `EmployerWorkersList.tsx` were calling `resetSupabaseBrowserClient()` on query timeouts, which destroyed the auth state and created a new client without the previous session.

5. **PWA Caching Stale Pages**: The service worker used `cacheFirstForMobile` for HTML navigation requests, serving old cached pages with broken auth code instead of fetching fresh pages.

---

## Attempted Fixes (All Deployed, Issue Persists)

### Fix 1: Centralized AuthProvider

**Files Changed**:
- `src/app/providers.tsx` - Added AuthProvider wrapper
- `src/app/(app)/layout.tsx` - Removed AuthProvider
- `src/app/mobile/layout.tsx` - Removed AuthProvider
- `src/app/page.tsx` - Removed AuthProvider

**Rationale**: Single AuthProvider instance at root level prevents remounting on navigation.

**Code**:
```tsx
// src/app/providers.tsx
return (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <Suspense fallback={null}>
        <PostHogProvider>
          {children}
          <Toaster richColors position="top-right" />
        </PostHogProvider>
      </Suspense>
    </AuthProvider>
  </QueryClientProvider>
)
```

### Fix 2: Refactored useAuth Hook

**File Changed**: `src/hooks/useAuth.tsx`

**Changes**:
- Removed aggressive `getSessionWithTimeout` wrapper with retry logic
- Now calls `getSession()` immediately on mount (not waiting for `onAuthStateChange`)
- Relies on `onAuthStateChange` for subsequent auth state changes
- Added session recovery mechanism that attempts `refreshSession()` when session is unexpectedly lost
- Added cache invalidation for auth-dependent queries on auth events

**Key Code**:
```tsx
useEffect(() => {
  const supabase = getSupabaseBrowserClient();
  
  // IMMEDIATELY call getSession() to get cached session from storage
  const initializeSession = async () => {
    try {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      // ... set state
    } catch (error) {
      // ... handle error
    }
  };

  initializeSession();

  // Set up listener for future auth changes
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    async (event, newSession) => {
      // ... handle auth events
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

### Fix 3: Removed Health Check from Supabase Client

**File Changed**: `src/lib/supabase/client.ts`

**Changes**:
- Removed `checkConnectionHealth()` function that was calling `getSession()` periodically
- Simplified `getSupabaseBrowserClient()` to just return the singleton client
- Added warning comment to `resetSupabaseBrowserClient()` that it should NOT be called from components

### Fix 4: Removed Client Reset Calls from Components

**Files Changed**:
- `src/components/employers/EmployerDetailModal.tsx` - Removed 5 calls to `resetSupabaseBrowserClient()`
- `src/components/workers/EmployerWorkersList.tsx` - Removed 2 calls to `resetSupabaseBrowserClient()`

**Rationale**: These calls were triggered on query timeouts, destroying auth state for the entire app.

### Fix 5: Improved Worker Request Hooks

**Files Changed**:
- `src/hooks/useProjectsServerSide.ts`
- `src/hooks/useEmployersServerSide.ts`

**Changes**:
- Added `hasSession` to queryKey so queries refetch when session changes
- Reduced console warning noise
- Better handling of auth fallback scenarios (401/403 now fall back gracefully to app routes)

### Fix 6: Updated Service Worker

**File Changed**: `public/sw.js`

**Changes**:
- Bumped version from `2.0.1` to `2.1.0` to invalidate old caches
- Changed mobile route handling from `cacheFirstForMobile` to `networkFirstForNavigation`
- All HTML navigation requests now use network-first strategy
- Added `SW_UPDATED` message to clients when service worker updates

### Fix 7: Enhanced Service Worker Registration

**File Changed**: `src/app/providers.tsx`

**Changes**:
- Auto-checks for service worker updates on load
- Checks for updates every 5 minutes
- Auto-reloads when controller changes
- Sends `SKIP_WAITING` to new service worker

---

## Current State of Auth Flow

### How Auth Should Work:
1. `AuthProvider` mounts once at root level
2. `getSession()` is called immediately to get cached session from localStorage/cookies
3. `onAuthStateChange` listener is set up for future changes
4. Session state is maintained across all navigations
5. API calls use the session token from context

### What Might Still Be Happening:
1. Something is still causing the Supabase client to lose its session
2. The `onAuthStateChange` listener might not be firing correctly
3. There might be cookie/storage issues in the PWA context
4. Server components in layouts might be doing auth checks that interfere

---

## Key Files for Further Investigation

### Auth-Related:
- `src/hooks/useAuth.tsx` - Main auth context provider
- `src/lib/supabase/client.ts` - Supabase browser client singleton
- `src/lib/supabase/server.ts` - Server-side Supabase client
- `src/lib/supabase/middleware.ts` - Auth middleware

### Layouts (Server Components):
- `src/app/(app)/layout.tsx` - Main app layout (does server-side auth check)
- `src/app/mobile/layout.tsx` - Mobile layout (does server-side auth check)
- `src/app/page.tsx` - Root page (does server-side auth check)

### Components That Query User Data:
- `src/components/employers/EmployerDetailModal.tsx`
- `src/components/workers/EmployerWorkersList.tsx`
- Any component using `useAuth()` hook

### PWA:
- `public/sw.js` - Service worker
- `public/manifest.json` - PWA manifest

---

## Relevant Vercel Logs

```
[AppLayout] Slow profile fetch: userId=006284d3-fdc6-499c-9122-c5675df8d605, duration=249ms, hasRole=true
```

This suggests server-side auth is working, but something is happening on the client side.

---

## Possible Remaining Issues

1. **Server Component Auth Checks**: The layouts do server-side auth checks using `getSupabaseServerClient()`. This creates a server-side session that might not sync properly with client-side session.

2. **Cookie Synchronization**: Supabase SSR uses cookies for session. The server might be setting cookies that don't match client state.

3. **React Query Cache Conflicts**: Auth-dependent queries might be using stale cached data.

4. **Middleware Interference**: Check if `middleware.ts` is doing anything that affects session cookies.

5. **PWA Storage Context**: Standalone PWAs might have different storage/cookie access than browser tabs.

---

## Debugging Steps for Next Agent

1. **Add Console Logging**: Add detailed logging to track:
   - When `AuthProvider` mounts/unmounts
   - When `getSession()` is called and what it returns
   - When `onAuthStateChange` fires and with what event
   - When session state changes

2. **Check Server Logs**: Look at Vercel function logs to see if server-side auth is consistent.

3. **Inspect Cookies**: Check if Supabase auth cookies (`sb-*`) are being set/cleared correctly.

4. **Compare Browser vs PWA**: Test if the issue is more severe in PWA vs browser.

5. **Check Middleware**: Review `src/lib/supabase/middleware.ts` for any session manipulation.

6. **Review Server Components**: Check if server-side `getUser()` calls in layouts are affecting client session.

---

## Environment Details

- **Framework**: Next.js 14 with App Router
- **Auth**: Supabase Auth with SSR package (`@supabase/ssr`)
- **State Management**: React Query (`@tanstack/react-query`)
- **Deployment**: Vercel (serverless) + Railway (workers)
- **Database**: Supabase PostgreSQL with Row Level Security (RLS)

---

## User Roles & RLS

- Users have roles: `admin`, `lead_organiser`, `organiser`, `delegate`, `viewer`
- RLS policies restrict data access based on user ID and assigned patches
- When session is lost, RLS denies all queries (permission errors)

---

## Files Modified in This Session

1. `src/app/providers.tsx` - Added AuthProvider, enhanced SW registration
2. `src/app/(app)/layout.tsx` - Removed AuthProvider
3. `src/app/mobile/layout.tsx` - Removed AuthProvider
4. `src/app/page.tsx` - Removed AuthProvider
5. `src/hooks/useAuth.tsx` - Complete rewrite
6. `src/lib/supabase/client.ts` - Removed health check
7. `src/hooks/useProjectsServerSide.ts` - Improved session handling
8. `src/hooks/useEmployersServerSide.ts` - Improved session handling
9. `src/components/employers/EmployerDetailModal.tsx` - Removed client reset calls
10. `src/components/workers/EmployerWorkersList.tsx` - Removed client reset calls
11. `public/sw.js` - Changed to network-first for navigation

---

## Contact

Created: 2025-11-26
Last Updated: 2025-11-26
Issue Status: **UNRESOLVED** - Fixes deployed but problem persists


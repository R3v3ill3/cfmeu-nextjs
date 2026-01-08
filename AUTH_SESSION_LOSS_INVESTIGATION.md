# Auth Session Loss Investigation

## Problem Summary

**Issue**: Users with role "organiser" experience intermittent permission errors and authentication loss when navigating between pages (e.g., Projects → Patch → Site Visit Wizard → back). The session/user becomes null on the CLIENT side, causing RLS permission errors and data failing to load.

**Key Insight (2025-11-27)**: Server-side auth is consistently working (Vercel logs show authenticated requests), but client-side React state loses the profile/session data during complex navigation flows.

**Environment**: 
- Production deployed on Vercel (main app) + Railway (workers)
- Occurs in both desktop and mobile browser views
- Also affects PWA (home screen web app)
- Tested with user role: organiser (also reproduced with admin)

**User Impact**: Navigation between pages causes loss of user profile data on the client, requiring page refresh to restore. Symptoms include:
- Profile information missing from Settings page
- Project data not loading
- Components showing loading states indefinitely

---

## Investigation Sessions

### Session 1: 2025-11-26 (Initial Investigation)

#### Original Console Errors
```
[SupabaseClient] Health check failed (not resetting immediately)
[useAuth] Session fetch timeout (attempt 1/3), retrying in 1000ms...
[useAuth] Safety timeout: onAuthStateChange did not fire, setting loading=false
[withTimeout] Timeout occurred for fetch my role
[SupabaseClient] Resetting browser client
```

#### Root Causes Identified
1. **AuthProvider Remounting**: Multiple AuthProvider instances in different layouts
2. **Aggressive Timeout Logic**: Custom timeout wrapper causing premature session=null
3. **Health Check Contention**: Periodic `getSession()` calls competing with auth ops
4. **Component-Level Client Reset**: Components calling `resetSupabaseBrowserClient()` on timeouts
5. **PWA Caching Issues**: Service worker caching auth-protected HTML pages

#### Fixes Applied (Session 1)
- Centralized AuthProvider to root `providers.tsx`
- Removed timeout wrapper from useAuth
- Removed health check from Supabase client
- Removed `resetSupabaseBrowserClient()` calls from components
- Updated service worker to network-first for navigation

---

### Session 2: 2025-11-27 (Current Session)

#### New Issues Identified

##### Issue A: TOKEN_REFRESHED Triggering Cache Invalidation (CRITICAL)
**Location**: `src/hooks/useAuth.tsx` lines 226-236

**Problem**: The `onAuthStateChange` handler was invalidating React Query caches on `TOKEN_REFRESHED` events:
```typescript
// OLD CODE - PROBLEMATIC
if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
  queryClient.invalidateQueries({ queryKey: ['user-role'] });
  queryClient.invalidateQueries({ queryKey: ['accessible-patches'] });
  queryClient.invalidateQueries({ queryKey: ['my-role'] });
  queryClient.invalidateQueries({ predicate: (query) =>
    query.queryKey.some(key => typeof key === 'string' &&
      (key.includes('user') || key.includes('auth') || key.includes('role') || key.includes('permission')))
  });
}
```

**Why This Caused Issues**:
- Supabase automatically refreshes tokens in the background during navigation
- Each `TOKEN_REFRESHED` event triggered cache invalidation
- The broad predicate `key.includes('user')` invalidated queries like `settings-current-user` (profile data)
- Complex navigation (back/forward) triggered more token refreshes = more cache clears

**Fix Applied**:
```typescript
// NEW CODE - FIXED
if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
  queryClient.invalidateQueries({ queryKey: ['user-role'] });
  queryClient.invalidateQueries({ queryKey: ['accessible-patches'] });
  queryClient.invalidateQueries({ queryKey: ['my-role'] });
  // Removed broad predicate - was clearing too much data
}
```

##### Issue B: Service Worker Pre-Caching Auth-Protected Routes
**Location**: `public/sw.js`

**Problem**: The service worker was trying to pre-cache auth-protected routes during installation:
```javascript
// OLD CODE - PROBLEMATIC
const STATIC_ASSETS = [
  '/',           // Requires auth
  '/settings',   // Requires auth
  '/dashboard',  // Requires auth
  '/site-visits', // Requires auth
  ...
]
```

When creating a fresh PWA (before login):
1. SW registers and calls `cache.addAll(STATIC_ASSETS)`
2. Auth-protected routes redirect to `/auth` or fail
3. `cache.addAll()` fails if ANY request fails
4. SW installation fails or caches wrong content (redirect pages)

**Fix Applied** (v2.2.0):
```javascript
// NEW CODE - FIXED
const STATIC_ASSETS = [
  '/manifest.json',
  '/favicon.ico',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/auth'  // Only public page
]
```

##### Issue C: PWA Cookie Isolation
**Discovery**: Creating PWA from `/auth` page works; creating from protected page fails.

**Root Cause**: iOS Safari PWAs run in isolated storage context - they don't inherit cookies from the browser session.

**When creating PWA after login (from protected page)**:
1. User is logged in with cookies in Safari
2. User adds to Home Screen
3. PWA is created but has NO cookies (isolated context)
4. When opened, PWA has no auth → app fails or shows wrong state

**When creating PWA from /auth**:
1. PWA starts at /auth
2. User logs in WITHIN the PWA context
3. Cookies are set in PWA's storage
4. Everything works

**Recommendation**: Users should create PWAs from the `/auth` page, then log in within the app.

##### Issue D: PostgREST Ambiguous Relationship Error
**Location**: `src/app/api/projects/quick-list/route.ts`

**Problem**: Query using `job_sites!inner` failed because `projects` has two relationships to `job_sites`:
1. `projects.main_job_site_id` → `job_sites.id`
2. `job_sites.project_id` → `projects.id`

**Error**: `Could not embed because more than one relationship was found for 'projects' and 'job_sites'`

**Fix Applied**:
```typescript
// Changed from ambiguous:
job_sites!inner(...)

// To explicit FK reference:
job_sites!fk_job_sites_project(...)
```

##### Issue E: Middleware Logging Noise
**Location**: `src/middleware.ts`

**Problem**: Unauthenticated requests (bots, preview checks, SW pre-caching) were logged as errors, creating noise in Vercel logs.

**Fix Applied**: Only log as error when Supabase cookies exist but auth fails (actual session loss). Unauthenticated requests (no cookies) are silently ignored.

---

### Session 3: 2025-11-27 (Ratings View Fix)

#### Problem Identified

**Specific Symptom**: Auth/profile loss when clicking "Add Rating" in Site Visit Wizard → Ratings view.

**Root Cause**: `RatingsView.tsx` was using `window.location.href` for navigation, which:

1. **Destroys the entire React tree** - All client-side state including AuthProvider is lost
2. **Crosses route groups** - Navigates from `(app)/site-visit-wizard` to `/mobile/projects/...` (different layout trees)
3. **Forces full re-initialization** - Both layouts perform separate server auth checks, and client needs to rebuild all state from scratch

**Location**: `src/components/siteVisitWizard/views/RatingsView.tsx` line 136

```typescript
// PROBLEMATIC CODE - caused full page refresh
const handleAddRating = () => {
  window.location.href = `/mobile/projects/${projectId}/assessments`
}
```

#### Why MappingView Works But RatingsView Didn't

**MappingView** (working):
- Uses `setIsAddMappingOpen(true)` to open a Dialog
- Renders `MappingSheetEditor` inline within the same React tree
- No navigation occurs = auth state preserved

**RatingsView** (broken):
- Used `window.location.href` for full page navigation
- React tree completely destroyed
- AuthProvider re-initialized from scratch
- All React Query cache cleared

#### Fix Applied

Changed `RatingsView.tsx` to use the same Dialog pattern as `MappingView.tsx`:

1. **Created new component**: `src/components/siteVisitWizard/views/InlineAssessmentFlow.tsx`
   - Self-contained employer selection and assessment flow
   - Two-step process: select employers → fill assessment form
   - Stays entirely within the React tree
   - Properly submits all compliance/assessment data

2. **Updated RatingsView.tsx**:
```typescript
// NEW CODE - opens dialog instead of navigating
const [isAddRatingOpen, setIsAddRatingOpen] = useState(false)
const handleAddRating = () => setIsAddRatingOpen(true)

// Dialog with embedded flow
<Dialog open={isAddRatingOpen} onOpenChange={setIsAddRatingOpen}>
  <DialogContent className="max-w-3xl p-0 overflow-hidden max-h-[90vh]">
    <DialogHeader className="px-4 pt-4 pb-2 border-b">
      <DialogTitle>Add Employer Rating</DialogTitle>
    </DialogHeader>
    <div className="overflow-y-auto">
      <InlineAssessmentFlow
        projectId={projectId}
        projectName={projectName}
        onComplete={handleAssessmentComplete}
        onCancel={() => setIsAddRatingOpen(false)}
      />
    </div>
  </DialogContent>
</Dialog>
```

#### Files Modified in Session 3

| File | Change | Status |
|------|--------|--------|
| `src/components/siteVisitWizard/views/RatingsView.tsx` | Changed from `window.location.href` to Dialog pattern | **Pending deployment** |
| `src/components/siteVisitWizard/views/InlineAssessmentFlow.tsx` | New file - embedded assessment flow | **Pending deployment** |

---

## Current State (2025-11-27)

### What's Working
- Server-side auth is consistent (Vercel logs show correct user ID, 200 responses)
- PWA created from `/auth` page works correctly
- Middleware properly refreshes sessions when cookies exist but JWT is stale
- MappingView (uses Dialog pattern) - auth preserved

### What's Been Fixed (Pending Deployment)
- RatingsView now uses Dialog pattern instead of `window.location.href`
- New `InlineAssessmentFlow` component handles employer selection and assessment inline

### Files Modified - All Sessions

| File | Change | Status |
|------|--------|--------|
| `src/hooks/useAuth.tsx` | Removed TOKEN_REFRESHED from cache invalidation | Committed |
| `public/sw.js` | v2.2.0 - Only pre-cache static assets | Committed |
| `src/middleware.ts` | Added session refresh, improved logging | Committed |
| `src/app/providers.tsx` | Added iOS SecurityError handling for SW | Committed |
| `src/app/api/projects/quick-list/route.ts` | Fixed PostgREST relationship | Committed |
| `src/components/siteVisitWizard/views/RatingsView.tsx` | Dialog pattern instead of navigation | **Pending deployment** |
| `src/components/siteVisitWizard/views/InlineAssessmentFlow.tsx` | New embedded assessment component | **Pending deployment** |

---

## Key Files Reference

### Auth System
| File | Purpose |
|------|---------|
| `src/hooks/useAuth.tsx` | Client-side auth context provider |
| `src/lib/supabase/client.ts` | Browser Supabase client singleton |
| `src/lib/supabase/server.ts` | Server-side Supabase client |
| `src/middleware.ts` | Auth middleware (runs on every request) |
| `src/integrations/supabase/client.ts` | Legacy shim that re-exports from `@/lib/supabase/client` |

### Layouts (Server Components)
| File | Purpose |
|------|---------|
| `src/app/(app)/layout.tsx` | Main app layout - server-side auth check |
| `src/app/mobile/layout.tsx` | Mobile layout - server-side auth check |
| `src/app/page.tsx` | Root page - redirects organisers to /patch |
| `src/app/providers.tsx` | Root providers including AuthProvider |

### Service Worker
| File | Purpose |
|------|---------|
| `public/sw.js` | PWA service worker (v2.2.0) |

---

## Debugging Guide for Future Agents

### Step 1: Determine If Issue Is Server or Client Side

Check Vercel logs for the failing request:
- **200 with userId present**: Server auth is working → Issue is CLIENT-SIDE
- **401/403**: Server auth failed → Check middleware, cookies
- **Auth error with sbCookieCount: 0**: No cookies sent → Expected for unauthenticated requests
- **Auth error with sbCookieCount > 0**: Cookies exist but auth failed → Session loss issue

### Step 2: For Client-Side Issues

1. **Check if TOKEN_REFRESHED is causing problems**:
   - Look for `[useAuth] Auth state change: TOKEN_REFRESHED` in console
   - If this appears followed by data disappearing, the cache invalidation is the issue

2. **Check React Query cache**:
   - Open React Query DevTools
   - Look for queries being invalidated unexpectedly
   - Check if `settings-current-user` or profile queries are being cleared

3. **Check for unexpected onAuthStateChange events**:
   - Add logging: `console.log('[useAuth] Event:', event, 'Session:', !!newSession)`
   - Look for events firing during navigation that shouldn't

4. **Check for `window.location.href` usage** (CRITICAL):
   - Search codebase: `grep -r "window.location.href" src/components`
   - Any use in navigation flows will destroy React tree and auth state
   - Replace with `router.push()` or Dialog pattern (preferred for wizard flows)

### Step 3: For PWA Issues

1. **Test creating PWA from /auth page** - this should work
2. **Clear Safari cache** before testing: Settings → Safari → Clear History and Website Data
3. **Check service worker version**: Should be 2.2.0
4. **Look for SecurityError in console**: iOS Safari may block SW registration

### Step 4: For Server-Side Issues

1. **Check middleware logs** for session refresh attempts
2. **Verify cookies are being sent**: Look for `sbCookieCount` in logs
3. **Check if session refresh succeeds**: Look for "Session recovered via refresh"

---

## Technical Context

### Supabase Auth Events
| Event | When It Fires | Should Invalidate Cache? |
|-------|--------------|-------------------------|
| `INITIAL_SESSION` | On page load | No |
| `SIGNED_IN` | After login | Yes |
| `SIGNED_OUT` | After logout | Yes |
| `TOKEN_REFRESHED` | Background token refresh | **NO** (user is same) |
| `USER_UPDATED` | Profile changes | Maybe |

### Cookie Names
- `sb-<project-ref>-auth-token` - Main auth token cookie
- Multiple `sb-*` cookies may exist

### React Query Keys That Should NOT Be Invalidated on TOKEN_REFRESHED
- `settings-current-user` - Profile data
- `user-projects` - User's projects
- Any query with `user` in the key (the old broad predicate was clearing these)

---

## Reproduction Steps

### To Reproduce Profile Loss (Pre-Fix)
1. Sign in as organiser
2. Navigate: Site Visit Wizard → Mapping → Employer Search
3. Press Back multiple times
4. Navigate to Ratings → Employer Rating
5. Press Back
6. Check Settings page - profile info may be missing

### To Test Fix
1. Commit the `useAuth.tsx` change
2. Deploy to production
3. Repeat the reproduction steps
4. Profile should persist through navigation

---

---

## Pattern: Dialog vs Navigation for Wizard Flows

### The Problem with Navigation in Wizard Flows

When a wizard/multi-step flow uses navigation (`router.push()` or `window.location.href`) to move between steps:

1. **React tree destruction**: Each navigation destroys the current component tree
2. **Auth state re-initialization**: AuthProvider must re-fetch session from storage
3. **Cache invalidation risk**: Navigation can trigger auth events that clear caches
4. **Cross-route-group issues**: Navigating between `(app)` and `mobile` routes means different layouts, different auth checks

### The Dialog Pattern Solution

Instead of navigation, render the sub-flow in a Dialog/Modal:

```typescript
// DON'T DO THIS in wizard flows
const handleAction = () => {
  window.location.href = '/some/other/page'  // Destroys React tree!
  // or
  router.push('/some/other/page')  // Still causes remount
}

// DO THIS INSTEAD
const [isOpen, setIsOpen] = useState(false)
const handleAction = () => setIsOpen(true)

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <EmbeddedFlow onComplete={() => setIsOpen(false)} />
  </DialogContent>
</Dialog>
```

### Components Using Dialog Pattern (Reference)
- `MappingView.tsx` - Uses `MappingSheetEditor` in Dialog
- `RatingsView.tsx` - Uses `InlineAssessmentFlow` in Dialog (fixed in Session 3)

---

---

### Session 4: 2026-01-08 (Inactivity/Tab Background Session Loss)

#### Problem Identified

**Specific Symptom**: After periods of inactivity (overnight, tab backgrounded for extended time), users experience:
- Pages load but data doesn't populate
- "Checking access permissions..." spinner persists indefinitely
- Console shows: `[withTimeout] Timeout occurred for fetch current user profile`

**Root Cause**: Race condition between token refresh and database queries.

When a tab becomes visible after inactivity:
1. The Supabase access token has expired (typically ~1 hour)
2. `useUserProfile` and `useAccessiblePatches` queries run immediately with stale token
3. `withTimeout` starts 10-second countdown
4. `useAuth` visibility handler schedules session recovery with 1-second debounce
5. Database query hangs waiting for valid auth context
6. `withTimeout` fires BEFORE session refresh completes

#### Fix Applied

##### Fix A: Proactive Session Refresh in useUserProfile

**File**: `src/hooks/useUserProfile.ts`

Added `ensureValidSession()` helper that:
- Checks if session is missing or expires within 1 minute
- Proactively calls `refreshSession()` BEFORE querying database
- Prevents queries from running with stale tokens

Also added retry logic for auth/RLS errors (similar to `useUserRole`).

```typescript
async function ensureValidSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  const { data: { session } } = await supabase.auth.getSession();
  
  const isExpiredOrStale = !session || 
    (session.expires_at && session.expires_at * 1000 < Date.now() + 60000);
  
  if (isExpiredOrStale) {
    const { data: refreshData, error } = await supabase.auth.refreshSession();
    if (error || !refreshData.session) return false;
  }
  return true;
}
```

##### Fix B: Immediate Session Refresh on Visibility Change

**File**: `src/hooks/useAuth.tsx`

Changed visibility handler to:
- Check token expiry immediately (compare `expires_at` with current time + 1 minute buffer)
- Call `refreshSession()` IMMEDIATELY instead of using 1-second debounced `scheduleRecovery()`
- Apply the refreshed session and reset recovery flags

Key change: Removed debounce delay for visibility-triggered refreshes to prevent race conditions.

##### Fix C: Session Validation in useAccessiblePatches

**File**: `src/hooks/useAccessiblePatches.ts`

Added same session validation pattern as `useUserProfile`:
- Check and refresh session before any database queries
- Added retry logic for auth/RLS errors
- Changed from using imported `supabase` singleton to `getSupabaseBrowserClient()`

#### Files Modified - Session 4

| File | Change | Status |
|------|--------|--------|
| `src/hooks/useUserProfile.ts` | Added `ensureValidSession()` helper and retry logic | **Committed** |
| `src/hooks/useAuth.tsx` | Immediate session refresh on visibility change, token expiry check | **Committed** |
| `src/hooks/useAccessiblePatches.ts` | Added session validation and retry logic | **Committed** |

---

## Contact & History

| Date | Status | Key Finding |
|------|--------|-------------|
| 2025-11-26 | Initial investigation | Multiple root causes identified |
| 2025-11-27 | Continued investigation | TOKEN_REFRESHED cache invalidation identified as likely cause |
| 2025-11-27 | Session 3 | `window.location.href` in RatingsView identified as specific cause; fixed with Dialog pattern |
| 2026-01-08 | Session 4 | Race condition between tab visibility and token refresh; fixed with proactive session validation |

**Current Status**: Session 4 fixes deployed. To test:
1. Log in as any user
2. Leave tab backgrounded overnight (or wait for token expiry ~1 hour)
3. Return to tab
4. Navigate to any data-heavy page (e.g., Project Details)
5. Verify data loads without "Checking access permissions..." hanging
6. Check console for `[useUserProfile] Session refreshed successfully` logs

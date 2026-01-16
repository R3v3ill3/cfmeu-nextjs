# iOS PWA Session Loss - Investigation & Fix Summary

> **Last Updated**: January 2026  
> **Status**: Fixes deployed, monitoring in production  
> **Severity**: Critical - affects primary user workflow

## Problem Statement

iOS webapp users (primarily organisers on iPhone 13+) experience persistent session/profile loss during multi-page navigation. The issue manifests as:

- Profile information disappearing from the client mid-session
- Functions ceasing to work without visible UI errors
- Recovery previously required browser refresh or PWA reinstallation
- No server-side errors in Vercel logs

### Affected Users
- Role: `organiser`
- Device: iOS (iPhone 13+, iOS 18.x)
- Context: PWA installed to home screen, field use on construction sites

### Reproduction Pattern
```
Login → Navigate: Patch → Site Visits → Project Details → Back → Patch
Repeat navigation sequence 3-5+ times
→ Profile data disappears, functions fail silently
```

---

## Root Causes Identified

### 1. Service Worker Reload Race Condition (PRIMARY)

**Location**: `src/app/providers.tsx`, `public/sw.js`

When a new service worker activated during navigation, the `controllerchange` event triggered an immediate `window.location.reload()`. This destroyed the React tree mid-navigation, losing:
- In-memory session state (`sessionRef.current`)
- The `hadSessionRef` flag that tracks if we ever had a session
- React Query cache state

On iOS PWA specifically, this was catastrophic because:
- PWAs run in isolated storage contexts
- Cookie state can be inconsistent during reload
- The reload often happened at the worst possible time (during auth-dependent navigation)

### 2. React Tree Destruction Losing Session Memory

**Location**: `src/hooks/useAuth.tsx`

The `hadSessionRef` was a React ref that didn't survive component unmount. When the React tree was destroyed (by SW reload, chunk loading error, or iOS memory pressure), we lost the knowledge that the user had ever been authenticated.

This meant:
- No automatic recovery attempt
- No Sentry warning about unexpected session loss
- User appeared as "never logged in" instead of "session lost"

### 3. iOS PWA Cookie Isolation

**Context**: iOS Safari PWAs run in isolated storage contexts separate from Safari

When users installed the PWA from Safari after logging in, the PWA didn't always have access to the same cookies. The fix was documented but not enforced: users should install PWA from `/auth` page and log in within the PWA.

### 4. Lack of Diagnostic Visibility

Previous Sentry errors showed minified stack traces (`uM`, `sU`, `aO`) making root cause identification impossible. No breadcrumbs existed for:
- Session state transitions
- Service worker events
- Navigation timing
- iOS/PWA context detection

---

## Fixes Implemented

### Fix 1: Navigation-Aware Service Worker Activation

**Files Changed**:
- `public/sw.js` (v2.3.0 → v2.4.0)
- `src/app/providers.tsx`
- `src/hooks/useNavigationLoading.tsx`

**What Changed**:

1. **SW defers activation on iOS PWA**:
```javascript
// In providers.tsx controllerchange handler
if (isIOS && isStandalone) {
  logPwaEvent('iOS PWA detected - deferring reload to preserve session')
  pendingReload = true
  return  // DON'T reload
}
```

2. **Navigation signals sent to SW**:
```javascript
// In useNavigationLoading.tsx
navigator.serviceWorker.controller.postMessage({ 
  type: 'NAVIGATION_START',
  from: currentBasePath,
  to: targetBasePath
})
```

3. **SW waits for navigation end before activating**:
```javascript
// In sw.js message handler
if (event.data?.type === 'NAVIGATION_END') {
  isNavigating = false
  if (pendingSkipWaiting) {
    self.skipWaiting()
  }
}
```

### Fix 2: Session State Persistence to localStorage

**File Changed**: `src/hooks/useAuth.tsx`

**What Changed**:

Added localStorage-based persistence for the "had session" indicator:

```javascript
const HAD_SESSION_STORAGE_KEY = "cfmeu-had-session"
const HAD_SESSION_TTL = 24 * 60 * 60 * 1000 // 24 hours

function persistHadSession(userId: string): void {
  localStorage.setItem(HAD_SESSION_STORAGE_KEY, JSON.stringify({
    userId: userId.slice(-12),
    timestamp: Date.now(),
  }))
}
```

On mount, if we find persisted `hadSession` but current session is null:
```javascript
if (persisted.hadSession && !session && !recoveryAttemptedRef.current) {
  logAuthEvent("Session null on mount despite persisted hadSession - attempting recovery")
  attemptSessionRecovery()
}
```

### Fix 3: iOS PWA Context Detection & Logging

**File Changed**: `src/hooks/useAuth.tsx`

**What Changed**:

Added comprehensive iOS/PWA detection:

```javascript
const detectIosPwaContext = useCallback(() => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches
  
  // Check cookie accessibility
  let sbCookieCount = 0
  const cookies = document.cookie.split(";").filter(c => c.trim().startsWith("sb-"))
  sbCookieCount = cookies.length
  
  return { isIOS, isStandalone, isPWA: isStandalone && isIOS, sbCookieCount }
})
```

Warning logged if iOS PWA has no Supabase cookies:
```javascript
if (context.sbCookieCount === 0) {
  logAuthEvent("WARNING: iOS PWA with no Supabase cookies - session loss likely", context, "warning")
}
```

### Fix 4: Enhanced Sentry Diagnostics

**Files Changed**:
- `next.config.mjs` - Sentry SDK v10+ configuration
- `sentry.client.config.ts` - Tunnel route, session replay, network capture
- `instrumentation.ts` - New file for Next.js 14+ integration
- `src/hooks/useAuth.tsx` - Session transition breadcrumbs
- `src/hooks/useNavigationLoading.tsx` - Navigation breadcrumbs
- `src/hooks/useUserProfile.ts` - Session loss detection
- `src/middleware.ts` - Cookie metadata logging

**Key Sentry Configuration**:
```javascript
// Tunnel route bypasses ad-blockers
tunnel: "/monitoring",

// Network capture for debugging
networkDetailAllowUrls: [window.location.origin, /.*supabase\.co.*/],

// Increased replay rate during investigation
replaysSessionSampleRate: 0.2,
```

**Breadcrumb Categories Added**:
- `auth` - Session state changes, recovery attempts
- `navigation` - startNavigation, navigation completed
- `pwa` - Service worker events, iOS context
- `auth-session-loss` - Explicit session loss warnings

---

## Key Code Locations

| Component | File | Purpose |
|-----------|------|---------|
| Auth Provider | `src/hooks/useAuth.tsx` | Session management, recovery |
| Navigation Loading | `src/hooks/useNavigationLoading.tsx` | Navigation state, SW communication |
| SW Registration | `src/app/providers.tsx` | SW lifecycle, chunk error handling |
| Service Worker | `public/sw.js` | Caching, activation control |
| Middleware | `src/middleware.ts` | Server-side session validation |
| User Profile Hook | `src/hooks/useUserProfile.ts` | Profile fetching, session validation |

---

## Diagnosing Future Occurrences

### Sentry Breadcrumb Patterns to Look For

**Healthy Session**:
```
[auth] Initializing auth listener
[auth] iOS PWA context detected on mount { isPWA: true, sbCookieCount: 2 }
[auth] Session state updated { source: "initial_session", hasSession: true }
[navigation] startNavigation called { from: "/patch", to: "/site-visits" }
[navigation] Navigation completed { duration: 450 }
```

**Session Loss Pattern**:
```
[auth] Session state updated { hasSession: true }
[pwa] Service worker controller changed { isIOS: true, isStandalone: true }
[auth] SESSION LOSS DETECTED - applyAuthState transitioning to null
[auth-session-loss] useUserProfile detected session loss
```

**Recovery Pattern**:
```
[auth] Found persisted hadSession from localStorage
[auth] Session null on mount despite persisted hadSession - attempting recovery
[auth] Session recovered successfully
```

### Middleware Logs to Check

In Vercel logs, look for:
```
[Middleware] Auth error with existing cookies (potential session loss)
  sbCookieMetadata: [{ name: "sb-xxx-auth-token", valueLength: 1234, looksLikeJwt: true }]
  isIOS: true
  isMobileSafari: true
```

### Quick Diagnostic Checklist

1. **Check Sentry for breadcrumbs** - Look for `auth-session-loss` category
2. **Check SW version** - Should be `2.4.0+`
3. **Check iOS PWA context** - `sbCookieCount` should be > 0
4. **Check if recovery was attempted** - Look for "attempting recovery" breadcrumb
5. **Check cookie state in middleware** - `looksLikeJwt: true` confirms valid tokens exist

---

## Testing Protocol

### Reproduction Test
1. Log in as organiser on iOS Safari
2. Install PWA from `/auth` page (critical!)
3. Navigate: Patch → Site Visits → Project Details → Back → Patch
4. Repeat navigation sequence 5+ times
5. Check Settings page for profile data

### Success Criteria
- Profile data persists through 20+ navigation cycles
- No `SESSION LOSS DETECTED` in Sentry
- PWA maintains session across iOS backgrounding
- SW updates don't trigger mid-navigation reload

### If Session Loss Still Occurs

1. **Collect Sentry event ID** - Share with developer
2. **Check if new SW is active** - Look for v2.4.0 in console logs
3. **Try clean reinstall**:
   - Delete PWA from home screen
   - Clear Safari website data for the domain
   - Navigate to `/auth` in Safari
   - Install PWA from there
   - Log in within the PWA

---

## Previous Investigation Documents

For historical context, see:
- `AUTH_SESSION_LOSS_INVESTIGATION.md` - Detailed investigation history
- `AUTH_SESSION_LOSS_DIAGNOSTIC_REPORT.md` - Previous diagnostic findings

---

## Architecture Context

```
┌─────────────────────────────────────────────────────────────┐
│                        iOS PWA                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  React App (providers.tsx)                           │    │
│  │  ├── AuthProvider (useAuth.tsx)                      │    │
│  │  │   ├── sessionRef (in-memory)                      │    │
│  │  │   ├── hadSessionRef (in-memory)                   │    │
│  │  │   └── localStorage persistence (survives reload)  │    │
│  │  ├── NavigationLoadingProvider                       │    │
│  │  │   └── Sends NAVIGATION_START/END to SW           │    │
│  │  └── React Query (cache)                             │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Service Worker (sw.js v2.4.0)                       │    │
│  │  ├── Defers activation on iOS PWA                    │    │
│  │  ├── Listens for NAVIGATION_START/END               │    │
│  │  └── Network-first for navigation (no auth caching) │    │
│  └─────────────────────────────────────────────────────┘    │
│                           │                                  │
└───────────────────────────│──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Supabase                                                    │
│  ├── Cookies (sb-*-auth-token)                              │
│  ├── JWT tokens (access + refresh)                          │
│  └── RLS policies (enforce permissions)                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary of Changes by File

| File | Change Summary |
|------|----------------|
| `next.config.mjs` | Sentry SDK v10+ config, source maps, tunnel route |
| `instrumentation.ts` | NEW - Next.js 14+ Sentry initialization |
| `sentry.client.config.ts` | Tunnel, network capture, increased replay |
| `public/sw.js` | v2.4.0 - Deferred activation, navigation awareness |
| `src/app/providers.tsx` | iOS PWA detection, no auto-reload on iOS |
| `src/hooks/useAuth.tsx` | localStorage persistence, iOS detection, recovery |
| `src/hooks/useNavigationLoading.tsx` | SW communication, navigation breadcrumbs |
| `src/hooks/useUserProfile.ts` | Session loss detection |
| `src/middleware.ts` | Enhanced cookie logging, iOS detection |

---

## Additional Manifestation: API Route RLS Failures (January 2026)

### Problem

Intermittent errors appearing in Vercel logs as:
```
Error fetching expertise assessments: [object Object]
```

Users experienced repeated timeouts attempting to load employer information pages, specifically when viewing the Traffic Light Rating tab.

### Root Cause

The `/api/employers/[employerId]/ratings-4point` route was missing authentication checks that other employer routes had. When session loss occurred (due to any of the causes documented above), the route would:

1. Create a Supabase client without valid auth context
2. Attempt to query `organiser_overall_expertise_ratings` table
3. RLS policy would fail because `auth.role() = 'authenticated'` check fails for `anon` role
4. Supabase returns an error object that wasn't being serialized properly (hence `[object Object]`)

### Fix Applied

**File Changed**: `src/app/api/employers/[employerId]/ratings-4point/route.ts`

1. **Added Sentry import** for proper error tracking
2. **Added authentication check** with logging:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (!user) {
  console.warn('[ratings-4point] No authenticated user - RLS policies may fail', { employerId });
  Sentry.addBreadcrumb({ category: 'ratings-4point', message: 'No authenticated user', level: 'warning' });
}
```

3. **Added proper error serialization**:
```typescript
const serializeError = (err: any): Record<string, unknown> => {
  if (!err) return { raw: err };
  if (typeof err !== 'object') return { raw: err };
  return { message: err.message, code: err.code, details: err.details, hint: err.hint };
};
```

4. **Added Sentry exception capture** for expertise assessment errors
5. **Added timing instrumentation** to identify slow queries

### Diagnostic Logs to Look For

In Vercel function logs:
```
[ratings-4point] No authenticated user - RLS policies may fail
[ratings-4point] Auth error: {"message":"...","code":"..."}
[ratings-4point] Error fetching expertise assessments: {"message":"...","code":"..."}
```

### Why This Manifests Intermittently

This error only occurs when session loss happens. The user may:
- Have a valid session most of the time (queries work)
- Experience session loss due to iOS PWA issues, token expiry, or service worker activation
- During the brief window of no auth context, the ratings-4point query fails
- Session may recover on next page load, making the issue appear "intermittent"

### Recommended Pattern for New API Routes

All API routes that query RLS-protected tables should include:
```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

Or at minimum, log when auth context is missing for debugging purposes.

---

## Contact & Escalation

If session loss issues persist after these fixes:

1. **Check Sentry** for new breadcrumb patterns
2. **Export edge logs** from Supabase for affected user around incident time
3. **Check for iOS-specific issues** in Apple release notes for the iOS version
4. **Consider**: Supabase cookie configuration, token refresh timing, RLS policy performance

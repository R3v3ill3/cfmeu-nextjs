# Composer's Failed Attempts to Fix React Error #311

## Summary

React error #311 (conditional hook calls) occurs specifically for organisers when accessing the `/patch` route. The error does not occur for admin users accessing the dashboard. All attempted fixes have been unsuccessful.

## Changes Made That Likely Caused the Error

### 1. Mobile Map Component Changes (`src/components/map/MobileMap.tsx`)

**Date**: During mobile map recentering fix session

**Changes**:
- Added geolocation hooks (`useState` for `userLocation`, `isGettingLocation`, `locationError`, `isClient`, `geolocationSupported`)
- Added `useEffect` hooks for geolocation detection and auto-location fetching
- Moved `useMemo` hooks (`stableCenter`, `stableZoom`) to before conditional returns to fix hook order
- Added conditional rendering based on `isClient` state for geolocation UI

**Lines affected**: Multiple hook additions throughout the component

### 2. Mobile Optimization Provider Changes (`src/components/mobile/shared/MobileOptimizationProvider.tsx`)

**Date**: During hydration mismatch fix session

**Changes**:
- Added `isClient` state to `useMobileOptimization` hook
- Modified `useEffect` to check `typeof window === 'undefined' || typeof navigator === 'undefined'` before accessing browser APIs
- Changed return values to conditionally return based on `isClient` state

**Lines affected**: Lines 201-250 (useMobileOptimization hook)

## Unsuccessful Fix Attempts

### Attempt 1: Moving useMemo Hooks Before Conditional Returns

**File**: `src/components/map/MobileMap.tsx`

**Change**: Moved `useMemo` hooks for `stableCenter` and `stableZoom` to execute before any conditional returns (lines 600-604)

**Rationale**: Thought hooks were being called after conditional returns, violating Rules of Hooks

**Result**: Did not fix the error

### Attempt 2: Adding Client-Side Guards to useMobileOptimization

**File**: `src/components/mobile/shared/MobileOptimizationProvider.tsx`

**Change**: Added guard check `if (typeof window === 'undefined' || typeof navigator === 'undefined') return` at the start of `useEffect` in `useMobileOptimization` hook (line 210)

**Rationale**: Thought accessing `navigator` and `window` without guards might cause hook order issues

**Result**: Did not fix the error

### Attempt 3: Reordering Hooks in Patch Page

**File**: `src/app/(app)/patch/page.tsx`

**Change**: Reordered hook calls to ensure `useAdminPatchContext()` is called before `useIsMobile()` (lines 31-40)

**Rationale**: Thought hook call order might differ between server and client renders

**Result**: Did not fix the error

## Error Details

- **Error Code**: React error #311
- **Error Message**: "Minified React error #311" (conditional hook calls)
- **Affected Route**: `/patch`
- **Affected Users**: Organisers only (admin users work fine)
- **Error Location**: Both web app and website fail with same error
- **Vercel Logs**: Show POST requests to `/api/errors` with 400 status, indicating client-side errors being reported

## Investigation Findings

### Components Checked (No Issues Found)

1. `RoleGuard` - All hooks called unconditionally before conditional returns
2. `useAccessiblePatches` - All hooks called unconditionally
3. `usePatchScans` - All hooks called unconditionally
4. `useAddressSearch` - All hooks called unconditionally
5. `useIsMobile` - All hooks called unconditionally
6. `PatchMap` - All hooks called unconditionally
7. `PatchScansTable` - All hooks called unconditionally
8. `PatchProjectsTable` - All hooks called unconditionally
9. `GoogleMap` - All hooks called unconditionally
10. `NavigationLoadingWrapper` - All hooks called unconditionally

### Key Observations

- Error occurs specifically for organisers, not admins
- Error occurs on `/patch` route (organiser landing page)
- Admin users can access dashboard without errors
- All hooks appear to be called unconditionally in all checked components
- The error persists despite multiple fix attempts

## Files Modified During Fix Attempts

1. `src/components/map/MobileMap.tsx` - Hook reordering
2. `src/components/mobile/shared/MobileOptimizationProvider.tsx` - Client-side guards added
3. `src/app/(app)/patch/page.tsx` - Hook call order changed

## Status

**RESOLVED** - Root cause identified and fixed on 2025-11-25.

## Root Cause Identified

The actual root cause was in `src/hooks/useOptimizedSearch.ts`:

```typescript
export function useOptimizedSearch(initialValue = "") {
  const isMobile = useIsMobile()
  // ...

  if (isMobile) {
    return useMobileSearchState(...)  // Calls useState, useRef, useCallback, useEffect (6+ hooks)
  } else {
    return useDesktopSearchState(...) // Calls only useCallback (1 hook)
  }
}
```

This was a **Rules of Hooks violation**. The `useIsMobile()` hook starts with `false` during SSR/hydration (to prevent hydration mismatches), then becomes `true` on the client after mounting for mobile devices. This caused:

1. **First render (hydration):** `isMobile = false` → desktop path → 1 hook (useCallback)
2. **Second render (after mount):** `isMobile = true` → mobile path → 6+ hooks

This violates React's rule that hooks must be called in the same order every render, hence **React error #311**.

## Why Only Organisers Were Affected

Organisers land on `/patch` which uses `PatchProjectsFilterBar`, which calls `useOptimizedSearch`. Admins typically access different pages or the dashboard which don't use this specific component.

## Fix Applied

The `useOptimizedSearch` hook was refactored to call ALL hooks unconditionally at the top level, then use the `isMobile` flag only to determine which values/callbacks to return:

```typescript
export function useOptimizedSearch(initialValue = "") {
  const isMobile = useIsMobile()
  // ... 

  // ALL HOOKS CALLED UNCONDITIONALLY
  const [localValue, setLocalValue] = useState(() => urlValue)
  const syncTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const syncToUrl = useCallback(...)
  const setValueDesktop = useCallback(...)
  const setValueMobile = useCallback(...)
  
  useEffect(...) // cleanup
  useEffect(...) // sync URL changes

  // RETURN BASED ON PLATFORM (hooks already called above)
  if (isMobile) {
    return [localValue, setValueMobile, syncToUrl] as const
  } else {
    return [urlValue, setValueDesktop, syncToUrl] as const
  }
}
```

## Additional Fixes

1. Fixed stray semicolon in `src/components/patch/PatchMap.tsx` (line 3)
2. Added missing `ReactNode` import in `src/components/DesktopLayout.tsx`


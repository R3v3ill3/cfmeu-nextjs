# Mobile Regression Checklist (CFMEU uConstruct)

This checklist is **specific to this codebase** and is meant for PR review and fast debugging when something “looks wrong on iPhone”.

Primary target: **iPhone 13+**, Mobile Safari + installed PWA, outdoor/gloves/poor connectivity.

## Key architecture fact (don’t get tricked)

This repo has **two “mobile” paths**:

- **Dedicated `/mobile` route group**: `src/app/mobile/**` (has its own `layout.tsx`)
- **Responsive mobile shell** used across the main app (`src/app/(app)/**`) when `user-agent` is mobile/tablet:
  - Switch happens in `src/app/(app)/layout.tsx` → `{isMobile ? <Layout/> : <DesktopLayout/>}`

When triaging: confirm which shell you’re actually in.

## Hotspot map (start here)

- **Mobile header + left drawer + content offset + pull-to-refresh + FAB**: `src/components/Layout.tsx`
- **Drawer overlay + stacking behavior**: `src/components/ui/sheet.tsx` (used by `Layout.tsx`)
- **Dialogs/modals (safe-area + max-height)**: `src/components/ui/dialog.tsx`
- **Bottom sheets**: `src/components/ui/drawer.tsx` + `src/components/mobile/shared/BottomSheet.tsx`
- **Global mobile foundations** (safe area, tap targets, overflow-x prevention): `src/app/globals.css` and `src/styles/mobile.css`
- **Safe area utilities + guidance**:
  - `src/components/ui/SafeAreaContainer.tsx`
  - `src/styles/safe-area-utilities.ts`
  - `src/lib/SAFE_AREA_IMPLEMENTATION_GUIDE.md`
- **Navigation loading overlay** (must cover header too): `src/hooks/useNavigationLoading.tsx` + `src/components/NavigationLoadingWrapper.tsx`

## Checklist (PR review + debugging)

### 1) Layout: header/drawer/content alignment

- [ ] **No content hidden under header** on iPhone 13.
  - The mobile header is **fixed** and the content offset is manual.
  - Check `src/components/Layout.tsx`:
    - `<header className=... fixed ...>`
    - `<main ... style={isMobile() ? { paddingTop: ... } : undefined}>`
- [ ] **No double safe-area padding** (common cause of “everything is pushed down”).
  - This repo applies safe-area padding in multiple layers:
    - `body` padding in `src/app/globals.css`
    - component-level classes like `safe-area-inset-top`, `px-safe`
  - Be careful when adding new wrappers around headers or fixed elements.

### 2) Drawer + overlay + stacking (mobile nav)

- [ ] **Mobile left drawer is fully opaque white in light theme**, and above any overlay.
  - Drawer callsite: `src/components/Layout.tsx` uses `SheetContent side="left" className="... !bg-white z-50 ..."`
- [ ] **Overlay dims the page in light theme** (no “click-through, no dim”).
  - Overlay primitive: `src/components/ui/sheet.tsx` (`SheetOverlay`).
  - If you see “no dim overlay” in light theme, check for `bg-black/0` and adjust carefully.
- [ ] **Z-index ordering is correct**:
  - mobile header uses `z-40`
  - sheet/drawer overlay + content use `z-50`
  - navigation loading overlay uses `zIndex: 99999` (should cover header too)

### 3) Dialogs / overlays (modals, loading, autocomplete)

- [ ] **Dialogs fit on iPhone 13** (no off-screen close button, no content inaccessible).
  - Primary primitive: `src/components/ui/dialog.tsx`
  - This already includes:
    - mobile `max-h` and `overflow-y-auto`
    - safe-area padding classes and variables
- [ ] **Navigation loading dialog is solid white, with a moderately dark dim overlay covering header too**.
  - `src/hooks/useNavigationLoading.tsx` renders `fixed inset-0` and `bg-black/50` dim.
- [ ] **Google Places Autocomplete appears above dialogs**.
  - Global CSS: `.pac-container { z-index: 99999 !important; }` in `src/app/globals.css`

### 4) Overflow / wrapping / truncation

- [ ] **No horizontal scroll** on iPhone.
  - `src/app/globals.css` sets `overflow-x: hidden` for small screens, but you can still create overflow inside nested scroll containers.
- [ ] **Flex children that must shrink have `min-w-0`**, and long labels are `truncate`/`break-words`.
  - Common hotspot: header/title rows and nav items in `src/components/Layout.tsx`
- [ ] **Avoid fixed widths on mobile** (`w-[600px]` etc).
  - Prefer `w-full`, `max-w-*`, and responsive breakpoints.

### 5) Tap targets (gloves / field use)

- [ ] **All primary actions are >= 44x44px**.
  - Baseline CSS: `src/app/globals.css` sets min height/width for `button` and `[role="button"]` under 767px.
  - For non-button elements (`Link`, `div` clickables), explicitly add:
    - `min-h-[44px] min-w-[44px]` or use `.touch-target` from `src/styles/mobile.css`
- [ ] **Icon-only actions are still tappable** (close buttons, kebab menus, back arrows).
  - Check `src/components/ui/dialog.tsx` (close button already sets mobile size `max-lg:h-11 max-lg:w-11`)

### 6) Safe-area + home indicator

- [ ] **Fixed headers/footers respect safe area** (notch/dynamic island + home indicator).
  - Use:
    - `safe-area-inset-top`, `safe-area-inset-bottom`, `px-safe` (CSS utilities)
    - or `SafeAreaContainer` variants (`SafeAreaHeader`, `SafeAreaFooter`, `SafeAreaModal`) from `src/components/ui/SafeAreaContainer.tsx`
- [ ] **Watch for mismatched safe-area class names**.
  - Example: `src/components/mobile/shared/MobileOptimizationProvider.tsx` uses `pb-safe-area-inset-bottom`.
  - Legacy utility present in CSS is `pb-safe-bottom` (`src/app/globals.css`), and modern safe-area utilities are `safe-area-inset-*`.
  - If you see bottom padding “not working”, check naming first.

### 7) Touch gestures (drawer edge-swipe / pull-to-refresh)

- [ ] **Edge swipe to open/close drawer doesn’t conflict with content gestures**.
  - Implemented in `src/components/Layout.tsx` using touch handlers and a 20px edge threshold.
- [ ] **Pull-to-refresh doesn’t block normal scrolling**.
  - Implemented in `src/components/Layout.tsx` (custom pull distance logic).

## Quick triage flow (1 minute)

1. Confirm which shell: `/mobile/**` route group or `(app)` mobile shell.
2. If it’s header/drawer/scroll: open `src/components/Layout.tsx`.
3. If it’s overlay/dimmer/stacking: open `src/components/ui/sheet.tsx` and `src/hooks/useNavigationLoading.tsx`.
4. If it’s modal sizing/safe-area: open `src/components/ui/dialog.tsx` and `src/app/globals.css`.
5. If it’s home indicator/notch overlap: use `SafeAreaContainer` and re-check safe-area utility classes.



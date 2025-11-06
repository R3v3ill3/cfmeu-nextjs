# Dashboard-New Page - Unresolved Rendering Issues

## Context

The user has a new alternative dashboard at `http://localhost:3000/dashboard-new` that is rendering poorly. Multiple attempts have been made to fix the issues but **NONE of the code changes have had any visible effect on the page**.

## Environment

- **Technology**: Next.js 14.2.33, React 18.3.1, Recharts 3.3.0, Tailwind CSS v4
- **Route**: `/dashboard-new` → `src/app/(app)/dashboard-new/page.tsx`
- **Main Component**: `src/components/dashboard/new/NewDashboardPage.tsx`
- **Authentication**: Required (redirects to /auth if not logged in)
- **Testing**: Viewed in incognito browser after restarting all apps

## Current Issues (All Persist Despite Multiple Fix Attempts)

### 1. **Coverage Ladders Component**
**Symptoms:**
- Stacked bar charts render OVER THE TOP of their labels
- Charts appear too tall/wide
- Labels and chart graphics overlap
- Visual jumble of overlapping elements

**Component**: `src/components/dashboard/new/CoverageLadders.tsx`

### 2. **"Contractors on EBA-Builder Projects" Component**
**Symptoms:**
- Side-by-side stacked bar charts render over labels
- Charts appear too tall/wide
- Elements are a jumble of overlapping graphics
- Frame is messy and unreadable

**Component**: `src/components/dashboard/new/EbaBuilderSubset.tsx`

### 3. **Patch/Coordinator Scorecards Component**
**Symptoms:**
- Charts render as "3 vertically stacked light blue dashes"
- NOT rendering as proper progress bars
- Dashes appear in different locations on each scorecard element
- Component DOES load (title and structure visible), but charts broken

**Component**: `src/components/dashboard/new/PatchScorecards.tsx`

### 4. **Project Mapping Status Grid**
**Symptoms:**
- Grid renders correctly
- BUT the squares are MUCH TOO LARGE
- User reports they need to be smaller

**Component**: `src/components/dashboard/new/WaffleTiles.tsx`

### 5. **Browser Console Warnings**
**Persistent warnings** (appear multiple times):
```
The width(-1) and height(-1) of chart should be greater than 0,
please check the style of container, or the props width(100%) and height(100%),
or add a minWidth(300) or minHeight(200) or use aspect(undefined) to control the
height and width.
```
**Source**: `LogUtils.js:16` from Recharts `ResponsiveContainer.js:131`

**Additional warnings:**
```
⚠️ Slow organizing metrics query detected: {queryTime: 1215, appliedFilters: {...}, patchCount: 0}
```
**Source**: `useOrganizingUniverseMetricsServerSide.ts:72`

## What's Working Well

According to user:
- ✅ Top KPI cards (Known Builders, EBA Builders, Contractors Identified, Contractors EBA)
- ✅ Contractor-Type Heatmap component is "excellent"
- ✅ Project Mapping Status grid logic is "good" (just squares too large)

## Attempted Fixes (None Had Any Effect)

### Attempt 1: Fixed HTML Nesting
**Changed**: `CoverageLadders.tsx` - Made Projects and Contractors ladder sibling elements instead of nested
**Expected**: Eliminate overlapping between the two ladder charts
**Result**: NO CHANGE - overlapping persists

### Attempt 2: Improved Spacing
**Changed**: `EbaBuilderSubset.tsx` - Increased spacing from `space-y-6` to `space-y-8`, adjusted margins
**Expected**: Better separation between chart sections
**Result**: NO CHANGE - overlapping persists

### Attempt 3: Reduced Waffle Grid Size
**Changed**: `WaffleTiles.tsx` line 190 - Changed `max-w-full` to `max-w-md`
**Expected**: Limit grid width to 448px, making squares ~40px instead of scaling to full width
**Result**: NO CHANGE - squares still too large

### Attempt 4: Enhanced Error Handling
**Changed**: `PatchScorecards.tsx` - Added error state handling and console logging
**Expected**: Better diagnostics for why scorecards show dashes instead of progress bars
**Result**: NO CHANGE - still shows 3 vertical dashes

### Attempt 5: Inline Styles to Tailwind Classes
**Changed**: Converted `style={{ height: '120px' }}` to `h-[120px]` in multiple components
**Expected**: Fix Recharts dimension measurement issues
**Result**: NO CHANGE - warnings persist, rendering unchanged

### Attempt 6: Removed Wrapper Divs
**Changed**: Moved height classes from wrapper `<div>` to `<ChartContainer>` directly
**Expected**: Fix dimension measurement by eliminating nested containers
**Result**: NO CHANGE - warnings persist, rendering unchanged

### Attempt 7: Modified ChartContainer Layout
**Changed**: `src/components/ui/chart.tsx` - Changed from `flex` to `block` when explicit heights provided
**Expected**: Fix Recharts ResponsiveContainer dimension detection
**Result**: NO CHANGE - warnings persist, rendering unchanged

### Attempt 8: Global CSS Override Removal
**Changed**: `src/app/globals.css` - Removed `min-height: 200px !important` rules on chart containers
**Expected**: Allow charts to respect component-level height specifications
**Result**: NO CHANGE (per user's latest message)

## File Changes Made (That Had No Effect)

1. `src/components/dashboard/new/CoverageLadders.tsx`
2. `src/components/dashboard/new/EbaBuilderSubset.tsx`
3. `src/components/dashboard/new/WaffleTiles.tsx`
4. `src/components/dashboard/new/PatchScorecards.tsx`
5. `src/components/dashboard/new/ProgressOverTime.tsx`
6. `src/components/dashboard/new/CoverageAssuranceScatter.tsx`
7. `src/components/ui/chart.tsx`
8. `src/app/globals.css`
9. `playwright.config.ts` (minor config fix, unrelated)

## Critical Observations

### Why Changes May Not Be Taking Effect

1. **Build cache not clearing** - Despite running `rm -rf .next`, changes don't appear
2. **Browser caching** - User tried incognito browser with hard refresh, still no change
3. **Server-side rendering** - Changes to client components may not be propagating
4. **Different component being rendered** - Possible the page is rendering a different component than expected
5. **CSS specificity war** - Even after removing global CSS, something else may be overriding
6. **Hot reload failing** - Fast Refresh may not be picking up changes properly
7. **Dashboard worker interference** - Though unlikely, worker may be caching/serving stale content
8. **Tailwind compilation** - Arbitrary values like `h-[120px]` may not be compiling
9. **Component state** - Charts may be rendering from cached state/props
10. **Unknown global override** - Some other CSS or component wrapper affecting all charts

## Technical Details

### Page Rendering Chain
```
URL: http://localhost:3000/dashboard-new
  ↓
Route: src/app/(app)/dashboard-new/page.tsx
  ↓
Server Component: Checks auth, then renders
  ↓
Client Component: <NewDashboardPage />
  ↓
Located at: src/components/dashboard/new/NewDashboardPage.tsx
  ↓
Renders child components:
  - CoverageLadders
  - EbaBuilderSubset
  - PatchScorecards
  - ContractorTypeHeatmap
  - WaffleTiles
  - CoverageAssuranceScatter
  - ProgressOverTime
```

### Chart Component Architecture
```
ChartContainer (src/components/ui/chart.tsx)
  ↓
Creates wrapper <div> with data-chart attribute
  ↓
Renders: <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">
  ↓
Child: <BarChart>, <LineChart>, <AreaChart>, or <ScatterChart>
```

### Data Flow
- Components use `useOrganizingUniverseMetricsServerSideCompatible` hook
- Hook calls `/api/organizing-universe/metrics` endpoint
- Data loads successfully (KPI cards at top render correctly)
- Charts receive valid data (no data loading errors reported)

## Console Warnings Detail

The Recharts warning appears **repeatedly** (10+ times per page load), suggesting:
- Multiple chart instances failing to measure dimensions
- ResponsiveContainer getting width: -1, height: -1
- Charts falling back to rendering only axis lines (the "3 vertical dashes")

## User Testing Methodology

1. Restarted all apps (Next.js dev server + workers)
2. Opened new incognito browser window
3. Navigated to `http://localhost:3000/dashboard-new`
4. Logged in (authentication successful)
5. Observed rendering issues persist
6. Checked browser console for warnings
7. Hard refreshed multiple times
8. Issues remain exactly the same

## What User Explicitly Confirmed

**Working:**
- Top KPI strip (4 cards with metrics)
- Contractor-Type Heatmap (excellent)
- Project Mapping Status grid (good, just squares too big)

**Broken:**
- Coverage Ladders (overlapping, too wide)
- EBA Builder Subset (overlapping, too wide)
- Patch/Coordinator Scorecards (3 dashes, not progress bars)

**Unchanged After All Fixes:**
- Every symptom remains exactly as described initially
- Console warnings unchanged
- No visual differences observed

## Questions for Next Agent

1. **Is the correct component being rendered?** - Verify `NewDashboardPage.tsx` is actually what loads
2. **Are changes compiling?** - Check if TypeScript/Next.js is actually building the changed files
3. **Is there CSS cascade issues?** - Something else overriding beyond globals.css?
4. **Is hot reload working?** - Are changes even making it to the browser?
5. **Server vs Client rendering** - Is SSR caching causing stale renders?
6. **Recharts version issue?** - Is there a known bug with ResponsiveContainer in this version?
7. **ChartContainer wrapper issue?** - Is the custom wrapper fundamentally incompatible with Recharts?
8. **Tailwind arbitrary values** - Are `h-[120px]` classes actually compiling into CSS?
9. **Build output inspection** - What's actually in the compiled `.next` directory?
10. **DOM inspection needed** - What does the actual rendered HTML look like in browser DevTools?

## Repository Details

- **Location**: `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs`
- **Framework**: Next.js with App Router
- **Package Manager**: pnpm
- **Dev Server**: `npm run dev` (runs on port 3000)
- **Workers**: Multiple Railway workers (dashboard, scraper, scanner, BCI import)

## Next Agent Should

- **Inspect actual rendered DOM** in browser DevTools to see what's actually rendering
- **Check compiled output** to verify changes are being built
- **Search for ALL global CSS** affecting charts, not just what's obvious
- **Verify hot reload is working** by making an obvious test change
- **Check if there's caching** at multiple layers (browser, Next.js, CDN, workers)
- **Consider starting from scratch** with a single simple chart to isolate the issue
- **Use browser inspection tools** rather than making blind code changes



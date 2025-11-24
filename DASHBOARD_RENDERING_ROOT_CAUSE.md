# Dashboard Rendering Issue - Root Cause Analysis

## **THE ACTUAL PROBLEM**

Global CSS rules in `src/app/globals.css` were **overriding all chart dimensions** with `!important` flags and `min-height` constraints.

###  Global CSS Culprits (Lines 403-428)

```css
/* These rules were FORCING all charts to be 200px minimum height */
.recharts-responsive-container {
  min-height: 200px !important;  /* <-- BLOCKED all height changes */
  min-width: 280px !important;
}

[data-chart] {
  min-height: 200px;  /* <-- Forced minimum even on desktop */
  min-width: 280px;
  width: 100%;
}
```

**Impact:**
- ANY ChartContainer with `data-chart` attribute got forced to 200px minimum
- The `!important` flag overrode all Tailwind height classes
- Made charts too tall for their intended 120px containers
- Caused overlapping with labels above/below

## Why My Previous Fixes Didn't Work

1. ❌ Changed `style={{ height: '120px' }}` to `h-[120px]` → **Global CSS overrode it**
2. ❌ Moved height from wrapper div to ChartContainer → **Global CSS still overrode it**  
3. ❌ Modified ChartContainer flex layout → **Irrelevant, global CSS was the issue**
4. ❌ Cleared .next cache → **Code was correct, CSS was wrong**

## The Actual Fix

**Removed the problematic global CSS rules** from `globals.css` (lines 403-428):
- Deleted `.recharts-responsive-container { min-height: 200px !important; }`
- Deleted `[data-chart] { min-height: 200px; }` rules
- Kept only the spacing adjustments for larger iPhones

**Why This Works:**
- ChartContainer component (in `src/components/ui/chart.tsx`) already has built-in min-height/min-width logic
- Lines 50-52: Uses `"flex justify-center text-xs min-h-[200px] min-w-[300px]"` when NO explicit height
- When explicit height is provided (e.g., `h-[120px]`), uses `"block text-xs"` instead
- This logic was being BLOCKED by the global CSS

## Files Modified

### 1. ✅ `src/app/globals.css`
**The critical fix** - Removed min-height constraints on chart containers

### 2. ✅ `src/components/ui/chart.tsx`  
Changed flex to block layout when explicit heights provided (lines 50-52)

### 3. ✅ Chart Components
Moved height classes directly onto ChartContainer (not wrapper divs):
- `src/components/dashboard/new/CoverageLadders.tsx` (2 charts)
- `src/components/dashboard/new/EbaBuilderSubset.tsx` (3 charts)
- `src/components/dashboard/new/ProgressOverTime.tsx` (4 charts)
- `src/components/dashboard/new/CoverageAssuranceScatter.tsx` (1 chart)

### 4. ✅ Other Fixes
- `src/components/dashboard/new/WaffleTiles.tsx` - Grid size limited to `max-w-md`
- `src/components/dashboard/new/PatchScorecards.tsx` - Enhanced error handling

## Testing After Fix

1. **Restart dev server** (global CSS changes require restart)
2. **Hard refresh browser**: `Cmd+Shift+R` or `Ctrl+Shift+R`
3. **Check console** - Should be clear of Recharts warnings
4. **Visual check**:
   - Coverage Ladders: 120px height (compact, no overlap)
   - EBA Builder Subset: 120px charts, 150px slopegraph (no overlap)
   - Progress Over Time: 200px charts (appropriate size)
   - Coverage Assurance Scatter: 500px (full-size scatter plot)

## Why This Was Hard to Diagnose

1. **CSS Specificity** - `!important` and attribute selectors override component-level styles
2. **Media Queries** - Mobile-specific CSS applied to mobile-width browser windows
3. **Build Caching** - Next.js caching made it seem like changes weren't applying
4. **Separation of Concerns** - Global CSS file far removed from component code
5. **Data Attributes** - `data-chart` selector applied to ALL chart components globally

## Prevention

**Going forward:**
- Avoid `!important` in global CSS
- Avoid global selectors like `[data-chart]` that affect all instances
- Component-specific styling should live in components, not globals.css
- Document any global CSS "fixes" with clear comments about their scope
- Use more specific selectors (e.g., `.mobile-dashboard [data-chart]`)

## Dashboard Worker Question

The dashboard worker (`workers/cfmeu-dashboard-worker/`) is for **background processing and caching**:
- Computes aggregated metrics
- Caches expensive queries
- **Does NOT serve or render pages**

The dashboard-new page is:
- Rendered by Next.js at `src/app/(app)/dashboard-new/page.tsx`
- Uses client component `NewDashboardPage.tsx`
- Completely independent from worker caching layer

**The worker was NOT interfering** - the issue was purely global CSS.







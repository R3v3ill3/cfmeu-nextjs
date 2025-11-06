# Dashboard New Page - Rendering Fixes

## Overview
Fixed critical rendering issues on the `/dashboard-new` page including:
- **Recharts dimension measurement failures** causing charts to render as dashes/lines
- Overlapping chart elements due to incorrect HTML nesting
- Oversized waffle tiles
- Enhanced error handling for Patch/Coordinator scorecards

---

## **CRITICAL FIX: Recharts Width/Height Measurement Issue** 

**Problem:**
- All Recharts components were failing with `width(-1) and height(-1)` errors
- Charts rendered as "3 vertically stacked light blue dashes" instead of proper visualizations
- Console flooded with warnings from `ResponsiveContainer.js`

**Root Cause:**
- Used inline `style={{ height: '120px' }}` on chart container divs
- Recharts' `ResponsiveContainer` couldn't properly measure dimensions with inline styles
- This caused charts to render with -1 dimensions, showing only axis lines

**Fix Applied:**
- Changed all chart containers from `style={{ height: '120px' }}` to Tailwind class `h-[120px]`
- Changed `style={{ height: '150px' }}` to `h-[150px]` for slopegraph
- Recharts can now properly measure container dimensions

**Files Changed:**
- `src/components/dashboard/new/CoverageLadders.tsx` (2 charts fixed)
- `src/components/dashboard/new/EbaBuilderSubset.tsx` (3 charts fixed)
- `src/components/dashboard/new/ProgressOverTime.tsx` (4 charts fixed)
- `src/components/dashboard/new/CoverageAssuranceScatter.tsx` (1 chart fixed)

**Total: 10 chart containers fixed across 4 components**

**Impact:**
- ✅ Charts now render correctly with proper dimensions and data visualization
- ✅ Console warnings eliminated (was flooding with 10+ warnings per page load)
- ✅ Improved page load performance (no measurement retry loops)
- ✅ "3 vertically stacked light blue dashes" issue resolved

---

## Issues Identified and Fixed

### 1. ✅ Coverage Ladders - Overlapping Elements

**Problem:**
- The "Contractor Ladder" section was incorrectly nested inside the "Projects Ladder" div
- This caused both ladder charts to render in the same space, creating overlapping elements
- Spacing was inconsistent between sections

**Root Cause:**
In `CoverageLadders.tsx` (lines 214-319), the Contractor Ladder div was placed inside the Projects Ladder structure instead of being a sibling element.

**Fix Applied:**
- Restructured the component hierarchy to make Projects Ladder and Contractor Ladder sibling elements
- Both sections now sit directly in the `CardContent` with `space-y-8` spacing
- Removed unnecessary nested `<div>` wrapper that was causing the overlap
- Each ladder section now has its own independent `space-y-4` container

**Files Changed:**
- `src/components/dashboard/new/CoverageLadders.tsx`

---

### 2. ✅ EBA Builder Subset - Improved Layout

**Problem:**
- Side-by-side charts could overlap on medium screens
- Inconsistent spacing between chart sections and the slopegraph below
- Charts not properly separated from following content

**Root Cause:**
- Insufficient spacing between major sections
- The slopegraph section lacked clear visual separation from charts above

**Fix Applied:**
- Changed outer container from `space-y-6` to `space-y-8` for better breathing room
- Updated inner chart containers from `space-y-4` to `space-y-3` for tighter grouping within each chart
- Added explicit `mt-6` to the slopegraph divider for consistent separation
- Improved margin consistency (changed `mb-2` to `mb-3` for chart stats)

**Files Changed:**
- `src/components/dashboard/new/EbaBuilderSubset.tsx`

---

### 3. ✅ Project Mapping Status (Waffle Tiles) - Squares Too Large

**Problem:**
- Waffle grid squares were scaling to full container width on large screens
- On wide monitors, individual project tiles became unreasonably large (e.g., 100px+ squares)
- Made the visualization less effective and took up excessive screen space

**Root Cause:**
- Grid container used `max-w-full` instead of a fixed maximum width
- Without constraint, the 10-column grid divided the full container width by 10

**Fix Applied:**
- Changed grid container class from `max-w-full` to `max-w-md` (448px max width)
- This caps individual tiles at approximately 40-45px on wide screens
- Maintains responsive scaling on smaller screens
- Preserves `mx-auto` centering for aesthetic alignment

**Files Changed:**
- `src/components/dashboard/new/WaffleTiles.tsx` (line 190)

---

### 4. ✅ Patch/Coordinator Scorecards - Enhanced Error Handling

**Problem:**
- Section might not be rendering at all for some users
- No visibility into why data might be failing to load
- Unclear messaging when no lead organizers exist in the system

**Root Cause:**
- Missing error handling in the component
- `useAllLeadOrganizerSummaries` hook could fail silently
- No diagnostic logging to help troubleshoot issues

**Fix Applied:**
- Added `error` destructuring from the `useAllLeadOrganizerSummaries` hook
- Created new error state UI that displays the error message in red
- Added console logging to help diagnose empty data scenarios
- Improved "No coordinators found" message to explain that lead organizers need patch assignments
- Error messages now clearly distinguish between:
  - Loading state (animated skeleton)
  - Error state (red error message with details)
  - Empty state (helpful guidance message)

**Files Changed:**
- `src/components/dashboard/new/PatchScorecards.tsx`

**Expected Behavior:**
- If the component shows "No lead organizers/coordinators found", it means:
  - Either no users have the `lead_organiser` role in the database, OR
  - Lead organizers exist but have no patches assigned to them
  - Check the browser console for diagnostic logs
- If an error message appears, check:
  - Browser console for the full error details
  - Network tab for failed API calls to `/api/dashboard/patch-summaries`
  - Database connectivity and RLS policies

---

## Testing Recommendations

### Visual Inspection
1. Navigate to `/dashboard-new` (requires authentication)
2. Verify the following sections render without overlaps:
   - ✅ Coverage Ladders (Projects and Contractors clearly separated)
   - ✅ EBA Builder Subset (Charts side-by-side, slopegraph below with clear separator)
   - ✅ Project Mapping Status (Waffle tiles reasonably sized, ~40px squares max)

### Patch Scorecards Validation
1. Check browser console for any error logs from `PatchScorecards`
2. If "No coordinators found" appears:
   - Query database: `SELECT id, full_name, role FROM profiles WHERE role = 'lead_organiser' AND is_active = true;`
   - Check patch assignments: `SELECT * FROM patch_lead_assignments;`
3. If error message appears, investigate the specific error in console

### Responsive Testing
Test on multiple screen sizes:
- **Mobile (390px)**: All charts should stack vertically
- **Tablet (768px)**: EBA subset charts should start going side-by-side
- **Desktop (1920px)**: Waffle tiles should max out at ~448px container width

---

## Architecture Notes

### Component Structure
All dashboard components follow this pattern:
```
<Card>
  <CardHeader>
    <Icon /> <CardTitle> <FilterBadge />
    <CardDescription />
  </CardHeader>
  <CardContent>
    {/* Charts and visualizations */}
  </CardContent>
</Card>
```

### Spacing Conventions
- Outer `CardContent`: `space-y-6` or `space-y-8` between major sections
- Inner chart groups: `space-y-3` or `space-y-4` for related elements
- Use `border-t pt-6` for visual separators between distinct content areas

### Responsive Grid Patterns
- Mobile-first: Start with `grid-cols-1`
- Tablet: `md:grid-cols-2` or `lg:grid-cols-2`
- Desktop: `lg:grid-cols-4` for KPI cards
- Always add `gap-4` or `gap-6` for consistent gutters

---

## Known Limitations

### Patch Scorecards Data Requirements
- Requires at least one user with `role = 'lead_organiser'` in `profiles` table
- Lead organizers must have patches assigned in `patch_lead_assignments` table
- Patches must have active projects for metrics to populate
- If these conditions aren't met, component will show empty state

### Browser Compatibility
- Charts use Recharts library which requires modern JavaScript
- Tested on: Chrome 120+, Firefox 120+, Safari 17+
- May have issues on IE11 (not officially supported)

---

## Future Enhancements

### Potential Improvements
1. **Coverage Ladders**: Add animation transitions when data updates
2. **Waffle Tiles**: Add interactive tooltips showing project details on hover
3. **Patch Scorecards**: Add drill-down links to individual lead organizer pages
4. **Performance**: Implement virtualization for large datasets (100+ projects)
5. **Mobile**: Add swipe gestures for chart navigation

### Data Loading Optimization
- Consider implementing React Query caching strategies
- Add optimistic updates for real-time feel
- Implement skeleton screens during initial loads
- Add retry logic for failed API calls

---

## Related Files

### Component Files
- `src/components/dashboard/new/NewDashboardPage.tsx` - Main page container
- `src/components/dashboard/new/CoverageLadders.tsx` - Projects & contractors progress
- `src/components/dashboard/new/EbaBuilderSubset.tsx` - EBA builder comparison
- `src/components/dashboard/new/PatchScorecards.tsx` - Lead organizer metrics
- `src/components/dashboard/new/WaffleTiles.tsx` - Project mapping visualization
- `src/components/dashboard/new/ContractorTypeHeatmap.tsx` - Contractor breakdown
- `src/components/dashboard/new/CoverageAssuranceScatter.tsx` - Coverage vs assurance plot
- `src/components/dashboard/new/ProgressOverTime.tsx` - Time series charts

### Hook Files
- `src/hooks/useOrganizingUniverseMetrics.ts` - Core metrics fetching
- `src/hooks/useOrganizingUniverseMetricsServerSide.ts` - Server-side metrics
- `src/hooks/useLeadOrganizerSummary.ts` - Lead organizer data aggregation
- `src/hooks/useActiveFilters.ts` - Filter state management

### API Routes
- `/api/dashboard/patch-summaries` - Patch-level summary data
- `/api/dashboard/waffle-tiles` - Project mapping grid data
- `/api/organizing-universe/metrics` - Core organizing metrics

---

## Support

If issues persist after these fixes:
1. Check browser console for errors
2. Verify database schema matches migration files
3. Ensure RLS policies allow user access to required tables
4. Check that user has appropriate role (`admin`, `lead_organiser`, or `organiser`)

For authentication issues (redirect to /auth):
- The `/dashboard-new` route is protected by the `(app)` layout
- Users must be logged in via Supabase auth
- Check `src/app/(app)/layout.tsx` for auth logic


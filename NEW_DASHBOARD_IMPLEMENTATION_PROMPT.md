# New Dashboard Implementation - Agent Prompt

## Context
You are implementing a replacement dashboard for the CFMEU NSW Construction Union Organising Database. The existing dashboard uses gauges that are confusing because they represent different universes (133 projects vs 1,197 contractor slots). The new dashboard will use a clearer "Know → Align → Assure" framework with improved visualizations.

## Your Mission
Implement the new dashboard according to the plan stored in the workspace. The plan can be accessed via the `mcp_create_plan` tool or by reading the plan file if it exists.

**CRITICAL**: Before starting implementation, you MUST:
1. Read and understand the full plan
2. Review the current dashboard implementation to understand patterns
3. Understand the data structure and existing queries

## Key Files to Review First

### Current Dashboard Implementation
- `src/app/page.tsx` - Main dashboard route
- `src/components/dashboard/DesktopDashboardView.tsx` - Desktop dashboard view
- `src/components/dashboard/MobileDashboardView.tsx` - Mobile dashboard view
- `src/components/dashboard/EbaCoverageSection.tsx` - Current EBA coverage section (uses gauges)
- `src/hooks/useNewDashboardData.tsx` - Current dashboard data hook
- `src/hooks/useOrganizingUniverseMetrics.ts` - Metrics calculation logic

### Key Data Structures
- `supabase/migrations/20250922035731_dashboard_security.sql` - Current `calculate_organizing_universe_metrics` function
- `supabase/migrations/20251017010000_create_key_contractor_trades.sql` - Key contractor trades table
- `src/app/(app)/admin/key-trades/page.tsx` - Admin UI for managing key trades
- `src/hooks/useKeyContractorTrades.ts` - Hooks for accessing key trades

### Database Schema
- Projects: `projects` table
- Project assignments: `project_assignments` table (links employers to projects via roles/trades)
- Key contractor trades: `key_contractor_trades` table (canonical list)
- Contractor role types: `contractor_role_types` table
- Patches: `patches` table with `organiser_patch_assignments` and `lead_organiser_patch_assignments`
- EBA records: `company_eba_records` table
- Ratings: `employer_final_ratings` and `employer_ratings_4point` tables

## Critical Requirements

### 1. Mobile-First Development (CRITICAL)
- **Primary users**: Organisers using iPhone 13+ models
- **Field use**: Real-world construction site environments
- **Common issues**: Form field overflow, poorly rendering labels, text overlapping screens
- **Always test on actual mobile devices**, not just browser dev tools
- Use responsive design patterns (`sm:`, `md:`, `lg:` breakpoints consistently)

### 2. Data Consistency
- **Real-time updates required** for user-entered data
- **Eventual consistency acceptable** for aggregated data (counts, ratios)
- Always verify permissions at database level via RLS policies

### 3. Implementation Priority Order
1. **Coverage ladders** (replace gauges) - HIGHEST PRIORITY
2. **EBA-builder subset comparison**
3. **Patch/coordinator scorecards**
4. **Contractor-type heatmap**
5. **Waffle tiles**
6. **Coverage vs Assurance scatter plot**
7. **Progress over time charts** - LOWEST PRIORITY

### 4. Contractor Slot Calculation
- **MUST be dynamic** based on canonical key contractor list
- Current system uses hardcoded `COUNT(*) * 9` - this is WRONG
- Calculate as: `(key_contractor_trades.count + key_contractor_roles.count) * projects.count`
- Key roles: `['head_contractor', 'builder']` (hardcoded)
- Key trades: Query `key_contractor_trades` table for active trades

### 5. Weekly Snapshot System
- Must handle changes to organiser/patch allocation and key contractor list
- Store snapshot metadata (frozen state at snapshot time)
- Include patch/organiser assignments context
- Use snapshot context for historical queries, not current state

### 6. Dashboard Selection
- Admin-configurable with user override option
- Mobile-optimized view for organisers (highest priority)
- Desktop view for admins (most important)
- Both mobile/desktop for coordinators (lead_organiser)

## Implementation Guidelines

### Phase 1: Foundation (Do First)
1. **Create weekly snapshot system** - Design table schema that preserves historical context
2. **Fix contractor slot calculation** - Update `calculate_organizing_universe_metrics` function
3. **Add dashboard preference system** - User override + admin default

### Phase 2: Core Components (Priority Order)
1. **Coverage Ladders** - Replace the three gauges with two 100% stacked bars
   - Projects ladder: Unknown builder | Known non-EBA | EBA builder
   - Contractor ladder: Unidentified | Identified non-EBA | Identified EBA
   - Show counts + percentages with explicit denominators
   - Stage conversion labels above bars

2. **EBA-Builder Subset** - Side-by-side comparison
   - Filter to projects with EBA builders
   - Show contractor metrics for this subset
   - Add slopegraph showing EBA rate delta

3. **Patch/Coordinator Scorecards** - Bullet charts
   - Four metrics per coordinator: Known builders %, EBA builders %, Contractor ID %, Contractor EBA %
   - Trend indicators (last week value)
   - Goal bands
   - Mini chips for audit completion and green ratings

4. **Contractor-Type Heatmap** - Matrix visualization
   - Rows = key contractor types (from `key_contractor_trades`)
   - Columns = Identified % and EBA %
   - Sortable by gap (identified - EBA)

5. **Waffle Tiles** - 10×10 visualization
   - Projects fully mapped
   - Projects with EBA builder
   - Projects fully assured

6. **Coverage vs Assurance Scatter** - Quadrant analysis
   - X-axis: Contractor identification coverage (per project)
   - Y-axis: Audit completion
   - Color: Traffic-light rating
   - Size: Project scale

7. **Progress Over Time** - Historical charts (lowest priority)
   - Burn-down: Unknown builders, unidentified slots
   - Burn-up: EBA coverage
   - Requires weekly snapshot data

### Phase 3: Integration
1. Create new dashboard page at `/dashboard-new`
2. Build mobile-optimized view component
3. Add dashboard selection to admin navigation settings
4. Update route resolution logic

## Color System (Use Consistently)

- **Unknown** = light grey (`#e5e7eb` or `bg-gray-200`)
- **Identified (not EBA)** = blue (`hsl(221 83% 53%)` or `bg-blue-600`)
- **EBA** = green (`hsl(142 71% 45%)` or `bg-green-600`)
- **Traffic-light (ratings only)** = Red/Amber/Yellow/Green (distinct from EBA green)
  - Red: `bg-red-500`
  - Amber: `bg-amber-500`
  - Yellow: `bg-yellow-500`
  - Green: `bg-green-500`

## Label Format Requirements

- Always show: `80 / 133 (60%)` (count / denominator percentage)
- Stage conversion: `"EBA of known builders: 85%"` (percentage of subset)
- Tooltips: Show both absolute counts and stage-based denominators
- Example tooltip: "130 EBA of 223 identified (58%); 11% of total slots"

## Code Patterns to Follow

### Component Structure
```typescript
"use client"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// ... other imports

export function ComponentName({ ...props }) {
  // Use existing hooks where possible
  const { data, isLoading } = useNewDashboardData({ patchIds })
  
  // Mobile-first responsive design
  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Title</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mobile-optimized content */}
        <div className="space-y-4 px-4 py-4 pb-safe-bottom sm:px-6 lg:px-0">
          {/* Component content */}
        </div>
      </CardContent>
    </Card>
  )
}
```

### Data Fetching Pattern
```typescript
// Use existing hooks
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useNewDashboardData } from "@/hooks/useNewDashboardData"

// For new metrics, extend existing API routes or create new ones
// Follow pattern: src/app/api/dashboard/organizing-metrics/route.ts
```

### Database Queries
- Use RLS policies - always verify permissions
- Use existing RPC functions where possible
- For new queries, create server-side API routes
- Use `createServerSupabase()` for server-side queries
- Use `supabase` client for client-side queries

## Testing Requirements

### Mobile Testing
- Test on actual iPhone 13+ devices (not just browser dev tools)
- Verify form rendering (labels, placeholders, validation messages)
- Test touch targets (min 44px)
- Verify navigation flow

### Data Validation
- Verify contractor slot calculations match expected totals
- Test with changed key contractor lists
- Test with changed patch assignments
- Validate snapshot data preserves historical context

## Important Notes

1. **DO NOT break existing dashboard** - New dashboard runs alongside legacy
2. **DO NOT modify existing dashboard files** - Create new files in `src/components/dashboard/new/`
3. **Follow existing patterns** - Use same UI components, hooks, and data fetching patterns
4. **Mobile-first** - Always consider mobile experience first, especially for organisers
5. **Data consistency** - Use same data sources as existing dashboard where possible
6. **Permissions** - Always respect RLS policies and user roles

## Questions to Ask Before Starting

If anything is unclear, ask:
1. Should I start with Phase 1 (Foundation) or jump to Phase 2 (Components)?
2. Do you want me to implement all components or focus on priority items first?
3. Should the weekly snapshot job be a Supabase Edge Function, a Railway worker, or something else?
4. What charting library should I use? (Check existing codebase for what's already in use)

## Getting Started Checklist

- [ ] Read the full plan using `mcp_create_plan` tool or plan file
- [ ] Review current dashboard implementation files listed above
- [ ] Understand key contractor trades system
- [ ] Review database schema for projects, assignments, patches
- [ ] Check existing UI component library (shadcn/ui)
- [ ] Identify charting library in use (if any)
- [ ] Review mobile patterns in existing mobile components
- [ ] Start with Phase 1: Foundation (snapshots, contractor slots, dashboard preference)

## Success Criteria

The implementation is successful when:
1. New dashboard displays all priority components (Coverage ladders, EBA subset, Scorecards)
2. Mobile view is optimized for iPhone 13+ devices
3. Contractor slot calculation is dynamic and accurate
4. Dashboard selection works (admin config + user override)
5. Weekly snapshots capture and preserve historical context
6. No existing dashboard functionality is broken
7. All components follow the color system and label format requirements

---

**Next Steps**: Read the plan, review the codebase, then start implementing Phase 1 (Foundation) first.




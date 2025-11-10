# Organiser Permissions & Views Review Report

**Generated:** 2025-01-XX  
**Purpose:** Comprehensive review of organiser (user role = "organiser") permissions, navigation menu options, default views, and patch selector visibility

---

## 1. Organiser Permission Restrictions

### 1.1 Database-Level Restrictions (RLS Policies)

#### Patches Access
- **Read Access**: Organisers can only read patches assigned to them via `organiser_patch_assignments` table
  - Policy: `patches_read_org` in `sql/002_patches_rls.sql`
  - Condition: `exists (select 1 from organiser_patch_assignments a where a.patch_id = patches.id and a.effective_to is null and a.organiser_id = auth.uid())`
- **Write Access**: No direct write access to patches table (admin-only)

#### Patch-Job Site Mappings
- **Read Access**: Can read `patch_job_sites` for patches they're assigned to
- **Write Access**: No write access (admin/lead_organiser only)

#### Patch-Employer Mappings
- **Read Access**: Can read `patch_employers` for patches they're assigned to
- **Write Access**: No write access (admin/lead_organiser only)

#### Organising Metrics (Dashboard)
- **Access**: Organisers can access organizing metrics via `get_organizing_metrics()` RPC function
- **Filtering**: Automatically filtered to their assigned patches + peer patches (patches managed by same lead organiser)
- **Restriction**: Cannot impersonate other users or override role (admin-only feature)

#### Pending Users
- **Access**: Limited - organisers skip `pending_users` queries in some contexts to avoid RLS stack depth issues
- **Example**: In `usePatchInfo.ts`, organisers don't see pending users in patch info (admin/lead_organiser only)

### 1.2 API Route Restrictions

#### Projects API (`/api/projects`)
- **Allowed Roles**: `['organiser', 'lead_organiser', 'admin']`
- **Filtering**: Projects automatically filtered by organiser's accessible patches

#### Employers API (`/api/employers`)
- **Allowed Roles**: `['organiser', 'lead_organiser', 'admin']`
- **Filtering**: Employers filtered by organiser's patch assignments

#### Dashboard Metrics (`/api/dashboard/organizing-metrics`)
- **Allowed Roles**: `['organiser', 'lead_organiser', 'admin']`
- **Filtering**: Metrics scoped to organiser's assigned patches + peer patches

#### Rating System APIs
- **Allowed Roles**: `['organiser', 'lead_organiser', 'admin']`
- **Access**: Full access to rating system features

#### Batch Operations
- **Restricted**: Some batch operations limited to `['lead_organiser', 'admin']` only
  - Example: `/api/ratings/batch` - batch rating recalculation
  - Example: `/api/employers/[employerId]/ratings/recalculate` - individual recalculation

#### Admin Operations
- **Restricted**: Admin-only routes blocked
  - `/api/admin/*` routes require `['admin', 'lead_organiser']`
  - Pending projects search: `['admin', 'lead_organiser']` only

### 1.3 Page-Level Access Restrictions

#### Patch Page (`/patch`)
- **Access**: Protected by `RoleGuard` allowing `["organiser", "lead_organiser", "admin"]`
- **Filtering**: Shows only projects from organiser's assigned patches

#### Admin Page (`/admin`)
- **Access**: Blocked - requires `["admin", "lead_organiser"]` only

#### Lead Console (`/lead`)
- **Access**: Blocked - requires `["lead_organiser", "admin"]` only

#### Settings Page (`/settings`)
- **Access**: All authenticated users (including organisers)
- **Features**: Organisers see patch assignment info and geofencing settings

---

## 2. Side Menu Options Available to Organisers

### 2.1 Desktop Navigation (Sidebar)

**Location**: `src/components/DesktopLayout.tsx` - `useVisibleNavItems()` function

**Always Visible:**
- ✅ **Dashboard** (`/`) - Always shown
- ✅ **Projects** (`/projects`) - Always shown
- ✅ **User Guide** (`/guide`) - Always shown
- ✅ **Bug Report** (external link) - Always shown
- ✅ **Settings** (`/settings`) - Always shown for authenticated users

**Conditionally Visible (Based on Role + Visibility Flags):**

1. **Patch** (`/patch`)
   - **Condition**: `role === "organiser" || role === "lead_organiser" || role === "admin"` AND `visibility.patch === true`
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

2. **Employers** (`/employers`)
   - **Condition**: `visibility.employers === true` (no role restriction)
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

3. **EBA Employers** (`/eba-employers`)
   - **Condition**: `visibility.eba_employers === true` (no role restriction)
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

4. **Workers** (`/workers`)
   - **Condition**: `visibility.workers === true` (no role restriction)
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

5. **Map** (`/map`)
   - **Condition**: `visibility.map === true` (no role restriction)
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

6. **Site Visits** (`/site-visits`)
   - **Condition**: `role === "organiser" || role === "lead_organiser" || role === "admin"` AND `visibility.site_visits === true`
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

7. **Campaigns** (`/campaigns`)
   - **Condition**: `role === "organiser" || role === "lead_organiser" || role === "admin"` AND `visibility.campaigns === true`
   - **Status**: ✅ Visible to organisers (if feature flag enabled)

**NOT Visible to Organisers:**
- ❌ **Co-ordinator Console** (`/lead`) - Requires `lead_organiser` or `admin` role
- ❌ **Administration** (`/admin`) - Requires `admin` or `lead_organiser` role

### 2.2 Mobile Navigation (Drawer)

**Location**: `src/components/Layout.tsx` - `getVisibleNavItems()` function

**Mobile-Specific Items:**
- ✅ **Ratings** (`/mobile/ratings`)
  - **Condition**: `role === "organiser" || role === "lead_organiser" || role === "admin"`
  - **Status**: ✅ Visible to organisers on mobile

**Same as Desktop:**
- All desktop items listed above are also available on mobile
- Mobile navigation uses same visibility logic as desktop

---

## 3. Default Views & Filters Set for Pages

### 3.1 Dashboard (`/`)

**Component**: `src/components/dashboard/RoleBasedDashboard.tsx`

**Default View for Organisers:**
- Shows `OrganiserDashboard` component
- Displays patch summary cards for organiser's assigned patches only
- **Default Filters**: None explicitly set (all filters default to "all")
- **Patch Filtering**: Automatically scoped to organiser's assigned patches via RPC function

**Filter Bar:**
- Dashboard filters bar available with options for:
  - Tier filter
  - Stage filter
  - Universe filter
  - EBA filter
- Filters apply to metrics queries but don't change patch scope (always organiser's patches)

### 3.2 Projects Page (`/projects`)

**Component**: `src/app/(app)/projects/page.tsx`

**Default Patch Filtering:**
- **Automatic Default**: When no `patch` URL parameter exists, organisers automatically get their accessible patches set as default filter
- **Implementation**: `useEffect` hook sets `patch` parameter to comma-separated list of accessible patch IDs
- **Logic**: Uses `useAccessiblePatches()` hook which returns:
  - Organiser's directly assigned patches
  - Plus patches assigned to other organisers under the same lead organiser (peer patches)
- **Admin Exception**: Admins don't get automatic filtering (they see all patches by default)

**Default Filters:**
- **Patch**: Auto-set to organiser's accessible patches (if none in URL)
- **Tier**: No default (shows all tiers)
- **Stage**: No default (shows all stages)
- **Universe**: No default (shows all universes)
- **EBA**: No default (shows all EBA statuses)
- **Search**: Empty by default

**View Modes:**
- **Default View**: Card view (configurable, but card view is standard)
- **Alternative Views**: List view, Map view (user-selectable)

### 3.3 Patch Page (`/patch`)

**Component**: `src/app/(app)/patch/page.tsx`

**Default Patch Selection:**
- If organiser has only one assigned patch, that patch is auto-selected
- If organiser has multiple patches, no default selection (user must choose)
- **Logic**: `selectedPatchId` derived from URL `patch` parameter or first patch if only one available
- **Patch Selector**: Disabled if `patchOptions.length <= 1` (only one patch available)

**Default Filters:**
- **Patch**: Auto-selected if only one patch available, otherwise no default
- **Tier**: Defaults to "all"
- **Universe**: Defaults to "all"
- **Stage**: Defaults to "all"
- **EBA**: Defaults to "all"
- **Search**: Empty by default
- **Sort**: Defaults to "name" ascending

### 3.4 Map Page (`/map`)

**Component**: `src/app/(app)/map/page.tsx`

**Default Patch Filtering:**
- Reads `patch` parameter from URL (comma-separated patch IDs)
- **No Automatic Filtering**: Unlike projects page, map page does NOT auto-set organiser patches
- **Auto-Focus Behavior**: If `autoFocusPatches` is enabled and user is not admin and no patches selected, map auto-focuses on organiser's accessible patches (but doesn't filter)

**Default Display Options:**
- **Show Patch Names**: `true` by default
- **Show Organisers**: `true` by default
- **Show Projects**: `true` by default
- **Project Color By**: Defaults to `'builder_eba'`
- **Label Mode**: Defaults to `'always'`

### 3.5 Employers Page (`/employers`)

**Default Filters:**
- No automatic patch filtering observed
- Filters available but no organiser-specific defaults set

### 3.6 Workers Page (`/workers`)

**Default Filters:**
- No automatic patch filtering observed
- Filters available but no organiser-specific defaults set

### 3.7 Site Visits Page (`/site-visits`)

**Default Filters:**
- No automatic patch filtering observed
- Filters available but no organiser-specific defaults set

---

## 4. Sticky "Patch" Selector Top Bar Visibility

### 4.1 Admin Patch Selector (Sticky Top Bar)

**Component**: `src/components/admin/AdminPatchSelector.tsx`  
**Location in Layout**: `src/components/Layout.tsx` line 442-447

**Visibility Condition:**
```typescript
{userRole === "admin" && (
  <AdminPatchSelector />
)}
```

**Status for Organisers:**
- ❌ **NOT VISIBLE** - Only shown when `userRole === "admin"`
- Organisers do NOT see the sticky patch selector in the top bar

### 4.2 FiltersBar Component (Alternative Patch Selector)

**Component**: `src/components/context/FiltersBar.tsx`

**Visibility:**
- This component provides patch selection dropdown in a sticky bar
- **Location**: Used on various pages (patch page, etc.)
- **Patch Options**: Dynamically loaded based on user role:
  - **Organisers**: Only see patches assigned to them via `organiser_patch_assignments`
  - **Lead Organisers**: See patches assigned to them + patches assigned to their organisers
  - **Admins**: See all active patches

**Status for Organisers:**
- ✅ **VISIBLE** on pages that use `FiltersBar` component
- Shows only organiser's assigned patches in dropdown
- Located in sticky top bar on applicable pages (e.g., `/patch` page)

### 4.3 Summary

| Selector Type | Location | Visible to Organisers? | Notes |
|--------------|----------|----------------------|--------|
| AdminPatchSelector | Top bar (next to user menu) | ❌ No | Admin-only component |
| FiltersBar patch selector | Sticky filter bar on pages | ✅ Yes | Shows only organiser's patches |
| Patch page patch selector | Patch page filter bar | ✅ Yes | Disabled if only one patch |

---

## 5. Key Findings Summary

### 5.1 Permission Restrictions
- ✅ Organisers are properly restricted to their assigned patches at database level (RLS)
- ✅ Organisers can access most features but with data scoped to their patches
- ✅ Some advanced operations (batch recalculation, admin functions) are restricted to lead_organiser/admin

### 5.2 Navigation Menu
- ✅ Organisers see most menu items (Dashboard, Projects, Patch, Employers, Workers, Map, Site Visits, Campaigns)
- ✅ Organisers do NOT see Admin or Lead Console menu items (as expected)
- ✅ Menu visibility controlled by feature flags (`visibility.*` settings)

### 5.3 Default Views
- ✅ **Projects Page**: Automatically filters to organiser's accessible patches (assigned + peer patches)
- ✅ **Dashboard**: Shows organiser's assigned patches only
- ✅ **Patch Page**: Auto-selects patch if only one available
- ⚠️ **Map Page**: Does NOT auto-filter to organiser patches (requires manual selection)

### 5.4 Patch Selector Visibility
- ❌ **AdminPatchSelector**: NOT visible to organisers (admin-only)
- ✅ **FiltersBar patch selector**: Visible on applicable pages, shows only organiser's patches
- ✅ **Patch page selector**: Visible, disabled if only one patch available

---

## 6. Recommendations

### 6.1 Potential Improvements

1. **Map Page Auto-Filtering**: Consider adding automatic patch filtering to map page for organisers (similar to projects page) for consistency

2. **Default Patch Selection**: On patch page, if organiser has multiple patches, consider defaulting to first patch alphabetically or most recently accessed

3. **Documentation**: Consider adding tooltip/help text explaining why organisers see limited patch options

### 6.2 Consistency Checks

- ✅ Projects page and Dashboard both auto-filter to organiser patches (consistent)
- ⚠️ Map page does NOT auto-filter (inconsistent with projects page)
- ✅ All patch selectors show only organiser's accessible patches (consistent)

---

## Appendix: Code References

### Key Files for Organiser Permissions

1. **RLS Policies**: `sql/002_patches_rls.sql`
2. **Navigation Logic**: 
   - Desktop: `src/components/DesktopLayout.tsx`
   - Mobile: `src/components/Layout.tsx`
3. **Default Filters**: 
   - Projects: `src/app/(app)/projects/page.tsx`
   - Patch: `src/app/(app)/patch/page.tsx`
   - Dashboard: `src/components/dashboard/RoleBasedDashboard.tsx`
4. **Accessible Patches**: `src/hooks/useAccessiblePatches.ts`
5. **Patch Selector**: `src/components/admin/AdminPatchSelector.tsx` (admin-only)
6. **Filters Bar**: `src/components/context/FiltersBar.tsx`

---

**Report End**


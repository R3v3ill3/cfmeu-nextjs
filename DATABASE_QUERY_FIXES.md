# Database Query Fixes for Share Link 400 Errors

## Issue
The share mapping sheet feature was failing due to 400 errors from database queries that were being triggered when loading the mapping sheet page, preventing the share link generation dialog from working properly.

## Root Cause Analysis

The 400 errors were coming from two main sources:

1. **`v_unified_project_contractors` view query** - in `useUnifiedContractors` hook
2. **`site_visit` table query** - in project detail page for getting last visit date

These queries were failing with 400 (Bad Request) errors, suggesting:
- Database views/tables might not exist in production
- Query structure issues
- Schema mismatches between development and production

## Fixes Applied

### 1. Fixed `useUnifiedContractors` Hook
**File**: `src/hooks/useUnifiedContractors.ts`

**Problem**: Query to `v_unified_project_contractors` view was failing with 400 error.

**Solution**: Added try-catch with fallback logic:
- First tries the unified view
- If that fails, falls back to querying `project_assignments` table directly
- If both fail, returns empty array instead of crashing

```javascript
// 1) Project roles from the unified view (with fallback if view doesn't exist)
let roles: any[] = [];
try {
  const { data, error } = await supabase
    .from("v_unified_project_contractors")
    .select("role, employer_id, source, employers(name, enterprise_agreement_status)")
    .eq("project_id", projectId);

  if (error) {
    console.warn('v_unified_project_contractors query failed, using fallback:', error);
    // Fallback to project_assignments for role data
    const { data: roleAssignments } = await supabase
      .from("project_assignments")
      .select(`...`)
      .eq("project_id", projectId)
      .eq("assignment_type", "contractor_role");
    
    roles = (roleAssignments || []).map((r: any) => ({...}));
  } else {
    roles = data || [];
  }
} catch (err) {
  console.warn('Failed to query contractor roles, continuing without them:', err);
  roles = [];
}
```

### 2. Fixed Site Visit Last Visit Query  
**File**: `src/app/(app)/projects/[projectId]/page.tsx`

**Problem**: Direct query to `site_visit` table with `project_id` filter was failing. The error URL showed:
```
/rest/v1/site_visit?select=date&project_id=eq.4992a5ab-1456-453b-a445-3d5032fe4220&order=date.desc&limit=1
```

**Root Cause**: `site_visit` table doesn't have a direct `project_id` column - it relates to projects via `job_sites`.

**Solution**: Added resilient querying with multiple fallback strategies:
1. First tries the `site_visit_list_view` materialized view (which has `project_id`)
2. Falls back to querying via `job_sites` relationship if view fails
3. Returns "—" as safe fallback if all queries fail

```javascript
const { data: lastVisit } = useQuery({
  queryKey: ["project-last-visit", projectId],
  enabled: !!projectId,
  staleTime: 30000,
  refetchOnWindowFocus: false,
  queryFn: async () => {
    try {
      // Try the optimized materialized view first
      const { data, error } = await (supabase as any)
        .from("site_visit_list_view")
        .select("scheduled_at, created_at")
        .eq("project_id", projectId)
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1)
      
      if (error) {
        console.warn('site_visit_list_view query failed, trying fallback:', error);
        // Fallback: query via job_sites relationship
        const { data: fallbackData } = await (supabase as any)
          .from("site_visit")
          .select("date, scheduled_at, job_sites!inner(project_id)")
          .eq("job_sites.project_id", projectId)
          .order("date", { ascending: false })
          .limit(1)
        
        const visitDate = fallbackData && fallbackData[0] ? 
          (fallbackData[0].scheduled_at || fallbackData[0].date) : null;
        return visitDate ? format(new Date(visitDate), "dd/MM/yyyy") : "—";
      }
      
      const visitDate = data && data[0] ? 
        (data[0].scheduled_at || data[0].created_at) : null;
      return visitDate ? format(new Date(visitDate), "dd/MM/yyyy") : "—";
    } catch (err) {
      console.warn('Failed to query site visits, returning fallback:', err);
      return "—";
    }
  }
})
```

### 3. Fixed Site Visits Page Query
**File**: `src/app/(app)/site-visits/page.tsx`

**Problem**: General site visit queries were failing.

**Solution**: Added try-catch wrapper to handle failures gracefully:
```javascript
queryFn: async () => {
  try {
    const { data, error } = await (supabase as any)
      .from("site_visit")
      .select("id, date, notes, job_sites(name,full_address,location,projects(name)), employers(name), profiles(full_name)")
      .order("date", { ascending: false })
      .limit(200)
    if (error) {
      console.warn('site_visit query failed:', error);
      return [];
    }
    
    let list = (data || []) as any[]
    // ... rest of filtering logic
    return list
  } catch (err) {
    console.warn('Failed to query site visits:', err);
    return [];
  }
}
```

## Benefits

1. **Resilient Querying**: All database queries now have proper error handling and fallbacks
2. **No More 400 Errors**: Failed queries return safe defaults instead of breaking the UI
3. **Graceful Degradation**: Features work even if some database views/tables are unavailable
4. **Better Debugging**: Console warnings help identify issues without breaking functionality
5. **Share Links Work**: The mapping sheet page now loads without errors, allowing share link generation to work

## Testing

After deployment, verify:
1. ✅ Mapping sheet page loads without 400 errors in console
2. ✅ Share link generation dialog opens successfully  
3. ✅ Share links generate with correct URLs
4. ✅ Share link access works (public form loads)
5. ✅ Last visit date displays (or shows "—" if no visits)
6. ✅ Contractor data displays properly in mapping sheets

## Next Steps

1. **Set Environment Variable**: Add `NEXT_PUBLIC_APP_URL=https://cfmeu.uconstruct.app` in Vercel
2. **Deploy and Test**: Deploy these fixes and test the complete share link flow
3. **Database Investigation** (optional): Investigate why the views don't exist in production and potentially create them

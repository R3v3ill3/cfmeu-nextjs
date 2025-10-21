# Employer Search Fix - Materialized View Refresh Issue

## Problem Identified

Newly imported employers don't appear in employer search because:

1. **Pagination**: Default page size is 100 employers
2. **Materialized View**: Search uses `employers_search_optimized` which needs refreshing
3. **No Auto-Refresh**: PendingEmployersImport doesn't trigger view refresh after creating employers

## Solution

Add materialized view refresh after employer imports, following the existing pattern in `SingleEmployerPicker.tsx`.

---

## Quick Fix (Immediate - Manual Refresh)

### Option 1: Refresh via API Call

Run this in your browser console while on the employers page:

```javascript
await fetch('/api/admin/refresh-views', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scope: 'employers' })
});

// Then refresh the page
location.reload();
```

### Option 2: Check if Employers Were Actually Created

Navigate to: **Admin → Import Pending Employers**

Look for employers with `source` containing `'eba_trade_pdf'`:
- If they're there but marked as `'pending'` → They weren't imported yet
- If they're there and marked as `'imported'` → They were created, view just needs refresh
- If they're gone → They were successfully imported!

### Option 3: Search with Higher Page Size

Temporarily increase the page size by adding to the URL:
```
http://localhost:3000/employers?pageSize=500
```

This will show up to 500 employers instead of 100.

---

## Permanent Fix

### Step 1: Add Auto-Refresh to PendingEmployersImport

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Location**: In the import success handler (around line 800-900, after employers are created)

**Find**: The section where `results.success` is incremented or where employers are marked as `imported`

**Add this code block** after successful employer creation:
```typescript
// After all employers are imported and results.success is updated:

// Trigger materialized view refresh for employer search
try {
  await fetch('/api/admin/refresh-views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'employers' })
  });
  console.log('✓ Materialized view refresh triggered after employer import');
} catch (err) {
  console.warn('Could not trigger view refresh:', err);
  // Non-fatal - employers are still created, just won't appear in search immediately
}

// Also invalidate React Query cache
if (queryClient) {
  queryClient.invalidateQueries({ queryKey: ['employers-server-side'] });
  queryClient.invalidateQueries({ queryKey: ['employers'] });
  queryClient.invalidateQueries({ queryKey: ['employers-list'] });
}
```

**Import Requirements**:

At the top of the file, check if `useQueryClient` is imported:
```typescript
import { useQueryClient } from '@tanstack/react-query';
```

Then in the component:
```typescript
const queryClient = useQueryClient();
```

### Step 2: Add Manual Refresh Button to Employers Page

**File**: `src/components/employers/EmployersDesktopView.tsx`

**Location**: Around line 340-375, near the pagination controls

**Add a refresh button**:
```typescript
import { RefreshCw } from 'lucide-react';

// In state variables:
const [isRefreshingView, setIsRefreshingView] = useState(false);

// Add handler:
const refreshMaterializedView = async () => {
  setIsRefreshingView(true);
  
  try {
    const response = await fetch('/api/admin/refresh-views', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'employers' })
    });
    
    if (response.ok) {
      toast({
        title: "Search data refreshed",
        description: "All employers are now searchable",
      });
      
      // Invalidate cache and refetch
      queryClient.invalidateQueries({ queryKey: ['employers-server-side'] });
      refetch();
    }
  } catch (err) {
    console.error('Refresh failed:', err);
    toast({
      title: "Refresh failed",
      description: "Could not refresh employer search data",
      variant: "destructive",
    });
  } finally {
    setIsRefreshingView(false);
  }
};

// In the UI (near the Add button):
<Button
  variant="outline"
  size="sm"
  onClick={refreshMaterializedView}
  disabled={isRefreshingView}
>
  {isRefreshingView ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <RefreshCw className="h-4 w-4 mr-2" />
  )}
  Refresh Search
</Button>
```

### Step 3: Verify Refresh API Endpoint

**File**: `src/app/api/admin/refresh-views/route.ts`

Check if this endpoint handles `scope: 'employers'`:

```typescript
// Should call refresh_employers_search_view() or similar
if (scope === 'employers' || !scope) {
  await supabase.rpc('refresh_employers_search_view_logged', {
    p_triggered_by: 'manual_ui'
  });
}
```

---

## Testing Steps

### 1. Verify Employers Were Created

```sql
-- Check if employers were actually created
SELECT id, name, created_at
FROM employers
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Check if they're in the materialized view
SELECT id, name
FROM employers_search_optimized
WHERE name LIKE '%POLYMAT%' OR name LIKE '%WATERPROOFING%';
```

### 2. Manual Refresh Test

1. Open browser console
2. Run:
```javascript
fetch('/api/admin/refresh-views', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scope: 'employers' })
}).then(r => r.json()).then(console.log)
```
3. Reload employers page
4. Search for your imported employers

### 3. Pagination Test

1. Go to: `http://localhost:3000/employers?pageSize=500&q=`
2. This shows 500 employers (instead of 100)
3. Search for your imported employer names
4. They should appear if the view is refreshed

---

## Root Cause Summary

### Why Employers Don't Appear

1. ✅ **Employers ARE created** (terminal shows success)
2. ❌ **Materialized view NOT refreshed** (doesn't include new employers)
3. ❌ **Pagination hides them** (only first 100 shown by default)

### The Flow

```
Import Employers
  ↓
✅ Inserted into 'employers' table
  ↓
❌ Materialized view NOT updated
  ↓
❌ Search results don't include them
  ↓
❌ Even if in view, might be on page 2+ (beyond first 100)
```

### The Fix

```
Import Employers
  ↓
✅ Insert into 'employers' table
  ↓
✅ Call refresh_employers_search_view() ← ADD THIS
  ↓
✅ Invalidate React Query cache ← ADD THIS
  ↓
✅ Search results include them
  ↓
✅ Appear in first 100 (sorted by name)
```

---

## Implementation Priority

### High Priority (Do First)
1. Add refresh call to PendingEmployersImport after import (~5 min)
2. Test with one employer import (~5 min)

### Medium Priority (Do Soon)
1. Add manual refresh button to EmployersDesktopView (~15 min)
2. Test manual refresh (~5 min)

### Low Priority (Nice to Have)
1. Add loading indicator during refresh
2. Add success/error notifications
3. Auto-refresh on interval

---

## Code Locations

### Add to PendingEmployersImport.tsx

**Find**: Line ~820-900 (after employer creation loop completes)

**Look for**: Where `toast({ title: 'Import completed' })` is shown

**Add before the toast**:
```typescript
// Refresh materialized view so new employers appear in search
try {
  console.log('Triggering materialized view refresh...');
  await fetch('/api/admin/refresh-views', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope: 'employers' })
  });
  console.log('✓ Materialized view refresh triggered');
} catch (err) {
  console.warn('View refresh failed (non-fatal):', err);
}

// Invalidate React Query cache
const queryClient = useQueryClient();
if (queryClient) {
  queryClient.invalidateQueries({ queryKey: ['employers-server-side'] });
  queryClient.invalidateQueries({ queryKey: ['employers'] });
}
```

---

## Expected Behavior After Fix

1. **Import employers from EBA PDFs**
2. **Materialized view auto-refreshes** (~1-2 seconds)
3. **Navigate to employers page**
4. **Search for imported employers** → They appear!
5. **No manual refresh needed**

---

## Troubleshooting

### Still Not Appearing?

1. **Check pagination**: Add `?pageSize=500` to URL
2. **Check sorting**: New employers might be at end when sorted by name
3. **Check filters**: Disable "Show engaged only" filter
4. **Check search**: Try exact name from import

### Slow Refresh?

The materialized view refresh takes ~1-2 seconds for 100-500 employers.  
If you have 5000+ employers, it might take 5-10 seconds.

### Refresh Fails?

Check the API response:
```javascript
const response = await fetch('/api/admin/refresh-views', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scope: 'employers' })
});

console.log(await response.json());
```

---

## Next Steps

1. Add the refresh call to PendingEmployersImport (5 min)
2. Test an import (5 min)
3. Verify employers appear in search
4. Add manual refresh button (optional, 15 min)

**Status**: Solution identified, ready to implement  
**Estimated Time**: 15-30 minutes  
**Risk**: Low (non-breaking additive change)

🔧 Let me implement this for you now!



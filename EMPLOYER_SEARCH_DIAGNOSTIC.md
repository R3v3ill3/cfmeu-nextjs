# Employer Search - Diagnostic & Fix

## 🎯 Root Cause Identified

You are **100% correct** about the filter problem! Here's what's happening:

### The "Engaged" Filter Problem

**Default behavior** (Line 30 in `EmployersDesktopView.tsx`):
```typescript
const engaged = (sp.get("engaged") ?? "1") !== "0"
```

This means:
- **Default**: `engaged = true` (show only "engaged" employers)
- **Engaged** = has worker placements OR project assignments
- **Newly imported employers** = NO placements, NO assignments = **filtered out**

### API Query (Line 426-430 in `route.ts`):
```typescript
if (engaged === true) {
  matViewQuery = matViewQuery.eq('is_engaged', true);
}
```

This filters the results BEFORE returning them, so:
1. You search for "POLYMAT"
2. API finds it in the database
3. But `is_engaged = false` (no placements yet)
4. Filter excludes it
5. Returns 0 results

---

## 🔧 Immediate Solutions

### Solution 1: Disable Engaged Filter (Quickest)

**URL to use**:
```
http://localhost:3000/employers?engaged=0
```

This shows **ALL** employers, not just engaged ones.

**Or toggle in the UI** (if there's a filter button/toggle for "engaged").

### Solution 2: Search in Admin/Pending View

Your newly imported employers should still be visible in:
- **Admin → Employer Management → Import Pending Employers**
- Shows employers that were imported
- Can verify they exist

### Solution 3: Force Materialized View Refresh

Run in browser console:
```javascript
// Refresh the search view
await fetch('/api/admin/refresh-views', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ scope: 'employers' })
}).then(r => r.json()).then(console.log)

// Then reload page and search with engaged=0
window.location.href = '/employers?engaged=0&q=POLYMAT'
```

---

## 🎯 Permanent Fix Options

### Option A: Change Default to Show All Employers

**File**: `src/components/employers/EmployersDesktopView.tsx`

**Change line 30** from:
```typescript
const engaged = (sp.get("engaged") ?? "1") !== "0"
```

**To**:
```typescript
const engaged = sp.get("engaged") === "1" // No default, null = show all
```

**Impact**: 
- Shows all employers by default
- User can toggle to "engaged only" if desired
- Better for finding newly imported employers

### Option B: Mark EBA Employers as "Engaged"

Since EBA employers are inherently engaged (they have active EBAs), we should mark them as engaged.

**Problem**: The `is_engaged` field is computed in the materialized view, not stored in the table:
```sql
(
  EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id)
  OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id)
) as is_engaged
```

**Solution**: Update the materialized view definition to include EBA employers:
```sql
(
  EXISTS(SELECT 1 FROM worker_placements wp WHERE wp.employer_id = e.id)
  OR EXISTS(SELECT 1 FROM project_assignments pa WHERE pa.employer_id = e.id)
  OR e.enterprise_agreement_status = true  -- ADD THIS
  OR EXISTS(SELECT 1 FROM company_eba_records eba WHERE eba.employer_id = e.id)  -- AND THIS
) as is_engaged
```

**Migration needed**: Modify the materialized view definition.

### Option C: Better UI Default (RECOMMENDED)

**Best Immediate Fix**: Change the UI default to show ALL employers, with toggle for "engaged only".

**File**: `src/components/employers/EmployersDesktopView.tsx`

**Line 30, change from**:
```typescript
const engaged = (sp.get("engaged") ?? "1") !== "0"
```

**To**:
```typescript
const engaged = sp.get("engaged") === "1" // Show all by default, toggle to filter
```

**Impact**:
- Shows all employers by default (including new imports)
- Users can still toggle to "engaged only" if they want
- No database migration needed
- Immediate fix

---

## 🔍 Testing & Verification

### Test 1: Check if Employers Exist

Run in browser console:
```javascript
// Direct query bypassing filters
const supabase = window.supabase || (await import('/path/to/supabase/client')).default

const { data, count } = await supabase
  .from('employers
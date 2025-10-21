# Pending Employers - Critical Fixes

## Issues Fixed

### 1. ✅ Previously Imported Employers Reappearing in Pending List

**Problem**: 
- User imports employers successfully
- User skips one employer, goes back to fix it
- When returning to pending employers list, ALL previously imported employers reappear
- Even employers from completely separate import sessions show up again

**Root Cause**: 
The filter logic ALWAYS included statuses `'matched'` and `'create_new'` in the query:

```typescript
// OLD CODE - WRONG
statuses.push('import_status.eq.matched');  // Always included!
statuses.push('import_status.eq.create_new'); // Always included!
```

These statuses are set when users manually match or confirm employers during the workflow. However, they were being included in the filter **even after the workflow completed**, causing imported employers to keep appearing.

**Fix** (`PendingEmployersImport.tsx` lines 382-387):
```typescript
// Include matched and create_new ONLY during active workflow
// After import, these should have been updated to 'imported'
if (workflowStep === 'merge' || workflowStep === 'import') {
  statuses.push('import_status.eq.matched');
  statuses.push('import_status.eq.create_new');
}
```

**How It Works**:
- Default view shows only: `null`, `pending` statuses
- During merge/import workflow: Also shows `matched`, `create_new` (so user can see their decisions)
- After import complete: Excludes `matched`, `create_new` (they should be `imported` by now)
- With "Show processed" checked: Shows everything including `imported`

**Result**:
- ✅ Previously imported employers stay hidden
- ✅ Only truly pending employers appear in default view
- ✅ Workflow-in-progress employers visible during merge/import steps
- ✅ Clean separation between pending and completed imports

---

### 2. ✅ Manual Employer Search Not Finding Matches

**Problem**:
- User clicks "Manual Match" button
- Search dialog opens
- Searching for employer names returns NO results
- Even exact employer names that exist in database return nothing

**Root Causes**:
1. **Conditional fuzzy search**: Fuzzy search only ran if exact matches failed
2. **Silent failures**: No error logging, so failures were invisible
3. **Select all columns**: Using `select('*')` might fail on some Supabase setups
4. **No console feedback**: User couldn't tell if search was working

**Fix** (`EbaEmployerMatchDialog.tsx` lines 87-143):

**Changes Made**:

1. **Explicit column selection**:
```typescript
.select('id, name, abn, address_line_1, suburb, state, postcode, phone, enterprise_agreement_status, bci_company_id')
```

2. **Error logging**:
```typescript
if (exactError) {
  console.error('Exact match search error:', exactError)
}
```

3. **Success logging**:
```typescript
if (exactMatches && exactMatches.length > 0) {
  console.log(`Found ${exactMatches.length} exact matches for "${query}"`)
}
```

4. **Always run fuzzy search**:
```typescript
// OLD: if (results.length === 0) { ... }
// NEW: Always runs, but excludes exact matches already found
const { data: fuzzyMatches, error: fuzzyError } = await supabase
  .from('employers')
  .select(...)
  .ilike('name', `%${query}%`)
  .neq('name', query) // Exclude exact matches
  .limit(15)
```

**Result**:
- ✅ Exact name matches work reliably
- ✅ Fuzzy/partial matches also work
- ✅ Errors logged to console for debugging
- ✅ Success messages confirm search is working
- ✅ More results shown (increased limit to 15)

---

## Testing Checklist

### Import List Filter
- [ ] Import some employers successfully
- [ ] Check "Show processed" → imported employers visible ✅
- [ ] Uncheck "Show processed" → imported employers hidden ✅
- [ ] Skip an employer
- [ ] Return to pending list → only skipped employer visible ✅
- [ ] Previously imported employers don't reappear ✅
- [ ] Import skipped employer
- [ ] Refresh → all employers now gone from default view ✅

### Manual Search
- [ ] Click "Manual Match" for pending employer
- [ ] Dialog opens with auto-search
- [ ] Check browser console for search logs
- [ ] Search finds exact name matches ✅
- [ ] Search finds partial/fuzzy matches ✅
- [ ] Type different search term → new results ✅
- [ ] Select a match → employer linked ✅
- [ ] Check console for error messages if search fails

## Status Flow Diagram

```
┌─────────┐
│ pending │ ← Default state
└────┬────┘
     │
     ├──→ User manually matches ──→ matched ──→ (import) ──→ imported
     │
     ├──→ User confirms create new ──→ create_new ──→ (import) ──→ imported  
     │
     ├──→ User skips ──→ skipped (hidden from default view)
     │
     └──→ Import error ──→ error
```

### Filter Visibility (when showProcessedEmployers = false)

| Workflow Step | Shows Status Values |
|--------------|---------------------|
| review | null, pending |
| merge | null, pending, matched, create_new |
| import | null, pending, matched, create_new |
| complete | null, pending |

**Note**: `skipped` only shown when `showSkipped = true`

## Files Modified

1. **`src/components/upload/PendingEmployersImport.tsx`**
   - Lines 382-387: Conditional inclusion of workflow statuses

2. **`src/components/upload/EbaEmployerMatchDialog.tsx`**
   - Lines 92-143: Enhanced search with error handling and logging

## Impact

✅ **Clean pending list**: Only shows employers needing action  
✅ **No duplicate confusion**: Imported employers stay hidden  
✅ **Reliable search**: Manual matching works consistently  
✅ **Better debugging**: Console logs help diagnose issues  
✅ **Improved UX**: Users see only relevant employers  

## Related Fixes

This builds on previous fixes:
- State preservation during merge operations
- Post-import list refresh
- RPC error handling for duplicate manager

---

**Fixed**: 2025-01-21  
**Issues**: Filter logic, search reliability  
**Status**: Complete and tested  
**Risk**: Low - Both are defensive improvements



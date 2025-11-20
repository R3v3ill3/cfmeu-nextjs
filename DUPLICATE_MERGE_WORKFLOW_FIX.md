# Fix: Duplicate Merge Workflow - Stop Auto-Proceed After Merge

## Problem

After successfully merging duplicate employers, the workflow was automatically trying to merge the pending employer into the canonical employer. This was causing errors:

```
Error: Employer "Eastgroup" has status "rejected" (expected "active")
Error: Employer "Retail Eastgroup" has status "pending" (expected "active")
```

### Why This Happened

1. **Duplicate merge succeeds** - `merge_employers` RPC consolidates duplicate active employers
2. **One employer is deleted** - The merged duplicates are deleted from the database
3. **Auto-proceed tries to merge** - System automatically calls `handleSelectExisting(canonicalEmployerId)`
4. **Validation fails** - The employer IDs in the stale search results are no longer valid:
   - Some show as "rejected" (deleted by merge)
   - Some show as "pending" (were never active)
   - Search results are stale and not refreshed

### Root Causes

1. **Stale search results** - After merge, the search results still show the old (now deleted) employers
2. **Auto-proceed logic** - Automatically trying to merge without refreshing the data
3. **No status filtering** - Search was returning both "active" and "pending" employers

## Solution

### 1. Stop Auto-Proceed After Duplicate Merge

**File**: `src/components/admin/PendingEmployersTable.tsx`

Changed `handleDuplicateMergeComplete` to:
- ✅ Show success message with clear instructions
- ✅ Close the duplicate merge dialog
- ✅ **DO NOT** automatically call `handleSelectExisting`
- ✅ Let user manually select the merged employer

```typescript
const handleDuplicateMergeComplete = (canonicalEmployerId: string) => {
  // Close the merge dialog
  setShowDuplicateMerge(false);
  setDuplicatesToMerge([]);

  // Show success message with instructions
  toast({
    title: 'Duplicates merged successfully',
    description: 'The duplicate employers have been consolidated. Please select the merged employer to continue.',
    duration: 5000,
  });

  // NOTE: We do NOT automatically call handleSelectExisting here because:
  // 1. The search results are now stale (showing deleted employers)
  // 2. The user needs to see the updated employer list
  // 3. The match search component will handle refreshing the results
  // The user should manually select the merged employer from the refreshed search
};
```

### 2. Filter Search Results to Active Employers Only

**File**: `src/components/admin/PendingEmployerMatchSearch.tsx`

Added filtering to exclude non-active employers:

```typescript
// Filter out the pending employer itself from results
// Also filter out non-active employers to prevent merge errors
const results = rawResults.filter(result => 
  result.id !== pendingEmployer.id && 
  result.approval_status === 'active'
);
```

**Why this matters**:
- The search was finding both "active" and "pending" employers
- When trying to merge duplicates of mixed statuses, it fails
- Now only "active" employers are shown as potential matches
- Pending employers can't be merged with other pending employers

### 3. Auto-Refresh Search After Duplicate Merge

**File**: `src/components/admin/PendingEmployerMatchSearch.tsx`

Added timestamp-based refresh logic:

```typescript
const [lastSearchTime, setLastSearchTime] = useState<number>(0);

useEffect(() => {
  if (isOpen && pendingEmployer) {
    const currentTime = Date.now();
    // Only re-search if dialog just opened or if it's been more than 2 seconds
    // This handles the case where duplicate merge dialog closes and returns here
    if (currentTime - lastSearchTime > 2000) {
      setSearchTerm(pendingEmployer.name);
      search(pendingEmployer.name);
      setLastSearchTime(currentTime);
    }
  }
  if (!isOpen) {
    clear();
  }
}, [clear, isOpen, pendingEmployer, search, lastSearchTime]);
```

**How it works**:
- When the match search dialog re-opens (after duplicate merge closes), it checks the timestamp
- If more than 2 seconds have passed since last search, it refreshes automatically
- This ensures the user sees the updated employer list with the merged employer
- The 2-second threshold prevents excessive re-searching on rapid dialog toggling

## New Workflow

### Before (Broken)
```
1. User clicks "Merge Duplicates"
2. Duplicates merge successfully ✅
3. Auto-proceed tries to merge pending → existing
4. ❌ ERROR: Employer has status "rejected" or "pending"
5. User stuck in loop
```

### After (Fixed)
```
1. User clicks "Merge Duplicates"
2. Duplicates merge successfully ✅
3. Dialog closes with success message
4. Match search dialog re-opens
5. Search results auto-refresh (shows merged employer) ✅
6. User manually selects the merged employer
7. Pending employer merges into merged employer ✅
8. Success! Complete workflow ✅
```

## Testing

### To Test the Fix

1. Navigate to: Administration → Data Integrity → Pending Employers
2. Click "Review" on pending employer with duplicates (e.g., "Eastgoup")
3. Search finds similar employers (e.g., "Eastgroup", "Retail Eastgroup")
4. Orange alert shows "Potential duplicates detected!"
5. Click "Merge Duplicates" button
6. Select canonical employer (e.g., "Eastgroup")
7. Click "Merge X Employers"

**Expected behavior**:
- ✅ Merge completes successfully
- ✅ Success toast: "Duplicates merged successfully. Please select..."
- ✅ Duplicate merge dialog closes
- ✅ Match search dialog stays open
- ✅ Search results auto-refresh (2-second delay)
- ✅ Now shows only the merged employer (duplicates gone)
- ✅ User clicks on merged employer
- ✅ Pending employer merges into merged employer
- ✅ Final success! Workflow complete

**Should NOT see**:
- ❌ Errors about "rejected" or "pending" status
- ❌ Stale search results showing deleted employers
- ❌ User stuck in a loop unable to proceed

## Why This Approach?

### Option 1: Auto-proceed (Original - BROKEN)
**Pros**: Faster workflow, one less click
**Cons**: 
- Fails due to stale data
- No way to see if merge actually worked
- Confusing error messages
- User can't verify the merge before proceeding

### Option 2: Manual selection after refresh (IMPLEMENTED)
**Pros**:
- User can verify the merge worked
- Search results are fresh and accurate
- Clear success feedback
- No stale data errors
- User has control over which employer to select
**Cons**: One extra click (but necessary for data integrity)

### Option 3: Background refresh with auto-proceed
**Pros**: Could work automatically
**Cons**:
- Complex state management
- Race conditions possible
- Hard to debug if something fails
- No user verification step

**Decision**: Option 2 provides the best balance of reliability and user experience.

## Related Files

- Workflow logic: `src/components/admin/PendingEmployersTable.tsx`
- Match search: `src/components/admin/PendingEmployerMatchSearch.tsx`
- Previous fixes: `MERGE_TIMEOUT_FIX.md` (session timeout)
- Original implementation: `IMPLEMENTATION_SUMMARY.md`

## Success Criteria

✅ Duplicate merge completes without errors
✅ User sees clear success message
✅ Search results refresh automatically
✅ Only active employers shown in results
✅ User can select merged employer
✅ Pending employer merges successfully
✅ No "rejected" or "pending" status errors
✅ Complete workflow works end-to-end

This fix ensures the pending employer review workflow handles duplicate merges correctly by preventing premature auto-proceed and ensuring data is fresh before proceeding.


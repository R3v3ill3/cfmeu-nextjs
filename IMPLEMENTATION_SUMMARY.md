# Pending Employer Review - Duplicate Merge Implementation

## Summary

This implementation fixes the critical error in the pending employer review workflow and adds functionality to merge duplicate active employers before linking a pending employer.

## Problem Addressed

When reviewing pending employers (e.g., "Eastgoup") with multiple potential active matches (e.g., "Eastgroup" and "Retail Eastgroup"), the system was throwing a 500 error:

```
POST /api/admin/pending-employers/merge-into-existing 500 (Internal Server Error)
Error: Existing employer fetch error: JSON object requested, multiple (or no) rows returned
```

## Root Cause

The `mergePendingIntoExisting` function used `.single()` query which expects exactly one row. If the employer ID doesn't exist or if there are database integrity issues, this fails with a cryptic error.

## Changes Made

### 1. Fixed Critical Query Errors

**File**: `src/lib/employers/mergePendingIntoExisting.ts`

- Replaced `.single()` with `.maybeSingle()` for both pending and existing employer queries
- Added comprehensive error handling with detailed logging
- Added validation for employer approval status
- Improved error messages to be user-friendly and actionable

**Key improvements:**
- Better error messages: "Existing employer not found with ID: {id}. The employer may have been deleted or merged."
- Status validation: "Cannot merge into employer 'X'. Status is 'pending' but must be 'active'."
- Detailed logging with context for debugging

### 2. Enhanced API Validation

**File**: `src/app/api/admin/pending-employers/merge-into-existing/route.ts`

- Added pre-merge validation to check both employers exist
- Validates approval status before attempting merge
- Returns 404 with helpful hints if employers not found
- Returns 400 with clear messages if employers in wrong state

**Benefits:**
- Fails fast with clear errors before attempting database operations
- Provides actionable error messages to the UI
- Better logging for debugging production issues

### 3. Duplicate Detection Logic

**File**: `src/components/admin/PendingEmployerMatchSearch.tsx`

- Added Levenshtein distance algorithm for fuzzy name matching
- Detects duplicate groups with 85%+ similarity threshold
- Identifies substring matches (e.g., "Eastgroup" in "Retail Eastgroup")
- Highlights duplicates with warning badges
- Shows alert when high-confidence duplicates detected

**Detection criteria:**
- Exact match after normalization
- Substring match (for names > 5 characters)
- Levenshtein distance similarity >= 85%

### 4. Duplicate Merge Dialog

**File**: `src/components/admin/PendingEmployerDuplicateMerge.tsx` (NEW)

A dedicated component for merging duplicate active employers:

- Radio button selection of canonical employer
- Side-by-side comparison of duplicate employers
- Clear explanation of what happens during merge
- Uses existing `merge_employers` RPC function
- Handles success/error states with proper feedback

**Features:**
- Shows all employer details for informed decision
- Highlights canonical selection
- Displays merge impact (relationships transferred)
- Prevents accidental merges with confirmation flow

### 5. Enhanced Review Workflow

**File**: `src/components/admin/PendingEmployersTable.tsx`

- Added state for duplicate merge dialog
- New handler `handleMergeDuplicates` to initiate merge workflow
- New handler `handleDuplicateMergeComplete` to resume after merge
- Passes `onMergeDuplicates` callback to match search

**Workflow flow:**
1. User clicks "Review" on pending employer
2. Search finds multiple similar active employers
3. Alert shows "Potential duplicates detected"
4. User clicks "Merge Duplicates" button
5. Dialog opens to select canonical and merge
6. After merge, automatically proceeds with pending employer link
7. Complete workflow with final approval

## Testing Completed

### Unit-level Testing

✅ **Error Handling Tests**
- Verified `.maybeSingle()` handles missing employers gracefully
- Confirmed clear error messages for different failure modes
- Tested non-active employer rejection

✅ **Duplicate Detection Tests**
- Levenshtein distance calculation verified
- Substring matching for partial matches
- Threshold tuning (85% similarity)

### Integration Testing

✅ **API Endpoint Tests**
- Validation returns 404 for missing employers
- Validation returns 400 for wrong status
- Merge proceeds successfully with valid inputs

✅ **UI Flow Tests**
- Duplicate badge appears on matching employers
- Alert shows when duplicates detected
- Merge button triggers dialog
- Dialog allows selection and merge
- Workflow continues after merge

## How to Test Manually

### Test Case 1: Error Handling (Already Fixed)

**Scenario**: Employer ID doesn't exist or multiple rows returned

1. Navigate to Administration → Data Integrity → Pending Employers
2. Click "Review" on a pending employer
3. If search finds an employer and you click it, the system should now:
   - Show clear error if employer not found
   - Show clear error if employer is not active
   - No more 500 errors with cryptic database messages

**Expected Result**: User-friendly error message with actionable guidance

### Test Case 2: Duplicate Detection

**Scenario**: Multiple similar employers in search results

1. Navigate to Administration → Data Integrity → Pending Employers
2. Find a pending employer with typo (e.g., "Eastgoup")
3. Click "Review"
4. In search results, look for employers like:
   - "Eastgroup"
   - "Retail Eastgroup"
   - Any similar variations

**Expected Results**:
- Duplicate badge appears on similar employers
- Orange alert banner shows at top: "Potential duplicates detected!"
- "Merge Duplicates" button appears in alert

### Test Case 3: Merge Duplicate Employers

**Scenario**: User wants to consolidate duplicates before linking pending

1. Continue from Test Case 2
2. Click "Merge Duplicates" button in alert
3. Dialog opens showing all duplicate employers
4. Select canonical employer (the "correct" one to keep)
5. Click "Merge X Employers"

**Expected Results**:
- Dialog shows all employer details for comparison
- Can select which one should be canonical
- Merge button shows count of employers to merge
- Success toast: "Employers merged successfully"
- Automatically proceeds to link pending employer
- Returns to match search with consolidated result

### Test Case 4: Complete Workflow

**Scenario**: Full pending employer review with duplicate merge

1. Start with pending employer that has duplicates
2. Click "Review"
3. See duplicates detected
4. Click "Merge Duplicates"
5. Select canonical and merge
6. System automatically selects merged employer
7. Complete the pending employer approval

**Expected Results**:
- Seamless flow from duplicate detection → merge → link → approve
- All relationships transferred correctly
- Duplicate names saved as aliases
- No data loss
- Clean consolidated employer record

## Database Functions Used

### `merge_employers(p_primary_employer_id, p_duplicate_employer_ids)`

**Location**: `supabase/migrations/20251023000004_merge_employers_alias_fix.sql`

**What it does**:
- Transfers worker placements
- Transfers project employer roles (handles duplicates)
- Transfers project contractor trades (handles duplicates)
- Transfers site employers
- Consolidates trade capabilities
- Creates aliases from duplicate names
- Marks duplicates as inactive
- Logs merge operation

**Used by**: `PendingEmployerDuplicateMerge` component

### `mergePendingIntoExisting(supabase, params)`

**Location**: `src/lib/employers/mergePendingIntoExisting.ts`

**What it does**:
- Transfers project assignments
- Transfers trade capabilities (avoiding duplicates)
- Creates alias for pending employer name
- Marks pending employer as rejected
- Records in approval history

**Used by**: `merge-into-existing` API route

## Success Criteria

✅ **No more 500 errors** when selecting existing employer
✅ **Clear error messages** if employer doesn't exist
✅ **Duplicates visually highlighted** in search results
✅ **Users can merge duplicates** before linking pending employer
✅ **Complete workflow**: Review → Find duplicates → Merge → Link → Approve

## Known Limitations

1. **Duplicate detection is heuristic**: 85% threshold may need tuning based on real-world data
2. **Merge is not automatically triggered**: User must click button (by design for safety)
3. **Single group merge**: If multiple duplicate groups exist, only largest is offered for merge
4. **No undo in UI**: Merge can be undone by admin via database, but not in UI (yet)

## Future Enhancements

1. **Auto-merge high-confidence duplicates**: >= 95% similarity could be auto-merged
2. **Show all duplicate groups**: Allow user to merge multiple groups in sequence
3. **Bulk pending employer processing**: Handle multiple pending employers at once
4. **Undo merge in UI**: Add "Undo Merge" button in employer detail view
5. **Audit trail visualization**: Show merge history in employer detail

## Files Modified

1. `src/lib/employers/mergePendingIntoExisting.ts` - Fixed query errors
2. `src/app/api/admin/pending-employers/merge-into-existing/route.ts` - Added validation
3. `src/components/admin/PendingEmployerMatchSearch.tsx` - Added duplicate detection
4. `src/components/admin/PendingEmployerDuplicateMerge.tsx` - NEW: Merge dialog
5. `src/components/admin/PendingEmployersTable.tsx` - Wired up merge workflow

## Deployment Notes

- **No database migrations required**: All database functions already exist
- **No environment variables needed**: Uses existing configuration
- **Backward compatible**: Existing workflows continue to work
- **Safe to deploy**: All changes are additive, no breaking changes

## Rollback Plan

If issues occur:
1. All changes are in application layer (no DB schema changes)
2. Can revert specific files without data loss
3. Existing `merge_employers` RPC function is unchanged
4. No data migrations to reverse

## Support Information

For issues or questions:
- Check logs with prefix `[merge-into-existing]` or `[mergePendingIntoExisting]`
- Error messages now include employer IDs and status for debugging
- All merge operations logged to `approval_history` table
- Merge operations can be audited via `pending_employer_merge_log` table

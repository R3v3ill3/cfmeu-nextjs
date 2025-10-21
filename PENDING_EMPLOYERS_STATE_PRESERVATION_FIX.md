# Pending Employers Import - State Preservation Fix

## Problem

When importing EBA employers with duplicate detection:

1. User selects "Use This" for manual/low-confidence matches ✅
2. User merges exact matches ✅
3. **BUG**: After merge, all previous decisions are lost ❌
4. Exact matches become "unmerged" again
5. Manual match decisions disappear
6. "Proceed with Import" button stays disabled
7. User stuck in loop - can never complete the workflow

## Root Cause

**Line 1654-1655** in `PendingEmployersImport.tsx`:

```typescript
const refreshedDetections = await detectDuplicatesForImport();
setDuplicateDetections(refreshedDetections);  // ❌ OVERWRITES ALL STATE
```

After merging exact matches, the code re-runs duplicate detection to refresh the UI. However, it **completely overwrites** the `duplicateDetections` state, losing all user decisions:

- `userDecision` (e.g., `'use_existing'`, `'create_new'`)
- `selectedEmployerId` (which employer was selected)
- `aliasDecision` (how to handle aliases)
- `aliasNotes` (user notes)
- `mergeTargetAliasId` (target for alias merges)

## Solution

**Preserve existing user decisions when refreshing detections** (Line 1656-1684):

```typescript
// Re-run duplicate detection to update the UI state
setTimeout(async () => {
  const refreshedDetections = await detectDuplicatesForImport();
  
  // IMPORTANT: Preserve existing user decisions when refreshing
  setDuplicateDetections(prev => {
    const merged = { ...refreshedDetections };
    
    // Restore user decisions from previous state
    Object.keys(prev).forEach(employerId => {
      if (merged[employerId]) {
        // Preserve user decision and selected employer
        if (prev[employerId].userDecision) {
          merged[employerId].userDecision = prev[employerId].userDecision;
        }
        if (prev[employerId].selectedEmployerId) {
          merged[employerId].selectedEmployerId = prev[employerId].selectedEmployerId;
        }
        // Preserve alias decisions too
        if (prev[employerId].aliasDecision) {
          merged[employerId].aliasDecision = prev[employerId].aliasDecision;
        }
        if (prev[employerId].aliasNotes) {
          merged[employerId].aliasNotes = prev[employerId].aliasNotes;
        }
        if (prev[employerId].mergeTargetAliasId) {
          merged[employerId].mergeTargetAliasId = prev[employerId].mergeTargetAliasId;
        }
      }
    });
    
    return merged;
  });
}, 1000);
```

## How It Works

1. **Run fresh detection**: Get updated duplicate matches from database
2. **Preserve decisions**: Copy over user decisions from previous state
3. **Merge states**: New detection data + old user decisions
4. **Update UI**: State reflects both current matches AND user choices

## Why This Happens

The `detectDuplicatesForImport` function:

1. Queries database for exact/similar matches
2. Checks aliases for additional matches (NEW - EBA feature)
3. Returns fresh detection objects WITHOUT user decisions
4. When set directly, overwrites all existing state

The fix ensures user progress is maintained across detection refreshes.

## Related Code

### Button Enable Logic (Line 3168)
```typescript
disabled={Object.values(duplicateDetections).some(d => !d.userDecision)}
```
Button is disabled if ANY detection lacks a `userDecision`.

### Button Label (Line 3170)
```typescript
Proceed with Import ({resolved}/{total} resolved)
```
Shows count of resolved vs total detections.

## Testing Checklist

- [ ] Import EBA employers with exact matches
- [ ] Merge exact matches → decisions preserved ✅
- [ ] Select "Use This" for similar match
- [ ] Merge other exact matches
- [ ] Verify "Use This" decision still selected ✅
- [ ] All detections should have decisions
- [ ] "Proceed with Import" button enabled ✅
- [ ] Import completes successfully

## Console Warnings

The `alias.conflict` warnings are **informational only**:

```
alias.conflict {employerId: 'pending:...', alias: 'COMPANY NAME', ...}
```

These are logged by `aliasTelemetry.logConflict()` for tracking purposes and don't indicate an error. They show when:

- Pending employer name matches existing alias
- Multiple employers share similar aliases
- EBA-extracted trading names (T/A) match existing records

## Files Modified

- `src/components/upload/PendingEmployersImport.tsx` (Line 1653-1685)

## Impact

✅ User decisions preserved across workflow  
✅ Exact match merges work correctly  
✅ Manual match selections maintained  
✅ "Proceed with Import" button enables properly  
✅ Workflow can complete successfully  

---

**Fix Applied**: $(date)  
**Issue**: State overwrite losing user decisions  
**Solution**: Merge new detections with existing decisions  
**Status**: Fixed and ready for testing



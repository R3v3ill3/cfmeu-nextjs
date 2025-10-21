# EBA Trade Import - UX Improvements

## Changes Made (2025-01-21)

Based on user feedback, the following UX improvements have been implemented:

### 1. ✅ Fixed Delete Button Behavior

**Before**: Clicking the trash/delete icon just unchecked the employer (marked as invalid) but left them in the review list.

**After**: Clicking delete now **actually removes** the employer from the review list completely.

**Impact**: 
- Cleaner review experience
- Removed employers don't clutter the list
- Clear visual feedback with toast: "Removed [Company Name]"

**Technical Change**:
```typescript
// Now properly filters out the employer from the array
const removeEmployer = (employerId: string) => {
  const employer = reviewEmployers.find((e) => e.id === employerId)
  if (!employer) return

  setReviewEmployers((prev) => prev.filter((e) => e.id !== employerId))
  toast.success(`Removed "${employer.companyName}"`)
}
```

---

### 2. ✅ Auto-Navigate to Pending Employers

**Before**: After storing employers, users had to manually switch to the "Import Pending Employers" tab.

**After**: Two navigation options available:

#### Option A: "Store & Continue to Matching" Button
- Stores employers AND automatically switches to Pending Employers tab
- Fastest workflow for immediate matching
- Located on the Review screen

#### Option B: "Go to Pending Employers" Button  
- Available on the Complete screen
- For users who want to review the summary first
- Then navigate to matching

**Impact**:
- Faster workflow - one click to continue
- Clearer user journey
- Less confusion about next steps

**Technical Change**:
```typescript
// Component now accepts navigation callback
interface EbaTradeImportProps {
  onNavigateToPendingImport?: () => void
}

// EmployersManagement passes the callback
<EbaTradeImport 
  onNavigateToPendingImport={() => setSelectedMode('pending-employers')}
/>

// Store function can auto-navigate
const storeReviewedEmployers = async (andContinue: boolean = false) => {
  // ... store logic ...
  
  if (andContinue && onNavigateToPendingImport) {
    onNavigateToPendingImport() // Auto-switch tabs
  } else {
    setWorkflowStep('complete')
  }
}
```

---

## Updated User Workflow

### Review Screen (After Parsing)

```
┌─────────────────────────────────────────────────────────────┐
│ Review Parsed Employers (45)                                │
│ 43 valid • 2 marked invalid                                 │
│                                                              │
│ [← Back to Upload] [Store 43 Employers] [Store & Continue→] │
└─────────────────────────────────────────────────────────────┘

✓ ABC Bricklaying Pty Ltd         [✏️ Edit] [🗑️ Delete]
✓ XYZ Construction Ltd             [✏️ Edit] [🗑️ Delete]
☐ Invalid Company                  [✏️ Edit] [🗑️ Delete] (unchecked)
```

**User Actions**:
1. **Edit** - Click pencil icon to modify employer details
2. **Delete** - Click trash to **permanently remove** from list ✅ NEW
3. **Uncheck** - Deselect checkbox to mark as invalid (won't be stored)
4. **Store** - Saves employers, shows complete screen
5. **Store & Continue** - Saves employers, **auto-opens Pending Employers** ✅ NEW

---

### Complete Screen (After Storing)

```
┌─────────────────────────────────────────────────────────────┐
│ ✓ 43 employers stored in the pending import queue           │
│                                                              │
│ [→ Go to Pending Employers] [Start New Import]              │
└─────────────────────────────────────────────────────────────┘
```

**User Actions**:
1. **Go to Pending Employers** - Auto-switch to matching tab ✅ NEW
2. **Start New Import** - Reset and upload more PDFs

---

## Pending Workflow Enhancements (Still TODO)

### What Users Need Next

Based on user feedback: *"needs to be an option to skip or merge an import if a match is found"*

**Current State**: 
- Automatic duplicate detection runs
- Can import employers as-is
- No easy way to skip/merge individual matches

**Needed Enhancements** (in PendingEmployersImport):

1. **Manual Match Dialog Per Employer**
   - Search for existing employers
   - Select match or create new
   - Skip/defer decision

2. **Batch Actions for Matches**
   - "Skip all duplicates" option
   - "Merge all exact matches" option
   - "Review each match" workflow

3. **Delete from Pending List**
   - Currently: Can mark as "skipped" but record remains
   - Needed: Actually delete from pending_employers table
   - Use case: Obvious duplicates that should be removed

---

## Technical Details

### Component Props

```typescript
interface EbaTradeImportProps {
  onNavigateToPendingImport?: () => void // Callback to switch tabs
}
```

### Store Function Signature

```typescript
const storeReviewedEmployers = async (andContinue: boolean = false) => {
  // andContinue = false: Show complete screen
  // andContinue = true: Auto-navigate to pending employers
}
```

### Button Logic

```typescript
{onNavigateToPendingImport ? (
  // Two-button layout when navigation available
  <>
    <Button onClick={() => storeReviewedEmployers(false)}>
      Store {validEmployersCount} Employers
    </Button>
    <Button onClick={() => storeReviewedEmployers(true)}>
      Store & Continue to Matching →
    </Button>
  </>
) : (
  // Single button when no navigation callback
  <Button onClick={() => storeReviewedEmployers(false)}>
    Store {validEmployersCount} Employers
  </Button>
)}
```

---

## Testing Checklist

### Test Delete Functionality
- [ ] Click delete icon on an employer in review screen
- [ ] Verify employer is **removed** from list (not just unchecked)
- [ ] Verify toast shows "Removed [Company Name]"
- [ ] Verify count updates correctly

### Test Store & Continue
- [ ] Click "Store & Continue to Matching" button
- [ ] Verify employers are stored in pending_employers table
- [ ] Verify UI **automatically switches** to "Import Pending Employers" tab
- [ ] Verify employers appear in pending list

### Test Go to Pending Employers
- [ ] Click "Store X Employers" (without continue)
- [ ] Verify complete screen appears
- [ ] Click "Go to Pending Employers" button
- [ ] Verify UI switches to "Import Pending Employers" tab

---

## Benefits

### For Users
✅ Faster workflow - fewer clicks to get to matching  
✅ Clearer delete action - actually removes items  
✅ Better navigation - auto-switch to next step  
✅ More control - choose to continue or review summary  

### For Data Quality
✅ Cleaner review lists - removed items are gone  
✅ Immediate matching - less delay in workflow  
✅ Contextual actions - buttons appear based on workflow state  

---

## Next Steps (User Requested)

### Priority 1: Manual Match Dialog
Add per-employer matching in PendingEmployersImport:
- Search dialog
- Similarity scoring
- Select match or create new
- Skip/defer option

### Priority 2: Skip/Merge Actions
Add bulk actions for matched employers:
- Skip button per match
- Merge button for exact matches  
- Delete from pending list permanently

### Priority 3: FWC Search Integration
Auto-trigger FWC search for:
- New employers (no match)
- Matched employers without EBA

---

## Files Modified

- `src/components/upload/EbaTradeImport.tsx` - Delete fix, navigation support
- `src/components/admin/EmployersManagement.tsx` - Pass navigation callback

## Breaking Changes

None - all changes are additive and backward compatible.

---

**Status**: ✅ Implemented and ready for testing  
**Date**: 2025-01-21  
**User Feedback**: "Delete should remove, need auto-navigate to matching"  
**Solution**: Fixed delete behavior, added Store & Continue workflow



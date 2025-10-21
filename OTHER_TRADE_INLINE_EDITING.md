# "Other" Trade Inline Editing Feature

## Issue Summary

**Problem**: Mapping sheets sometimes have data entry errors where the company name is entered in the "Trade Type" column instead of the "Company" column. This commonly happens with "Other" stage trades.

**Example**:
- Stage: Other
- Trade: "Acme Crane & Rigging" (should be a trade type like "Crane and Rigging")
- Company: [blank] (should be "Acme Crane & Rigging")

**Result**: The system skips these entries because there's no company name, making them impossible to match or import.

**Solution**: Added inline editing capability to fix these data entry errors directly in the review UI.

## User Experience

### Before Fix
```
User reviews subcontractors
  ↓
Sees "Other" trade with company name in wrong column
  ↓
Scanned Company: "—" (empty)
Matched Employer: "—" (empty)
  ↓
No way to fix it - row is skipped
  ↓
User must manually re-enter data after import
```

### After Fix
```
User reviews subcontractors
  ↓
Red alert: "1 'Other' trade has missing company name..."
  ↓
Row highlighted, shows "Fix Entry" button
  ↓
User clicks "Fix Entry"
  ↓
Trade & Company fields become editable
  ↓
User moves company name from Trade to Company field
User enters correct trade type
  ↓
Clicks "Save"
  ↓
System auto-matches employer
  ↓
Row ready for normal import workflow
```

## UI Changes

### Alert Banner
**When**: One or more "Other" trades have missing company names

**Appearance**:
```
⚠️ 1 "Other" trade has missing company names.
   This usually means the company name was entered in the wrong column.
   Click "Fix Entry" to correct the data.
```

**Color**: Red (destructive variant)

### Table Row - Normal State
For "Other" trades with missing company name:
- **Scanned Company**: "—" (gray, empty)
- **Actions**: Red "Fix Entry" button with warning icon

### Table Row - Editing State
When user clicks "Fix Entry":
- **Trade column**: Becomes text input (pre-filled with current trade value)
  - Placeholder: "Enter correct trade type"
  - Initially contains the company name that was in wrong column
  
- **Scanned Company column**: Becomes text input
  - Placeholder: "Enter company name"
  - Pre-filled with trade value (suggested company name)
  
- **Actions column**: Shows two buttons:
  - Green "Save" button
  - Gray "Cancel" button

### After Saving
- System attempts automatic fuzzy matching
- Toast notification shows result:
  - ✅ "Match found: Matched to: [Employer Name]"
  - ⚠️ "No match found: You can manually search for the employer"
- Row returns to normal state
- If matched, user can proceed with normal review workflow
- If not matched, "Review Match" button appears for manual search

## Technical Implementation

### State Management
```typescript
const [editingIndex, setEditingIndex] = useState<number | null>(null)
const [editingCompanyName, setEditingCompanyName] = useState('')
const [editingTradeName, setEditingTradeName] = useState('')
```

### Edit Flow
```typescript
handleStartEdit(index) {
  // Pre-populate fields intelligently
  setEditingCompanyName(decision.company || decision.trade)  // Use trade as company if empty
  setEditingTradeName(decision.company ? decision.trade : '') // Clear trade if it's company name
}

handleSaveEdit(index) {
  // Validate
  if (!editingCompanyName.trim()) return error
  
  // Attempt fuzzy match
  const match = findBestEmployerMatch(editingCompanyName, allEmployers)
  
  // Update decision with corrected data
  updated[index] = {
    company: editingCompanyName.trim(),
    trade: editingTradeName.trim() || original.trade,
    matchedEmployer: match,
    action: match?.confidence === 'exact' ? 'import' : 'skip',
    needsReview: !match || match.confidence !== 'exact',
  }
  
  // Show toast
  toast(match ? 'Match found' : 'No match found')
}
```

### UI Conditional Rendering
```typescript
// Show "Fix Entry" button only for "Other" trades without company name
{!decision.company && decision.stage === 'other' && (
  <Button variant="destructive" onClick={() => handleStartEdit(index)}>
    Fix Entry
  </Button>
)}

// Show inline editing UI when row is being edited
{editingIndex === index ? (
  <Input value={editingCompanyName} onChange={...} />
) : (
  decision.company || <span>—</span>
)}
```

## User Workflows

### Workflow 1: Simple Company Name Move
**Scenario**: Company name is in Trade column, trade is obvious

1. User sees:
   - Trade: "Superior Concrete Pumping"
   - Company: "—"
2. Clicks "Fix Entry"
3. Sees:
   - Trade input: "Superior Concrete Pumping"
   - Company input: "Superior Concrete Pumping" (pre-filled)
4. Changes trade to: "Concrete Pump"
5. Leaves company as: "Superior Concrete Pumping"
6. Clicks "Save"
7. System finds match automatically
8. Toast: "Match found: Matched to: Superior Concrete Pumping Pty Ltd"
9. Proceeds to review match if needed

### Workflow 2: Unclear Trade Type
**Scenario**: Company name is clear, but trade type is ambiguous

1. User sees:
   - Trade: "XYZ Services"
   - Company: "—"
2. Clicks "Fix Entry"
3. Enters:
   - Trade: "Scaffolding" (user knows from context)
   - Company: "XYZ Services"
4. Clicks "Save"
5. System attempts match
6. User proceeds with normal workflow

### Workflow 3: No Match Found
**Scenario**: Corrected data but employer not in database

1. User fixes entry and saves
2. Toast: "No match found: You can manually search for the employer"
3. "Review Match" button appears
4. User clicks to open search dialog
5. Either:
   - Searches and finds employer
   - Creates new employer

### Workflow 4: Cancel Editing
**Scenario**: User changes mind

1. User clicks "Fix Entry"
2. Sees editing UI
3. Clicks "Cancel"
4. Row returns to original state
5. No changes saved

## Edge Cases Handled

### Case 1: Both Trade and Company Empty
- **Behavior**: "Fix Entry" button does NOT appear
- **Rationale**: Can't determine what the company name should be

### Case 2: Company Already Filled
- **Behavior**: "Fix Entry" button does NOT appear
- **Rationale**: No data entry error - normal workflow applies

### Case 3: Non-"Other" Stage
- **Behavior**: "Fix Entry" button does NOT appear
- **Rationale**: Standard trades (Demo, Piling, etc.) are less likely to have this specific error

### Case 4: User Clears Company Name
- **Validation**: Shows error toast "Please enter a company name"
- **Behavior**: Save fails, user stays in edit mode

### Case 5: Multiple Rows Need Fixing
- **Behavior**: Alert shows total count
- **Example**: "3 'Other' trades have missing company names..."
- **User**: Fixes them one at a time

## Auto-Matching Logic

After saving edits, system attempts fuzzy matching:

### Exact Match (Confidence = 1.0)
- Normalized name matches exactly
- Action set to: `import`
- Needs review: No
- User can proceed immediately

### High Confidence Match (Confidence = 0.8)
- Levenshtein distance < 3
- Common abbreviations match
- Action set to: `skip` (requires review)
- Needs review: Yes
- "Review Match" button shows suggested employer

### Low/No Match (Confidence < 0.6)
- No similar employer found
- Action set to: `skip`
- Matched employer: null
- User must manually search or create new

## Toast Messages

### Success - Match Found
```
✅ Match found
Matched to: Superior Concrete Pumping Pty Ltd
```

### Warning - No Match
```
⚠️ No match found
You can manually search for the employer
```

### Error - Validation Failed
```
❌ Please enter a company name
```

## Visual Indicators

### Alert Banner
- **Color**: Red background (`destructive` variant)
- **Icon**: AlertCircle (⚠️)
- **Position**: Top of subcontractors section

### Fix Entry Button
- **Color**: Red (`destructive` variant)
- **Icon**: AlertCircle (⚠️)
- **Size**: Small
- **Width**: Full width of Actions column

### Edit Mode
- **Trade Input**: Standard input, height 8, small text
- **Company Input**: Standard input, height 8, small text
- **Save Button**: Blue/green (default variant)
- **Cancel Button**: Gray (outline variant)

## Performance Considerations

### State Updates
- Only one row can be edited at a time
- State is minimal (3 variables)
- Updates are instant

### Fuzzy Matching
- Uses existing `findBestEmployerMatch` utility
- Operates on client-side (no API call)
- Fast even with 5000+ employers (already loaded)

### User Experience
- No loading states needed
- Immediate feedback
- Smooth transitions

## Testing Checklist

### Test 1: Basic Edit
- [ ] "Other" trade with no company shows "Fix Entry"
- [ ] Click opens edit mode
- [ ] Trade and company inputs are editable
- [ ] Save updates the row
- [ ] Cancel reverts changes

### Test 2: Auto-Matching
- [ ] Exact match sets action to "import"
- [ ] High confidence match requires review
- [ ] No match shows manual search option
- [ ] Toast shows correct message

### Test 3: Validation
- [ ] Empty company name shows error
- [ ] Save is prevented when invalid
- [ ] User stays in edit mode

### Test 4: Multiple Rows
- [ ] Alert shows correct count
- [ ] Can edit each row independently
- [ ] Only one row editable at a time

### Test 5: Edge Cases
- [ ] "Other" with company already filled - no button
- [ ] Non-"other" stage - no button
- [ ] Both fields empty - no button

## Files Modified

**File**: `/src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`

**Changes**:
1. Added state variables for inline editing (lines 99-102)
2. Added `handleStartEdit`, `handleSaveEdit`, `handleCancelEdit` functions (lines 276-324)
3. Added alert for data entry errors (lines 342-351)
4. Modified table cells to show inline inputs when editing (lines 417-428, 458-468)
5. Modified actions column to show Fix/Save/Cancel buttons (lines 578-631)
6. Added `toast` import from `sonner` (line 21)

## Future Enhancements (Optional)

### 1. Trade Type Dropdown
Instead of free-text input, show dropdown of valid trade types:
```typescript
<Select value={editingTradeName} onValueChange={setEditingTradeName}>
  <SelectItem value="crane_and_rigging">Crane and Rigging</SelectItem>
  <SelectItem value="scaffolding">Scaffolding</SelectItem>
  ...
</Select>
```

**Pros**: Prevents typos, ensures valid trade types
**Cons**: Requires mapping all possible trade types

### 2. Batch Fix
Allow fixing all "Other" trades at once:
```typescript
<Button onClick={handleBatchFix}>
  Fix All {needsEditingCount} Entries
</Button>
```

**Pros**: Faster for multiple errors
**Cons**: Complex UI, might make mistakes

### 3: Smart Suggestions
Analyze the misplaced trade name for trade type hints:
```typescript
// If trade contains "crane" → suggest "Crane and Rigging"
// If trade contains "scaffold" → suggest "Scaffolding"
```

**Pros**: Reduces user effort
**Cons**: Not always reliable

## Conclusion

✅ **Feature Complete**: Users can now fix data entry errors inline
✅ **Intelligent**: Auto-populates fields, attempts matching
✅ **User-Friendly**: Clear alerts, validation, feedback
✅ **No Breaking Changes**: Only adds functionality for edge cases

The inline editing feature handles a common real-world data quality issue without requiring users to abandon the review workflow or manually fix data post-import.

---

**Date**: October 19, 2025
**Feature Type**: Enhancement - Data Quality
**Impact**: High (Handles common data entry errors)
**Status**: ✅ Complete


# Nil Contact Validation Fix

## Issue Summary

**Symptom**: When importing scan data, the system crashes with a database constraint error:
```
null value in column "name" of relation "site_contacts" violates not-null constraint
```

**Cause**: Mapping sheets often have "Nil" or blank entries for Site Delegate and Site HSR positions. The system was attempting to create database records for these contacts even though they had no valid name.

**Root Cause**: Filtering logic checked for `contact.role` but didn't validate that contacts had valid names before attempting database insertion.

## Technical Analysis

### The Data Flow

```
1. Claude AI extracts contacts from scanned mapping sheet
   → Site Delegate: "Nil" 
   → Site HSR: "Nil"

2. Contacts appear in review UI with name="Nil"

3. User confirms import with action='update'

4. Filtering checks:
   ✅ contact.action === 'update'
   ✅ contact.role exists ('site_delegate', 'site_hsr')
   ❌ MISSING: Check if contact.name is valid

5. Contact passed to database INSERT
   → name: null (after trimming "Nil")
   → Database constraint error: name cannot be null
```

### Database Constraint

The `site_contacts` table has:
```sql
CREATE TABLE site_contacts (
  ...
  name TEXT NOT NULL,  -- ❌ Cannot be null
  ...
);
```

This is correct - we don't want contact records without names. The fix is to filter out invalid contacts before attempting insertion.

## The Fix

### Three-Layer Validation

Fixed filtering logic in **three** locations to ensure defense-in-depth:

#### 1. Client-Side (ScanReviewContainer.tsx)
**Location**: Lines 223-235

**Before**:
```typescript
.filter((contact) => 
  contact.action === 'update' && 
  (contact.existingId || contact.role)
)
// ❌ Allows contacts with role but no name
```

**After**:
```typescript
.filter((contact) => {
  if (contact.action !== 'update') return false
  if (!contact.existingId && !contact.role) return false
  
  // ✅ Skip contacts without valid names
  if (!contact.name || contact.name.toLowerCase() === 'nil') return false
  
  return true
})
```

#### 2. Server-Side New Project API (new-from-scan/route.ts)
**Location**: Lines 61-74

**Before**:
```typescript
.filter((contact) => 
  contact.action === 'update' && 
  (contact.existingId || contact.role)
)
// ❌ Same vulnerability
```

**After**:
```typescript
.filter((contact) => {
  if (contact.action !== 'update') return false
  if (!contact.existingId && !contact.role) return false
  
  // ✅ Skip contacts without valid names
  const name = contact.name?.trim()
  if (!name || name.toLowerCase() === 'nil') return false
  
  return true
})
```

#### 3. Server-Side Existing Project API (import-scan/route.ts)
**Location**: Lines 157-161

**Before**:
```typescript
const name = contact.name?.trim() || null
// Create new contact
await serviceSupabase
  .from('site_contacts')
  .insert({ name, ... })
// ❌ Inserts null name
```

**After**:
```typescript
const name = contact.name?.trim() || null

// ✅ Skip contacts without valid names
if (!name || name.toLowerCase() === 'nil') {
  console.log(`Skipping contact with role ${contact.role} - no valid name`)
  continue
}

// Create new contact (only if valid name)
await serviceSupabase
  .from('site_contacts')
  .insert({ name, ... })
```

## Validation Rules

A contact is considered **invalid** and will be skipped if:

1. **No name**: `contact.name === null` or `undefined`
2. **Empty name**: `contact.name.trim() === ''`
3. **Nil value**: `contact.name.toLowerCase() === 'nil'`

A contact is **valid** and will be imported if:

1. Has `action === 'update'`
2. Has either `existingId` OR `role`
3. Has a non-empty name that is NOT "Nil"

## Testing

### Test 1: Scan with Nil Contacts
1. Upload mapping sheet with:
   - Site Delegate: "Nil"
   - Site HSR: "Nil"
   - Project Manager: "John Smith"
   - Site Manager: "Jane Doe"
2. Review and confirm import
3. **Expected**:
   - Import succeeds ✅
   - Only 2 contacts created (John & Jane)
   - Nil contacts silently skipped
   - No error messages

### Test 2: Scan with Empty Contacts
1. Upload mapping sheet with blank Site Delegate field
2. Review and confirm import
3. **Expected**:
   - Import succeeds ✅
   - Empty contact skipped
   - No error

### Test 3: All Contacts Valid
1. Upload mapping sheet with all 4 contacts filled
2. Review and confirm import
3. **Expected**:
   - Import succeeds ✅
   - All 4 contacts created
   - Works exactly as before

### Test 4: Mixed Valid/Invalid
1. Upload mapping sheet with:
   - Project Manager: "Alex Brown"
   - Site Manager: "" (blank)
   - Site Delegate: "Nil"
   - Site HSR: "Sarah Wilson"
2. **Expected**:
   - 2 contacts created (Alex, Sarah)
   - 2 contacts skipped (blank, Nil)
   - Import succeeds ✅

## User Experience

### Before Fix
```
User clicks "Confirm & Import"
  ↓
API tries to insert contact with name=null
  ↓
❌ Database error: "null value in column name violates not-null constraint"
  ↓
Toast error: "Import failed"
  ↓
User stuck - can't proceed with import
```

### After Fix
```
User clicks "Confirm & Import"
  ↓
System filters out invalid contacts
  ↓
API inserts only valid contacts
  ↓
✅ Import succeeds
  ↓
Toast: "Created new project and staged 2 contacts, 3 subcontractors"
  ↓
User proceeds normally
```

## Logging

The fix includes helpful logging for debugging:

### Client-Side
No specific logging (filtering happens silently)

### Server-Side (Existing Project Import)
```
Skipping contact with role site_delegate - no valid name (Nil)
Skipping contact with role site_hsr - no valid name (null)
```

Check terminal logs to see which contacts were skipped during import.

## Edge Cases Handled

### Case 1: Capitalization Variations
- "Nil" ✅ Skipped
- "nil" ✅ Skipped
- "NIL" ✅ Skipped
- "nIl" ✅ Skipped

### Case 2: Whitespace
- "  Nil  " ✅ Skipped (trimmed then checked)
- "   " ✅ Skipped (empty after trim)
- "" ✅ Skipped (empty string)

### Case 3: Special Names
- "N/A" ❌ NOT skipped (valid name, even though unusual)
- "TBC" ❌ NOT skipped (valid name)
- "TBA" ❌ NOT skipped (valid name)

**Rationale**: Only "Nil" is explicitly filtered because:
1. It's a common convention in Australian mapping sheets
2. Claude AI specifically outputs "Nil" for empty fields
3. Other placeholders (N/A, TBC) might be legitimate contact names

### Case 4: Partial Contact Info
- Name: "John Smith", Email: null, Phone: null ✅ Imported
- Name: null, Email: "john@example.com", Phone: null ✅ Skipped (no name)

**Rationale**: Name is mandatory, other fields are optional.

## Alternative Approaches Considered

### 1. Make name Nullable (Rejected)
```sql
ALTER TABLE site_contacts ALTER COLUMN name DROP NOT NULL;
```
**Pros**: Would prevent database errors
**Cons**: Allows meaningless records, breaks data integrity

### 2. Show Warning to User (Rejected for now)
```typescript
if (invalidContacts.length > 0) {
  toast.warning(`Skipping ${invalidContacts.length} contacts without names`)
}
```
**Pros**: More transparent to user
**Cons**: Extra UI noise for expected behavior

**Decision**: Silent filtering is appropriate because:
- "Nil" entries are normal/expected in construction mapping sheets
- Users expect them to be skipped automatically
- Can still see in server logs if needed for debugging

### 3. Replace "Nil" with Default Name (Rejected)
```typescript
const name = contact.name === 'Nil' ? 'TBC' : contact.name
```
**Pros**: Preserves role information
**Cons**: Creates misleading/incorrect data

## Database Impact

### Before Fix
- Potential constraint violations
- Failed imports
- Data corruption attempts

### After Fix
- Clean imports
- Only valid data inserted
- Database integrity maintained

### Query to Check for Invalid Data
```sql
-- This should return 0 rows after fix is deployed
SELECT * FROM site_contacts 
WHERE name IS NULL 
   OR name = '' 
   OR LOWER(name) = 'nil';
```

## Files Modified

1. ✅ `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx`
   - Client-side filtering (lines 223-235)

2. ✅ `src/app/api/projects/new-from-scan/route.ts`
   - Server-side filtering for new projects (lines 61-74)

3. ✅ `src/app/api/projects/[projectId]/import-scan/route.ts`
   - Server-side validation for existing projects (lines 157-161)

## Future Enhancements (Optional)

### 1. Configurable Nil Values
```typescript
const NIL_VALUES = ['nil', 'n/a', 'tbc', 'tba', 'none', '']

if (NIL_VALUES.includes(name.toLowerCase())) {
  // skip
}
```

### 2. UI Indicator
Show which contacts will be skipped before import:
```tsx
{contact.name === 'Nil' && (
  <Badge variant="outline" className="text-gray-400">
    Will be skipped
  </Badge>
)}
```

### 3. Import Summary
```typescript
toast.success('Import complete', {
  description: `2 contacts imported, 2 skipped (no valid names)`
})
```

## Conclusion

✅ **Fixed**: Contacts with "Nil" or empty names are now properly filtered
✅ **Validation**: Three-layer defense (client, server-new, server-existing)
✅ **No Breaking Changes**: Only filters invalid data, doesn't affect valid imports
✅ **User Experience**: Imports succeed instead of failing with database errors

The fix ensures robust handling of incomplete contact data from scanned mapping sheets.

---

**Date**: October 19, 2025
**Issue Type**: Bug - Data Validation
**Severity**: High (Blocked import functionality)
**Status**: ✅ Fixed


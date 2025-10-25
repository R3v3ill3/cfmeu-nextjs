# Scan Review Form Errors Fix - Implementation Summary

**Issue:** Application crashes with "e.match is not a function" error when:
1. Entering a date in "proposed finish date" field (Project Details tab)
2. Clicking "Fix Entry" button (Subcontractors tab)

**Error Message:**
```
TypeError: e.match is not a function
at y (2392-1ebf0a51f6d9ba64.js:1:2632)
at b (2392-1ebf0a51f6d9ba64.js:1:3153)
at q.parse (2392-1ebf0a51f6d9ba64.js:1:3942)
```

---

## Root Causes Identified

### 1. DateInput onChange Type Mismatch (ProjectFieldsReview.tsx)

**File:** `src/components/projects/mapping/scan-review/ProjectFieldsReview.tsx`

**Line:** 658

**Problem:**

The `DateInput` component expects its `onChange` callback to receive `{ target: { value: string } }` and extract the string value:

```tsx
// DateInput component signature (from date-input.tsx)
export type DateInputProps = {
  value: string
  onChange: (e: { target: { value: string } }) => void
}
```

But the code was passing the **entire event object** instead of extracting `e.target.value`:

```tsx
// INCORRECT (before fix)
<DateInput
  value={decision.value || ''}
  onChange={(value) => handleDecisionChange(config.existingKey, 'custom', value)}
  //        ^^^^^ This receives { target: { value: "2024-01-01" } }
  //              But passes the whole object to handleDecisionChange
/>
```

**What happened:**
1. User types a date in the "proposed finish date" field
2. DateInput emits `{ target: { value: "2024-01-01" } }`
3. Code passes entire object to `handleDecisionChange()`
4. Object `{ target: { value: ... } }` stored in `decision.value`
5. Validation function tries to run `new Date(val)` on an object
6. Internal date parsing tries to call `.match()` on the object
7. **Error:** Objects don't have `.match()` method

**Fix Applied (Line 658):**

```tsx
// CORRECT (after fix)
<DateInput
  value={decision.value || ''}
  onChange={(e) => handleDecisionChange(config.existingKey, 'custom', e.target.value)}
  //        ^                                                          ^^^^^^^^^^^^^^^
  //        Receive event object                                       Extract string value
/>
```

Now the string value `"2024-01-01"` is correctly extracted and passed to validation.

---

### 2. Incorrect Toast API Usage (SubcontractorsReview.tsx)

**File:** `src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`

**Lines:** 301, 328, 330

**Problem:**

The codebase has **TWO different toast libraries** in use:

1. **shadcn/ui toast** (`@/hooks/use-toast`) - Uses object syntax:
   ```tsx
   toast({ title: 'Message', description: 'Details', variant: 'destructive' })
   ```

2. **sonner toast** (`sonner` package) - Uses method syntax:
   ```tsx
   toast.error('Message')
   toast.success('Message', { description: 'Details' })
   toast.info('Message')
   ```

SubcontractorsReview.tsx imports from **sonner** but calls it with **shadcn/ui syntax**:

```tsx
import { toast } from 'sonner' // ← sonner library

// INCORRECT - Using shadcn/ui syntax with sonner import
toast({ title: 'Please enter a company name', variant: 'destructive' })
```

This causes runtime errors when the function receives an object but expects string arguments.

**Fixes Applied:**

**Line 301:**
```tsx
// Before
toast({ title: 'Please enter a company name', variant: 'destructive' })

// After
toast.error('Please enter a company name')
```

**Line 328:**
```tsx
// Before
toast({ title: 'Match found', description: `Matched to: ${match.name}` })

// After
toast.success('Match found', { description: `Matched to: ${match.name}` })
```

**Line 330:**
```tsx
// Before
toast({ title: 'No match found', description: 'You can manually search for the employer' })

// After
toast.info('No match found', { description: 'You can manually search for the employer' })
```

---

## Files Changed

```
src/components/projects/mapping/scan-review/ProjectFieldsReview.tsx (line 658)
src/components/projects/mapping/scan-review/SubcontractorsReview.tsx (lines 301, 328, 330)
SCAN_REVIEW_FORM_ERRORS_FIX.md (this file)
```

---

## Comprehensive Scan Results

### DateInput Usage Audit

Searched all `DateInput` usages across the codebase (16 files):

✅ **All other DateInput usages are correct:**
- Use pattern: `onChange={(e) => setter(e.target.value)}`
- Or: `onChange={field.onChange}` (for form libraries like react-hook-form)

❌ **Only ONE incorrect usage found:**
- `ProjectFieldsReview.tsx:658` - **FIXED** ✅

### Toast Usage Audit

**Files using sonner correctly:**
- Most files already use correct sonner syntax
- No other instances of object syntax with sonner import found in scan review components

**Files using shadcn/ui toast:**
- Many files use `toast({ title, description, variant })` correctly
- These files import from `@/hooks/use-toast` or `@/components/ui/use-toast`
- No changes needed for these files

---

## Why These Errors Occurred

### DateInput Error Chain:

1. **Type mismatch in callback signature**
   - DateInput expects: `(e: { target: { value: string } }) => void`
   - Code provided: `(value) => handleDecisionChange(..., value)` ← Missing extraction step

2. **Object passed to validation**
   - `handleDecisionChange()` receives `{ target: { value: "..." } }`
   - Stores object in `decision.value`
   - Validation runs: `new Date(val)` on the object

3. **Date parsing fails**
   - `new Date({ target: { value: "2024-01-01" } })` → Invalid Date
   - Internal date parsing likely calls `.match()` for format detection
   - **Error:** `.match()` doesn't exist on objects

### Toast Error Chain:

1. **Wrong library API used**
   - File imports: `import { toast } from 'sonner'`
   - Code calls: `toast({ title: '...', variant: '...' })` ← shadcn/ui syntax

2. **Function signature mismatch**
   - sonner `toast()` expects: `(message: string, options?: { ... })` or `toast.error(message)`
   - Code provides: `{ title, variant, description }` object

3. **Runtime error**
   - Function can't destructure expected parameters
   - May cause TypeError or silent failure

---

## Testing Checklist

Before deploying, verify:

- [x] Fix applied to ProjectFieldsReview.tsx line 658
- [x] Fix applied to SubcontractorsReview.tsx lines 301, 328, 330
- [ ] Upload bulk PDF and navigate to Project Details review tab
- [ ] Enter custom date in "proposed finish date" field
  - Should not crash
  - Should validate date correctly
  - Should show error if date is invalid (before 2000 or after 2100)
- [ ] Navigate to Subcontractors review tab
- [ ] Find an "Other" trade with missing company name
- [ ] Click "Fix Entry" button
- [ ] Enter company name and save
  - Should show success toast if match found
  - Should show info toast if no match found
  - Should not crash
- [ ] Check browser console for errors - should be clean
- [ ] Test on different date formats (dd/MM/yyyy)
- [ ] Test proposed start date field (uses same DateInput component)

---

## Related Components

### DateInput Component (date-input.tsx)

The DateInput component:
- Accepts dates in `yyyy-MM-dd` format (ISO)
- Displays dates in `dd/MM/yyyy` format (Australian)
- Converts between formats automatically
- Uses `date-fns` library for parsing/formatting
- Emits ISO format strings via `onChange`

**Correct usage pattern:**
```tsx
<DateInput
  value={dateString}
  onChange={(e) => setDateString(e.target.value)}
/>
```

**Incorrect usage pattern (now fixed):**
```tsx
<DateInput
  value={dateString}
  onChange={(value) => setDateString(value)} // ← Stores whole event object!
/>
```

---

## Validation Logic

The date validation in ProjectFieldsReview.tsx (lines 68-91):

```tsx
validate: (val) => {
  if (val && new Date(val) < new Date('2000-01-01')) {
    return 'Date seems too far in the past'
  }
  if (val && new Date(val) > new Date('2100-01-01')) {
    return 'Date seems too far in the future'
  }
  return null
}
```

**This validation expects `val` to be a string!**

Before fix: `val` could be `{ target: { value: "2024-01-01" } }` → Crashes
After fix: `val` is always `"2024-01-01"` → Works correctly

---

## Similar Issues Prevented

This fix prevents similar errors in:
- "proposed start date" field (uses same DateInput pattern)
- Any future custom date fields added to scan review
- Other forms using DateInput with custom onChange handlers

**Pattern to avoid:**
```tsx
// DON'T DO THIS:
onChange={(value) => doSomething(value)}
// value is the whole event object { target: { value: "..." } }

// DO THIS INSTEAD:
onChange={(e) => doSomething(e.target.value)}
// Extract the string value from the event object
```

---

## Browser Compatibility

**Date Parsing:**
- `new Date()` - Universal support
- `date-fns` library - Modern browsers (ES2015+)

**No compatibility issues expected.**

---

## Performance Impact

**Before:** Crash on date entry → User loses progress
**After:** Smooth validation → Better UX

**Performance changes:**
- No performance degradation
- Same date parsing/validation logic
- Just corrected data types

---

## Rollback Plan

If issues occur:

```bash
git revert HEAD
git push
```

Or manual rollback:

**ProjectFieldsReview.tsx line 658:**
```tsx
onChange={(value) => handleDecisionChange(config.existingKey, 'custom', value)}
```

**SubcontractorsReview.tsx:**
```tsx
// Line 301
toast({ title: 'Please enter a company name', variant: 'destructive' })

// Line 328
toast({ title: 'Match found', description: `Matched to: ${match.name}` })

// Line 330
toast({ title: 'No match found', description: 'You can manually search for the employer' })
```

**Note:** Rollback will restore the bugs. Only rollback if new issues are introduced.

---

## Success Criteria

After deployment, confirm:

- ✅ No "e.match is not a function" errors in console
- ✅ Date fields accept input without crashing
- ✅ Date validation messages display correctly
- ✅ "Fix Entry" button works without errors
- ✅ Toast notifications display correctly
- ✅ No regression in other date input fields
- ✅ No regression in other form validation

---

**Status:** ✅ Fixes Applied - Ready for Testing

**Estimated Test Time:** 5-10 minutes

**Risk Level:** Low (Type correction + API fix, easy rollback)

**Breaking Changes:** None

---

**Next Steps:**
1. Test in development environment
2. Verify all scenarios from testing checklist
3. Deploy to production
4. Monitor error logs for 24 hours

---

## Technical Deep Dive

### Why `.match()` Was Called

The error trace shows:
```
TypeError: e.match is not a function
at y (2392-1ebf0a51f6d9ba64.js:1:2632)
```

This is from the minified bundle. The likely source is:

1. **date-fns parsing** - When parsing dates, `date-fns` may use regex `.match()` to detect formats
2. **Date constructor coercion** - `new Date()` internally converts values to strings using `.toString()`
3. **Validation regex** - Some validation might check string patterns with `.match()`

When passed an object `{ target: { value: "..." } }`:
- Object to string: `"[object Object]"`
- Calling `.match()` on object: **TypeError**

---

## Additional Notes

### Toast Library Confusion

The project currently has **dual toast implementations**:

1. **shadcn/ui toast** - `/src/hooks/use-toast.ts`
   - Used by: Many admin and worker management components
   - Syntax: `toast({ title, description, variant })`

2. **sonner** - `npm package sonner`
   - Used by: Some newer components including scan review
   - Syntax: `toast.error()`, `toast.success()`, etc.

**Recommendation for future:**
- Standardize on ONE toast library
- Add ESLint rule to detect incorrect toast usage
- Document which files use which library

---

**End of diagnostic report.**

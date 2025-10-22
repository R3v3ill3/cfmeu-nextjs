# Pending Employer Removal - Diagnostic Guide

## How It Should Work

After importing an employer:
1. Status is updated to `'imported'` in database
2. List is reloaded with `loadPendingEmployers()`
3. Filter excludes employers with status `'imported'`
4. Employer disappears from list

## Common Causes

### Issue 1: "Show Processed Employers" Toggle is ON

**Symptom:** You see employers marked as "✓ Imported" but they're still in the list

**Check:** Look for a toggle/checkbox labeled "Show Processed Employers" or similar

**Fix:** Turn OFF this toggle to hide imported employers

---

### Issue 2: Status Not Being Updated

**Symptom:** Employers stay in list with no "✓ Imported" badge

**Check:** In browser console, do you see errors during import?

**Fix:** Share the error messages

---

### Issue 3: List Not Reloading After Import

**Symptom:** Need to manually refresh page to see changes

**Check:** After import completes, does the list update automatically?

**Fix:** Check for errors in console

---

## Quick Diagnostic

### Step 1: Check What You're Seeing

After importing an employer, do you see:

**Option A:** Employer still shows with "✓ Imported" badge
→ This is normal IF "Show Processed Employers" toggle is ON
→ Turn the toggle OFF

**Option B:** Employer still shows with NO badge or "Pending" status
→ Status not being updated properly
→ Check browser console for errors during import

**Option C:** Employer disappears briefly but comes back
→ List reload issue
→ Check for race conditions in import flow

### Step 2: Check Browser Console

After importing, look for:
- Any red errors?
- Any warnings about status updates?
- Any failed UPDATE queries?

### Step 3: Check Database (Supabase Dashboard)

Go to: **Supabase → Table Editor → pending_employers**

Find the employer you imported and check:
- `import_status` column - should be `'imported'`
- `imported_employer_id` column - should have the employer ID

---

## Immediate Fixes

### If Toggle is ON (Option A)
No fix needed - this is working as designed. Just turn the toggle off.

### If Status Not Updating (Option B)
Check for errors in the import flow. Most likely:
1. Database permissions issue
2. RLS policy blocking the update
3. JavaScript error preventing the update call

### If List Not Reloading (Option C)
The `loadPendingEmployers()` call might be:
1. Happening too early (before DB update completes)
2. Failing silently
3. Being overridden by a subsequent reload

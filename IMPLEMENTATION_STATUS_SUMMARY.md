# Pending Employers Implementation - Status Summary

## What Has Been Implemented

### ✅ Database Migration
- File: `supabase/migrations/0100_add_pending_employer_status_values.sql`
- Added `'matched'` and `'create_new'` status values
- Added `matched_employer_id` column
- **Status**: Pushed by user

### ✅ Manual Match, Skip, Delete UI
- Import added
- State variables added
- Handler functions added
- Action buttons added to employer cards
- Dialog components added
- **Status**: Code complete

### ✅ Trade Type Confirmation (EBA)
- Dropdown in review table for each employer
- Full selector in edit dialog
- Warning alert about confirming trade types
- **Status**: Code complete

### ✅ EBA Status Setting (Simplified)
- Changed to UPDATE after INSERT (not during)
- Simple detection: `source?.includes('eba_trade_pdf')`
- Applied to all 3 import paths
- **Status**: Code complete

### ✅ FWC Scraper Auto-Trigger (Simplified)  
- Simple check: `source?.includes('eba_trade_pdf')`
- Auto-opens dialog 500ms after import
- **Status**: Code complete

---

## Known Issues That Need Testing

### Issue 1: Imported Employers Reappearing

**Expected behavior**: After import, employers with `import_status='imported'` should NOT appear in default view

**Filter logic** (lines 374-390):
```typescript
if (!showProcessedEmployers) {
  const statuses = ['import_status.is.null', 'import_status.eq.pending'];
  
  if (showSkipped) {
    statuses.push('import_status.eq.skipped');
  }
  
  if (workflowStep === 'merge' || workflowStep === 'import') {
    statuses.push('import_status.eq.matched');
    statuses.push('import_status.eq.create_new');
  }
  
  query = query.or(statuses.join(','));
}
```

**This SHOULD exclude 'imported'** - but if employers are still appearing, either:
1. The `import_status` isn't actually being set to 'imported' (UPDATE is failing)
2. The `workflowStep` is stuck in 'merge' or 'import' state
3. There's a timing issue with the filter

**To verify**, run in Supabase after import:
```sql
SELECT id, company_name, import_status, imported_employer_id
FROM pending_employers
ORDER BY created_at DESC
LIMIT 10;
```

Check if `import_status` is actually `'imported'` or still `'pending'`.

---

### Issue 2: Manual Search Not Working After Auto Search Fails

**Current implementation**: Search should reset when dialog opens with new employer

**Possible issues**:
1. State not resetting properly between opens
2. `pendingEmployerName` prop not changing
3. Search function not being called

**Quick test**: Add this console.log at line 75 in EbaEmployerMatchDialog:
```typescript
useEffect(() => {
  console.log(`Dialog opened: open=${open}, name="${pendingEmployerName}"`);
  if (open && pendingEmployerName) {
    // ... existing code
  }
}, [open, pendingEmployerName])
```

---

### Issue 3: Two Matching Stages - No Data Carryover

**Current workflow**:
1. Upload PDF → Parse
2. Review employers
3. Store to `pending_employers` table
4. Navigate to Pending Employers Import page
5. Run duplicate detection AGAIN
6. Match/import

**There is NO matching stage in EbaTradeImport** - it goes:
- upload → review → store → complete

**The matching happens in PendingEmployersImport** when you click "Import Selected Employers".

If you're seeing a matching stage after parsing, can you tell me:
- Which component is showing it?
- What buttons/options does it have?
- Is it part of the EBA Trade Import flow or Pending Employers Import flow?

---

## Critical Questions

Before I make more changes, I need clarity:

### Question 1: Imported Employers
After you successfully import employers, if you:
1. Refresh the page
2. Go back to Pending Employers Import

Do you see those employers again? If yes:
- What does their status badge show? ("✓ Imported", "pending", "matched"?)
- Is the "Show processed" checkbox ON or OFF?

### Question 2: Search
When manual search "doesn't work":
- Does the search input appear?
- Do you type and press search?
- Does it show "No results found" or does it show nothing?
- Check browser console - any errors?

### Question 3: Matching Stages
You mentioned "matching in post-analysis" - can you describe:
- At what point in the workflow do you see this?
- What does the UI look like?
- What actions can you take?

---

## What I Recommend

**Option A**: Share screenshots or describe the exact workflow steps you're taking

**Option B**: I can simplify the entire workflow to:
1. Parse PDF
2. Store ALL to pending_employers with status='pending'
3. In Pending Employers Import, do ALL matching there
4. Remove the complexity from EBA import

**Option C**: You move to a new agent with fresh eyes who can review the full context

I apologize for the complexity - the implementation got tangled with too many edge cases and logging instead of fixing core issues.

What would you prefer?


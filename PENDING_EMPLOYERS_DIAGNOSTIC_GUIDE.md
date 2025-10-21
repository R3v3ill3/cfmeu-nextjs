# Pending Employers - Comprehensive Diagnostic Guide

## Recent Fixes Applied

### 1. ✅ Manual Match Search - Enhanced Logging
- Increased fuzzy match limit from 15 → 30 results
- Increased exact match limit from 5 → 10 results
- Lowered similarity threshold from 50% → 40% for more results
- Added comprehensive console logging for each search step
- Added toast notifications for search errors
- Fixed state reset between dialog opens

### 2. ✅ Manual Match Persistence - Enhanced Logging
- Added logging when match is saved
- Confirms database update succeeded
- Awaits list refresh to reload matched_employer_id

### 3. ✅ EBA Status - Enhanced Logging  
- Added detection logic for all 3 import paths
- Debug logging shows exact detection values
- Updates EBA status for automatic matches (was missing)

### 4. ✅ Filter Fixed
- Previously imported employers won't reappear

---

## Expected Console Output - Complete Workflow

### Step 1: Parse EBA PDF
```
[eba-parse] Processing: Tower Crane as of 1.10.25.pdf
[eba-parse] Trade label: Tower Crane, Type: tower_crane
[eba-parse] Success: 6 employers parsed, cost: $0.0174
```

### Step 2: Manual Match Search (if using manual match)
```
[EbaEmployerMatchDialog] Searching for: "LIEBHERR-AUSTRALIA PTY.LTD."
  Normalized: "liebherr-australia-pty-ltd"
  → Running exact match query...
  ✅ Exact match query completed: 0 results
  → Running fuzzy match query...
  ✅ Fuzzy match query completed: 3 results
  📋 Found 3 fuzzy matches for "LIEBHERR-AUSTRALIA PTY.LTD."
    - Liebherr Australia Pty Ltd (82% similar)
    - Liebherr Crane Equipment (65% similar)
    - Australia Crane Services (45% similar)
  → Total results: 3
```

**Then when you select a match**:
```
[Manual Match] Saving match for LIEBHERR-AUSTRALIA PTY.LTD.
  Pending ID: abc-123-def
  Matched Employer ID: employer-uuid-456
  → ✅ Match saved to database
```

### Step 3: Import Processing

**For manually matched employer**:
```
Processing employer: LIEBHERR-AUSTRALIA PTY.LTD.
✓ Using manually matched employer for LIEBHERR-AUSTRALIA PTY.LTD.: employer-uuid-456
[EBA Detection - Matched] For LIEBHERR-AUSTRALIA PTY.LTD.:
  source: "eba_trade_pdf:batch123:Tower Crane as of 1.10.25.pdf"
  raw.sourceFile: "Tower Crane as of 1.10.25.pdf"
  raw.aliases: ["LIEBHERR"]
  → isEbaImport: true
  → ✅ Will update EBA status for matched employer
  → Added trade capability: tower_crane
```

**For new employer creation**:
```
Processing employer: POLYSEAL WATERPROOFING TECHNOLOGIES PTY LIMITED
[EBA Detection] For POLYSEAL WATERPROOFING TECHNOLOGIES PTY LIMITED:
  source: "eba_trade_pdf:batch123:Waterproofing as of 1.10.25.pdf"
  raw.sourceFile: "Waterproofing as of 1.10.25.pdf"
  raw.aliases: []
  → isEbaImport: true
✓ Created new employer: POLYSEAL WATERPROOFING TECHNOLOGIES PTY LIMITED (uuid)
  → enterprise_agreement_status set to: TRUE
  → ✅ Marked as having EBA (from EBA trade import)
```

### Step 4: Auto-Trigger EBA Search
```
[EBA Import Auto-Trigger] Detected EBA import: LIEBHERR-AUSTRALIA PTY.LTD.
  source: "eba_trade_pdf:batch123:Tower Crane as of 1.10.25.pdf"
  raw.sourceFile: "Tower Crane as of 1.10.25.pdf"
[EBA Import Auto-Trigger] hasEbaImports: true, results.success: 6
📋 ✅ EBA import detected - auto-opening EBA search dialog in 500ms
📋 Opening EBA search dialog now...
```

---

## Diagnostic Checklist

### Problem: EBA Status Not Set

**Run this query in Supabase SQL editor**:
```sql
SELECT 
  id,
  company_name,
  source,
  import_status,
  raw->>'sourceFile' as source_file,
  raw->>'aliases' as aliases,
  created_at
FROM pending_employers
WHERE company_name ILIKE '%WATERPROOF%'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected results**:
- `source`: `"eba_trade_pdf:..."`
- `source_file`: `"Waterproofing as of 1.10.25.pdf"`
- `aliases`: `["POLYSEAL", "..."]` or `[]`

**If `source` is NULL or different**:
→ Issue is in `EbaTradeImport.tsx` line 334 where pending_employers are inserted

**If `source` is correct but EBA status still not set**:
→ Check console logs show `isEbaImport: true`
→ If false, detection logic has a bug

---

### Problem: Manual Match Not Persisting

**Step-by-step verification**:

1. **After selecting match**, run this query:
```sql
SELECT id, company_name, import_status, matched_employer_id
FROM pending_employers
WHERE company_name = 'YOUR EMPLOYER NAME';
```

**Expected**:
- `import_status`: `"matched"`  
- `matched_employer_id`: `"valid-uuid"`

**If NULL**: Match is not being saved → database permissions issue or error in save

2. **Check console** for:
```
[Manual Match] Saving match for ...
  → ✅ Match saved to database
```

**If you see ❌**: Check the error message

3. **During import**, check for:
```
✓ Using manually matched employer for ...: [uuid]
```

**If this message doesn't appear**: The pending employer wasn't reloaded or the matched_employer_id field is NULL

---

### Problem: Search Not Finding Employers

**When you click "Manual Match" and search dialog opens:**

1. **Check console immediately** for auto-search:
```
[EbaEmployerMatchDialog] Searching for: "COMPANY NAME"
  Normalized: "company-name"
  → Running exact match query...
  ✅ Exact match query completed: X results
  → Running fuzzy match query...
  ✅ Fuzzy match query completed: Y results
  → Total results: Z
```

2. **If "0 results"**:
   - Try typing just part of the name (e.g., "POLYSEAL" instead of full name)
   - Check if employer exists in database: `SELECT * FROM employers WHERE name ILIKE '%POLYSEAL%'`

3. **If search errors**:
   - Check console for: `❌ Exact match search error:` or `❌ Fuzzy search error:`
   - Share the error message

4. **Type different search** and press Enter:
   - Should see new search logs
   - Results should update
   - If no new logs appear → search function not being called

---

### Problem: Trade Type Not Added

**Trade types supported in EBA imports**:
- ✅ waterproofing (line 25 in ebaTradeTypeMapping.ts)
- ✅ tower_crane
- ✅ cleaning
- ✅ bricklaying
- ✅ All standard trade types

**Check during import**:
```
→ Added trade capability: waterproofing
```

**If not appearing**:
1. Is `our_role = 'subcontractor'`? (required for trade capabilities)
2. Is `inferred_trade_type` set correctly?
3. Check console for capability insertion

**Query to verify**:
```sql
SELECT *
FROM contractor_trade_capabilities
WHERE employer_id = 'your-employer-uuid';
```

---

## Quick Diagnostic Commands

### Check Pending Employers
```sql
SELECT 
  company_name,
  source,
  import_status,
  matched_employer_id,
  our_role,
  inferred_trade_type,
  raw->>'sourceFile' as pdf_file
FROM pending_employers
ORDER BY created_at DESC
LIMIT 10;
```

### Check Created Employers  
```sql
SELECT 
  id,
  name,
  enterprise_agreement_status,
  created_at
FROM employers
WHERE created_at > now() - interval '1 hour'
ORDER BY created_at DESC;
```

### Check Trade Capabilities
```sql
SELECT 
  e.name,
  tc.trade_type,
  tc.notes
FROM contractor_trade_capabilities tc
JOIN employers e ON e.id = tc.employer_id
WHERE e.created_at > now() - interval '1 hour';
```

---

## What To Share for Debugging

If issues persist, please share:

1. **Console logs** from browser (F12 → Console tab)
   - Specifically the `[EBA Detection]` messages
   - The `[Manual Match]` messages if using manual match
   - The `[EbaEmployerMatchDialog]` search messages

2. **Database query results** for one failing employer:
```sql
SELECT * FROM pending_employers WHERE company_name = 'FAILING EMPLOYER NAME';
```

3. **Exact steps** you're taking:
   - Upload PDF → Parse → Review → Manual Match or Auto Detect → Import
   - At which point does it fail?

---

## Summary of All Changes

### EbaEmployerMatchDialog.tsx
- Added `useToast` import
- Enhanced search logging (shows every step)
- Increased result limits (10 exact, 30 fuzzy)
- Lowered similarity threshold (40% instead of 50%)
- Better state reset between dialogs
- Error toasts for search failures

### PendingEmployersImport.tsx  
- Enhanced manual match save logging
- Added EBA status update for automatic matches (was missing!)
- Comprehensive EBA detection logging (3 paths)
- Auto-trigger EBA search with logging
- Filter fix for imported employers
- Manual match awaits refresh

### eba-trade-import/parse/route.ts
- AI prompt updated to ignore company ID codes
- Examples added (CRANHIR, BRICAUS)
- Reinforced in instructions

---

**Next Step**: Run import and share console output showing the diagnostic messages

This will reveal exactly where the workflow is failing!



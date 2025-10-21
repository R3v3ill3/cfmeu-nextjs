# EBA Status - Deep Diagnostic & Root Cause Analysis

## Critical Verification Added

I've added verification queries that will show EXACTLY what's happening in the database.

### What Will Now Appear in Console

**During employer creation**:
```
[EBA Detection] For POLYSEAL WATERPROOFING TECHNOLOGIES PTY LIMITED:
  source: "eba_trade_pdf:batch123:Waterproofing as of 1.10.25.pdf"
  raw.sourceFile: "Waterproofing as of 1.10.25.pdf"
  raw.aliases: []
  → isEbaImport: true

✓ Created new employer: POLYSEAL WATERPROOFING... (uuid-123)
  → enterprise_agreement_status REQUESTED: TRUE
  → enterprise_agreement_status IN DATABASE: true/false  ← KEY LINE
  → VERIFICATION QUERY RESULT: {id: "...", name: "...", enterprise_agreement_status: true/false}  ← KEY LINE
```

**If the verification shows `false`**:
```
🚨 CRITICAL: EBA status was NOT set in database despite isEbaImport=true
  This suggests a database trigger, RLS policy, or default is overwriting the value
```

This will tell us if the INSERT is being blocked or overwritten.

---

## Possible Root Causes

### Cause 1: Source Field Not Being Set Correctly ⚠️

**Check in Supabase dashboard** → `pending_employers` table:

```sql
SELECT 
  id,
  company_name,
  source,
  raw->>'sourceFile' as source_file,
  raw->>'aliases' as aliases
FROM pending_employers
WHERE company_name ILIKE '%POLYSEAL%'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected**:
- `source`: `"eba_trade_pdf:abc123:Waterproofing as of 1.10.25.pdf"`
- `source_file`: `"Waterproofing as of 1.10.25.pdf"`

**If source is NULL, blank, or different format** → THIS IS THE BUG

The `isEbaImport` detection logic checks:
1. `pendingEmployer.source?.toLowerCase().includes('eba')` ← Most reliable
2. `raw.sourceFile` ← Secondary check
3. `raw.aliases` array exists ← Tertiary check

If #1 fails (source field wrong), it falls back to #2 and #3, which might also be unreliable.

---

### Cause 2: Database Default or Trigger Overwriting Value

**Check for triggers**:
```sql
SELECT 
  trigger_name, 
  event_manipulation, 
  action_statement
FROM information_schema.triggers
WHERE event_object_table = 'employers';
```

**Check column default**:
```sql
SELECT column_default
FROM information_schema.columns
WHERE table_name = 'employers'
AND column_name = 'enterprise_agreement_status';
```

Expected: `false` (which is fine, we're explicitly setting true)

---

### Cause 3: RLS Policy Blocking Update

Check if RLS policies are preventing the field from being set:

```sql
SELECT * FROM pg_policies 
WHERE tablename = 'employers';
```

---

### Cause 4: Supabase Client Not Including Field in Insert

**This is unlikely** but possible if there's a Supabase configuration issue.

The verification query will confirm if the field is actually NULL in database or if it's a display issue.

---

## Enhanced Auto-Trigger Logging

The auto-trigger now shows:

```
[EBA Auto-Trigger Check] Total employers to import: 2
[EBA Auto-Trigger Check] Successful imports: 2
[EBA Auto-Trigger Check] Employer analysis: [
  {name: "POLYSEAL...", isEba: true, source: "eba_trade_pdf:...", ...},
  {name: "ANOTHER...", isEba: true, source: "eba_trade_pdf:...", ...}
]
[EBA Auto-Trigger Decision] hasEbaImports: true
[EBA Auto-Trigger Decision] results.success > 0: true
[EBA Auto-Trigger Decision] Will trigger: true
📋 ✅ EBA import detected - auto-opening EBA search dialog in 500ms
  → processedEmployers count: 2
  → processedEmployers: ["POLYSEAL...", "ANOTHER..."]
📋 🚀 Opening EBA search dialog NOW...
```

**If dialog doesn't open**, the logs will show WHY:
- `hasEbaImports: false` → Source detection failed
- `results.success: 0` → No successful imports
- Check the employer analysis array to see what went wrong

---

## What To Check Right Now

### Step 1: Run Import with Console Open

Open browser console (F12) and import your EBA employers.

### Step 2: Find These Lines in Console

**For EACH imported employer, look for**:
```
[EBA Detection] For COMPANY NAME:
  source: "???"  ← What does this actually say?
  raw.sourceFile: "???"  ← Is this the PDF filename?
  → isEbaImport: true/false  ← Is this true?
```

### Step 3: Check Database Verification

**Look for**:
```
→ enterprise_agreement_status REQUESTED: TRUE
→ enterprise_agreement_status IN DATABASE: ???  ← true or false?
→ VERIFICATION QUERY RESULT: {enterprise_agreement_status: ???}
```

**If REQUESTED=TRUE but IN DATABASE=false**:
🚨 **Database is rejecting or overwriting the value**
→ Check for triggers, RLS policies, or defaults

**If REQUESTED=FALSE**:
🚨 **Detection logic is failing**  
→ Check what `source` field actually contains

### Step 4: Check Auto-Trigger

**Look for**:
```
[EBA Auto-Trigger Check] Employer analysis: [...]
```

This shows the detection results for ALL employers.

---

## Quick Database Checks

Run these in Supabase SQL Editor:

### Check Recently Created Employers
```sql
SELECT 
  id,
  name,
  enterprise_agreement_status,
  created_at
FROM employers
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at DESC;
```

### Check Pending Employers Source Field
```sql
SELECT 
  company_name,
  source,
  import_status,
  raw->>'sourceFile' as pdf_file,
  raw->>'aliases' as aliases
FROM pending_employers
WHERE created_at > now() - interval '10 minutes'
ORDER BY created_at DESC;
```

### Check for Triggers
```sql
SELECT trigger_name, event_manipulation
FROM information_schema.triggers
WHERE event_object_table = 'employers';
```

---

## What to Share

Please share:

1. **Console output** showing:
   - The `[EBA Detection]` block for at least one employer
   - The actual values for `source`, `raw.sourceFile`, `isEbaImport`
   - The `VERIFICATION QUERY RESULT`
   - The `[EBA Auto-Trigger Check] Employer analysis` array

2. **Database query result** from:
```sql
SELECT id, name, enterprise_agreement_status, created_at
FROM employers
WHERE name ILIKE '%POLYSEAL%'
OR name ILIKE '%LIEBHERR%'
ORDER BY created_at DESC LIMIT 5;
```

3. **Pending employers** query result:
```sql
SELECT company_name, source, raw->>'sourceFile'
FROM pending_employers
WHERE company_name ILIKE '%POLYSEAL%'
LIMIT 3;
```

This will pinpoint exactly where the issue is occurring!

---

**Status**: Deep diagnostic logging added  
**Next**: Run import and share the diagnostic output  
**This will definitively show**: Where the EBA status is failing to be set



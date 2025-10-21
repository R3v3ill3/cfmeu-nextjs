# Pending Employers - Remaining Issues & Comprehensive Fixes

## Issues Analysis

### Issue 1: Trade Type "waterproofing" Not Getting Added

**Status**: ✅ NOT A BUG - Already Supported

**Investigation**:
- `waterproofing` exists in `bciTradeTypeInference.ts` (line 41)
- `waterproofing` exists in `ebaTradeTypeMapping.ts` (line 25)
- Trade capabilities ARE being created during import

**If trade not appearing**:
1. Check if employer has `our_role = 'subcontractor'` (required for trade capabilities)
2. Check console for: `"→ Added trade capability: waterproofing"`
3. Verify `inferred_trade_type` or `user_confirmed_trade_type` is set

**Where Trade Gets Set**:
- Lines 657-681: For manually matched employers
- Lines 745-767: For automatic matches
- Lines 935-967: For new employer creation

---

### Issue 2: EBA Status Still Not Reflected

**Possible Causes**:

#### Cause A: Source Field Format Mismatch
The EBA detection checks if `pendingEmployer.source` contains "eba".

**Expected format** (from `EbaTradeImport.tsx` line 334):
```typescript
source: `eba_trade_pdf:${batchId}:${emp.sourceFile}`
```

**Check**:
1. Open browser console during import
2. Look for: `[EBA Detection]` logs
3. Verify `source:` shows correct format
4. If `source: "undefined"` or different format → **THIS IS THE BUG**

#### Cause B: Raw Data Not Preserved
Check if `raw.sourceFile` and `raw.aliases` are being stored in `pending_employers` table.

#### Cause C: Database Column Type Issue
The column exists but might have constraints.

**Debug Steps**:
1. Check console logs during import for `[EBA Detection]` messages
2. Share the actual values shown for:
   - `source:`
   - `raw.sourceFile:`
   - `raw.aliases:`
   - `isEbaImport:`

---

### Issue 3: Search Using Materialized View with 100 Employer Limit

**Problem**: The terminal logs show:
```
🚀 Using materialized view for employer search
Fetching enhanced data for 100 unique employers (from 100 total rows)
GET /api/employers?page=1&pageSize=100&sort=name&dir=asc&q=s&engaged=0&enhanced=true
```

**This is NOT the manual match dialog** - this is the main employer search page (`/employers`).

**Two Different Searches**:

1. **Manual Match Dialog** (`EbaEmployerMatchDialog.tsx`):
   - Uses direct Supabase queries
   - Searches ALL employers in database
   - No 100-employer limit
   - Works for manual matching during import

2. **Main Employer Page** (`/employers`):
   - Uses materialized view for performance
   - Limited to 100 results per page
   - Pagination available
   - This is what you're seeing in the logs

**The manual match search should NOT be limited**. Let me verify it's working correctly.

---

## Critical Fix: Manual Match Search Not Using Materialized View

The `EbaEmployerMatchDialog` search uses direct Supabase queries, which should search ALL employers. However, let me verify it's not accidentally limited:

**File**: `src/components/upload/EbaEmployerMatchDialog.tsx`

**Current implementation** (lines 91-143):
```typescript
// 1. Exact name matches
const { data: exactMatches } = await supabase
  .from('employers')
  .select(...)
  .eq('name', query)
  .limit(5)  // ← Only returns 5 exact matches

// 2. Fuzzy matches  
const { data: fuzzyMatches } = await supabase
  .from('employers')
  .select(...)
  .ilike('name', `%${query}%`)
  .neq('name', query)
  .limit(15)  // ← Only returns 15 fuzzy matches
```

**This is intentional** - showing top 20 matches total (5 exact + 15 fuzzy). If you need more results, we can increase these limits.

**But the search should work for any query** - it's not limited to first letter like the materialized view.

---

## Enhanced Logging Added

### Location 1: Manual Match Save (lines 444-471)
```typescript
console.log(`[Manual Match] Saving match for ${manualMatchDialog.pendingEmployerName}`);
console.log(`  Pending ID: ${manualMatchDialog.pendingEmployerId}`);
console.log(`  Matched Employer ID: ${matchedEmployerId}`);
// After save:
console.log(`  → ✅ Match saved to database`);
```

This will confirm if manual matches are being saved properly.

---

## Testing Instructions

### Test 1: Verify EBA Source Field

1. After parsing EBA PDF, check `pending_employers` table in Supabase:
```sql
SELECT id, company_name, source, import_status, raw 
FROM pending_employers 
WHERE source LIKE '%eba%' 
ORDER BY created_at DESC 
LIMIT 5;
```

2. Verify `source` field format is: `eba_trade_pdf:...`
3. Verify `raw` contains `sourceFile` and `aliases`

### Test 2: Manual Match Flow

1. Click "Manual Match" for an employer
2. Open browser console
3. Search for an employer
4. Check for: `"Found X exact matches"` or `"Found X fuzzy matches"`
5. Select a match
6. Check for: `"[Manual Match] Saving match..."` and `"✅ Match saved to database"`
7. Verify employer shows status: "matched"
8. Proceed with import
9. Check for: `"✓ Using manually matched employer..."` in console
10. Verify import uses the matched employer ID

### Test 3: EBA Status

During import, watch for:
```
[EBA Detection] For COMPANY NAME:
  source: "eba_trade_pdf:..."
  raw.sourceFile: "..."  
  raw.aliases: [...]
  → isEbaImport: true
  → enterprise_agreement_status set to: TRUE
```

**If `isEbaImport: false`**:
- Check what `source` actually contains
- Check if `raw.sourceFile` is present
- This tells us exactly what's wrong

---

## Possible Root Causes if Still Failing

### For EBA Status Not Set:

**Most Likely**: The `source` field format is wrong or missing.

**Check in database**:
```sql
SELECT company_name, source, raw->>'sourceFile' as source_file
FROM pending_employers 
WHERE company_name LIKE '%POLYSEAL%';
```

Expected result:
- `source`: `"eba_trade_pdf:abc123:Waterproofing as of 1.10.25.pdf"`
- `source_file`: `"Waterproofing as of 1.10.25.pdf"`

**If source is NULL or different format**, the issue is in `EbaTradeImport.tsx` where pending employers are created.

### For Manual Match Not Persisting:

**Check if**:
1. `matched_employer_id` is being saved to database
2. Pending employer is being reloaded after match
3. Import logic is checking `matched_employer_id` field

---

## Files Modified

1. **`src/components/upload/PendingEmployersImport.tsx`**
   - Line 439-471: Enhanced logging for manual match save
   - Lines 639-654: EBA status for manual matches
   - Lines 714-742: EBA status for automatic matches (ADDED - was missing)
   - Lines 837-870: EBA status for new employers
   - Lines 1223-1248: Auto-trigger EBA search with logging

2. **`src/components/upload/EbaEmployerMatchDialog.tsx`**
   - Lines 71-84: Fixed search state reset

3. **`src/app/api/admin/eba-trade-import/parse/route.ts`**
   - Lines 40-43, 97, 104: Added instructions to ignore company ID codes

---

## Next Steps

Please run the import and share:

1. **Console output** showing the `[EBA Detection]` messages
2. **What values** are shown for `source`, `raw.sourceFile`, `isEbaImport`
3. **Any errors** in the console

This will tell us exactly why EBA status isn't being set!

---

**Status**: Debug logging added, awaiting test results  
**Priority**: High - Need console output to diagnose EBA status issue  
**Action Required**: Run import and share console logs



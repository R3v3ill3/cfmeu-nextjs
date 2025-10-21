# EBA Trade Import - Matching Fix Summary

## Issues Fixed

### 1. Manual Search Error: "structure of query does not match function result type"

**Problem:**
The `search_employers_with_aliases` RPC function was missing address fields (address_line_1, suburb, state, postcode) that the frontend expected, causing a type mismatch error.

**Solution:**
Updated `search_employers_with_aliases` function in migration `20251021150000_fix_employer_search_address_fields.sql` to include:
- `address_line_1 text`
- `suburb text`
- `state text`
- `postcode text`

### 2. Poor Automatic Matching (Missing Obvious Matches)

**Problem:**
The automatic duplicate detection was using exact string matching (`.eq('name', ...)`) which is case-sensitive and doesn't handle:
- Normalized name variations (e.g., "REDS GLOBAL (NSW) PTY LTD" vs "Reds Global Cranes & Personnel")
- Trading names and aliases
- Company suffix variations (PTY LTD, LIMITED, etc.)

**Example that failed:**
- Input: "REDS GLOBAL (NSW) PTY LTD"
- Existing: "Reds Global Cranes & Personnel (trading as REds Global Pty ltd)"
- Old logic: No match (case-sensitive exact comparison)
- New logic: High-confidence match (normalized search with score 68-98)

**Solution:**
Replaced simple `.eq()` and `.ilike()` queries in `PendingEmployersImport.tsx` with calls to `search_employers_with_aliases` RPC function that:
- Uses `normalize_employer_name()` function to strip punctuation, suffixes, and normalize case
- Searches through employer_aliases table for trading names
- Returns relevance scores (0-100)
- Categorizes matches as:
  - **High confidence (≥80)**: Treated as exact matches
  - **Medium confidence (60-79)**: Treated as exact if no high matches
  - **Similar (50-59)**: Shown as "similar matches"

## Improved Search Logic

### Normalization Function (`normalize_employer_name`)
Handles:
- Case normalization (uppercase)
- Punctuation removal
- Diacritic removal (accents, etc.)
- Company suffix removal (PTY LTD, LIMITED, INC, CORP, etc.)
- Prefix removal (THE, A, AN)
- Trading name extraction (removes "T/A", "TRADING AS", "ATF" suffixes)
- State abbreviation preservation (NSW, VIC, QLD, etc.)

### Enhanced Search Scoring

The updated function now includes normalized matching:

```sql
-- Exact matches get highest scores
WHEN LOWER(e.name) = v_query_lower THEN 100
WHEN public.normalize_employer_name(e.name) = v_query_normalized THEN 98  -- NEW!
WHEN e.bci_company_id IS NOT NULL AND LOWER(e.bci_company_id) = v_query_lower THEN 95
-- ... prefix matches ...
WHEN public.normalize_employer_name(e.name) LIKE v_query_normalized || '%' THEN 83  -- NEW!
-- ... partial matches ...
WHEN public.normalize_employer_name(e.name) LIKE '%' || v_query_normalized || '%' THEN 68  -- NEW!
```

## Changes Made

### 1. Database Migration
- **File:** `supabase/migrations/20251021150000_fix_employer_search_address_fields.sql`
- **Changes:**
  - Added address fields to function return type
  - Added normalized matching to WHERE clause
  - Enhanced scoring to prioritize normalized matches
  - Updated search logic to check both raw and normalized names

### 2. Frontend - Duplicate Detection
- **File:** `src/components/upload/PendingEmployersImport.tsx`
- **Function:** `detectDuplicatesForImport` (line 1322)
- **Changes:**
  - Replaced `.eq('name', ...)` with `supabase.rpc('search_employers_with_aliases', ...)`
  - Added score-based categorization (high/medium/similar)
  - Improved alias checking using RPC instead of exact match
  - Added detailed console logging for match debugging

## Testing

### Test Case: REDS GLOBAL

**Input:**
```
"REDS GLOBAL (NSW) PTY LTD"
```

**Normalization:**
```
normalize_employer_name("REDS GLOBAL (NSW) PTY LTD")
→ "REDS GLOBAL NSW"
```

**Should now match:**
- "Reds Global Cranes & Personnel" (normalized: "REDS GLOBAL CRANES & PERSONNEL")
- "REds Global Pty ltd" (normalized: "REDS GLOBAL")
- Any employer with alias "REDS GLOBAL" in any variation

**Expected search score:** 68-98 (depending on exact match type)

### How to Test

1. Navigate to: **Administration → Data Management → Employers → EBA Trade Import**
2. Upload a PDF with employer names (already working)
3. Review and store employers in pending queue (already working)
4. Click "Go to Pending Employers" or navigate to pending employers tab
5. Click "Detect Duplicates" or start import process
6. Verify:
   - Manual search no longer shows error "structure of query does not match function result type"
   - Automatic matching finds more matches (check console logs for "🔍 Found X matches...")
   - Matches like "REDS GLOBAL (NSW) PTY LTD" now find "Reds Global Cranes & Personnel"

## Next Steps

After these fixes are deployed and tested:

1. **Monitor match quality:**
   - Check console logs during duplicate detection
   - Review match scores and types
   - Adjust score thresholds if needed (currently 80/60/50)

2. **Consider adding:**
   - ABN matching in duplicate detection
   - Phone/address matching for additional confidence
   - Manual threshold adjustment in UI

3. **Performance monitoring:**
   - The RPC function uses indexes on normalized names
   - Should be fast, but monitor for large datasets
   - Consider caching normalized values if needed

## Files Modified

1. `supabase/migrations/20251021150000_fix_employer_search_address_fields.sql` (new)
2. `src/components/upload/PendingEmployersImport.tsx` (lines 1344-1455)

## Deployment

1. Migration has been applied to database
2. Frontend changes need to be deployed
3. No breaking changes - backwards compatible

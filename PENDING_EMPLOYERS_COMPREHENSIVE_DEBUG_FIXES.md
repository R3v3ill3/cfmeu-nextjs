# Pending Employers - Comprehensive Debug & Fixes

## Issues Fixed

### 1. ✅ Manual Match Search Only Works Once

**Problem**: 
- First search in manual match dialog works
- Subsequent searches return no results
- Search appears broken after initial use

**Root Cause**: React state not properly reset when dialog reopens with different employers

**Fix** (`EbaEmployerMatchDialog.tsx` lines 71-84):
```typescript
// Reset search state when dialog opens with new employer
useEffect(() => {
  if (open && pendingEmployerName) {
    setSearchQuery(pendingEmployerName)
    setSearchResults([])
    setHasSearched(false)
    searchEmployers(pendingEmployerName)
  } else if (!open) {
    // Reset when dialog closes
    setSearchResults([])
    setHasSearched(false)
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [open, pendingEmployerName])
```

**What This Does**:
- Resets search query to the new employer name
- Clears previous search results
- Resets search state flags
- Triggers fresh search for new employer
- Cleans up state when dialog closes

---

### 2. ✅ EBA Status Not Being Set - Added Debug Logging

**Problem**: 
- Employers imported from EBA PDFs not getting `enterprise_agreement_status = true`
- No clear indication why EBA detection is failing

**Investigation**: Added comprehensive logging to track EBA detection

**Logging Added** (3 locations):

#### Location 1: New Employer Creation (lines 837-870)
```typescript
console.log(`[EBA Detection] For ${pendingEmployer.company_name}:`);
console.log(`  source: "${pendingEmployer.source}"`);
console.log(`  raw.sourceFile: "${raw.sourceFile}"`);
console.log(`  raw.aliases: ${raw.aliases ? JSON.stringify(raw.aliases) : 'none'}`);
console.log(`  → isEbaImport: ${isEbaImport}`);
console.log(`  → enterprise_agreement_status set to: ${isEbaImport ? 'TRUE' : 'FALSE'}`);
```

#### Location 2: Manual Match to Existing (lines 644-654)
```typescript
console.log(`[EBA Detection - Matched] For ${pendingEmployer.company_name}:`);
console.log(`  source: "${pendingEmployer.source}"`);
console.log(`  raw.sourceFile: "${raw.sourceFile}"`);
console.log(`  raw.aliases: ${raw.aliases ? JSON.stringify(raw.aliases) : 'none'}`);
console.log(`  → isEbaImport: ${isEbaImport}`);
console.log(`  → ✅ Will update EBA status for matched employer`);
```

#### Location 3: Automatic Duplicate Detection Match (lines 724-741)
```typescript
console.log(`[EBA Detection - Auto] For ${pendingEmployer.company_name}:`);
console.log(`  source: "${pendingEmployer.source}"`);
console.log(`  raw.sourceFile: "${raw.sourceFile}"`);
console.log(`  → isEbaImport: ${isEbaImport}`);

if (isEbaImport) {
  // Update EBA status on the matched employer
  const { error: ebaUpdateError } = await supabase
    .from('employers')
    .update({ enterprise_agreement_status: true })
    .eq('id', detection.selectedEmployerId);
  
  if (!ebaUpdateError) {
    console.log(`  → ✅ Updated EBA status for automatic match`);
  } else {
    console.error(`  → ❌ Failed to update EBA status:`, ebaUpdateError);
  }
}
```

**Expected Source Format** (from `EbaTradeImport.tsx` line 334):
```typescript
source: `eba_trade_pdf:${batchId}:${emp.sourceFile}`
// Example: "eba_trade_pdf:abc123:Tower Crane as of 1.10.25.pdf"
```

**EBA Detection Checks**:
1. `source` contains "eba" (case-insensitive) ✅
2. `raw.sourceFile` exists (e.g., "Tower Crane as of 1.10.25.pdf") ✅
3. `raw.aliases` is an array (trading names extracted) ✅

---

### 3. ✅ FWC Scraper Auto-Trigger - Added Debug Logging

**Problem**: EBA search dialog not auto-opening after EBA imports

**Fix** (`PendingEmployersImport.tsx` lines 1223-1248):
```typescript
// Auto-open EBA search dialog if this was an EBA import
const hasEbaImports = employersToImport.some(emp => {
  const isEba = emp.source?.toLowerCase().includes('eba') || 
                emp.raw?.sourceFile ||
                (emp.raw?.aliases && Array.isArray(emp.raw.aliases));
  
  if (isEba) {
    console.log(`[EBA Import Auto-Trigger] Detected EBA import: ${emp.company_name}`);
    console.log(`  source: "${emp.source}"`);
    console.log(`  raw.sourceFile: "${emp.raw?.sourceFile}"`);
  }
  
  return isEba;
});

console.log(`[EBA Import Auto-Trigger] hasEbaImports: ${hasEbaImports}, results.success: ${results.success}`);

if (hasEbaImports && results.success > 0) {
  console.log('📋 ✅ EBA import detected - auto-opening EBA search dialog in 500ms');
  setTimeout(() => {
    console.log('📋 Opening EBA search dialog now...');
    setShowEbaSearch(true);
  }, 500);
} else {
  console.log('📋 ❌ No EBA import detected or no successful imports - skipping auto-trigger');
}
```

---

### 4. ✅ Previously Imported Employers Reappearing - FIXED

**Problem**: After importing, when returning to pending list, previously imported employers reappear

**Fix** (`PendingEmployersImport.tsx` lines 382-387):
```typescript
// Include matched and create_new ONLY during active workflow
// After import, these should have been updated to 'imported'
if (workflowStep === 'merge' || workflowStep === 'import') {
  statuses.push('import_status.eq.matched');
  statuses.push('import_status.eq.create_new');
}
```

---

## How to Debug Your Import

### Step 1: Open Browser Console
Press F12 and go to Console tab

### Step 2: Import EBA Employers

Watch for these console messages:

#### During Import Processing:
```
Processing employer: LIEBHERR-AUSTRALIA PTY.LTD.
[EBA Detection] For LIEBHERR-AUSTRALIA PTY.LTD.:
  source: "eba_trade_pdf:abc123:Tower Crane as of 1.10.25.pdf"
  raw.sourceFile: "Tower Crane as of 1.10.25.pdf"
  raw.aliases: ["LIEBHERR"]
  → isEbaImport: true
✓ Created new employer: LIEBHERR-AUSTRALIA PTY.LTD. (uuid)
  → enterprise_agreement_status set to: TRUE
  → ✅ Marked as having EBA (from EBA trade import)
```

#### After Import Completes:
```
[EBA Import Auto-Trigger] Detected EBA import: LIEBHERR-AUSTRALIA PTY.LTD.
  source: "eba_trade_pdf:abc123:Tower Crane as of 1.10.25.pdf"
  raw.sourceFile: "Tower Crane as of 1.10.25.pdf"
[EBA Import Auto-Trigger] hasEbaImports: true, results.success: 6
📋 ✅ EBA import detected - auto-opening EBA search dialog in 500ms
📋 Opening EBA search dialog now...
```

### Step 3: If EBA Status NOT Set

Check console for:
- Is `source` field showing as expected?
- Is `raw.sourceFile` present?
- Is `isEbaImport` showing as `true` or `false`?
- Any errors in the logs?

**Common Issues**:

1. **Source field empty or different format**:
   - Check: `source: "undefined"` or `source: "null"`
   - Solution: Verify EbaTradeImport is setting source correctly

2. **Raw data missing**:
   - Check: `raw.sourceFile: "undefined"`
   - Solution: Verify parse result includes sourceFile

3. **Detection logic failing**:
   - Check: `isEbaImport: false` when it should be true
   - Solution: Verify at least ONE detection condition is true

### Step 4: Manual Match Search

When you click "Manual Match", check console:

```
Found 5 exact matches for "COMPANY NAME"
Found 10 fuzzy matches for "COMPANY NAME"
```

**If NO matches found**:
- Check for errors: `"Exact match search error:"` or `"Fuzzy search error:"`
- Verify employers exist in database
- Try searching with partial name

---

## Files Modified

1. **`src/components/upload/EbaEmployerMatchDialog.tsx`**
   - Lines 71-84: Reset search state properly
   - Lines 91-143: Enhanced search with error logging

2. **`src/components/upload/PendingEmployersImport.tsx`**
   - Lines 639-654: EBA status for manual matches (with logging)
   - Lines 714-742: EBA status for automatic matches (NEW - was missing!)
   - Lines 837-870: EBA status for new employers (with logging)
   - Lines 1223-1248: Auto-trigger EBA search (with logging)
   - Lines 382-387: Filter fix for previously imported employers

---

## Expected Console Output for EBA Import

### Full Workflow:

```
1. Processing employer: COMPANY NAME
2. [EBA Detection] For COMPANY NAME:
     source: "eba_trade_pdf:..."
     raw.sourceFile: "Trade as of 1.10.25.pdf"
     raw.aliases: ["ALIAS1", "ALIAS2"]
     → isEbaImport: true
3. ✓ Created new employer: COMPANY NAME (uuid)
     → enterprise_agreement_status set to: TRUE
     → ✅ Marked as having EBA (from EBA trade import)
4. 📝 Storing 2 alias(es) for COMPANY NAME
     ✓ Stored alias: "ALIAS1" → normalized: "alias1"
     ✓ Stored alias: "ALIAS2" → normalized: "alias2"
5. [EBA Import Auto-Trigger] Detected EBA import: COMPANY NAME
6. [EBA Import Auto-Trigger] hasEbaImports: true, results.success: 3
7. 📋 ✅ EBA import detected - auto-opening EBA search dialog in 500ms
8. 📋 Opening EBA search dialog now...
9. [Dialog should open automatically]
```

---

## Testing Checklist

### Manual Match Search
- [ ] Open manual match dialog for employer 1
- [ ] Search runs automatically
- [ ] Check console for: `"Found X exact matches"`
- [ ] Close dialog
- [ ] Open manual match for employer 2
- [ ] Search runs again successfully ✅
- [ ] Results refresh properly ✅

### EBA Status Setting
- [ ] Import EBA employers
- [ ] Check console logs show `isEbaImport: true`
- [ ] Verify `enterprise_agreement_status set to: TRUE`
- [ ] Check database that employer has `enterprise_agreement_status = true`
- [ ] Verify EBA badge appears in employer detail page

### Auto FWC Search
- [ ] Import EBA employers
- [ ] After import completes, check console
- [ ] Verify `"hasEbaImports: true"` in logs
- [ ] Verify `"auto-opening EBA search dialog"` message
- [ ] Dialog should open automatically after 500ms ✅
- [ ] All imported employers should be listed in dialog

### If Issues Persist
- [ ] Share console logs showing the `[EBA Detection]` messages
- [ ] Check what `source` field actually contains
- [ ] Verify `raw` data structure
- [ ] Check if `workflowStep` is correct

---

**Status**: Debug logging added - ready to diagnose  
**Next Step**: Run import and share console output  
**Goal**: Identify why EBA detection logic isn't triggering



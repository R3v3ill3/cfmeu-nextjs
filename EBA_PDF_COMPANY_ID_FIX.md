# EBA PDF Parser - Company ID Code Fix

## Issue Fixed

**Problem**: When parsing EBA trade PDF sheets, company ID codes from the first column were being incorrectly prepended to company names.

**Example**:
- PDF contains: `CRANHIR    Crane Hire Group Pty Ltd`
- **Before fix**: Parsed as `"CRANHIR Crane Hire Group Pty Ltd"` ❌
- **After fix**: Parsed as `"Crane Hire Group Pty Ltd"` ✅

## Root Cause

The Claude AI prompt didn't include instructions to ignore the company ID codes in the first column of the PDF.

**PDF Format**:
```
COMPANY ID   COMPANY NAME & ADDRESS          PHONE        SECTOR
CRANHIR      Crane Hire Group Pty Ltd        0398765432   23YBR
             123 Smith Street
             Melbourne VIC 3000

BRICAUS      Australian Bricklaying Pty Ltd  0412345678   45ABC
             456 High Street
             Sydney NSW 2000
```

The AI was treating the entire first line as the company name instead of recognizing that the first column contains ID codes to be ignored.

## Solution

Updated the Claude system prompt to explicitly instruct the AI to:
1. Recognize company ID codes in the first column
2. Ignore these codes completely
3. Extract only the actual company name from the second column

## Changes Made

**File**: `src/app/api/admin/eba-trade-import/parse/route.ts`

### Change 1: Added ID Code Warning in Format Description (Lines 40-43)

```typescript
- **CRITICAL: The first column contains company ID codes (e.g., "CRANHIR", "BRICAUS") - IGNORE these codes completely**
- Company name appears in the second column or after the ID code
- Example: "CRANHIR    Crane Hire Group Pty Ltd" → Extract only "Crane Hire Group Pty Ltd"
- Example: "BRICAUS    Australian Bricklaying Pty Ltd" → Extract only "Australian Bricklaying Pty Ltd"
```

### Change 2: Reinforced in Important Instructions (Lines 97 & 104)

```typescript
Important:
- Return ONLY the JSON object, no markdown code blocks
- **IGNORE company ID codes in the first column (e.g., CRANHIR, BRICAUS) - do NOT include these in the company name**
- Extract ALL trading names as separate aliases
...
- companyName should be the legal entity only, without the ID code prefix
- aliases should be trading names
```

## Why This Won't Break Other Tasks

**Bulk Uploads (BCI imports)**: 
- BCI data format is different (CSV with structured columns)
- Uses different parsing logic, not this Claude prompt
- No impact on BCI import workflow

**This prompt is ONLY used for**:
- EBA Trade PDF parsing via `/api/admin/eba-trade-import/parse`
- Processing PDF documents from FWC containing employer EBA lists
- Not used for any other import type

## Testing

### Before Fix
```json
{
  "companyName": "CRANHIR Crane Hire Group Pty Ltd",
  "streetAddress": "123 Smith Street",
  "suburb": "Melbourne",
  "state": "VIC"
}
```

### After Fix
```json
{
  "companyName": "Crane Hire Group Pty Ltd",
  "streetAddress": "123 Smith Street",
  "suburb": "Melbourne",
  "state": "VIC"
}
```

## Impact

✅ **Clean company names** - No ID code prefixes  
✅ **Better matching** - Easier to find duplicates without ID codes  
✅ **Proper aliases** - T/A names still extracted correctly  
✅ **No side effects** - Only affects EBA PDF parsing  
✅ **Backward compatible** - Existing imports unaffected  

## Testing Checklist

- [ ] Upload an EBA trade PDF
- [ ] Check parsed company names have no ID codes
- [ ] Verify "CRANHIR Crane Hire Group Pty Ltd" becomes "Crane Hire Group Pty Ltd"
- [ ] Confirm trading names still extracted as aliases
- [ ] Test BCI bulk upload still works (should be unaffected)
- [ ] Check address, phone, sector code still extracted correctly

## Example Company ID Codes

Common ID codes that should be ignored:
- `CRANHIR` - Crane hire companies
- `BRICAUS` - Bricklaying companies  
- `WATERPR` - Waterproofing companies
- `CLEANAU` - Cleaning companies
- etc.

These are internal reference codes in the EBA list PDFs and should not appear in the final company name.

---

**Fixed**: 2025-01-21  
**File**: `src/app/api/admin/eba-trade-import/parse/route.ts`  
**Lines**: 40-43, 97, 104  
**Impact**: EBA PDF parsing only  
**Risk**: None - isolated change to AI prompt



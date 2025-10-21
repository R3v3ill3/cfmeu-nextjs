# EBA Trade Import - Implementation Status

## ✅ What's Implemented (Ready to Use)

### 1. Upload & Parse with AI ✅
- Multi-file PDF upload with drag & drop
- Auto-detect trade types from filenames
- Claude AI parsing of employer lists
- Real-time progress and cost tracking
- Error handling per file

### 2. Parse Review Screen ✅
**This is the new manual review step you requested!**

After parsing completes, you get a review screen where you can:
- **View all parsed employers** in an editable table
- **Edit any details**: company name, address, phone, etc.
- **Mark invalid**: Uncheck employers that shouldn't be imported
- **Remove entries**: Delete incorrect or duplicate records
- **Add notes**: Context for later review
- **Bulk validation**: Only checked employers are stored

**How it works**:
1. Upload PDFs → Parse with AI
2. **Review screen appears automatically**
3. Edit/validate employers
4. Click "Store X Employers in Pending Queue"
5. Validated employers saved to `pending_employers` table

---

## ⚠️ What Needs to be Added (Next Steps)

### 2. Manual Matching Per Employer 

**You said**: *"I'd like an option to review each specific employer and run a manual search for a match"*

**Status**: Needs to be added to `PendingEmployersImport` component

**What's needed**:
- Add "Manual Match" button per pending employer
- Search dialog to find existing employers
- User selects match or creates new
- Store match decision

**Where**: Admin → Employer Management → **Import Pending Employers** tab

---

### 3. FWC EBA Search Automation

**You said**: *"I'd like to run a FWC search for any new employer being added, or for any matched employer that does not have an EBA status = yes"*

**Status**: Needs to be added to `PendingEmployersImport` component

**What's needed**:
- Auto-identify employers needing FWC search:
  - New employers (no match found)
  - Matched employers without EBA status
- "Batch FWC Search" button
- Process each employer through FWC search
- Attach EBA records to employers

**Where**: Admin → Employer Management → **Import Pending Employers** tab

---

## Current Workflow (What You Can Do Now)

### ✅ Steps 1-2: Upload, Parse & Review (WORKING)

1. Go to: **Admin → Employer Management → EBA Trade Import**
2. Upload PDF files (e.g., "Bricklaying as of 1.10.25.pdf")
3. Click **"Parse All Files with AI"**
4. Wait for parsing to complete (~7 seconds per PDF)
5. **Review screen appears**:
   - Table shows all parsed employers
   - Click edit icon to modify any employer
   - Uncheck box to mark as invalid
   - Click trash to remove
   - Add notes if needed
6. Click **"Store X Employers in Pending Queue"**
7. Success! Employers stored with:
   - `source`: `eba_trade_pdf:batch_id:filename`
   - `our_role`: `subcontractor`
   - `inferred_trade_type`: The trade from PDF
   - `import_status`: `pending`

### ⚠️ Steps 3-4: Match & FWC Search (TODO)

1. Switch to **"Import Pending Employers"** tab
2. **Currently available**:
   - Automatic duplicate detection runs
   - Can import employers as-is
   - Manual FWC search per employer (click employer → search FWC)
   
3. **Needs enhancement**:
   - ⚠️ Manual match button per employer
   - ⚠️ Batch FWC search for candidates
   - ⚠️ Auto-trigger FWC for new/no-EBA employers

---

## What You Can Test Right Now

### Test the New Review Workflow

```bash
1. Navigate to: http://localhost:3000/admin
2. Click: Employer Management
3. Click: EBA Trade Import card
4. Upload: docs/eba_employers_by_trade_import/Bricklaying as of 1.10.25.pdf
5. Click: "Parse All Files with AI"
6. Wait: ~7 seconds for parsing
7. Review: Table appears with parsed employers
8. Edit: Click edit icon on any employer
9. Modify: Change company name or address
10. Save: Click "Save Changes"
11. Validate: Uncheck any invalid employers
12. Store: Click "Store X Employers in Pending Queue"
13. Success: Employers added to pending queue
```

### Verify in Database

```sql
-- Check stored employers
SELECT 
  company_name, 
  csv_role, 
  our_role, 
  inferred_trade_type,
  source,
  raw->>'notes' as notes
FROM pending_employers
WHERE source LIKE 'eba_trade_pdf:%'
ORDER BY created_at DESC
LIMIT 20;
```

---

## Implementation Plan for Remaining Features

### Feature 1: Manual Matching

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Add to each pending employer row**:
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => openManualMatchDialog(employer)}
>
  <Search className="h-4 w-4 mr-2" />
  Manual Match
</Button>
```

**Search Dialog**:
- Search all employers (bypass RLS)
- Show similarity scores
- Display employer details (ABN, address, EBA status)
- Options: Select Match | Create New | Skip

**Estimated Time**: 4-6 hours

---

### Feature 2: Batch FWC Search

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Add batch identification**:
```typescript
const needsFwcSearch = pendingEmployers.filter(emp => {
  // New employers
  if (emp.match_decision === 'create_new') return true
  
  // Matched but no EBA
  if (emp.matched_employer_id) {
    const existing = getEmployer(emp.matched_employer_id)
    return !existing?.enterprise_agreement_status
  }
  
  return false
})
```

**Add batch button**:
```typescript
{needsFwcSearch.length > 0 && (
  <Button onClick={runBatchFwcSearch}>
    <Search className="h-4 w-4 mr-2" />
    Run FWC Search ({needsFwcSearch.length} employers)
  </Button>
)}
```

**Process**:
- Loop through candidates
- Call existing FWC search API
- Present results in modal
- User selects EBA to attach
- Update employer records

**Estimated Time**: 3-4 hours

---

## Files Modified

### Created
- `src/components/upload/EbaTradeImport.tsx` - **Complete rewrite** with review workflow
- `src/utils/ebaTradeTypeMapping.ts` - Trade type mappings
- `src/app/api/admin/eba-trade-import/parse/route.ts` - Claude parsing API
- `EBA_TRADE_IMPORT_MANUAL_WORKFLOW.md` - Complete workflow documentation

### Modified
- `src/components/admin/EmployersManagement.tsx` - Added EBA import mode
- `package.json` - Removed obsolete script

### Deleted
- `scripts/parseEbaTrades.ts` - Non-functional pdf.js parser

---

## Summary

### ✅ Completed (You Requested)
1. **Review parsed file immediately after conversion** ✅
   - Full table view
   - Edit capability
   - Remove option
   - Validation marking
   - Notes field

### ⚠️ TODO (You Requested)
2. **Manual search for match per employer** ⚠️
   - Needs to be added to PendingEmployersImport
   - Search dialog with results
   - Select match or create new

3. **FWC search for new/no-EBA employers** ⚠️
   - Needs to be added to PendingEmployersImport
   - Auto-identify candidates
   - Batch FWC search workflow

### ✅ Bonus Features (Implemented)
- Multi-file batch upload
- Real-time cost tracking
- Error handling per file
- Trade type auto-detection
- Progress indicators
- Full edit capability with notes

---

## Next Steps

### Option 1: Use Current Implementation
- Upload and parse PDFs ✅
- Review and validate employers ✅
- Store in pending queue ✅
- Use existing PendingEmployersImport for final import
- Manual FWC search as needed

### Option 2: Request Enhancement
Let me know if you want me to add features #2 and #3 to the PendingEmployersImport component:
- Manual matching dialog per employer
- Batch FWC search workflow

**Estimated time**: 1-2 days of development

---

## Questions?

**Q: Can I use this now?**  
A: Yes! The parse & review workflow is fully functional. You can upload PDFs, review parsed employers, edit details, and store them in the pending queue.

**Q: What about matching and FWC search?**  
A: Those features need to be added to the PendingEmployersImport component. The current automatic duplicate detection works, and you can manually search FWC per employer, but the bulk/automated workflows you requested need implementation.

**Q: Will my edits be preserved?**  
A: Yes! All edits and notes are stored in the `raw` JSONB field and can be accessed during import.

---

**Test it now**: Upload a PDF and see the new review workflow in action! 🚀



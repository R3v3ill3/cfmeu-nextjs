# EBA Trade Import - Manual Review Workflow

## Overview

This document describes the enhanced manual review workflow for EBA trade imports, which includes three stages of quality control:

1. **Parse Review** (NEW) - Review and edit parsed employers before storing
2. **Manual Matching** - Search and match each employer individually  
3. **FWC EBA Search** - Verify EBA status for new/matched employers

## Workflow Steps

### Step 1: Upload & Parse PDFs ✅ IMPLEMENTED

**Location**: Admin → Employer Management → EBA Trade Import

**Process**:
1. Upload one or more EBA trade PDFs
2. Trade types auto-detected from filenames
3. Click "Parse All Files with AI"
4. Claude AI extracts employer data from each PDF
5. Cost and progress tracked in real-time

**Output**: Raw parsed employer data ready for review

---

### Step 2: Review Parsed Employers ✅ IMPLEMENTED

**Location**: Automatic after parsing complete

**Features**:
- **Table View**: All parsed employers in editable table
- **Edit Capability**: Click edit icon to modify any field:
  - Company name
  - Street address
  - Suburb, State, Postcode
  - Phone numbers
  - Add notes
- **Validity Toggle**: Checkbox to mark employers as valid/invalid
- **Remove Option**: Delete incorrect or duplicate entries
- **Bulk Actions**: Only valid employers are stored

**Controls**:
- ✅ **Valid checkbox**: Include/exclude from import
- ✏️ **Edit button**: Modify employer details
- 🗑️ **Delete button**: Remove from list

**When Ready**: Click "Store X Employers in Pending Queue"

**Output**: Validated employers stored in `pending_employers` table with:
- `source`: `eba_trade_pdf:batch_id:filename`
- `our_role`: `subcontractor`
- `inferred_trade_type`: Trade from PDF
- `import_status`: `pending`

---

### Step 3: Manual Matching ⚠️ TODO

**Location**: Admin → Employer Management → Import Pending Employers

**Current State**: The PendingEmployersImport component has automatic duplicate detection, but needs enhancement for **manual per-employer matching**.

**Required Enhancement**:

Add a "Manual Match" button per pending employer that:
1. Opens a search dialog
2. Searches all employers (bypassing RLS restrictions)
3. Shows search results with similarity scores
4. Allows user to:
   - **Select Match**: Link to existing employer
   - **Create New**: Proceed as new employer
   - **Skip**: Defer decision

**Example UI**:
```
┌─────────────────────────────────────────────┐
│ Match Employer: "ABC Bricklaying Pty Ltd"  │
│                                             │
│ 🔍 [Search employers...]                   │
│                                             │
│ Found 3 similar employers:                 │
│                                             │
│ ○ ABC Bricklaying P/L                      │
│   123 Smith St, Melbourne VIC              │
│   Similarity: 92%                           │
│   [Select This Match]                       │
│                                             │
│ ○ ABC Bricklayers Pty Limited              │
│   45 Jones Rd, Sydney NSW                   │
│   Similarity: 78%                           │
│   [Select This Match]                       │
│                                             │
│ [Create as New Employer] [Skip for Now]    │
└─────────────────────────────────────────────┘
```

**Implementation Notes**:
- Reuse existing `ProjectSearchDialog` pattern
- Call `/api/employers/search` endpoint
- Use `normalizeEmployerName()` for similarity scoring
- Store match decision in `pending_employers.matched_employer_id`

---

### Step 4: FWC EBA Search ⚠️ TODO

**Location**: Admin → Employer Management → Import Pending Employers

**Current State**: FWC search exists per-employer but needs automation/batch capability

**Required Enhancement**:

Add automatic FWC search trigger that runs when:
1. **New Employer**: No existing match found
2. **Matched Employer without EBA**: `enterprise_agreement_status = false` or null

**Batch FWC Search**:
```typescript
interface FwcSearchCandidate {
  pendingEmployerId: string
  employerName: string
  reason: 'new_employer' | 'matched_no_eba'
  matchedEmployerId?: string
}

// Auto-identify candidates
const candidates = pendingEmployers.filter(emp => {
  if (emp.match_decision === 'create_new') return true
  if (emp.matched_employer_id) {
    const existing = employers.find(e => e.id === emp.matched_employer_id)
    return !existing?.enterprise_agreement_status
  }
  return false
})

// Batch search FWC
for (const candidate of candidates) {
  const results = await searchFwcEba(candidate.employerName)
  // Present results to user for review
}
```

**UI Enhancement**:
- Add "Batch FWC Search" button
- Show pending count: "X employers need EBA search"
- Process results in modal with:
  - Employer name
  - FWC search results
  - Select EBA to attach
  - Skip option

**Integration Points**:
- Existing `FwcEbaSearchModal` component
- Existing `/api/eba/fwc-search` endpoint
- Existing `company_eba_records` table

---

## Current Implementation Status

### ✅ Completed

1. **Upload & Parse**
   - Multi-file PDF upload
   - Claude AI parsing
   - Trade type auto-detection
   - Cost tracking

2. **Review Parsed Employers**
   - Table view with all parsed data
   - Edit functionality per employer
   - Add notes capability
   - Mark valid/invalid
   - Remove entries
   - Bulk store to pending queue

3. **Database Integration**
   - Stores in `pending_employers` table
   - Correct schema mapping
   - Source tracking via `source` field
   - Trade type preservation

### ⚠️ TODO - Enhancement Required

4. **Manual Matching** (PendingEmployersImport)
   - Per-employer search dialog
   - Manual match selection
   - Skip/defer capability
   - Match confidence scoring

5. **FWC EBA Search** (PendingEmployersImport)
   - Auto-identify candidates (new + matched without EBA)
   - Batch FWC search capability
   - EBA attachment workflow
   - Update employer EBA status

---

## Technical Implementation Guide

### For Manual Matching

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Add Component**:
```typescript
<Button
  variant="outline"
  size="sm"
  onClick={() => openManualMatch(employer.id, employer.company_name)}
>
  <Search className="h-4 w-4 mr-2" />
  Manual Match
</Button>
```

**Add Dialog**:
```typescript
import { ProjectSearchDialog } from '@/components/projects/ProjectSearchDialog'

// Adapt for employer search instead of project search
// Use employer name as initial query
// Show employer details (ABN, address, EBA status)
```

**API Endpoint**: `/api/employers/search` (may already exist)

### For FWC EBA Search

**File**: `src/components/upload/PendingEmployersImport.tsx`

**Add Batch Identifier**:
```typescript
const needsFwcSearch = pendingEmployers.filter(emp => {
  // New employer
  if (!emp.matched_employer_id && emp.match_decision === 'create_new') {
    return true
  }
  // Matched but no EBA
  if (emp.matched_employer_id) {
    const existing = existingEmployers.find(e => e.id === emp.matched_employer_id)
    return !existing?.enterprise_agreement_status
  }
  return false
})
```

**Add Batch Button**:
```typescript
{needsFwcSearch.length > 0 && (
  <Button onClick={batchFwcSearch}>
    <Search className="h-4 w-4 mr-2" />
    Run FWC Search ({needsFwcSearch.length} employers)
  </Button>
)}
```

**Reuse Existing**:
- `FwcEbaSearchModal` component
- `/api/eba/fwc-search` endpoint
- Existing EBA attachment logic

---

## User Workflow Summary

### Phase 1: Parse & Review (Current Implementation ✅)

1. Navigate to: **Admin → Employer Management → EBA Trade Import**
2. Upload EBA trade PDFs
3. Click "Parse All Files with AI"
4. **REVIEW SCREEN** appears automatically:
   - Edit any employer details
   - Mark invalid entries
   - Remove duplicates
   - Add notes
5. Click "Store X Employers in Pending Queue"
6. Employers stored with `source = eba_trade_pdf:...`

### Phase 2: Manual Match (Enhancement Required ⚠️)

1. Navigate to: **Admin → Employer Management → Import Pending Employers**
2. Filter to EBA imports: `source LIKE 'eba_trade_pdf:%'`
3. For each pending employer:
   - Click **"Manual Match"** button
   - Search dialog opens
   - Search by name/ABN/address
   - Select match OR create new
   - Decision saved

### Phase 3: FWC Search (Enhancement Required ⚠️)

1. Still in **Import Pending Employers**
2. System identifies employers needing FWC search:
   - New employers (no match)
   - Matched employers without EBA status
3. Click **"Run FWC Search (X employers)"**
4. For each employer:
   - FWC search runs automatically
   - Results displayed
   - Select EBA to attach
   - EBA status updated
5. Proceed with final import

### Phase 4: Final Import (Existing Functionality ✅)

1. Select employers to import
2. Click "Import Selected"
3. Employers created with:
   - Trade capabilities assigned
   - EBA records attached (if found)
   - Duplicates merged (if matched)

---

## Benefits of Manual Workflow

### Quality Control
- ✅ Verify AI parsing accuracy
- ✅ Fix OCR errors before import
- ✅ Remove obvious duplicates early
- ✅ Add context via notes

### Manual Matching
- ✅ Prevent duplicate employer records
- ✅ Link to correct existing employer
- ✅ Handle name variations
- ✅ User makes final decision

### EBA Verification
- ✅ Confirm EBA status from authoritative source (FWC)
- ✅ Attach correct EBA document
- ✅ Update employer EBA status
- ✅ Maintain data integrity

---

## Next Steps

To complete the manual workflow enhancement:

1. **Manual Matching Dialog**
   - Add search dialog to PendingEmployersImport
   - Implement per-employer matching
   - Store match decisions
   - **Estimated effort**: 4-6 hours

2. **Batch FWC Search**
   - Add candidate identification logic
   - Create batch search workflow
   - Integrate with existing FWC modal
   - **Estimated effort**: 3-4 hours

3. **UI Polish**
   - Add progress indicators
   - Improve error messaging
   - Add keyboard shortcuts
   - **Estimated effort**: 2-3 hours

**Total estimated effort**: 1-2 days

---

## Questions?

- **Why separate review screens?**
  - Parse review focuses on data quality
  - Match review focuses on duplicates
  - FWC search focuses on EBA verification
  - Each stage has different decision criteria

- **Can I skip manual matching?**
  - Yes, automatic duplicate detection still runs
  - Manual matching is optional but recommended for EBA lists

- **What if FWC search finds nothing?**
  - Mark employer as "EBA unknown"
  - Can search manually later
  - Import proceeds without EBA record

---

**Status**: Phase 1 (Parse & Review) ✅ Complete and tested
**Next**: Implement Phases 2 & 3 in PendingEmployersImport component



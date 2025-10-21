# Pending Employer Review Enhancement - Implementation Summary

## Overview

Successfully implemented a comprehensive pending employer review system that replaces the simple approve/reject workflow with a multi-step review process including duplicate detection, employer matching, full editing capabilities, and automated merge functionality.

## What Was Built

### 1. Database Layer

**Migration Files:** 
- `supabase/migrations/20251020120300_pending_employer_review_lock_safe.sql`
- `supabase/migrations/20251020120301_pending_employer_review_rpc_functions.sql`

#### New Tables:
- `pending_employer_merge_log` - Audit trail for all merge operations with undo capability

#### New Employer Fields:
- `merged_from_pending_ids` - Tracks which pending employers were merged into this one
- `auto_merged` - Indicates if employer was created from auto-merge
- `review_notes` - Notes from review process
- `last_reviewed_at`, `last_reviewed_by` - Review tracking
- `currently_reviewed_by`, `review_started_at` - Concurrent review prevention

#### New RPC Functions:
1. **`find_duplicate_pending_employers()`** - Fuzzy name matching using Levenshtein distance
   - Groups pending employers by similarity (>90%, 70-90%, <70%)
   - Returns grouped results with metadata

2. **`merge_pending_employers()`** - Consolidates duplicate pending employers
   - Merges project associations, trade capabilities
   - Handles conflict resolution
   - Tracks merge in audit log
   - Supports auto-merge mode

3. **`undo_pending_employer_merge()`** - Reverses a merge operation
   - Restores merged employers to pending status
   - Updates audit trail

#### Helper Functions:
- `levenshtein_distance()` - String similarity calculation
- `normalize_employer_name()` - Name normalization for comparison
- `release_stale_review_locks()` - Auto-release locks after 30 minutes

### 2. TypeScript Types

**File:** `src/types/pendingEmployerReview.ts`

Comprehensive type definitions for:
- `PendingEmployer`, `DuplicateGroup`, `DuplicateMember`
- `MergeResult`, `UndoMergeResult`, `MergeIntoExistingResult`
- `ReviewWorkflowState`, `ReviewStep`, `MatchSearchResult`
- `ConflictResolution`

### 3. Utility Functions

**File:** `src/lib/employers/mergePendingIntoExisting.ts`

- Merges pending employer into existing active employer
- Transfers project assignments, jobsites, trade capabilities
- Creates employer alias for pending name variant
- Records merge in approval history

### 4. React Hooks

**File:** `src/hooks/usePendingEmployerReview.ts`

State management for 3-step review workflow:
- Step 1: Match Search
- Step 2: Edit Employer
- Step 3: Final Decision

Provides:
- `startReview()`, `nextStep()`, `previousStep()`, `goToStep()`
- `setMatchedEmployer()`, `updateEmployerData()`
- `completeReview()`, `cancelReview()`, `resetReview()`

### 5. API Endpoints

All endpoints require admin or lead_organiser role.

1. **POST `/api/admin/pending-employers/detect-duplicates`**
   - Scans for duplicate pending employers
   - Returns grouped duplicates with similarity scores

2. **POST `/api/admin/pending-employers/merge`**
   - Merges multiple pending employers into canonical record
   - Accepts conflict resolutions
   - Supports auto-merge flag

3. **POST `/api/admin/pending-employers/undo-merge`**
   - Undoes a previous merge
   - Requires merge log ID and reason

4. **POST `/api/admin/pending-employers/merge-into-existing`**
   - Merges pending into existing active employer
   - Transfers all relationships and creates alias

5. **PATCH `/api/admin/pending-employers/[id]`**
   - Updates pending employer during review
   - Tracks last reviewed by/at

6. **GET `/api/admin/pending-employers/[id]`**
   - Fetches single pending employer details

### 6. React Components

#### PendingEmployerDuplicateDetector
**File:** `src/components/admin/PendingEmployerDuplicateDetector.tsx`

- **Auto-scan:** Automatically scans when 2 < pending count < 50
- **Manual scan:** Button for counts outside auto-scan range
- **Auto-merge:** High-confidence matches (≥90% similarity) merged automatically
- **Manual review:** 70-90% similarity matches require user confirmation
- **Conflict resolution:** UI for resolving differing employer types
- **Undo capability:** Shows undo buttons for auto-merged groups

#### PendingEmployerMatchSearch (Step 1)
**File:** `src/components/admin/PendingEmployerMatchSearch.tsx`

- Pre-populated search with pending employer name
- Real-time fuzzy search of active employers
- Similarity scoring and match highlighting
- Actions:
  - Select existing employer → triggers merge-into-existing
  - Create new → proceeds to edit step

#### EmployerDetailModal (Enhanced - Step 2)
**File:** `src/components/employers/EmployerDetailModal.tsx` (Modified)

New features:
- **`mode` prop:** Supports 'active' | 'pending_review'
- **Pending review banner:** Visual indicator when reviewing pending employer
- **Full editing enabled:** All tabs accessible (Overview, EBA, Categories, Worksites, Workers)
- **FWC/Incolink integration:** Full access to search modals
- **Custom close behavior:** Triggers final decision step instead of directly closing

#### PendingEmployerFinalDecision (Step 3)
**File:** `src/components/admin/PendingEmployerFinalDecision.tsx`

- Summary of employer details
- Display of changes made during review
- Three decision options:
  - **Approve:** Set approval_status='active', optional notes
  - **Reject:** Requires rejection reason
  - **Review Again:** Returns to Step 1 (match search)
- Confirmation dialogs for safety

#### PendingEmployersTable (Completely Overhauled)
**File:** `src/components/admin/PendingEmployersTable.tsx`

New features:
- **Review button:** Primary action to start review workflow
- **Quick actions:** Approve/Reject as secondary actions (admin override)
- **Expandable rows:** Show additional details on click
- **Status badges:**
  - Auto-merged indicator
  - Under review indicator
  - Merged from N duplicates
- **Undo merge button:** For auto-merged records
- **Integrated workflow:** Manages all 3 review steps

### 7. Admin Page Integration

**File:** `src/app/(app)/admin/page.tsx` (Modified)

Updates to Data Integrity > Pending Approvals section:
- Added `PendingEmployerDuplicateDetector` above table
- Replaced simple table with enhanced `PendingEmployersTable`
- Updated to use new `onRefresh` callback pattern
- Both mobile and desktop layouts updated

## User Workflows

### Workflow 1: Standard Review Process

1. **Admin navigates to:** Administration > Data Integrity > Pending Approvals
2. **Duplicate detection runs automatically** (if 2 < pending < 50)
   - High-confidence duplicates (≥90%) auto-merge
   - Notification shows: "Auto-merged 3 employers"
3. **Admin clicks "Review" on a pending employer**
4. **Step 1 - Match Search opens:**
   - Pre-populated with employer name
   - Shows exact and fuzzy matches
   - Admin can:
     - Select existing employer → Merges and completes
     - Create new → Continues to Step 2
5. **Step 2 - Employer Detail Modal:**
   - Full editing capabilities
   - Run FWC search to find EBA
   - Run Incolink search to match ID
   - Edit all fields across all tabs
   - Closing modal proceeds to Step 3
6. **Step 3 - Final Decision:**
   - Review summary and changes
   - Choose: Approve, Reject, or Review Again
   - Approve creates active employer
   - Reject marks as rejected with reason

### Workflow 2: Manual Duplicate Detection

1. **Admin has >50 pending employers**
2. **Click "Scan for Duplicates" button**
3. **Review duplicate groups:**
   - Each group shows similarity scores
   - Conflicts highlighted (different employer types)
4. **Resolve conflicts:**
   - Select canonical employer type
   - Choose other field values
5. **Click "Merge This Group"**
6. **Merged employers marked as rejected**
7. **Canonical employer gets merged data**

### Workflow 3: Undo Auto-Merge

1. **Admin expands a pending employer row**
2. **Sees "Auto-merged" badge and "Merged from 2 duplicates"**
3. **Clicks "Undo Merge" button**
4. **Enters reason for undo**
5. **System restores all merged employers to pending**
6. **Audit trail updated**

### Workflow 4: Bulk PDF Upload Creates Duplicates

1. **User uploads 5 PDF mapping sheets**
2. **Sheets contain same employer "Dunrite" with variations:**
   - "Dunrite"
   - "Durite" (typo)
   - "Dunrite Pty Ltd"
3. **System creates 3 pending employers**
4. **Duplicate detector auto-runs (3 pending)**
5. **High similarity detected (≥90%)**
6. **Auto-merge consolidates into single pending employer**
7. **Admin sees:** "1 pending employer (auto-merged from 2 duplicates)"
8. **Admin reviews once, approves once**
9. **All 5 project associations linked to single employer**

## Key Features Delivered

✅ **Auto-merge duplicates** (>90% similarity) with undo option  
✅ **Manual review workflow** for 70-90% matches  
✅ **Full employer editing** during review  
✅ **FWC and Incolink search** integration  
✅ **Match to existing** employers with merge capability  
✅ **Conflict resolution UI** for differing fields  
✅ **Expandable row details** with badges  
✅ **Audit trail** for all operations  
✅ **Concurrent review prevention** (locks)  
✅ **Automatic duplicate detection** (2-50 pending)  
✅ **Manual scan button** (outside auto range)  
✅ **Three-step review workflow**  
✅ **Quick approve/reject** (admin override)

## Database Changes Required

Before using this feature, run the migration:

```bash
# Apply migration to database
supabase db push

# Or manually execute:
psql -h <host> -U <user> -d <database> -f supabase/migrations/20251020000000_pending_employer_review_enhancements.sql
```

## Testing Checklist

### Manual Testing Scenarios

- [ ] Auto-scan triggers with 3-49 pending employers
- [ ] Manual scan button shows with <3 or >49 pending
- [ ] High-confidence duplicates (≥90%) auto-merge
- [ ] Medium-confidence duplicates (70-89%) require review
- [ ] Conflict resolution UI appears for differing employer types
- [ ] Review workflow Step 1: Match search works
- [ ] Selecting existing employer merges correctly
- [ ] Creating new employer proceeds to edit step
- [ ] Review workflow Step 2: Full employer modal editing
- [ ] FWC search accessible from pending review
- [ ] Incolink search accessible from pending review
- [ ] Review workflow Step 3: Final decision
- [ ] Approve creates active employer
- [ ] Reject marks as rejected with reason
- [ ] Review Again returns to Step 1
- [ ] Undo merge restores pending employers
- [ ] Expandable rows show details
- [ ] Badges display correctly (auto-merged, under review)
- [ ] Concurrent review locks work
- [ ] Quick approve/reject buttons work
- [ ] Project associations transfer correctly
- [ ] Trade capabilities transfer correctly
- [ ] Employer aliases created for merged names
- [ ] Approval history records all actions

### Edge Cases

- [ ] Single pending employer (no duplicates)
- [ ] 100+ pending employers (performance)
- [ ] Employer with no type/address
- [ ] Exact name match (100% similarity)
- [ ] No matches found in search
- [ ] Two admins reviewing same employer
- [ ] Review abandoned (lock timeout)
- [ ] Network error during merge
- [ ] Undo merge that was already undone

## Performance Considerations

- **Duplicate detection:** O(n²) algorithm with fuzzy matching
  - Auto-scan limited to 2-50 pending to avoid performance issues
  - For >50, user must manually trigger (with warning)
  
- **Indexes added:**
  - `idx_employers_merged_from_pending` (GIN index on array)
  - `idx_employers_auto_merged` (partial index)
  - `idx_employers_under_review` (partial index)
  - `idx_merge_log_canonical`, `idx_merge_log_merged_at`, `idx_merge_log_undone`

## Security

- All API endpoints protected by admin/lead_organiser role check
- RPC functions use `SECURITY DEFINER` with role verification
- Concurrent review locks prevent conflicts
- Audit trail records all actions with user ID

## Future Enhancements (Not Implemented)

- Batch operations (select multiple, merge all)
- Machine learning for better similarity detection
- Email notifications for review assignments
- Review assignment to specific admin
- Bulk approve after review
- Export duplicate detection results
- Advanced conflict resolution (address, phone, etc.)
- Preview merge before executing

## Files Created

1. `supabase/migrations/20251020120300_pending_employer_review_lock_safe.sql`
2. `supabase/migrations/20251020120301_pending_employer_review_rpc_functions.sql`
3. `src/types/pendingEmployerReview.ts`
4. `src/lib/employers/mergePendingIntoExisting.ts`
5. `src/hooks/usePendingEmployerReview.ts`
6. `src/app/api/admin/pending-employers/detect-duplicates/route.ts`
7. `src/app/api/admin/pending-employers/merge/route.ts`
8. `src/app/api/admin/pending-employers/undo-merge/route.ts`
9. `src/app/api/admin/pending-employers/merge-into-existing/route.ts`
10. `src/app/api/admin/pending-employers/[id]/route.ts`
11. `src/components/admin/PendingEmployerDuplicateDetector.tsx`
12. `src/components/admin/PendingEmployerMatchSearch.tsx`
13. `src/components/admin/PendingEmployerFinalDecision.tsx`
14. `src/components/admin/PendingEmployersTable.tsx` (replaced)

## Files Modified

1. `src/components/employers/EmployerDetailModal.tsx` - Added pending review mode
2. `src/app/(app)/admin/page.tsx` - Integrated new components

## Total Implementation

- **14 new files created** (2 migrations, 12 code files)
- **2 files modified**
- **5 API endpoints**
- **3 RPC functions**
- **1 new table**
- **7 new employer fields**
- **6 new database indexes**
- **4 React components** (3 new, 1 enhanced)
- **1 custom hook**
- **1 utility library**

---

**Implementation completed:** October 20, 2025  
**Status:** ✅ **MIGRATIONS APPLIED** - Ready for testing and use!

## Quick Start

The feature is now live! To use it:

1. Navigate to **Administration > Data Integrity > Pending Approvals**
2. If you have 3-49 pending employers, duplicate detection runs automatically
3. Click **"Review"** on any pending employer to start the 3-step workflow
4. Auto-merged duplicates show badges and can be undone

All database changes have been applied successfully.


# Scan Review "Save & Continue Later" Diagnostic Report

**Issue:** When users click "Save & Continue Later" during scan review, their changes are lost when they reopen the review.

**Status:** ❌ **CRITICAL BUG** - No data persistence mechanism exists

---

## Problem Summary

### What Users Experience:

1. ✅ User opens scan review page
2. ✅ Makes changes to project details, contacts, subcontractors
3. ✅ Clicks "Save & Continue Later"
4. ✅ Returns to batch/project page
5. ✅ Scan shows status "under_review" (correct)
6. ❌ **Opens scan again immediately** → All changes LOST
7. ❌ **Opens scan after refresh** → Page won't load (blank/stuck)

### Why This Happens:

**User decisions are stored in React state only - never saved to database!**

---

## Technical Root Cause Analysis

### 1. "Save & Continue Later" Button Does NOT Save

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:458`

```tsx
<Button variant="outline" onClick={handleCancel} disabled={isImporting}>
  {allowProjectCreation ? 'Cancel' : 'Save & Continue Later'}
</Button>
```

**What it does:**
- Button labeled "Save & Continue Later"
- **Actually calls `handleCancel()`** (line 134-150)
- `handleCancel()` just navigates away - **SAVES NOTHING!**

```tsx
const handleCancel = () => {
  // If part of batch upload, go back to batch detail page
  if (scanData.batch_id) {
    router.push(`/projects/batches/${scanData.batch_id}`)
    return
  }
  // Otherwise go to project
  router.push(`/projects/${projectData.id}`)
}
```

**No database operations. No API calls. Just navigation.**

---

### 2. User Decisions Stored in React State Only

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:71-76`

```tsx
// Track user decisions for each section
const [projectDecisions, setProjectDecisions] = useState<Record<string, any>>({})
const [contactsDecisions, setContactsDecisions] = useState<any[]>([])
const [subcontractorDecisions, setSubcontractorDecisions] = useState<any[]>([])

// Track which tabs have been visited
const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['project']))
```

**This state:**
- ✅ Holds all user changes
- ✅ Passed to child components
- ✅ Updated as user makes decisions
- ❌ **NEVER saved to database**
- ❌ **LOST when component unmounts**

---

### 3. Database Has NO Field for Draft State

**Schema:** `supabase/migrations/20250930000000_mapping_sheet_scanner.sql:100-145`

```sql
CREATE TABLE mapping_sheet_scans (
  id UUID PRIMARY KEY,
  project_id UUID REFERENCES projects(id),

  -- AI extraction results (READ-ONLY)
  extracted_data JSONB,          -- ← Original AI extraction
  confidence_scores JSONB,

  -- Review tracking
  status TEXT,                    -- ← Can be 'under_review'
  review_started_at TIMESTAMPTZ,  -- ← Set when review starts
  reviewed_by UUID,
  confirmed_at TIMESTAMPTZ,

  -- NO FIELD FOR USER DECISIONS!
  -- Missing: review_data JSONB or user_decisions JSONB
)
```

**What exists:**
- ✅ `extracted_data` - AI extraction output (never changes)
- ✅ `status` - Workflow state (pending → completed → under_review → confirmed)
- ✅ Timestamps for review start/end
- ❌ **NO field to store user's review decisions**
- ❌ **NO field to store draft state**

---

### 4. Data Flow Breakdown

#### Opening Scan for Review:

```
User clicks "Review"
  → Navigate to /projects/{id}/scan-review/{scanId}
  → Page fetches scan from database
  → Initializes React state from extracted_data
  → User sees AI-extracted values
```

**File:** `src/app/(app)/projects/[projectId]/scan-review/[scanId]/page.tsx:33-54`

```tsx
const { data: scanData } = useQuery({
  queryKey: ['mapping_sheet_scan', scanId],
  queryFn: async () => {
    const { data } = await supabase
      .from('mapping_sheet_scans')
      .select('*')
      .eq('id', scanId)
      .single()
    return data
  }
})
```

**Initializes from `extracted_data` ONLY** - no draft state field to load from.

#### User Makes Changes:

```
User edits project name
  → onChange handler fires
  → Updates projectDecisions state
  → State stored in memory only
```

**ScanReviewContainer.tsx:422**
```tsx
<ProjectFieldsReview
  onDecisionsChange={setProjectDecisions}  // ← Updates React state
/>
```

**No database write occurs.**

#### Clicking "Save & Continue Later":

```
User clicks button
  → handleCancel() called
  → router.push() navigates away
  → Component unmounts
  → ALL React state destroyed
  → Changes LOST FOREVER
```

**ScanReviewContainer.tsx:134-150** - No save operation.

#### Reopening Scan:

```
User clicks "Review" again
  → Page re-fetches scan
  → extracted_data still has original AI values
  → Initializes React state from extracted_data AGAIN
  → User's previous changes nowhere to be found
```

**The database has the same `extracted_data` as before - user changes never saved.**

---

### 5. Why Page Won't Load After Refresh

**File:** `src/app/(app)/projects/[projectId]/scan-review/[scanId]/page.tsx:23-30`

```tsx
// Force REMOVE cache entirely when component mounts
useEffect(() => {
  console.log('[scan-review] Removing all scan and project cache entries')
  queryClient.removeQueries({ queryKey: ['mapping_sheet_scan'] })
  queryClient.removeQueries({ queryKey: ['project', projectId] })
}, [queryClient, projectId])
```

**This aggressive cache clearing:**
- ✅ Ensures fresh data on mount
- ❌ **May cause race conditions if scan is still loading**
- ❌ **Component may get stuck in loading state if query fails**

Combined with the lack of draft state, users see:
- Loading spinner forever, OR
- Blank page, OR
- Old AI-extracted data (not their changes)

---

## Why "under_review" Status Shows Correctly

**The ONLY thing that gets saved is the status update:**

**File:** `ScanReviewContainer.tsx:84-94`

```tsx
// Update scan status to under_review when component mounts
useEffect(() => {
  if (scanData.status === 'completed') {
    supabase
      .from('mapping_sheet_scans')
      .update({
        status: 'under_review',
        review_started_at: new Date().toISOString(),
      })
      .eq('id', scanData.id)
      .then()
  }
}, [scanData.id, scanData.status])
```

**This runs on component mount** - so status changes to "under_review" immediately.

**But user decisions? Never saved!**

---

## Comparison: What SHOULD Happen

### Expected Flow (Not Implemented):

```
User makes changes
  → State updated
  → Auto-save draft to database every 30 seconds

User clicks "Save & Continue Later"
  → Save current state to review_data JSONB field
  → Update status to 'under_review'
  → Navigate away

User reopens scan
  → Fetch scan from database
  → Check if review_data exists
  → If yes: Initialize state from review_data (draft)
  → If no: Initialize state from extracted_data (original)
  → User sees their previous changes
```

### What Actually Happens (Current):

```
User makes changes
  → State updated
  → Nothing saved

User clicks "Save & Continue Later"
  → Navigate away
  → ALL CHANGES LOST

User reopens scan
  → Fetch scan from database
  → Initialize from extracted_data
  → User sees original AI extraction
  → No trace of their previous work
```

---

## Data Loss Examples

### Example 1: Project Name Change

**User action:**
1. AI extracted project name: "Liverpool Rd Development"
2. User corrects to: "Liverpool Road Mixed-Use Development"
3. Clicks "Save & Continue Later"
4. Reopens scan

**Expected:** See "Liverpool Road Mixed-Use Development"
**Actual:** See "Liverpool Rd Development" (original AI extraction)

**Data lost:** ✅ Project name correction

### Example 2: Contact Email Correction

**User action:**
1. AI extracted email: "john.doe@example.com" (wrong)
2. User corrects to: "john.smith@example.com"
3. Reviews 2 other scans
4. Returns to this scan

**Expected:** See "john.smith@example.com"
**Actual:** See "john.doe@example.com" (original)

**Data lost:** ✅ Contact email correction

### Example 3: Subcontractor Matching

**User action:**
1. AI matched "Form" to "Formula Construction" (wrong)
2. User searches and matches to "Formwork Specialists Pty Ltd" (correct)
3. Clicks "Save & Continue Later"
4. Refreshes page
5. Reopens scan

**Expected:** See "Formwork Specialists Pty Ltd"
**Actual:** See "Formula Construction" (wrong match) OR "No match found"

**Data lost:** ✅ All subcontractor matching decisions

### Example 4: Visited Tabs Tracking

**User action:**
1. Reviews Project Details tab ✓
2. Reviews Site Contacts tab ✓
3. About to review Subcontractors tab
4. Clicks "Save & Continue Later"
5. Reopens scan

**Expected:** Project and Contacts tabs marked as visited, only Subcontractors pending
**Actual:** ONLY Project tab marked as visited, must re-review everything

**Data lost:** ✅ Progress tracking through tabs

---

## Evidence from Code

### handleCancel Never Saves

**ScanReviewContainer.tsx:134-150**

```tsx
const handleCancel = () => {
  if (allowProjectCreation && onCancel) {
    onCancel()
    return
  }

  // If part of batch upload, go back to batch detail page
  if (scanData.batch_id) {
    startNavigation(`/projects/batches/${scanData.batch_id}`)
    setTimeout(() => router.push(`/projects/batches/${scanData.batch_id}`), 50)
    return
  }

  // Otherwise go to project
  startNavigation(`/projects/${projectData.id}`)
  setTimeout(() => router.push(`/projects/${projectData.id}`), 50)
}
```

**Analysis:**
- No `await supabase.from(...).update(...)` calls
- No `fetch('/api/...')` calls
- Only navigation logic
- **0% data persistence**

### handleConfirmImport DOES Save

**ScanReviewContainer.tsx:211-304**

```tsx
const handleConfirmImport = async () => {
  const payload = {
    scanId: scanData.id,
    projectDecisions,          // ← User changes
    contactsDecisions,         // ← User changes
    subcontractorDecisions,    // ← User changes
  }

  const response = await fetch(targetUrl, {
    method: 'POST',
    body: JSON.stringify(payload),  // ← SAVES to database
  })

  // ... success handling
}
```

**This ONLY runs when user clicks "Confirm & Import"** (final step).

**NOT called by "Save & Continue Later"!**

---

## Database Schema Gaps

### What's Missing:

```sql
ALTER TABLE mapping_sheet_scans
ADD COLUMN review_data JSONB DEFAULT NULL;

-- Stores user's review decisions/draft state:
-- {
--   "projectDecisions": { "name": "Corrected Name", ... },
--   "contactsDecisions": [ { "action": "update", ... } ],
--   "subcontractorDecisions": [ { "action": "import", ... } ],
--   "visitedTabs": ["project", "contacts"],
--   "savedAt": "2025-10-25T12:34:56Z"
-- }
```

### What Exists:

```sql
-- Only has original AI extraction
extracted_data JSONB,  -- Never changes after AI processing

-- Only has status tracking
status TEXT,           -- 'under_review' etc
review_started_at TIMESTAMPTZ,
```

**Gap:** No field to store in-progress user decisions.

---

## Proposed Solution

### Option 1: Add review_data Field (Recommended)

**Database migration:**

```sql
-- Add field to store draft review state
ALTER TABLE mapping_sheet_scans
ADD COLUMN review_data JSONB DEFAULT NULL;

-- Index for performance
CREATE INDEX idx_mapping_sheet_scans_review_data
  ON mapping_sheet_scans((review_data IS NOT NULL));

COMMENT ON COLUMN mapping_sheet_scans.review_data IS
  'Stores user review decisions and draft state before final import. Allows "Save & Continue Later" functionality.';
```

**Frontend changes:**

1. **Auto-save draft every 30 seconds:**

```tsx
// ScanReviewContainer.tsx
useEffect(() => {
  const saveDraft = async () => {
    const draftData = {
      projectDecisions,
      contactsDecisions,
      subcontractorDecisions,
      visitedTabs: Array.from(visitedTabs),
      savedAt: new Date().toISOString()
    }

    await supabase
      .from('mapping_sheet_scans')
      .update({ review_data: draftData })
      .eq('id', scanData.id)
  }

  const interval = setInterval(saveDraft, 30000) // Every 30 seconds
  return () => clearInterval(interval)
}, [projectDecisions, contactsDecisions, subcontractorDecisions, visitedTabs, scanData.id])
```

2. **Save on "Save & Continue Later" click:**

```tsx
const handleCancel = async () => {
  // SAVE DRAFT FIRST
  const draftData = {
    projectDecisions,
    contactsDecisions,
    subcontractorDecisions,
    visitedTabs: Array.from(visitedTabs),
    savedAt: new Date().toISOString()
  }

  await supabase
    .from('mapping_sheet_scans')
    .update({
      status: 'under_review',
      review_data: draftData,
      review_started_at: review_started_at || new Date().toISOString()
    })
    .eq('id', scanData.id)

  toast.success('Progress saved!')

  // THEN navigate
  if (scanData.batch_id) {
    router.push(`/projects/batches/${scanData.batch_id}`)
  } else {
    router.push(`/projects/${projectData.id}`)
  }
}
```

3. **Load from draft on mount:**

```tsx
// Initialize from review_data if it exists, otherwise extracted_data
useEffect(() => {
  if (scanData.review_data) {
    // Load draft state
    setProjectDecisions(scanData.review_data.projectDecisions || {})
    setContactsDecisions(scanData.review_data.contactsDecisions || [])
    setSubcontractorDecisions(scanData.review_data.subcontractorDecisions || [])
    setVisitedTabs(new Set(scanData.review_data.visitedTabs || ['project']))

    toast.info('Loaded saved progress')
  } else {
    // Load from original extraction
    // (current initialization logic)
  }
}, [scanData])
```

4. **Clear draft on final import:**

```tsx
const handleConfirmImport = async () => {
  // ... existing import logic

  // Clear draft after successful import
  await supabase
    .from('mapping_sheet_scans')
    .update({
      status: 'confirmed',
      review_data: null  // ← Clear draft
    })
    .eq('id', scanData.id)
}
```

---

### Option 2: Browser localStorage (Quick Fix, Not Recommended)

**Pros:**
- No database changes
- Quick to implement

**Cons:**
- Data lost if user clears browser cache
- Data lost if user switches devices
- No backup/recovery
- Not suitable for production

**Implementation:**

```tsx
// Save to localStorage
const handleCancel = () => {
  const draftKey = `scan-review-draft-${scanData.id}`
  localStorage.setItem(draftKey, JSON.stringify({
    projectDecisions,
    contactsDecisions,
    subcontractorDecisions,
    visitedTabs: Array.from(visitedTabs),
  }))

  router.push(...)
}

// Load from localStorage
useEffect(() => {
  const draftKey = `scan-review-draft-${scanData.id}`
  const saved = localStorage.getItem(draftKey)

  if (saved) {
    const draft = JSON.parse(saved)
    setProjectDecisions(draft.projectDecisions)
    // ... etc
  }
}, [scanData.id])
```

**This is a band-aid, not a real solution.**

---

### Option 3: Separate review_drafts Table (Over-engineered)

**Database migration:**

```sql
CREATE TABLE scan_review_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID REFERENCES mapping_sheet_scans(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  draft_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_scan_review_drafts_scan_user
  ON scan_review_drafts(scan_id, user_id);
```

**Pros:**
- Supports multiple users reviewing same scan
- Audit trail of drafts

**Cons:**
- More complex
- Extra table to maintain
- Overkill for single-user review

---

## Recommended Approach

**Option 1: Add review_data JSONB field**

**Why:**
- ✅ Simple, clean solution
- ✅ Data persists in database
- ✅ Works across devices
- ✅ Easy to implement
- ✅ Minimal schema changes

**Implementation steps:**

1. **Database migration** (5 min)
   - Add `review_data JSONB` column
   - Add index for performance

2. **Update handleCancel** (10 min)
   - Save draft to database before navigating

3. **Add auto-save** (15 min)
   - Save draft every 30 seconds
   - Show "Saving..." indicator

4. **Update mount logic** (10 min)
   - Load from `review_data` if exists
   - Otherwise load from `extracted_data`

5. **Clear draft on import** (5 min)
   - Set `review_data` to null after successful import

**Total time:** ~45 minutes

---

## Testing Checklist

After implementing fix:

- [ ] Make changes to project name
- [ ] Click "Save & Continue Later"
- [ ] Reopen scan immediately
- [ ] ✅ Verify changes are preserved
- [ ] Make changes to contacts
- [ ] Refresh page
- [ ] Reopen scan
- [ ] ✅ Verify changes are preserved
- [ ] Make changes to subcontractors
- [ ] Review another scan
- [ ] Return to first scan
- [ ] ✅ Verify changes are preserved
- [ ] Complete review and import
- [ ] ✅ Verify draft is cleared
- [ ] Reopen scan
- [ ] ✅ Verify no draft data loaded (clean state)

---

## Impact Assessment

### Current State:

- ❌ **Data Loss:** 100% of user changes lost on "Save & Continue Later"
- ❌ **User Experience:** Frustrating, users must complete review in one sitting
- ❌ **Workflow:** Forces rushed decisions, no option to pause
- ❌ **Trust:** Users lose confidence in system

### After Fix:

- ✅ **Data Persistence:** 100% of user changes saved
- ✅ **User Experience:** Users can review at their own pace
- ✅ **Workflow:** Flexible, supports interrupted work
- ✅ **Trust:** System works as expected

---

## Related Issues

This bug affects:

1. **Bulk uploads** - Users reviewing multiple scans
2. **Long scans** - Complex projects requiring careful review
3. **Mobile users** - Interrupted sessions (phone calls, etc)
4. **Multi-tasking** - Users switching between tasks
5. **Team workflows** - Multiple reviewers coordinating

---

## Conclusion

**The "Save & Continue Later" button is mislabeled.**

It should be called "**Discard Changes & Exit**" because that's what it actually does.

**Root cause:** No database field to store user decisions. All changes held in React state, lost on unmount.

**Solution:** Add `review_data JSONB` field to `mapping_sheet_scans` table and implement proper save/load logic.

**Effort:** ~1 hour of development + testing
**Risk:** Low (adding new field, not modifying existing data)
**Priority:** **HIGH** - Critical UX bug, causes data loss

---

**Status:** ❌ Awaiting implementation

**Files to modify:**
1. `supabase/migrations/YYYYMMDD_add_scan_review_data.sql` (new migration)
2. `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx`
3. `src/app/(app)/projects/[projectId]/scan-review/[scanId]/page.tsx`

**Next step:** Implement Option 1 (recommended solution).

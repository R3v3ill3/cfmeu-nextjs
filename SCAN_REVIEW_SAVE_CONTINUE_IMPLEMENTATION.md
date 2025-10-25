# Scan Review "Save & Continue Later" - Implementation Complete

**Issue:** User changes were lost when clicking "Save & Continue Later" during scan review

**Solution:** Added draft state persistence to database with auto-save functionality

**Status:** ✅ **IMPLEMENTED** - Ready for testing

---

## Changes Implemented

### 1. Database Migration ✅

**File:** `supabase/migrations/20251025000000_add_scan_review_draft_state.sql`

**Changes:**
- Added `review_data JSONB` column to `mapping_sheet_scans` table
- Added index for performance: `idx_mapping_sheet_scans_review_data`
- Added column documentation

**Schema:**
```sql
ALTER TABLE mapping_sheet_scans
ADD COLUMN IF NOT EXISTS review_data JSONB DEFAULT NULL;
```

**review_data structure:**
```json
{
  "projectDecisions": { "name": "...", "value": "..." },
  "contactsDecisions": [ { "action": "update", ... } ],
  "subcontractorDecisions": [ { "action": "import", ... } ],
  "visitedTabs": ["project", "contacts"],
  "savedAt": "2025-10-25T12:34:56.789Z"
}
```

---

### 2. Load Draft on Mount ✅

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:85-113`

**Added:**
- New state: `draftLoaded` to track if draft has been loaded
- `useEffect` hook that runs on mount
- Checks if `scanData.review_data` exists
- If yes: Restores `projectDecisions`, `contactsDecisions`, `subcontractorDecisions`, `visitedTabs`
- Shows toast notification: "Loaded saved progress"

**Code:**
```tsx
useEffect(() => {
  if (draftLoaded) return

  const reviewData = scanData.review_data as any
  if (reviewData) {
    console.log('[scan-review] Loading saved draft from review_data')

    // Restore all decisions
    if (reviewData.projectDecisions) {
      setProjectDecisions(reviewData.projectDecisions)
    }
    // ... etc

    toast.info('Loaded saved progress')
  }

  setDraftLoaded(true)
}, [scanData.review_data, draftLoaded])
```

---

### 3. Auto-Save Every 30 Seconds ✅

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:129-166`

**Added:**
- New state: `isSavingDraft` to track save status
- `useEffect` hook with 30-second interval
- Saves current state to `review_data` field
- Console logging for debugging
- Error handling (non-blocking)

**Code:**
```tsx
useEffect(() => {
  if (!draftLoaded) return

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

  const interval = setInterval(saveDraft, 30000)
  return () => clearInterval(interval)
}, [draftLoaded, projectDecisions, contactsDecisions, subcontractorDecisions, visitedTabs, scanData.id])
```

**Auto-save triggers:**
- Every 30 seconds while review is open
- Only after initial draft load completes
- Runs in background (non-blocking)

---

### 4. Save on "Save & Continue Later" Click ✅

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:205-258`

**Changed:**
- `handleCancel` now `async`
- Saves draft BEFORE navigating away
- Updates `status` to `under_review`
- Shows success toast: "Progress saved!"
- Shows error toast if save fails

**Code:**
```tsx
const handleCancel = async () => {
  // Save draft before navigating
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
      review_started_at: scanData.review_started_at || new Date().toISOString()
    })
    .eq('id', scanData.id)

  toast.success('Progress saved!')

  // Then navigate
  router.push(...)
}
```

---

### 5. Clear Draft After Import ✅

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:390-400`

**Added:**
- Clears `review_data` after successful import
- Prevents loading stale draft if scan reopened
- Non-blocking (won't prevent navigation if fails)

**Code:**
```tsx
// After successful import
toast.success('Import completed successfully!')

// Clear draft
await supabase
  .from('mapping_sheet_scans')
  .update({ review_data: null })
  .eq('id', scanData.id)

// Then navigate away
```

---

### 6. UI Indicators ✅

**File:** `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx:577-592`

**Added:**
- "Saving..." indicator when draft is being saved
- Button shows "Saving..." during save operation
- Button disabled while saving (prevents double-click)
- Loading spinner animation

**UI changes:**
```tsx
{isSavingDraft && (
  <div className="flex items-center gap-2 text-sm text-gray-600">
    <Loader2 className="h-3 w-3 animate-spin" />
    <span>Saving...</span>
  </div>
)}

<Button onClick={handleCancel} disabled={isSavingDraft}>
  {isSavingDraft ? (
    <>
      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      Saving...
    </>
  ) : (
    'Save & Continue Later'
  )}
</Button>
```

---

## Data Flow

### Opening Scan (First Time):

```
User clicks "Review"
  → Fetch scan from database
  → Check if review_data exists → NO
  → Initialize from extracted_data (AI extraction)
  → User sees original AI values
```

### Opening Scan (With Draft):

```
User clicks "Review"
  → Fetch scan from database
  → Check if review_data exists → YES
  → Load from review_data (saved draft)
  → Toast: "Loaded saved progress"
  → User sees their previous changes ✅
```

### Making Changes:

```
User edits project name
  → State updated in memory
  → Auto-save runs after 30 seconds
  → Draft saved to database (background)
  → Console: "[scan-review] Auto-saved draft"
```

### Clicking "Save & Continue Later":

```
User clicks button
  → Button shows "Saving..."
  → Draft saved to database
  → Toast: "Progress saved!"
  → Navigate to batch/project page
  → All changes preserved ✅
```

### Reopening Scan:

```
User clicks "Review" again
  → Fetch scan from database
  → review_data contains saved state
  → Load all decisions from draft
  → Toast: "Loaded saved progress"
  → User continues where they left off ✅
```

### Completing Review:

```
User clicks "Confirm & Import"
  → Import data to project
  → Toast: "Import completed successfully!"
  → Clear review_data (set to null)
  → Navigate to project
  → Draft cleared (clean state) ✅
```

---

## Testing Checklist

### Test 1: Save and Reopen Immediately

- [ ] Open scan review page
- [ ] Change project name to "Test Project ABC"
- [ ] Click "Save & Continue Later"
- [ ] Verify toast: "Progress saved!"
- [ ] Immediately click "Review" on same scan
- [ ] **Expected:** See "Loaded saved progress" toast
- [ ] **Expected:** Project name still "Test Project ABC" ✅

### Test 2: Auto-Save Functionality

- [ ] Open scan review page
- [ ] Change contact email to "test@example.com"
- [ ] Wait 35 seconds (don't click any buttons)
- [ ] Check browser console for: "[scan-review] Auto-saved draft"
- [ ] Navigate away manually (browser back)
- [ ] Reopen scan
- [ ] **Expected:** Contact email still "test@example.com" ✅

### Test 3: Save and Refresh Page

- [ ] Open scan review page
- [ ] Make changes to subcontractors (match a company)
- [ ] Click "Save & Continue Later"
- [ ] Refresh browser page (F5)
- [ ] Navigate back to scan review
- [ ] **Expected:** Subcontractor matching preserved ✅

### Test 4: Multiple Scans in Batch

- [ ] Open Scan 1, make changes
- [ ] Click "Save & Continue Later"
- [ ] Review Scan 2, make different changes
- [ ] Click "Save & Continue Later"
- [ ] Reopen Scan 1
- [ ] **Expected:** Scan 1 changes preserved
- [ ] Reopen Scan 2
- [ ] **Expected:** Scan 2 changes preserved (not mixed) ✅

### Test 5: Visited Tabs Tracking

- [ ] Open scan review page
- [ ] Visit "Project Details" tab ✓
- [ ] Visit "Site Contacts" tab ✓
- [ ] Don't visit "Subcontractors" tab
- [ ] Click "Save & Continue Later"
- [ ] Reopen scan
- [ ] **Expected:** Project and Contacts tabs show checkmark
- [ ] **Expected:** Subcontractors tab not marked as visited ✅

### Test 6: Complete Import Clears Draft

- [ ] Open scan review with saved draft
- [ ] Complete all tabs
- [ ] Click "Confirm & Import"
- [ ] Wait for success message
- [ ] Go back to batch page
- [ ] Try to reopen same scan
- [ ] **Expected:** Scan status is "confirmed" (not "under_review")
- [ ] **If reopenable:** No "Loaded saved progress" toast (draft cleared) ✅

### Test 7: UI Indicators

- [ ] Open scan review page
- [ ] Make a change
- [ ] Click "Save & Continue Later"
- [ ] **Expected:** Button shows "Saving..." with spinner
- [ ] **Expected:** Button disabled while saving
- [ ] **Expected:** Success toast after save completes ✅

### Test 8: Error Handling

- [ ] Open browser DevTools → Network tab
- [ ] Set network to "Offline"
- [ ] Make changes in scan review
- [ ] Click "Save & Continue Later"
- [ ] **Expected:** Error toast shown
- [ ] **Expected:** Page doesn't navigate (stays on review)
- [ ] Set network back to "Online"
- [ ] Click "Save & Continue Later" again
- [ ] **Expected:** Saves successfully ✅

---

## Database Verification

### Check Draft Data in Database:

```sql
-- View scans with saved drafts
SELECT
  id,
  status,
  file_name,
  review_data->>'savedAt' as last_saved,
  jsonb_array_length(COALESCE(review_data->'visitedTabs', '[]'::jsonb)) as tabs_visited
FROM mapping_sheet_scans
WHERE review_data IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

**Expected:** See rows with `review_data` populated

### Check Draft Structure:

```sql
-- View draft structure for specific scan
SELECT
  id,
  file_name,
  jsonb_pretty(review_data) as draft_state
FROM mapping_sheet_scans
WHERE id = 'YOUR_SCAN_ID';
```

**Expected:** See properly formatted JSON with decisions

### Verify Draft Cleared After Import:

```sql
-- Check completed scans have no draft data
SELECT
  id,
  status,
  review_data
FROM mapping_sheet_scans
WHERE status = 'confirmed'
  AND review_data IS NOT NULL;
```

**Expected:** Empty result (no confirmed scans should have draft data)

---

## Console Logging

**Look for these log messages:**

### On Mount (With Draft):
```
[scan-review] Loading saved draft from review_data
```

### Auto-Save (Every 30s):
```
[scan-review] Auto-saved draft
```

### On "Save & Continue Later":
```
[scan-review] Saving draft before navigation
[scan-review] Draft saved successfully
```

### On Import:
```
[scan-review] Clearing draft data after successful import
```

### On Errors:
```
[scan-review] Auto-save failed: [error details]
[scan-review] Failed to save draft: [error details]
```

---

## Migration Deployment

### Deploy to Supabase:

```bash
# If using Supabase CLI
supabase db push

# Or apply migration manually
psql $DATABASE_URL < supabase/migrations/20251025000000_add_scan_review_draft_state.sql
```

### Verify Migration:

```sql
-- Check column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'mapping_sheet_scans'
  AND column_name = 'review_data';

-- Expected output:
-- column_name | data_type | is_nullable
-- review_data | jsonb     | YES
```

### Rollback (If Needed):

```sql
-- Remove column if there are issues
ALTER TABLE mapping_sheet_scans
DROP COLUMN IF EXISTS review_data;

DROP INDEX IF EXISTS idx_mapping_sheet_scans_review_data;
```

---

## Performance Considerations

### Auto-Save Interval:

**Current:** 30 seconds

**Alternatives:**
- **15 seconds** - More frequent saves, higher database load
- **60 seconds** - Less database load, higher risk of data loss
- **Debounced** - Save only after user stops typing (complex implementation)

**Recommendation:** Keep 30 seconds. Good balance between safety and performance.

### Database Impact:

**Per auto-save:**
- 1 UPDATE query to `mapping_sheet_scans`
- ~1-5 KB of JSON data (typical)
- Indexed field for fast lookups

**With 10 concurrent reviewers:**
- 10 UPDATEs per 30 seconds
- 20 queries/minute
- Negligible load on Supabase

---

## Known Limitations

### 1. Single User Per Scan

**Limitation:** If two users review the same scan simultaneously, last save wins.

**Mitigation:** RLS policies already prevent this (users can only see their own uploads).

**Future:** Add `reviewed_by` lock to prevent concurrent edits.

### 2. No Conflict Resolution

**Limitation:** No merge strategy if multiple drafts exist.

**Current behavior:** Latest save overwrites previous.

**Future:** Add timestamp comparison and conflict detection.

### 3. No Draft History

**Limitation:** Only stores latest draft, no version history.

**Current behavior:** Each save overwrites previous draft.

**Future:** Add `scan_review_history` table for audit trail.

---

## Troubleshooting

### Issue: "Loaded saved progress" doesn't appear

**Check:**
1. Browser console for `[scan-review] Loading saved draft` message
2. Database: `SELECT review_data FROM mapping_sheet_scans WHERE id = 'scanId'`
3. Verify `review_data` is not null

**Solution:**
- If null: Draft not saved (check auto-save logs)
- If populated but not loading: Check state initialization logic

### Issue: Changes still lost after clicking "Save & Continue Later"

**Check:**
1. Browser console for `[scan-review] Draft saved successfully`
2. Network tab for 200 response from Supabase
3. Database: Verify `review_data` updated

**Solution:**
- If save failed: Check RLS policies
- If saved but not loading: Check load logic on mount

### Issue: Auto-save not working

**Check:**
1. Browser console for `[scan-review] Auto-saved draft` (every 30s)
2. Verify `draftLoaded` is true
3. Check interval is running

**Solution:**
- If interval not running: Check useEffect dependencies
- If running but not saving: Check Supabase permissions

---

## Success Metrics

After deployment, verify:

- ✅ No more reports of "lost changes" on Save & Continue Later
- ✅ Users can review scans across multiple sessions
- ✅ Draft state persists across page refreshes
- ✅ Auto-save runs every 30 seconds
- ✅ Completed scans don't show "Loaded saved progress"
- ✅ No performance degradation
- ✅ Database storage increase < 1MB for 100 scans

---

## Files Modified

```
✓ supabase/migrations/20251025000000_add_scan_review_draft_state.sql
✓ src/components/projects/mapping/scan-review/ScanReviewContainer.tsx
✓ SCAN_REVIEW_SAVE_CONTINUE_IMPLEMENTATION.md (this file)
```

---

## Deployment Steps

### 1. Apply Database Migration

```bash
# Deploy migration to Supabase
cd /Volumes/DataDrive/cursor_repos/cfmeu-nextjs
supabase db push
```

### 2. Deploy Frontend Changes

```bash
# Commit all changes
git add .
git commit -m "Fix Save & Continue Later: add draft state persistence

- Add review_data JSONB field to mapping_sheet_scans
- Implement auto-save every 30 seconds
- Save draft on 'Save & Continue Later' click
- Load draft on scan review mount
- Clear draft after successful import
- Add UI indicators for save status"

# Push to trigger Vercel deployment
git push
```

### 3. Verify Deployment

**After Vercel deploys (~2 min):**

1. Open production app
2. Start a scan review
3. Make changes
4. Wait 35 seconds
5. Check console for auto-save log
6. Click "Save & Continue Later"
7. Verify "Progress saved!" toast
8. Reopen scan
9. Verify "Loaded saved progress" toast
10. Verify changes are preserved ✅

---

## Next Steps (Optional Enhancements)

### 1. Add Draft Age Indicator

Show how old the draft is:
```tsx
{reviewData?.savedAt && (
  <Badge variant="outline">
    Draft from {formatDistanceToNow(new Date(reviewData.savedAt))} ago
  </Badge>
)}
```

### 2. Add "Discard Draft" Button

Allow users to start fresh:
```tsx
<Button onClick={discardDraft}>
  Discard Saved Changes
</Button>
```

### 3. Add Offline Support

Cache drafts in localStorage as backup:
```tsx
// Save to both database and localStorage
localStorage.setItem(`scan-draft-${scanId}`, JSON.stringify(draftData))
```

### 4. Add Draft Conflict Detection

Warn if draft is older than extraction:
```tsx
if (reviewData?.savedAt < scanData.extraction_completed_at) {
  toast.warning('Saved draft is older than AI extraction')
}
```

---

**Status:** ✅ **READY FOR TESTING**

**Implementation Time:** ~1 hour

**Risk Level:** Low (new field, doesn't modify existing data)

**Breaking Changes:** None

**Rollback:** Simple (drop column if needed)

---

**Next:** Test in production and monitor for issues!

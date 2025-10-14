# Manual Testing Checklist - Alias Initiative
## UI Testing Guide

**Test Duration:** ~15-20 minutes  
**Prerequisites:** Admin page loading (✅ confirmed)

---

## Setup: Create Test Data

### Option A: Quick Setup (SQL)
1. Open Supabase Dashboard → SQL Editor
2. Copy and run the SQL from `tests/MANUAL_TESTING_SCRIPT.sql`
3. This creates 3 test employers with 4 aliases

### Option B: Use Your Existing Data
Skip SQL setup and test with your real employers and aliases (if any exist)

---

## Test 1: Alias Analytics Dashboard (5 min)

### Access
- [x] Admin page loaded
- [ ] Click "Alias Analytics" tab/collapsible
- [ ] Dashboard displays without errors

### Overview Cards
After running test SQL, verify numbers update:
- [ ] **Total Aliases** shows: ~4 (or your actual count)
- [ ] **Authoritative** shows under Total Aliases
- [ ] **Pending Reviews** shows: ~3 (test employers)
- [ ] **Employer Coverage** shows percentage
- [ ] Cards display without errors

### Source Systems Table
- [ ] Table shows rows for: bci, incolink, manual (or your sources)
- [ ] Each row has: total count, authoritative count, employers, avg/employer
- [ ] Numbers look reasonable
- [ ] "Last 7 Days" column shows recent activity (if you just added data)

### Export Functionality
- [ ] Click "Export CSV" button on Source Systems table
- [ ] CSV file downloads (check Downloads folder)
- [ ] Open CSV in Excel/Google Sheets
- [ ] Data looks correct with proper headers

### Conflict Backlog Table
- [ ] If test SQL created conflicts, table shows them
- [ ] Or shows nothing if no conflicts (also correct)
- [ ] If visible, shows: proposed name, current name, priority, conflicts count
- [ ] "Review Queue" link works

### Alerts
- [ ] If pending reviews > 25: High backlog alert shows
- [ ] If employers have BCI/Incolink ID but no aliases: Missing coverage alert shows
- [ ] Otherwise no alerts (correct)

**✅ Pass Criteria:** Dashboard loads, shows data, no console errors, export works

---

## Test 2: Canonical Promotion Console (10 min)

### Access
- [ ] Click "Canonical Names" tab/collapsible
- [ ] Console displays without errors
- [ ] Info alert "About Canonical Promotions" visible

### Queue Display
After test SQL:
- [ ] Shows 3 queue items (one for each authoritative alias)
- [ ] Each card shows:
  - [ ] Proposed name (e.g., "ABC Constructions Limited")
  - [ ] Current canonical name (e.g., "ABC Construction Pty Ltd")
  - [ ] Source badge (BCI, Incolink)
  - [ ] Authoritative badge (green)
  - [ ] Priority badge (High Priority)
- [ ] Cards sorted by priority (High first)

### Card Details
Pick one card and verify:
- [ ] Source System shown (e.g., "bci")
- [ ] Collected date shown
- [ ] External ID shown if present (e.g., "BCI12345")
- [ ] Total aliases count shown
- [ ] Notes shown if present
- [ ] "View employer" link works (opens employer page)

### Conflict Detection
If test SQL created similar employer:
- [ ] Red conflict alert box appears
- [ ] Lists similar employer names
- [ ] Shows similarity percentage if available
- [ ] "View" links work for conflicting employers

### Test Action Buttons
**Defer Action:**
- [ ] Click "Defer" button
- [ ] Dialog opens with title "Defer Decision"
- [ ] Shows proposed vs current name
- [ ] Rationale field required
- [ ] Type: "Need to verify with team"
- [ ] Click "Confirm"
- [ ] Toast notification: "Decision deferred for later review"
- [ ] Item removed from queue OR shows "Previously Deferred" alert
- [ ] Page refreshes queue

**Check Audit Trail:**
Run in Supabase SQL Editor:
```sql
SELECT * FROM employer_canonical_audit 
ORDER BY decided_at DESC LIMIT 1;

-- Should show your defer action with rationale
```

**Promote Action (if you have another queue item):**
- [ ] Click "Promote to Canonical" button
- [ ] Dialog opens
- [ ] Shows "You are about to change... from X to Y"
- [ ] Rationale is optional
- [ ] Type optional note: "BCI authoritative source"
- [ ] Click "Confirm"
- [ ] Toast: "Promoted... to canonical name"
- [ ] Item removed from queue
- [ ] Employer's canonical name updated

**Verify Promotion Worked:**
```sql
-- Check employer name was updated
SELECT id, name FROM employers 
WHERE id = '11111111-1111-1111-1111-111111111111';
-- Should show new canonical name

-- Check audit record
SELECT * FROM employer_canonical_audit 
WHERE action = 'promote' 
ORDER BY decided_at DESC LIMIT 1;
-- Should show promotion with your user ID
```

**Reject Action (if you have another item):**
- [ ] Click "Reject" button
- [ ] Dialog opens
- [ ] Rationale field required (won't let you continue without it)
- [ ] Type: "Prefer current canonical name"
- [ ] Click "Confirm"
- [ ] Toast: "Promotion rejected"
- [ ] Item removed from queue
- [ ] Audit record created

**✅ Pass Criteria:** All actions work, audit trail created, UI updates correctly

---

## Test 3: Alias Search (5 min)

### API Testing
Open browser console and run:
```javascript
// Test basic search
fetch('/api/employers?q=ABC&page=1&pageSize=10')
  .then(r => r.json())
  .then(d => console.log('Basic search:', d.employers.length, 'results'))

// Test alias-aware search
fetch('/api/employers?q=ABC&includeAliases=true&page=1&pageSize=10')
  .then(r => r.json())
  .then(d => {
    console.log('Alias search:', d.employers.length, 'results')
    console.log('Alias search used:', d.debug?.aliasSearchUsed)
    console.log('First result:', d.employers[0])
  })

// Test search by alias (not canonical name)
fetch('/api/employers?q=Constructions&includeAliases=true&page=1&pageSize=10')
  .then(r => r.json())
  .then(d => {
    console.log('Alias match results:', d.employers.length)
    d.employers.forEach(emp => {
      console.log(`- ${emp.name}`, emp.match_type, emp.aliases?.length, 'aliases')
    })
  })
```

**Expected Results:**
- [ ] Basic search returns employers matching canonical name
- [ ] Alias search (`includeAliases=true`) returns MORE results
- [ ] `debug.aliasSearchUsed` is `true` when aliases enabled
- [ ] Results include `aliases` array with alias data
- [ ] Results include `match_type` (canonical_name, alias, external_id, abn)
- [ ] Results include `search_score` (0-100)

### Database Testing
In Supabase SQL Editor:
```sql
-- Test search by canonical name
SELECT id, name, match_type, search_score
FROM search_employers_with_aliases('ABC Construction', 10, 0, true, 'any');

-- Test search by alias
SELECT id, name, match_type, search_score, aliases
FROM search_employers_with_aliases('Constructions Limited', 10, 0, true, 'any');

-- Test search by external ID
SELECT id, name, match_type, match_details
FROM search_employers_with_aliases('BCI12345', 10, 0, true, 'any');

-- Test authoritative only
SELECT id, name, aliases
FROM search_employers_with_aliases('ABC', 10, 0, true, 'authoritative');
```

**Expected:**
- [ ] Searches return results
- [ ] Match type correctly identifies what matched
- [ ] Scores rank exact matches higher (100) than partial (70-80)
- [ ] Aliases array included in results
- [ ] Authoritative filter works

**✅ Pass Criteria:** Search finds employers by aliases, external IDs, returns proper metadata

---

## Test 4: Analytics Refresh (2 min)

### After Creating Promotions/Deferrals
- [ ] Go back to "Alias Analytics" tab
- [ ] Click "Refresh" button
- [ ] Metrics update:
  - [ ] **Promotions (7d)** increases if you promoted
  - [ ] **Pending Reviews** decreases if you processed items
  - [ ] Coverage percentage may change
  - [ ] Source systems table shows activity

### Verify Metrics Match Database
Run in SQL Editor:
```sql
SELECT * FROM alias_metrics_summary;
-- Compare numbers to dashboard cards
```

**✅ Pass Criteria:** Dashboard reflects your test actions, numbers match database

---

## Test 5: Full Workflow (Optional - 5 min)

### End-to-End Scenario
1. **Create** a new employer manually (via UI if you have that feature)
2. **Check** if an alias was created automatically
3. **Search** for that employer using different names
4. **Promote** an alias to canonical via console
5. **Verify** analytics dashboard updated

**SQL to check workflow:**
```sql
-- See all recent aliases
SELECT * FROM employer_aliases 
ORDER BY created_at DESC 
LIMIT 10;

-- See all recent promotions
SELECT * FROM employer_canonical_audit 
ORDER BY decided_at DESC 
LIMIT 10;

-- Check current queue
SELECT COUNT(*) FROM canonical_promotion_queue;
```

---

## Quick Verification Checklist

### Minimum Tests (5 min)
- [x] Admin page loads ✅ (you confirmed)
- [x] Alias Analytics tab visible ✅ (you confirmed)
- [x] Canonical Names tab visible ✅ (you confirmed)
- [ ] Run test SQL to create data
- [ ] Refresh both tabs - see numbers update
- [ ] Click through one promotion/defer action
- [ ] Verify audit record created

### Comprehensive Tests (20 min)
- [ ] All items from Test 1 (Analytics Dashboard)
- [ ] All items from Test 2 (Canonical Console)
- [ ] All items from Test 3 (Alias Search)
- [ ] All items from Test 4 (Metrics Refresh)
- [ ] All items from Test 5 (Full Workflow)

### Critical Path Only (10 min)
- [ ] Create test data (SQL)
- [ ] Verify analytics shows non-zero counts
- [ ] Verify canonical queue shows items
- [ ] Promote one alias
- [ ] Verify employer name changed
- [ ] Verify audit record exists

---

## What to Look For

### ✅ Success Indicators
- No console errors in browser
- No React errors on page
- Cards/tables display data
- Buttons respond to clicks
- Dialogs open/close properly
- Toast notifications appear
- Database updates persist
- Metrics reflect reality

### ❌ Failure Indicators
- Console errors (red text in DevTools)
- "Failed to load" messages
- Infinite loading spinners
- Buttons don't respond
- Dialogs don't open
- Database queries fail
- Metrics stay at 0 despite data

---

## Expected Results Summary

**With Test Data:**
```
Alias Analytics:
- Total Aliases: 4
- Pending Reviews: 3
- Employer Coverage: ~75% (3 of 4 employers)
- Source Systems: bci (3), incolink (1), manual (1)

Canonical Names Queue:
- 3 items showing
- Priorities: High (2), Medium (1)
- Sources: BCI, Incolink
- All show "Authoritative" badge

After 1 Promotion:
- Queue: 2 items (1 removed)
- Promotions (7d): 1
- Audit table: 1 record
- Employer name: Updated
```

---

## Troubleshooting

### "Queue is empty" but I added authoritative aliases
**Check:**
```sql
-- Are aliases different from canonical names?
SELECT e.name, ea.alias, e.name = ea.alias as is_same
FROM employers e
JOIN employer_aliases ea ON ea.employer_id = e.id
WHERE ea.is_authoritative = true;

-- Queue only shows aliases that DIFFER from current canonical name
```

### "Metrics still show 0"
**Fix:** Click "Refresh" button, or run:
```sql
SELECT * FROM alias_metrics_summary;
-- If this shows data, refresh the UI
```

### "Export doesn't work"
**Check:** Browser console for errors, verify you're admin user

---

## Recommended Testing Order

1. **Run test SQL** (2 min) - Creates realistic data
2. **Refresh Analytics tab** (30 sec) - See numbers populate
3. **Open Canonical Names tab** (30 sec) - See queue items
4. **Test one Defer action** (2 min) - Verifies workflow
5. **Test one Promote action** (2 min) - Verifies promotion
6. **Check audit trail** (1 min) - Verify database updates
7. **Test alias search** (2 min) - Browser console or SQL
8. **Verify analytics updated** (1 min) - Numbers reflect actions

**Total: ~10 minutes for comprehensive validation**

---

## Success Criteria

✅ **Phase 1 Complete When:**
- Test data created (SQL runs without errors)
- Analytics shows non-zero metrics
- Canonical queue shows items
- All UI elements visible

✅ **Phase 2 Complete When:**
- One defer action successful
- One promote action successful
- Audit records created
- Employer name updated

✅ **Phase 3 Complete When:**
- Alias search returns results
- Analytics reflects your actions
- No console errors
- All workflows functional

---

## After Testing

**If Everything Works:**
1. Keep test data or clean up (SQL at end of test script)
2. Document any issues found
3. Mark implementation as validated ✅
4. Ready for production deployment

**If Issues Found:**
1. Note specific error messages
2. Check browser console (F12)
3. Check Supabase logs
4. Report back with details

---

## Quick Command Reference

**Create Test Data:**
```sql
-- Copy from tests/MANUAL_TESTING_SCRIPT.sql
-- Sections: STEP 1-4
```

**Verify Data:**
```sql
SELECT * FROM canonical_promotion_queue;
SELECT * FROM alias_metrics_summary;
```

**Check After Actions:**
```sql
SELECT * FROM employer_canonical_audit ORDER BY decided_at DESC;
```

**Clean Up:**
```sql
-- Uncomment cleanup section in MANUAL_TESTING_SCRIPT.sql
```

---

**Ready to test!** Start with running the test SQL, then click through the UI. Should take ~10-15 minutes to validate everything works. 🚀


# New Project from Scan - Critical Fixes & QA Plan

## ✅ CRITICAL FIXES COMPLETED

### 1. Worker Processor Status Bug (FIXED)
**File:** `railway_workers/mapping-sheet-scanner-worker/src/processors/mappingSheetProcessor.ts`

**Problem:** Worker was hardcoding status to `'completed'` for all scans, which prevented the ProjectQuickFinder dialog from appearing for new-project scans.

**Solution:**
- Added logic to fetch `upload_mode` from scan record
- Set status to `'review_new_project'` for new-project scans
- Set status to `'completed'` for existing-project scans

**Changes:**
- Lines 62-81: Fetch scan record and determine final status based on `upload_mode`
- Added console logging for debugging

### 2. Upload Mode Tracking (FIXED)
**File:** `src/components/projects/mapping/UploadMappingSheetDialog.tsx`

**Problem:** Scan records were not being tagged with `upload_mode`, making it impossible to differentiate new-project vs existing-project scans.

**Solution:**
- Added `upload_mode: mode` to the scan record insert (line 241)
- Mode is passed from props ('existing_project' or 'new_project')

### 3. Geocoding Support (IMPLEMENTED)
**Files Modified:**
- `supabase/migrations/20251010000000_add_geocoding_to_scan_project.sql` (NEW)
- `src/components/projects/mapping/scan-review/ProjectFieldsReview.tsx`
- `src/app/api/projects/new-from-scan/route.ts`

**Problem:** No geocoding support for addresses from scanned data, which prevents proper patch assignment.

**Solution:**
- **RPC Update:** Modified `create_project_from_scan` to accept `latitude`/`longitude` in `p_project_data`
- **UI Enhancement:** Added `GoogleAddressInput` component for address field when user selects "Enter custom value"
- **Data Flow:** Captures lat/lng in decisions as `address_latitude` and `address_longitude`
- **API Integration:** Passes lat/lng from projectDecisions to RPC

**How it works:**
1. User selects "Enter custom value" for address
2. GoogleAddressInput geocodes the address and returns lat/lng
3. `handleAddressChange` stores both formatted address and coordinates
4. API route passes to RPC: `latitude: projectDecisions?.address_latitude`
5. RPC stores in job_sites table for patch matching

---

## 📋 HIGH PRIORITY - QA CHECKLIST

### End-to-End Flow Testing
**Status:** ⚠️ REQUIRES MANUAL TESTING

**Test Steps:**
1. ✅ Navigate to Projects → "New Project" button
2. ✅ Select "Create from Scanned Data"
3. ⚠️ Upload test PDF (2-3 pages, Sydney address)
4. ⚠️ Verify processing status updates correctly
5. ⚠️ **CRITICAL:** Verify scan status becomes `'review_new_project'` (NOT `'completed'`)
6. ⚠️ Verify ProjectQuickFinder dialog appears after processing
7. ⚠️ Test "Create new project from scan" → redirects to `/projects/new-scan-review/[scanId]`
8. ⚠️ Navigate all tabs (Project, Contacts, Subcontractors)
9. ⚠️ Test address geocoding:
   - Select "Enter custom value" for address
   - Type Sydney address (e.g., "1 George St, Sydney NSW 2000")
   - Verify Google autocomplete works
   - Select address from dropdown
10. ⚠️ Click "Confirm Import"
11. ⚠️ Verify redirects to new project page (with real project ID, not "TEMP")
12. ⚠️ **VERIFY IN DATABASE:**
    - Check `mapping_sheet_scans` table: `status = 'under_review'`, `upload_mode = 'new_project'`
    - Check `job_sites` table: `latitude` and `longitude` populated (if geocoded)
    - Check `projects` table: new project exists
    - Check `project_assignments` table: builder assigned with correct role

### Navigation Flow Testing
**Status:** ⚠️ REQUIRES MANUAL TESTING

**Test Scenarios:**
1. Cancel during upload → Returns to Projects page
2. Cancel after upload (during processing) → Processing continues, can check back
3. Cancel from QuickFinder → Returns to Projects page
4. Select existing project from QuickFinder → Redirects to `/projects/[existingId]/scan-review/[scanId]`
5. Create new from QuickFinder → Redirects to `/projects/new-scan-review/[scanId]`
6. Cancel from review page → Returns to Projects page
7. Successful import → Redirects to new project detail page

### Employer Creation & Duplicates
**Status:** ⚠️ REQUIRES VERIFICATION

**Test Cases:**
1. **Matched Builder:**
   - Create project with existing builder match
   - Verify `project_assignments` has ONE entry with:
     - `assignment_type = 'contractor_role'`
     - `contractor_role_type_id` = (builder role)
     - `source = 'scanned_mapping_sheet'`
   - Verify `projects.builder_id` is set
   - **CHECK:** No duplicate employers created

2. **New Builder:**
   - Create project with "Create new employer" option
   - Verify new employer inserted in `employers` table
   - Verify employer assigned to project
   - **CHECK:** Only ONE new employer created (no duplicates)

3. **Subcontractors:**
   - Import scan with 3 subcontractors
   - Verify all 3 appear in `project_assignments` with `assignment_type = 'trade_work'`
   - **CHECK:** No duplicate assignments

### Geocoding Verification
**Status:** ⚠️ REQUIRES TESTING

**Sydney Test Addresses:**
```
1. "1 George Street, Sydney NSW 2000"
2. "Sydney Opera House, Sydney NSW 2000"
3. "Central Station, Sydney NSW 2000"
4. "Circular Quay, Sydney NSW 2000"
```

**What to Verify:**
1. GoogleAddressInput autocomplete works for Sydney addresses
2. Selecting address populates lat/lng in decisions
3. RPC receives lat/lng parameters
4. Job site created with coordinates:
   ```sql
   SELECT id, name, latitude, longitude, full_address
   FROM job_sites
   WHERE project_id = '[new-project-id]';
   ```
5. Coordinates are valid Sydney coordinates:
   - Latitude: ~-33.8 to -33.9
   - Longitude: ~151.1 to 151.3

---

## 🔒 RLS PERMISSIONS VERIFICATION

### Current Policies (VERIFIED)
**File:** `supabase/migrations/20251007000000_new_project_scan_support.sql`

**Read Access:** Lines 63-71
```sql
CREATE POLICY "Users can view scans for accessible projects"
  ON mapping_sheet_scans FOR SELECT
  USING (
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = mapping_sheet_scans.project_id
    ))
    OR auth.uid() = uploaded_by
  );
```

**Test Cases:**
1. ✅ User can view own new-project scans (even before project created)
2. ⚠️ User CANNOT view other users' new-project scans
3. ⚠️ After project created, user can view if they have access to project

### RPC Permissions (VERIFIED)
- `create_project_from_scan`: Granted to `authenticated` ✅
- `assign_contractor_role`: Granted to `authenticated` ✅
- Both use `SECURITY DEFINER` with auth checks ✅

**Test:**
```sql
-- Check grants
\df+ create_project_from_scan
\df+ assign_contractor_role

-- Should show: GRANT EXECUTE TO authenticated
```

---

## 📊 DATABASE MIGRATION CHECKLIST

### Before Deploying to Production

1. **Run Migration:**
   ```bash
   # In supabase/migrations/
   # Ensure 20251010000000_add_geocoding_to_scan_project.sql is applied
   ```

2. **Verify Function:**
   ```sql
   -- Check function exists
   SELECT proname, proargtypes
   FROM pg_proc
   WHERE proname = 'create_project_from_scan';

   -- Check it accepts 6 parameters (uuid, uuid, jsonb, jsonb, jsonb, jsonb)
   ```

3. **Test RPC Call:**
   ```javascript
   // From Supabase dashboard SQL editor or API
   SELECT create_project_from_scan(
     auth.uid(),
     '[test-scan-id]',
     '{
       "name": "Test Project",
       "address": "1 George St, Sydney NSW 2000",
       "latitude": -33.8688,
       "longitude": 151.2093
     }'::jsonb,
     '[]'::jsonb,
     '[]'::jsonb,
     '[]'::jsonb
   );
   ```

4. **Verify Indexes Exist:**
   ```sql
   \di idx_mapping_sheet_scans_created_project_id
   \di idx_mapping_sheet_scans_upload_mode
   ```

5. **Check RLS Policies:**
   ```sql
   SELECT tablename, policyname, roles, cmd, qual
   FROM pg_policies
   WHERE tablename = 'mapping_sheet_scans';
   ```

---

## 🧪 MEDIUM PRIORITY - Unit Tests

### Test Files to Create

1. **`supabase/tests/create_project_from_scan.test.sql`**
   ```sql
   -- Test 1: Minimal project creation
   -- Test 2: With builder (matched)
   -- Test 3: With builder (create new)
   -- Test 4: With contacts
   -- Test 5: With subcontractors
   -- Test 6: With geocoding
   -- Test 7: Error: missing scanId
   -- Test 8: Error: unauthorized user
   -- Test 9: Error: scan already linked
   -- Test 10: Transaction rollback on error
   ```

2. **`src/__tests__/new-from-scan.integration.test.ts`**
   ```typescript
   describe('New Project from Scan API', () => {
     it('creates project with minimal data')
     it('creates project with geocoded address')
     it('assigns builder role correctly')
     it('creates site contacts')
     it('creates subcontractor assignments')
     it('rejects unauthorized requests')
     it('prevents duplicate scans')
   })
   ```

---

## 📝 TESTING NOTES

### Known Issues/Limitations
1. **No address geocoding for "Use scanned value" option**
   - Only "Enter custom value" triggers GoogleAddressInput
   - Scanned addresses from AI are stored as plain text
   - **Workaround:** User must select "Enter custom value" to get geocoding

2. **Polling timeout**
   - 5 minute max (150 polls × 2s)
   - Large/complex PDFs may timeout
   - **Mitigation:** Scan continues in background, user can return later

3. **Page selection**
   - Max 3 pages per scan
   - Enforced in UI (UploadMappingSheetDialog:176-181)

### Test Data Requirements
- Sample PDF with 2-3 pages containing:
  - Project name
  - Sydney address (for geocoding)
  - Builder name
  - 2-3 site contacts (name, role, phone, email)
  - 3-5 subcontractors with trade types

---

## 🚀 DEPLOYMENT STEPS

### 1. Pre-Deployment
- [ ] Review all code changes
- [ ] Run TypeScript type-check
- [ ] Test worker processing with sample PDF
- [ ] Verify database migrations

### 2. Staging Deployment
- [ ] Deploy code to staging
- [ ] Run migration: `20251010000000_add_geocoding_to_scan_project.sql`
- [ ] Test full flow with staging data
- [ ] Verify RLS policies
- [ ] Check CloudWatch/Railway logs for worker

### 3. Production Deployment
- [ ] Backup database
- [ ] Deploy code to production
- [ ] Run migration
- [ ] Monitor first few scans
- [ ] Verify geocoding works
- [ ] Check for errors in logs

### 4. Post-Deployment
- [ ] Monitor scan success rate
- [ ] Check for failed scans
- [ ] Verify patch assignment works with geocoded addresses
- [ ] Collect user feedback

---

## 📞 SUPPORT

### Debugging Commands

**Check scan status:**
```sql
SELECT id, file_name, status, upload_mode, created_project_id
FROM mapping_sheet_scans
WHERE uploaded_by = auth.uid()
ORDER BY created_at DESC
LIMIT 10;
```

**Check worker processing:**
```sql
SELECT job_type, status, payload, last_error
FROM scraper_jobs
WHERE job_type = 'mapping_sheet_scan'
ORDER BY created_at DESC
LIMIT 10;
```

**Check project creation:**
```sql
SELECT p.id, p.name, js.latitude, js.longitude, js.full_address
FROM projects p
LEFT JOIN job_sites js ON js.id = p.main_job_site_id
WHERE p.created_at > NOW() - INTERVAL '1 day'
ORDER BY p.created_at DESC;
```

---

## ✅ SUMMARY

**CRITICAL Fixes:** ✅ COMPLETED
- Worker status handling
- Upload mode tracking
- Geocoding support

**HIGH Priority Testing:** ⚠️ PENDING
- End-to-end upload flow
- Employer creation/duplicates
- Navigation redirects
- RLS permissions

**MEDIUM Priority:** ⚠️ PENDING
- Unit tests
- Integration tests
- Performance testing

**READY FOR:** Staging deployment and QA testing

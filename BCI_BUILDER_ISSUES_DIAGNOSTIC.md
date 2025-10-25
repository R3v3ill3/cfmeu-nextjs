# BCI Builder Import Issues - Complete Diagnostic & Fix Plan

**Date:** 2025-10-25

**Status:** 🔴 Multiple Critical Issues Identified

---

## Executive Summary

BCI (Building and Construction Industry) data imports create builder assignments flagged as "BCI Match - needs review" but there are **five critical issues** preventing users from properly reviewing and confirming these builders:

1. ❌ No UI to review/confirm/change BCI-imported builders
2. ❌ BCI builders don't show in Edit Project dialog
3. ❌ "Change builder" adds employer as BOTH builder AND head contractor
4. ❌ Save changes fails with PostgreSQL function overloading error (PGRST203)
5. ❌ Bulk upload confirmation doesn't clear BCI import flags

---

## System Architecture

### Current Builder Assignment System

**Two Parallel Systems:**

1. **Legacy System:**
   - `projects.builder_id` column (single builder UUID)
   - Used for backwards compatibility
   - Shown when `project_assignments` is empty (MappingSheetPage1.tsx:238-255)

2. **New System (project_assignments table):**
   - Supports multiple contractors with different roles
   - Tracks BCI import metadata:
     - `source`: 'manual', 'bci_import', 'scanned_mapping_sheet', etc.
     - `match_status`: 'auto_matched', 'confirmed', 'needs_review'
     - `match_confidence`: 0.0 to 1.0
     - `match_notes`: Text notes about the match

**Display Logic** (MappingSheetPage1.tsx:202-237):
```tsx
{mappingData?.contractorRoles.slice(0, 2).map((contractor, index) => (
  // Shows builder, head contractor, etc. from project_assignments
  <AutoMatchIndicator
    matchStatus={contractor.matchStatus}      // e.g., 'auto_matched'
    dataSource={contractor.dataSource}        // e.g., 'bci_import'
    matchConfidence={contractor.matchConfidence}
    matchNotes={contractor.matchNotes}
  />
))}
```

---

## Issue #1: No Review UI for BCI Builders

### Current State

**What Users See:**
```
Builder: Multiplex Construction
[Badge: BCI Match - needs review]
```

**What's Missing:**
- No "Confirm" button
- No "Change" button
- No "Remove" button
- No way to clear the "needs review" flag

**Comparison to Subcontractors:**

Subcontractors have full review UI (SubcontractorsReview.tsx:747-778):
```tsx
<Button onClick={handleOpenMatchDialog}>Review</Button>
<Button onClick={handleChange}>Change</Button>
```

**Root Cause:**

Mapping sheet page only displays the builder name + badge (lines 202-237) with NO action buttons.

---

## Issue #2: BCI Builders Don't Show in Edit Dialog

### Current State

**EditProjectDialog.tsx Load Process** (lines 81-98):
```tsx
const { data: roles } = await supabase
  .from("v_unified_project_contractors")
  .select("role, employer_id")
  .eq("project_id", project.id);

const builders = roles
  .filter(r => r.role === "builder")
  .map(r => r.employer_id);

setBuilderIds(builders);
```

**Issue:**

When `matchStatus='auto_matched'` and `source='bci_import'`, the builder loads correctly into `builderIds` state BUT:

1. **SingleEmployerDialogPicker** may filter them out
2. **MultiEmployerPicker** may not display them properly
3. User can't see which builder is BCI-imported

**Expected Behavior:**

- BCI builder should show with visual indicator (badge/icon)
- User should be able to keep, change, or remove it
- Status should show "Needs Review" or similar

---

## Issue #3: Change Builder Adds to BOTH Roles

### Current State

**EditProjectDialog.tsx Save Process** (lines 243-274):

```tsx
// Delete ALL existing contractor role assignments
await supabase
  .from("project_assignments")
  .delete()
  .eq("project_id", project.id)
  .eq("assignment_type", "contractor_role");

// Add builders
for (const builderId of builderIds) {
  await supabase.rpc('assign_contractor_role', {
    p_project_id: project.id,
    p_employer_id: builderId,
    p_role_code: 'builder',
    p_company_name: 'Builder',
    p_is_primary: true
  });
}

// Add head contractor
if (headContractorId) {
  await supabase.rpc('assign_contractor_role', {
    p_project_id: project.id,
    p_employer_id: headContractorId,
    p_role_code: 'head_contractor',
    p_company_name: 'Head Contractor',
    p_is_primary: true
  });
}
```

**The Bug:**

When user selects an employer in the builder picker, it gets added to `builderIds` array. But if that same employer is ALSO set as head contractor (via separate picker), BOTH loops execute, creating TWO assignments for the same employer with different roles.

**Why It Happens:**

The UI has separate pickers:
- `<MultiEmployerPicker>` for builders (can select multiple)
- `<SingleEmployerDialogPicker>` for head contractor (single select)

If the same employer is selected in both, no validation prevents the duplicate.

**Result:**

```sql
-- Two rows created for same employer:
INSERT project_assignments (project_id, employer_id, role)
VALUES ('proj-1', 'employer-A', 'builder');

INSERT project_assignments (project_id, employer_id, role)
VALUES ('proj-1', 'employer-A', 'head_contractor');
```

This violates business logic (one employer = one role per project).

---

## Issue #4: Save Changes Fails - PGRST203 Error

### Error Message

```
PGRST203: Could not choose the best candidate function between:
  • public.assign_contractor_role(p_project_id => uuid, p_employer_id => uuid,
    p_role_code => text, p_company_name => text, p_is_primary => boolean)
  • public.assign_contractor_role(p_project_id => uuid, p_employer_id => uuid,
    p_role_code => text, p_company_name => text, p_is_primary => boolean,
    p_estimated_workers => integer, p_source => text, p_match_confidence => numeric,
    p_match_notes => text)
```

### Root Cause: Function Overloading Ambiguity

**Two Versions Exist:**

**Version 1** (0000_remote_schema.sql - OLD):
```sql
CREATE FUNCTION assign_contractor_role(
  p_project_id uuid,
  p_employer_id uuid,
  p_role_code text,
  p_company_name text,
  p_is_primary boolean DEFAULT false,
  p_estimated_workers integer DEFAULT NULL
) RETURNS TABLE(success boolean, message text)
```

**Version 2** (20251009120001_new_project_scan_rpcs.sql - NEW):
```sql
CREATE FUNCTION assign_contractor_role(
  p_project_id uuid,
  p_employer_id uuid,
  p_role_code text,
  p_company_name text,
  p_is_primary boolean DEFAULT false,
  p_source text DEFAULT 'manual',
  p_match_confidence numeric DEFAULT 1.0,
  p_match_notes text DEFAULT null
) RETURNS uuid
```

**The Call** (EditProjectDialog.tsx:254):
```tsx
await supabase.rpc('assign_contractor_role', {
  p_project_id: project.id,
  p_employer_id: builderId,
  p_role_code: 'builder',
  p_company_name: 'Builder',
  p_is_primary: true
  // ❌ Missing parameters! PostgreSQL can't determine which function to use
});
```

**Why PostgreSQL Can't Decide:**

Both functions accept the same 5 required parameters. PostgreSQL sees:
- Function 1 wants 5-6 params (6th is p_estimated_workers with default)
- Function 2 wants 5-8 params (6-8th are p_source, p_match_confidence, p_match_notes with defaults)

When you call with exactly 5 params, BOTH functions match! PostgreSQL throws PGRST203 error.

**The Fix:**

Add explicit parameter to disambiguate:
```tsx
await supabase.rpc('assign_contractor_role', {
  p_project_id: project.id,
  p_employer_id: builderId,
  p_role_code: 'builder',
  p_company_name: 'Builder',
  p_is_primary: true,
  p_source: 'manual',          // ✅ Now it's clear: use new function
  p_match_confidence: 1.0,
  p_match_notes: null
});
```

---

## Issue #5: Bulk Upload Doesn't Clear BCI Flag

### Current Flow

**When User Uploads Bulk PDF:**

1. Scan extracts: `"Builder: Multiplex"`
2. Fuzzy match finds existing employer in database
3. Check employer's assignments:
   ```sql
   SELECT * FROM project_assignments
   WHERE employer_id = 'multiplex-id'
   AND assignment_type = 'contractor_role'
   AND contractor_role_type_id = (SELECT id FROM contractor_role_types WHERE code = 'builder')
   ```
4. If found with `source='bci_import'` and `match_status='auto_matched'`:
   - User sees: "Matched to existing builder (BCI import - needs review)"
   - Scan review shows the match
5. User clicks "Import to Project"
6. **BUG:** Import route creates assignment with `match_status='confirmed'` but doesn't UPDATE the existing BCI assignment!

**Result:**

Two assignments created:
```sql
-- Old BCI import (still needs review)
id: 'old-id', employer_id: 'multiplex', role: 'builder',
source: 'bci_import', match_status: 'auto_matched' ❌

-- New scan import (confirmed)
id: 'new-id', employer_id: 'multiplex', role: 'builder',
source: 'scanned_mapping_sheet', match_status: 'confirmed' ✅
```

**Expected Behavior:**

When confirming via bulk upload, should:
1. UPDATE existing BCI assignment: `match_status='auto_matched'` → `'confirmed'`
2. Or DELETE old BCI assignment and create new confirmed one
3. Clear the "needs review" flag

---

## Comprehensive Fix Plan

### Fix #1: Add Review Actions to Builder Field

**File:** `src/components/projects/mapping/MappingSheetPage1.tsx`

**Changes:**

1. Add action buttons next to BCI-imported builders:

```tsx
{mappingData?.contractorRoles.slice(0, 2).map((contractor, index) => (
  <div key={contractor.id} className={index === 0 ? "md:col-span-2" : ""}>
    <label className="text-sm font-semibold">{contractor.roleLabel}</label>
    <div className="flex items-center gap-2">
      {/* Existing name display */}
      <button onClick={() => openEmployerDetail(contractor.employerId)}>
        {contractor.employerName}
      </button>

      {/* Auto-match indicator */}
      <AutoMatchIndicator
        matchStatus={contractor.matchStatus}
        dataSource={contractor.dataSource}
        matchConfidence={contractor.matchConfidence}
        matchNotes={contractor.matchNotes}
      />

      {/* NEW: Action buttons for BCI matches */}
      {contractor.matchStatus === 'auto_matched' && contractor.dataSource === 'bci_import' && (
        <div className="flex gap-1 ml-auto">
          <Button
            size="sm"
            variant="default"
            onClick={() => handleConfirmContractor(contractor.id)}
          >
            Confirm
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleChangeContractor(contractor)}
          >
            Change
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleRemoveContractor(contractor.id)}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  </div>
))}
```

2. Add handler functions:

```tsx
const handleConfirmContractor = async (assignmentId: string) => {
  const { error } = await supabase
    .from('project_assignments')
    .update({
      match_status: 'confirmed',
      confirmed_at: new Date().toISOString(),
      confirmed_by: user.id
    })
    .eq('id', assignmentId);

  if (error) {
    toast.error('Failed to confirm builder');
  } else {
    toast.success('Builder confirmed');
    // Refresh data
  }
};

const handleChangeContractor = (contractor) => {
  // Open employer search dialog
  setSelectedContractorRole(contractor);
  setChangeContractorDialogOpen(true);
};

const handleRemoveContractor = async (assignmentId: string) => {
  // Confirm with user first
  if (!confirm('Remove this builder assignment?')) return;

  const { error } = await supabase
    .from('project_assignments')
    .delete()
    .eq('id', assignmentId);

  if (error) {
    toast.error('Failed to remove builder');
  } else {
    toast.success('Builder removed');
    // Refresh data
  }
};
```

3. Add ChangeContractorDialog component (reuse EmployerMatchDialog pattern)

---

### Fix #2: Show BCI Builders in Edit Dialog

**File:** `src/components/projects/EditProjectDialog.tsx`

**Changes:**

1. Load BCI metadata when loading builders:

```tsx
const loadRelations = async () => {
  setLoadingRelations(true);
  try {
    // Load full assignment details (not just v_unified view)
    const { data: assignments, error: assignErr } = await supabase
      .from("project_assignments")
      .select(`
        id,
        employer_id,
        source,
        match_status,
        match_confidence,
        contractor_role_types(code)
      `)
      .eq("project_id", project.id)
      .eq("assignment_type", "contractor_role");

    if (assignErr) throw assignErr;

    const builders = assignments
      .filter(a => a.contractor_role_types?.code === "builder")
      .map(a => ({
        id: a.employer_id,
        source: a.source,
        matchStatus: a.match_status,
        assignmentId: a.id
      }));

    setBuilderIds(builders.map(b => b.id));
    setBuilderMetadata(builders); // NEW: Store metadata

    // Similar for head contractor...
  }
};
```

2. Display BCI badges in MultiEmployerPicker:

```tsx
<MultiEmployerPicker
  selectedIds={builderIds}
  onChange={setBuilderIds}
  label="Builders"
  metadata={builderMetadata} // Pass metadata
  renderBadge={(employerId) => {
    const meta = builderMetadata.find(b => b.id === employerId);
    if (meta?.source === 'bci_import' && meta?.matchStatus === 'auto_matched') {
      return <Badge variant="destructive">BCI - Needs Review</Badge>;
    }
    return null;
  }}
/>
```

---

### Fix #3: Prevent Duplicate Role Assignment

**File:** `src/components/projects/EditProjectDialog.tsx`

**Changes:**

1. Add validation before save:

```tsx
const updateMutation = useMutation({
  mutationFn: async () => {
    // Validate no employer has multiple roles
    const allRoleAssignments = [
      ...builderIds.map(id => ({ id, role: 'builder' })),
      headContractorId ? { id: headContractorId, role: 'head_contractor' } : null
    ].filter(Boolean);

    const employerCounts = new Map();
    for (const assignment of allRoleAssignments) {
      const count = employerCounts.get(assignment.id) || 0;
      if (count > 0) {
        throw new Error(
          `Cannot assign same employer to multiple roles. ` +
          `Please select different employers for builder and head contractor.`
        );
      }
      employerCounts.set(assignment.id, count + 1);
    }

    // Continue with save...
  }
});
```

2. Or auto-resolve by priority:

```tsx
// If head contractor is also in builders, remove from builders
const finalBuilderIds = builderIds.filter(id => id !== headContractorId);

for (const builderId of finalBuilderIds) {
  // Assign builder role...
}
```

---

### Fix #4: Fix Function Overloading Error

**File:** `src/components/projects/EditProjectDialog.tsx`

**Changes:**

Update RPC calls to include all parameters:

```tsx
// Before (ambiguous):
await supabase.rpc('assign_contractor_role', {
  p_project_id: project.id,
  p_employer_id: builderId,
  p_role_code: 'builder',
  p_company_name: 'Builder',
  p_is_primary: true
});

// After (explicit):
await supabase.rpc('assign_contractor_role', {
  p_project_id: project.id,
  p_employer_id: builderId,
  p_role_code: 'builder',
  p_company_name: 'Builder',
  p_is_primary: true,
  p_source: 'manual',           // ✅ Explicitly use new function
  p_match_confidence: 1.0,
  p_match_notes: null
});
```

**Alternative (better):** Drop the old function version:

```sql
-- Migration: drop_old_assign_contractor_role.sql
DROP FUNCTION IF EXISTS public.assign_contractor_role(
  uuid, uuid, text, text, boolean, integer
);

-- Now only one version exists, no ambiguity!
```

---

### Fix #5: Clear BCI Flag on Bulk Upload Confirmation

**File:** `src/app/api/projects/[projectId]/import-scan/route.ts`

**Changes:**

When importing builders from scan, check for existing BCI assignments and update them:

```tsx
// Current code (lines 69-73):
if (safeProjectDecisions.builder_name && safeProjectDecisions.builder_employer_id) {
  validUpdates.builder_id = safeProjectDecisions.builder_employer_id
}

// NEW: Also update/clear BCI assignment
if (safeProjectDecisions.builder_employer_id) {
  // Check for existing BCI import assignment
  const { data: existingAssignment } = await serviceSupabase
    .from('project_assignments')
    .select('id, source, match_status')
    .eq('project_id', projectId)
    .eq('employer_id', safeProjectDecisions.builder_employer_id)
    .eq('assignment_type', 'contractor_role')
    .eq('contractor_role_type_id', (
      await serviceSupabase
        .from('contractor_role_types')
        .select('id')
        .eq('code', 'builder')
        .single()
    ).data?.id)
    .single();

  if (existingAssignment) {
    // Update existing BCI assignment to confirmed
    await serviceSupabase
      .from('project_assignments')
      .update({
        source: 'scanned_mapping_sheet', // Or keep original source
        match_status: 'confirmed',
        match_confidence: 1.0,
        confirmed_at: new Date().toISOString(),
        confirmed_by: user.id,
        match_notes: 'Confirmed via bulk PDF upload'
      })
      .eq('id', existingAssignment.id);
  } else {
    // Create new assignment using assign_contractor_role RPC
    await serviceSupabase.rpc('assign_contractor_role', {
      p_project_id: projectId,
      p_employer_id: safeProjectDecisions.builder_employer_id,
      p_role_code: 'builder',
      p_company_name: safeProjectDecisions.builder_name,
      p_is_primary: true,
      p_source: 'scanned_mapping_sheet',
      p_match_confidence: 1.0,
      p_match_notes: 'Imported via bulk PDF upload'
    });
  }
}
```

---

## Implementation Priority

### Phase 1: Critical Fixes (Deploy ASAP)

1. **Fix #4** - Function overloading error (prevents ANY builder changes)
   - Priority: 🔴 CRITICAL
   - Time: 30 minutes
   - Risk: Low
   - Files: EditProjectDialog.tsx

2. **Fix #3** - Duplicate role assignment
   - Priority: 🔴 HIGH
   - Time: 1 hour
   - Risk: Low
   - Files: EditProjectDialog.tsx

### Phase 2: BCI Review Workflow (Week 1)

3. **Fix #1** - Add review actions to builder field
   - Priority: 🟡 MEDIUM
   - Time: 4-6 hours
   - Risk: Medium
   - Files: MappingSheetPage1.tsx + new dialog component

4. **Fix #5** - Clear BCI flag on confirmation
   - Priority: 🟡 MEDIUM
   - Time: 2-3 hours
   - Risk: Low
   - Files: import-scan/route.ts

### Phase 3: Enhanced UX (Week 2)

5. **Fix #2** - Show BCI metadata in edit dialog
   - Priority: 🟢 LOW
   - Time: 3-4 hours
   - Risk: Low
   - Files: EditProjectDialog.tsx, MultiEmployerPicker.tsx

---

## Testing Checklist

### Test Case 1: BCI Import Existing

- [ ] Import BCI data for project with existing builder
- [ ] Verify "BCI Match - needs review" badge shows
- [ ] Click "Confirm" button
- [ ] Verify badge changes to "Confirmed"
- [ ] Verify builder remains in project

### Test Case 2: Change BCI Builder

- [ ] Find project with BCI builder
- [ ] Click "Change" button
- [ ] Search and select different employer
- [ ] Save changes
- [ ] Verify old builder removed
- [ ] Verify new builder added
- [ ] Verify new builder has match_status='confirmed'

### Test Case 3: Edit Dialog with BCI Builder

- [ ] Open project with BCI builder
- [ ] Click "Edit" button
- [ ] Verify builder shows in picker
- [ ] Verify BCI badge displays
- [ ] Change builder to different employer
- [ ] Save changes
- [ ] Verify no PGRST203 error
- [ ] Verify builder updated successfully

### Test Case 4: Bulk Upload Confirmation

- [ ] Upload PDF with builder matching existing BCI builder
- [ ] Review shows "Matched to BCI builder"
- [ ] Click "Import to Project"
- [ ] Verify BCI flag cleared
- [ ] Verify builder shows as "Confirmed"
- [ ] Verify only ONE assignment exists (not duplicate)

### Test Case 5: Duplicate Role Prevention

- [ ] Open Edit dialog
- [ ] Add employer "Company A" as builder
- [ ] Try to add same "Company A" as head contractor
- [ ] Verify error message displays
- [ ] Or verify builder auto-removed from builder role
- [ ] Save changes
- [ ] Verify only ONE assignment created

---

## Database Cleanup Script

After deploying fixes, clean up existing issues:

```sql
-- 1. Find duplicate role assignments (same employer, same project, different roles)
SELECT
  project_id,
  employer_id,
  COUNT(*) as role_count,
  ARRAY_AGG(contractor_role_types.code) as roles
FROM project_assignments
JOIN contractor_role_types ON contractor_role_types.id = contractor_role_type_id
WHERE assignment_type = 'contractor_role'
GROUP BY project_id, employer_id
HAVING COUNT(*) > 1;

-- 2. Find BCI imports that were later confirmed via scan
-- (Keep the confirmed one, delete the auto_matched one)
WITH duplicates AS (
  SELECT
    pa1.id as bci_id,
    pa2.id as confirmed_id
  FROM project_assignments pa1
  JOIN project_assignments pa2 ON
    pa1.project_id = pa2.project_id AND
    pa1.employer_id = pa2.employer_id AND
    pa1.contractor_role_type_id = pa2.contractor_role_type_id
  WHERE
    pa1.source = 'bci_import' AND
    pa1.match_status = 'auto_matched' AND
    pa2.match_status = 'confirmed' AND
    pa1.id != pa2.id
)
DELETE FROM project_assignments
WHERE id IN (SELECT bci_id FROM duplicates);

-- 3. Drop old function version (after verifying all calls updated)
DROP FUNCTION IF EXISTS public.assign_contractor_role(
  uuid, uuid, text, text, boolean, integer
);
```

---

## Rollback Plan

If issues occur after deployment:

1. **Rollback code changes:**
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Restore old function (if dropped):**
   ```bash
   # Re-run migration: 0000_remote_schema.sql (relevant section)
   supabase db reset --skip-seed
   ```

3. **Verify data integrity:**
   ```sql
   SELECT COUNT(*) FROM project_assignments
   WHERE assignment_type = 'contractor_role';
   ```

---

## Success Metrics

After implementation:

- ✅ Zero PGRST203 errors in logs
- ✅ All BCI builders reviewable via UI
- ✅ No duplicate role assignments
- ✅ Bulk upload clears BCI flags correctly
- ✅ Edit dialog shows BCI metadata
- ✅ User can confirm/change/remove BCI builders

---

**Status:** 📋 Ready for Implementation

**Estimated Total Time:** 12-16 hours

**Risk Level:** Medium (database function changes, multiple files)

**Breaking Changes:** None (additive improvements)

---

**Next Steps:**
1. Review and approve diagnostic
2. Implement Phase 1 critical fixes ASAP
3. Test thoroughly before Phase 2
4. Deploy incrementally with monitoring

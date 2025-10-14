# Canonical Promotion Console - Validation Checklist

## Overview
This checklist validates the implementation of Prompt 3B: Canonical Promotion Console, which provides admin tooling for managing employer canonical name changes from authoritative sources.

## Database Validation

### Migration: `20251015120000_canonical_promotion_system.sql`

- [ ] **Table: `employer_canonical_audit`**
  - [ ] Table exists with all required columns
  - [ ] Primary key `id` is UUID
  - [ ] Foreign keys reference `employers(id)` and `employer_aliases(id)` correctly
  - [ ] `action` constraint allows only `promote`, `reject`, `defer`
  - [ ] Indexes created: `employer_id`, `decided_at`, `action`
  - [ ] Default values work: `decided_at` defaults to `now()`
  - [ ] `conflict_warnings` column stores JSONB properly

- [ ] **View: `canonical_promotion_queue`**
  - [ ] View exists and is queryable
  - [ ] Returns aliases where `is_authoritative = true` OR has external IDs
  - [ ] Excludes aliases that match current canonical name
  - [ ] Priority calculation works: authoritative=10, key systems=5, others=1
  - [ ] Conflict detection query runs without errors
  - [ ] Previous decision lookup shows `defer` actions
  - [ ] Ordering by priority and date works correctly

- [ ] **RPC: `promote_alias_to_canonical`**
  - [ ] Function exists and is executable by authenticated users
  - [ ] Updates `employers.name` with proposed name
  - [ ] Records decision in `employer_canonical_audit`
  - [ ] Returns JSONB with `success`, `employer_id`, `previous_name`, `new_name`, `conflict_warnings`
  - [ ] Detects conflicts with other employers having same name
  - [ ] Raises LOG event for observability
  - [ ] Handles missing alias with error

- [ ] **RPC: `reject_canonical_promotion`**
  - [ ] Function exists and is executable
  - [ ] Records rejection in `employer_canonical_audit`
  - [ ] Requires `decision_rationale` parameter
  - [ ] Returns success confirmation
  - [ ] Raises LOG event

- [ ] **RPC: `defer_canonical_promotion`**
  - [ ] Function exists and is executable
  - [ ] Records deferral in `employer_canonical_audit`
  - [ ] Requires `decision_rationale` parameter
  - [ ] Returns success confirmation
  - [ ] Raises LOG event

- [ ] **Permissions**
  - [ ] `GRANT SELECT` on audit table to authenticated users
  - [ ] `GRANT SELECT` on queue view to authenticated users
  - [ ] `GRANT EXECUTE` on all three RPCs to authenticated users
  - [ ] (Optional) RLS policies restrict to admin/lead_organiser roles

## TypeScript Types Validation

### File: `src/types/database.ts`

- [ ] **Table Type: `employer_canonical_audit`**
  - [ ] `Row` interface includes all columns
  - [ ] `Insert` interface has correct optional/required fields
  - [ ] `Update` interface has all fields optional
  - [ ] Foreign key relationships defined correctly
  - [ ] `conflict_warnings` typed as `Json | null`

- [ ] **View Type: `canonical_promotion_queue`**
  - [ ] Located in `Views` section
  - [ ] `Row` interface includes all view columns
  - [ ] All nullable fields marked with `| null`
  - [ ] `conflict_warnings` typed as `Json | null`
  - [ ] Relationships array present (empty for views)

- [ ] **Function Types**
  - [ ] `defer_canonical_promotion` defined with correct Args and Returns
  - [ ] `promote_alias_to_canonical` defined with optional `p_decision_rationale`
  - [ ] `reject_canonical_promotion` defined with required rationale
  - [ ] All return `Json` type

## UI Component Validation

### File: `src/components/admin/CanonicalPromotionConsole.tsx`

- [ ] **Component Rendering**
  - [ ] Loads queue items on mount
  - [ ] Shows loading skeleton while fetching
  - [ ] Displays "All caught up!" when queue is empty
  - [ ] Shows queue items as cards when data exists

- [ ] **Queue Item Display**
  - [ ] Proposed name shown prominently
  - [ ] Current canonical name displayed
  - [ ] Source system badge with correct color
  - [ ] Priority badge shows correct level (High/Medium/Low)
  - [ ] Authoritative badge shown when `is_authoritative = true`
  - [ ] External link to employer page works
  - [ ] Source identifier displayed
  - [ ] Collection date formatted correctly
  - [ ] Total aliases count shown
  - [ ] Alias notes displayed if present

- [ ] **Conflict Warnings**
  - [ ] Alert shown when `conflict_warnings` not empty
  - [ ] Each conflicting employer listed
  - [ ] Similarity percentage displayed if available
  - [ ] Links to conflicting employers work

- [ ] **Previous Decision Alert**
  - [ ] Alert shown when `previous_decision = 'defer'`
  - [ ] Message indicates item was previously deferred

- [ ] **Action Buttons**
  - [ ] Three buttons: Defer, Reject, Promote
  - [ ] Buttons open decision dialog with correct action
  - [ ] Button styles match design (outline, destructive, default)

- [ ] **Decision Dialog**
  - [ ] Opens when action button clicked
  - [ ] Shows correct title based on action
  - [ ] Shows proposed and current names in description
  - [ ] Rationale textarea present
  - [ ] Rationale required for Reject and Defer
  - [ ] Rationale optional for Promote
  - [ ] Cancel button closes dialog
  - [ ] Confirm button disabled while submitting
  - [ ] Shows loading state ("Processing...")

- [ ] **RPC Integration**
  - [ ] Calls correct RPC function for each action
  - [ ] Passes `p_alias_id` and `p_decision_rationale`
  - [ ] Handles success with toast notification
  - [ ] Handles errors with toast error
  - [ ] Reloads queue after successful decision
  - [ ] Closes dialog after success

- [ ] **Telemetry Integration**
  - [ ] `useAliasTelemetry` hook initialized with scope and actorId
  - [ ] `logInsert` called on successful promotion
  - [ ] Telemetry includes all required fields
  - [ ] Notes field describes promotion action

- [ ] **Info Alert**
  - [ ] Displays explanation of canonical promotions
  - [ ] Positioned at top of console

## Admin Page Integration

### File: `src/app/(app)/admin/page.tsx`

- [ ] **Import Statement**
  - [ ] `CanonicalPromotionConsole` imported correctly

- [ ] **Mobile Layout (Collapsible)**
  - [ ] "Canonical Names" collapsible section added
  - [ ] Section positioned logically (before Data Management)
  - [ ] Console component renders in collapsible content
  - [ ] Collapsible can be expanded/collapsed

- [ ] **Desktop Layout (Tabs)**
  - [ ] "Canonical Names" tab added to TabsList
  - [ ] Tab restricted to admin users only (`{isAdmin && ...}`)
  - [ ] Tab positioned logically in tab order
  - [ ] TabContent contains console component
  - [ ] Tab is selectable and displays content

## Manual Testing Checklist

### Setup
- [ ] Run migration: `supabase migration up`
- [ ] Verify no migration errors
- [ ] Check tables/views created in database
- [ ] Seed test data (see below)

### Seed Test Data (SQL)
```sql
-- Create test employer
INSERT INTO employers (id, name, employer_type) 
VALUES ('test-employer-1', 'ABC Construction Pty Ltd', 'main_contractor');

-- Create authoritative alias
INSERT INTO employer_aliases (
  id, alias, alias_normalized, employer_id, 
  source_system, source_identifier, is_authoritative
) VALUES (
  'test-alias-1', 
  'ABC Constructions Limited', 
  'abc constructions limited',
  'test-employer-1',
  'bci',
  'BCI123456',
  true
);

-- Create non-authoritative alias with BCI ID
UPDATE employers SET bci_company_id = 'BCI123456' WHERE id = 'test-employer-1';

INSERT INTO employer_aliases (
  id, alias, alias_normalized, employer_id,
  source_system, source_identifier, is_authoritative
) VALUES (
  'test-alias-2',
  'ABC Construction Group',
  'abc construction group',
  'test-employer-1',
  'bci',
  'BCI123456',
  false
);
```

### Test Cases

#### Test 1: View Queue
- [ ] Navigate to Admin page
- [ ] Open "Canonical Names" tab (desktop) or collapsible (mobile)
- [ ] Verify queue loads
- [ ] Verify test aliases appear
- [ ] Verify priority badges correct
- [ ] Verify source badges correct
- [ ] Verify external links work

#### Test 2: Promote Alias
- [ ] Click "Promote to Canonical" on a queue item
- [ ] Dialog opens with correct information
- [ ] Enter optional rationale
- [ ] Click Confirm
- [ ] Verify success toast
- [ ] Verify item removed from queue
- [ ] Check database: `employers.name` updated
- [ ] Check database: audit record created with `action = 'promote'`

#### Test 3: Reject Alias
- [ ] Click "Reject" on a queue item
- [ ] Dialog opens
- [ ] Try to confirm without rationale - should show error
- [ ] Enter rationale
- [ ] Click Confirm
- [ ] Verify success toast
- [ ] Check database: audit record created with `action = 'reject'`
- [ ] Item should be removed from queue (unless re-added by view logic)

#### Test 4: Defer Decision
- [ ] Click "Defer" on a queue item
- [ ] Dialog opens
- [ ] Enter rationale
- [ ] Click Confirm
- [ ] Verify success toast
- [ ] Check database: audit record created with `action = 'defer'`
- [ ] Verify item shows "Previously Deferred" alert on reload

#### Test 5: Conflict Detection
- [ ] Create duplicate employer with similar name
- [ ] Verify conflict warning appears in queue item
- [ ] Verify conflicting employer listed
- [ ] Verify link to conflicting employer works
- [ ] Verify similarity percentage shown (if available)

#### Test 6: Error Handling
- [ ] Try promoting non-existent alias (simulate by deleting alias mid-flow)
- [ ] Verify error toast displayed
- [ ] Verify dialog closes gracefully

#### Test 7: Empty Queue
- [ ] Process all queue items (promote/reject all)
- [ ] Verify "All caught up!" message displays
- [ ] Verify check icon shows

#### Test 8: Telemetry (Check Logs)
- [ ] Promote an alias
- [ ] Check application logs for `alias.insert` event
- [ ] Verify event includes employerId, alias, normalized, sourceSystem, notes
- [ ] Check Supabase logs for `RAISE LOG` statements

#### Test 9: Permissions
- [ ] Test as admin user - should see tab/console
- [ ] Test as lead_organiser - verify access based on role
- [ ] Test as organiser/viewer - should NOT see tab (if restricted)

## Observability Validation

- [ ] **Database Logs**
  - [ ] Promotion events logged: `alias.canonical_promotion`
  - [ ] Rejection events logged: `alias.canonical_rejection`
  - [ ] Deferral events logged: `alias.canonical_deferral`
  - [ ] Logs include employer_id, alias_id, names, actor

- [ ] **Application Logs**
  - [ ] Telemetry hook logs `alias.insert` on promotion
  - [ ] Errors logged with context

- [ ] **Audit Trail**
  - [ ] All decisions recorded in `employer_canonical_audit`
  - [ ] `decided_by` populated with user ID
  - [ ] `decided_at` timestamp accurate
  - [ ] `conflict_warnings` JSON saved correctly

## Performance Validation

- [ ] **Queue View Performance**
  - [ ] Query returns results in < 1 second for typical data
  - [ ] Handles > 100 queue items without timeout
  - [ ] Indexes used efficiently (check EXPLAIN)

- [ ] **RPC Performance**
  - [ ] Promotion completes in < 500ms
  - [ ] Rejection/deferral complete in < 200ms

## Documentation

- [ ] **README/Implementation Summary**
  - [ ] Prompt 3B marked complete in `ALIAS_MULTI_AGENT_PROMPTS.md`
  - [ ] Implementation notes added
  - [ ] Known limitations documented (if any)

## Final Sign-Off

- [ ] All database structures deployed
- [ ] All TypeScript types updated
- [ ] UI component tested on desktop and mobile
- [ ] Manual test cases passed
- [ ] No console errors
- [ ] No lint errors
- [ ] Telemetry verified
- [ ] Documentation updated

**Validated By:** _______________  
**Date:** _______________  
**Notes:**


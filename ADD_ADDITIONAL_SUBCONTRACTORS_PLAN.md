# Add Additional Subcontractors - Implementation Plan

**Feature Request:** Allow adding additional subcontractors when reviewing uploads on Project Review → Subcontractors tab

**Context:** Projects can have multiple employers assigned to the same trade_type (particularly during tender stage). The underlying database already supports this via `project_assignments` table.

---

## Current System Analysis

### Database Structure ✅ Already Supports Multiple Employers

**Table:** `project_assignments`
```sql
CREATE TABLE project_assignments (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  employer_id UUID NOT NULL,
  assignment_type TEXT NOT NULL,  -- 'trade_work' for subcontractors
  trade_type_id UUID,              -- References trade_types table
  contractor_role_type_id UUID,    -- For contractor roles
  status TEXT,                     -- 'active', 'inactive', 'pending', 'completed'
  source TEXT,                     -- 'scanned_mapping_sheet', 'manual', etc.
  match_status TEXT,               -- 'auto_matched', 'confirmed', 'needs_review'
  ...
)

-- UNIQUE constraint allows multiple employers per trade:
-- UNIQUE(project_id, employer_id, assignment_type, trade_type_id, contractor_role_type_id)
-- This means you can have:
-- (project_1, employer_A, 'trade_work', scaffolding, NULL) ✅
-- (project_1, employer_B, 'trade_work', scaffolding, NULL) ✅
-- (project_1, employer_C, 'trade_work', scaffolding, NULL) ✅
```

**Verification from useMappingSheetData.ts (lines 139-187):**
- Fetches ALL `project_assignments` where `assignment_type = 'trade_work'`
- No restriction on one employer per trade
- Already displays multiple employers in UI (lines 186-191 of SubcontractorsReview.tsx)

---

## Current Review Flow

### 1. Data Loading (SubcontractorsReview.tsx lines 146-198)

```tsx
const initial = extractedSubcontractors.map((sub, index) => {
  // Find ALL existing assignments for this trade (there can be multiple)
  const mappedTradeCode = mapTradeNameToCode(sub.trade)
  const existingAssignments = mappingData?.tradeContractors.filter(
    tc => tc.tradeType === mappedTradeCode
  ) || []

  return {
    ...sub,
    action: 'skip' | 'import' | 'replace_one',
    matchedEmployer: { id, name, confidence },
    existingEmployers: existingAssignments.map(ea => ({
      id: ea.employerId,
      name: ea.employerName,
      assignmentId: ea.id,
      keepDecision: true  // Default to keeping existing
    })),
    // ... other fields
  }
})
```

**Key Point:** Already tracks `existingEmployers` array with keep/remove decisions!

### 2. User Actions (SubcontractorsReview.tsx lines 214-230)

**Current actions:**
- `import` - Add scanned company as new assignment
- `skip` - Don't add scanned company
- `replace_one` - Replace ONE existing employer with scanned company
- Keep/remove existing employers via checkboxes (lines 453-469)

**What's Missing:**
- No way to add NEW employer beyond scanned company
- No "Add Additional Subcontractor" button

### 3. Import Processing (route.ts lines 183-236)

```tsx
for (const sub of subcontractorDecisions) {
  if (!sub.matchedEmployer) continue

  // Get trade_type_id
  const { data: tradeType } = await serviceSupabase
    .from('trade_types')
    .select('id')
    .eq('code', tradeCode)
    .single()

  // Create project assignment
  await serviceSupabase
    .from('project_assignments')
    .insert({
      project_id: projectId,
      employer_id: sub.matchedEmployer.id,
      assignment_type: 'trade_work',
      trade_type_id: tradeType.id,
      status: sub.status || 'active',
      source: 'scanned_mapping_sheet',
      match_status: 'confirmed',
      ...
    })
}
```

**Key Point:** Import route ONLY processes `subcontractorDecisions` array. Each decision with a `matchedEmployer` creates ONE assignment. To add multiple, just send multiple decisions with the same trade!

---

## Implementation Plan

### Phase 1: Extend State Management ✅ Minimal Changes Needed

**SubcontractorsReview.tsx - Add to decision object:**

```tsx
interface SubcontractorDecision {
  // Existing fields...
  existingEmployers: Array<{
    id: string
    name: string
    assignmentId: string
    keepDecision: boolean
  }>

  // NEW: Track additional employers to add
  additionalEmployers?: Array<{
    id: string
    name: string
    status: TradeStatus
    isNew: boolean  // For UI indication
  }>
}
```

**Why this works:**
- Existing state already handles arrays of employers
- Import route just needs more decisions with same trade
- No database changes needed

---

### Phase 2: UI Components

#### 2.1 Add Button (Per Trade Row)

**Location:** SubcontractorsReview.tsx line 599 (Actions column)

```tsx
<TableCell className={`sticky right-0 ...`}>
  <div className="space-y-1">
    {/* Existing buttons: Review, Change, Fix Entry, Search EBA */}

    {/* NEW: Add Additional Subcontractor button */}
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleAddAdditional(index)}
      className="w-full gap-1"
    >
      <Plus className="h-3 w-3" />
      Add Subcontractor
    </Button>
  </div>
</TableCell>
```

**Visual Design:**
- Icon: `<Plus />` from lucide-react
- Text: "Add Subcontractor"
- Placement: Below existing action buttons
- Always visible (not conditional)

#### 2.2 Add Additional Employer Modal

**New Component:** `AddAdditionalEmployerModal.tsx`

```tsx
interface AddAdditionalEmployerModalProps {
  open: boolean
  onClose: () => void
  trade: string
  tradeCode: string
  allEmployers: any[]
  currentEmployers: string[]  // IDs already assigned
  onConfirm: (employerId: string, employerName: string, status: TradeStatus) => void
}

export function AddAdditionalEmployerModal({
  open,
  onClose,
  trade,
  tradeCode,
  allEmployers,
  currentEmployers,
  onConfirm
}: AddAdditionalEmployerModalProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedEmployer, setSelectedEmployer] = useState<any>(null)
  const [status, setStatus] = useState<TradeStatus>('active')

  // Filter employers:
  // 1. Match search term
  // 2. Exclude already assigned employers
  const filteredEmployers = allEmployers.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    !currentEmployers.includes(emp.id)
  )

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Additional Subcontractor for {trade}</DialogTitle>
          <DialogDescription>
            Search and select an employer to add to this trade. This will create an additional assignment (tender stage may have multiple employers).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search Input */}
          <div>
            <Label>Search Employers</Label>
            <Input
              placeholder="Search by company name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Employer List (max height with scroll) */}
          <div className="max-h-[300px] overflow-y-auto border rounded">
            {filteredEmployers.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No employers found. Try different search terms.
              </div>
            ) : (
              <div className="divide-y">
                {filteredEmployers.map(emp => (
                  <div
                    key={emp.id}
                    className={`p-3 cursor-pointer hover:bg-gray-50 ${
                      selectedEmployer?.id === emp.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => setSelectedEmployer(emp)}
                  >
                    <div className="font-medium">{emp.name}</div>
                    {emp.enterprise_agreement_status && (
                      <Badge variant="secondary" className="mt-1">Has EBA</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status Selector */}
          {selectedEmployer && (
            <div>
              <Label>Status for this Assignment</Label>
              <StatusSelectSimple
                value={status}
                onChange={setStatus}
                size="md"
              />
            </div>
          )}

          {/* Current Assignments Display */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Currently assigned to {trade}:</strong>
              <ul className="mt-2 list-disc list-inside">
                {currentEmployers.map((empId, i) => {
                  const emp = allEmployers.find(e => e.id === empId)
                  return emp ? <li key={i}>{emp.name}</li> : null
                })}
              </ul>
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (selectedEmployer) {
                onConfirm(selectedEmployer.id, selectedEmployer.name, status)
                onClose()
              }
            }}
            disabled={!selectedEmployer}
          >
            Add Subcontractor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Key Features:**
- Search employers with real-time filtering
- Excludes already-assigned employers (prevents duplicates)
- Status selector (active/inactive/pending/completed)
- Shows current assignments for context
- Clean, simple UX

---

### Phase 3: State Handlers

**SubcontractorsReview.tsx - New handlers:**

```tsx
// State for Add Additional modal
const [addAdditionalOpen, setAddAdditionalOpen] = useState(false)
const [addAdditionalIndex, setAddAdditionalIndex] = useState<number | null>(null)

// Open modal for specific trade
const handleAddAdditional = (index: number) => {
  setAddAdditionalIndex(index)
  setAddAdditionalOpen(true)
}

// Confirm adding employer
const handleConfirmAdditional = (employerId: string, employerName: string, status: TradeStatus) => {
  if (addAdditionalIndex === null) return

  setDecisions(prev => {
    const updated = [...prev]
    const decision = updated[addAdditionalIndex]

    // Initialize additionalEmployers if not exists
    if (!decision.additionalEmployers) {
      decision.additionalEmployers = []
    }

    // Add new employer
    decision.additionalEmployers.push({
      id: employerId,
      name: employerName,
      status,
      isNew: true
    })

    return updated
  })

  setAddAdditionalOpen(false)
  setAddAdditionalIndex(null)

  toast.success('Subcontractor added', {
    description: `${employerName} will be added to ${decisions[addAdditionalIndex].trade}`
  })
}

// Remove additional employer
const handleRemoveAdditional = (decisionIndex: number, additionalIndex: number) => {
  setDecisions(prev => {
    const updated = [...prev]
    updated[decisionIndex].additionalEmployers?.splice(additionalIndex, 1)
    return updated
  })

  toast.info('Subcontractor removed', {
    description: 'This employer will not be added'
  })
}
```

---

### Phase 4: Display Additional Employers

**SubcontractorsReview.tsx - Add display section in table row:**

```tsx
{/* After existing employers section, before scanned company */}

{/* Additional Employers to Add */}
<TableCell>
  {decision.additionalEmployers && decision.additionalEmployers.length > 0 ? (
    <div className="space-y-1">
      {decision.additionalEmployers.map((emp, empIndex) => (
        <div key={empIndex} className="flex items-center gap-2 p-2 bg-green-50 rounded border border-green-200">
          <Plus className="h-4 w-4 text-green-600 flex-shrink-0" />
          <span className="text-green-800 font-medium flex-1">{emp.name}</span>
          <Badge variant="outline" className="text-xs">{emp.status}</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleRemoveAdditional(index, empIndex)}
            className="h-6 w-6 p-0"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}
      <div className="text-xs text-green-600 mt-1 font-medium">
        +{decision.additionalEmployers.length} to be added
      </div>
    </div>
  ) : (
    <span className="text-gray-400 italic">None</span>
  )}
</TableCell>
```

**New Column Header:**
```tsx
<TableHead className="min-w-[12rem]">Additional Subcontractors</TableHead>
```

**Visual Design:**
- Green background (`bg-green-50`) to distinguish from existing (green-50) and scanned (blue)
- Plus icon to indicate "adding"
- Status badge
- Remove (X) button
- Summary text: "+2 to be added"

---

### Phase 5: Export Decisions for Import

**SubcontractorsReview.tsx - Modify onDecisionsChange (lines 200-212):**

```tsx
useEffect(() => {
  // Flatten decisions: create separate decision for each employer to add
  const flattenedDecisions: any[] = []

  decisions.forEach(decision => {
    // 1. Add scanned company (if action is import or replace_one)
    if (['import', 'replace_one'].includes(decision.action) && decision.matchedEmployer) {
      flattenedDecisions.push({
        ...decision,
        existingEmployersToKeep: decision.existingEmployers?.filter(e => e.keepDecision) || [],
        existingEmployersToRemove: decision.existingEmployers?.filter(e => !e.keepDecision) || [],
        importScannedCompany: true,
      })
    } else {
      // Skip action - still need to track existing employers
      flattenedDecisions.push({
        ...decision,
        existingEmployersToKeep: decision.existingEmployers?.filter(e => e.keepDecision) || [],
        existingEmployersToRemove: decision.existingEmployers?.filter(e => !e.keepDecision) || [],
        importScannedCompany: false,
      })
    }

    // 2. Add each additional employer as separate decision
    decision.additionalEmployers?.forEach(addEmp => {
      flattenedDecisions.push({
        trade: decision.trade,
        stage: decision.stage,
        trade_type_code: decision.trade_type_code,
        matchedEmployer: {
          id: addEmp.id,
          name: addEmp.name,
          confidence: 'exact'
        },
        status: addEmp.status,
        action: 'import',
        confidence: 1.0,
        needsReview: false,
        isAdditionalAssignment: true  // Flag for import route
      })
    })
  })

  onDecisionsChange(flattenedDecisions)
}, [decisions])
```

**Why this works:**
- Import route expects array of decisions
- Each decision with `matchedEmployer` creates one assignment
- By creating multiple decisions with same `trade_type_code`, we create multiple assignments
- Database unique constraint allows this (different employer_id)

---

### Phase 6: Import Route Adjustment (Optional)

**route.ts - No changes needed!** ✅

Current code (lines 183-236) already handles this:
```tsx
for (const sub of subcontractorDecisions) {
  if (!sub.matchedEmployer) continue

  // Creates ONE assignment per decision
  await serviceSupabase
    .from('project_assignments')
    .insert({
      project_id: projectId,
      employer_id: sub.matchedEmployer.id,  // Different ID = different row
      assignment_type: 'trade_work',
      trade_type_id: tradeType.id,          // Can be same
      ...
    })
}
```

The unique constraint is:
```
UNIQUE(project_id, employer_id, assignment_type, trade_type_id, contractor_role_type_id)
```

So these are all valid:
- (project_1, employer_A, 'trade_work', scaffolding, NULL)
- (project_1, employer_B, 'trade_work', scaffolding, NULL)
- (project_1, employer_C, 'trade_work', scaffolding, NULL)

**No database changes required!**

---

## Table Layout Update

### Current Columns (10 total):
1. Stage
2. Trade
3. Current Employer
4. Scanned Company
5. Matched Employer
6. Action
7. Status
8. EBA
9. Confidence
10. Actions (sticky)

### Proposed Columns (11 total):
1. Stage
2. Trade
3. **Current Employers** (renamed, shows all existing)
4. **Additional to Add** (NEW - shows manually added)
5. Scanned Company
6. Matched Employer
7. Action (for scanned company)
8. Status
9. EBA
10. Confidence
11. Actions (sticky)

**Alternative (more compact):**
Keep 10 columns, combine "Current" and "Additional" into one "Assignments" column:

```tsx
<TableCell>
  <div className="space-y-2">
    {/* Existing Employers */}
    {decision.existingEmployers?.length > 0 && (
      <div>
        <div className="text-xs text-gray-500 mb-1">Existing:</div>
        {decision.existingEmployers.map(emp => (
          <div className="p-2 bg-gray-50 rounded border">
            {emp.name}
            <Checkbox checked={emp.keepDecision} ... />
          </div>
        ))}
      </div>
    )}

    {/* Additional to Add */}
    {decision.additionalEmployers?.length > 0 && (
      <div>
        <div className="text-xs text-green-600 mb-1">To Add:</div>
        {decision.additionalEmployers.map(emp => (
          <div className="p-2 bg-green-50 rounded border">
            {emp.name}
            <X onClick={remove} />
          </div>
        ))}
      </div>
    )}
  </div>
</TableCell>
```

---

## User Flow Example

### Scenario: Tender Stage Project with Multiple Scaffolding Companies

**Step 1: User uploads PDF scan**
- PDF shows: "Scaffolding: Acrow Formwork"
- Existing in database: "Scaffolding: Hanscaff"

**Step 2: Review Subcontractors Tab**

Table shows:
```
┌─────────────┬────────────┬───────────────────┬──────────────────┬─────────────┐
│ Trade       │ Current    │ Additional to Add │ Scanned Company  │ Actions     │
├─────────────┼────────────┼───────────────────┼──────────────────┼─────────────┤
│ Scaffolding │ ✓ Hanscaff │ (none)            │ Acrow Formwork   │ [Review]    │
│             │            │                   │ Match: Acrow (✓) │ [Add +]     │
└─────────────┴────────────┴───────────────────┴──────────────────┴─────────────┘
```

**Step 3: User clicks "Add Subcontractor" button**

Modal opens:
```
┌──────────────────────────────────────────┐
│ Add Additional Subcontractor for         │
│ Scaffolding                              │
├──────────────────────────────────────────┤
│ Search: [scaffold____________]           │
│                                          │
│ Results:                                 │
│ ○ Advance Scaffolding                   │
│ ○ Brand Scaffold                        │
│ ○ Complete Scaffolding                  │
│                                          │
│ Currently assigned:                      │
│ • Hanscaff                              │
│                                          │
│ [Cancel]  [Add Subcontractor]           │
└──────────────────────────────────────────┘
```

**Step 4: User selects "Brand Scaffold"**

Table now shows:
```
┌─────────────┬────────────┬───────────────────┬──────────────────┬─────────────┐
│ Trade       │ Current    │ Additional to Add │ Scanned Company  │ Actions     │
├─────────────┼────────────┼───────────────────┼──────────────────┼─────────────┤
│ Scaffolding │ ✓ Hanscaff │ + Brand Scaffold  │ Acrow Formwork   │ [Review]    │
│             │            │   (active) [X]    │ Match: Acrow (✓) │ [Add +]     │
└─────────────┴────────────┴───────────────────┴──────────────────┴─────────────┘
```

**Step 5: User clicks "Import to Project"**

Import creates 3 assignments:
1. Keep existing: `(project, Hanscaff, scaffolding)` - already exists, kept
2. Import scanned: `(project, Acrow, scaffolding)` - NEW
3. Import additional: `(project, Brand Scaffold, scaffolding)` - NEW

**Result in database:**
```sql
SELECT employer_id, trade_type_id FROM project_assignments
WHERE project_id = 'xxx' AND assignment_type = 'trade_work';

-- Returns 3 rows:
-- employer_id              | trade_type_id (scaffolding)
-- hanscaff-uuid           | scaffolding-uuid
-- acrow-uuid              | scaffolding-uuid
-- brand-scaffold-uuid     | scaffolding-uuid
```

---

## Implementation Checklist

### Phase 1: Component Structure ✅
- [x] Reviewed existing state management
- [x] Confirmed database supports multiple employers
- [x] Verified import route compatibility
- [ ] Create `AddAdditionalEmployerModal.tsx`
- [ ] Add modal state to SubcontractorsReview

### Phase 2: State Management
- [ ] Add `additionalEmployers` to decision interface
- [ ] Implement `handleAddAdditional` handler
- [ ] Implement `handleConfirmAdditional` handler
- [ ] Implement `handleRemoveAdditional` handler
- [ ] Update `onDecisionsChange` to flatten decisions

### Phase 3: UI Updates
- [ ] Add "Add Subcontractor" button to Actions column
- [ ] Add "Additional to Add" column (or integrate into existing column)
- [ ] Style additional employers with green background
- [ ] Add remove (X) buttons for additional employers

### Phase 4: Testing
- [ ] Test adding 1 additional employer
- [ ] Test adding multiple additional employers to same trade
- [ ] Test adding to different trades
- [ ] Test removing additional employers
- [ ] Test import with additional employers
- [ ] Verify database creates correct assignments
- [ ] Test with existing employers (keep/remove)
- [ ] Test with scanned employers (import/skip)

### Phase 5: Edge Cases
- [ ] Prevent duplicate employers (same employer twice on same trade)
- [ ] Handle employer search with no results
- [ ] Handle trade with no existing employers
- [ ] Handle adding employer already in "scanned" or "existing"
- [ ] Test with trades that have 5+ existing employers

---

## API Changes Required

**None!** ✅

The existing import route already handles this pattern:
- Accepts array of `subcontractorDecisions`
- Each decision with `matchedEmployer` creates one assignment
- Database allows multiple rows with same `trade_type_id`

We just need to send MORE decisions (duplicating trade info).

---

## Database Migration Required

**None!** ✅

The `project_assignments` table already supports this:
- UNIQUE constraint allows multiple employers per trade
- All required columns exist
- No schema changes needed

---

## Benefits

1. **Tender Stage Support** ✅
   - Can assign multiple contractors bidding for same trade
   - Real-world scenario already supported by database

2. **Flexibility** ✅
   - Add as many employers as needed per trade
   - Not limited to scanned data
   - Can add employers project-wide

3. **Clean UX** ✅
   - Simple "Add" button
   - Familiar search/select pattern (matches EmployerMatchDialog)
   - Visual distinction (green vs gray vs blue)

4. **No Breaking Changes** ✅
   - Existing functionality unchanged
   - Import route unchanged
   - Database unchanged
   - Backward compatible

---

## Alternative Approaches Considered

### Option A: Separate "Manage Subcontractors" Button
**Rejected:** Adds extra step, users expect inline management

### Option B: Editable table cells
**Rejected:** Complex UX for adding employers, search is needed

### Option C: Multi-select dropdown
**Rejected:** Poor UX for large employer list, hard to search

### Option D: Current Plan (Modal with Search) ✅
**Selected:** Clean, searchable, familiar pattern, non-intrusive

---

## Future Enhancements

### 1. Bulk Add Mode
Allow adding same employer to multiple trades at once:
```tsx
<Button onClick={openBulkAddModal}>
  Add to Multiple Trades
</Button>

// Modal shows:
// - Select employer (one)
// - Select trades (multiple checkboxes)
// - Set status for all
```

### 2. Template/Favorites
Save frequently-used employer groups:
```tsx
// E.g., "Standard Tender Package"
// - Scaffolding: Brand A, Brand B
// - Concrete: Company X, Company Y
// - Steel: Supplier Z
```

### 3. Copy from Another Project
```tsx
<Button onClick={copyFromProject}>
  Copy Subcontractors from Similar Project
</Button>

// Shows project search
// Copies all trade assignments
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Duplicate assignments | Low | UI prevents (filters already-assigned) |
| Performance (many employers) | Low | Already handling via pagination |
| UI clutter (many additional) | Medium | Collapsible section, max-height scroll |
| User confusion | Low | Clear labeling, color coding |
| Import failures | Low | Error handling already exists |

---

## Testing Plan

### Unit Tests
- [ ] Test `handleAddAdditional` adds to array
- [ ] Test `handleRemoveAdditional` removes from array
- [ ] Test `handleConfirmAdditional` creates correct decision
- [ ] Test decision flattening logic

### Integration Tests
- [ ] Test modal opens/closes correctly
- [ ] Test employer search filtering
- [ ] Test status selector updates
- [ ] Test import creates correct assignments

### E2E Tests
- [ ] Upload scan → Add additional → Import → Verify database
- [ ] Add multiple additional → Verify all imported
- [ ] Add + remove additional → Verify correct count
- [ ] Add to multiple trades → Verify all trades updated

---

## Rollout Plan

### Phase 1: Development (Week 1)
- Day 1-2: Create AddAdditionalEmployerModal component
- Day 3-4: Integrate with SubcontractorsReview
- Day 5: Testing and bug fixes

### Phase 2: Testing (Week 2)
- Day 1-2: Unit and integration tests
- Day 3: Manual testing with real data
- Day 4: User acceptance testing
- Day 5: Bug fixes

### Phase 3: Deployment
- Deploy to staging
- Test with sample uploads
- Deploy to production
- Monitor for issues

---

**Status:** Ready for Implementation

**Estimated Development Time:** 3-5 days

**Complexity:** Medium (new modal, state management updates)

**Breaking Changes:** None

**Database Changes:** None

**API Changes:** None

---

**Next Steps:**
1. Review and approve plan
2. Create AddAdditionalEmployerModal component
3. Integrate with SubcontractorsReview
4. Test and deploy

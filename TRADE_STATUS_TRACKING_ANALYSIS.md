# Trade Status Tracking - Analysis & Implementation Plan

## Executive Summary

**Request**: Add "project status" field to track whether each trade/contractor is:
- Active (currently on site)
- Completed (finished work)
- Tendering (contract out to tender)
- Not Yet Tendered
- N/A (not applicable for this project)

**Key Finding**: Status tracking **already exists** in the `project_assignments` table but:
1. ❌ Not exposed in mapping sheet UI
2. ❌ Not populated from scan imports
3. ❌ Missing "tendering" status options
4. ❌ No "updated_on" timestamp tracking
5. ❌ Legacy `project_contractor_trades` table has no status field

## Current Data Model

### Table 1: project_assignments (NEW SYSTEM)
**Location**: Primary table for all project-contractor relationships

**Schema**:
```sql
CREATE TABLE project_assignments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  employer_id uuid NOT NULL,
  assignment_type text NOT NULL,  -- 'contractor_role' or 'trade_work'
  
  trade_type_id uuid,  -- References trade_types table
  contractor_role_type_id uuid,  -- References contractor_role_types
  
  status text DEFAULT 'active',  -- ✅ ALREADY EXISTS
  -- CHECK: status IN ('planned', 'active', 'completed', 'cancelled', 'on_hold')
  
  start_date date,
  end_date date,
  estimated_workers integer,
  
  source text DEFAULT 'manual',
  match_status text DEFAULT 'confirmed',
  match_confidence numeric DEFAULT 1.0,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  notes text
);
```

**Current Status Values**:
- ✅ `planned` - Contractor identified but not started
- ✅ `active` - Currently working (DEFAULT)
- ✅ `completed` - Work finished
- ✅ `cancelled` - Contract cancelled
- ✅ `on_hold` - Work paused

**Missing Values** (user requested):
- ❌ `tendering` - Out to tender
- ❌ `not_yet_tendered` - Planned but not yet sent to tender

### Table 2: project_contractor_trades (LEGACY SYSTEM)
**Location**: Older table, still in use

**Schema**:
```sql
CREATE TABLE project_contractor_trades (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL,
  employer_id uuid NOT NULL,
  trade_type text NOT NULL,  -- Direct text, not FK
  stage trade_stage,  -- 'early_works', 'structure', 'finishing', 'other'
  
  eba_signatory eba_status_type,
  estimated_project_workforce numeric,
  start_date date,
  end_date date,
  
  source text DEFAULT 'manual',
  match_status text,
  match_confidence numeric,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
  
  -- ❌ NO STATUS FIELD
);
```

**Problem**: No status tracking in legacy table

## Data Flow Analysis

### Where Trade Data Is Written

#### 1. Scan Import (NEW)
**File**: `src/app/api/projects/[projectId]/import-scan/route.ts`

**Current Code**:
```typescript
await serviceSupabase
  .from('project_assignments')
  .insert({
    project_id,
    employer_id: matchedEmployerId,
    assignment_type: 'trade_work',
    trade_type_id: tradeTypeId,
    source: 'scanned_mapping_sheet',
    match_status: 'confirmed',
    // ❌ status not set → defaults to 'active'
    // ❌ No way for user to specify status during review
  })
```

#### 2. Manual Entry (MappingSubcontractorsTable)
**File**: `src/components/projects/mapping/MappingSubcontractorsTable.tsx`

**Current Code** (line 138-147):
```typescript
const payload: any = {
  project_id: projectId,
  employer_id: employerId,
  assignment_type: 'trade_work',
  trade_type_id: tradeType.id,
  source: 'manual',
  // ❌ status not set → defaults to 'active'
}

await supabase.from("project_assignments").insert(payload)
```

#### 3. Legacy Manual Entry (StageTradeAssignmentManager)
**File**: `src/components/projects/StageTradeAssignmentManager.tsx`

**Uses**: `project_contractor_trades` (legacy)
```typescript
await supabase
  .from("project_contractor_trades")
  .insert({
    project_id,
    employer_id,
    trade_type,
    stage,
    // ❌ No status field exists in this table
  })
```

### Where Trade Data Is Read/Displayed

#### 1. Mapping Sheet Subcontractors Tab
**File**: `src/components/projects/mapping/MappingSubcontractorsTable.tsx`

**Current Display**:
- Stage badge (Early Works, Structure, Finishing, Other)
- Trade name (Cleaning, Scaffolding, etc.)
- Employer name + EBA status
- Estimated workforce
- Compliance indicators
- **❌ NO STATUS DISPLAY**

#### 2. Project Contractors Tab
**File**: `src/components/projects/ContractorsSummary.tsx`

**Current Display**:
- Employer name
- Trade types
- Site location
- EBA status
- Membership percentage
- **❌ NO STATUS DISPLAY**

#### 3. Employer Worksites Tab
**File**: `src/components/employers/EmployerWorkSitesTab.tsx` (likely)

**Current Display** (need to verify):
- Project name
- Site name
- Trades assigned
- **❌ NO STATUS DISPLAY** (assumed)

#### 4. Dashboard/Reports
**Files**: Various dashboard components

**Impact**: May need status filtering

## Implementation Plan

### Phase 1: Database Schema Updates

#### Step 1.1: Expand Status Enum in project_assignments
```sql
-- Update constraint to include tendering statuses
ALTER TABLE project_assignments 
  DROP CONSTRAINT IF EXISTS project_assignments_status_check;

ALTER TABLE project_assignments
  ADD CONSTRAINT project_assignments_status_check 
  CHECK (status IN (
    'planned',           -- Identified, not started
    'tendering',         -- Out to tender
    'not_yet_tendered',  -- Will tender but not yet
    'active',            -- Currently on site (DEFAULT)
    'completed',         -- Work finished
    'cancelled',         -- Contract cancelled
    'on_hold'            -- Work paused
  ));
```

#### Step 1.2: Add Status to Legacy Table (Optional)
```sql
-- Option A: Add status to project_contractor_trades
ALTER TABLE project_contractor_trades
  ADD COLUMN status text DEFAULT 'active'
  CHECK (status IN ('planned', 'tendering', 'not_yet_tendered', 'active', 'completed', 'cancelled', 'on_hold'));

-- Option B: Migrate all data to project_assignments and deprecate legacy table
-- (More work but cleaner long-term)
```

#### Step 1.3: Add Status Update Timestamp
```sql
ALTER TABLE project_assignments
  ADD COLUMN status_updated_at timestamptz;

ALTER TABLE project_assignments
  ADD COLUMN status_updated_by uuid REFERENCES auth.users(id);

-- Create trigger to auto-update timestamp when status changes
CREATE OR REPLACE FUNCTION update_assignment_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.status IS DISTINCT FROM NEW.status) THEN
    NEW.status_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_assignment_status_timestamp
  BEFORE UPDATE ON project_assignments
  FOR EACH ROW
  EXECUTE FUNCTION update_assignment_status_timestamp();
```

### Phase 2: Scan Import Updates

#### Step 2.1: Add Status to Subcontractor Review
**File**: `src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`

**UI Changes**:
```typescript
// Add status column to table
<TableHead>Status</TableHead>

// Add status selection in row
<TableCell>
  <Select
    value={decision.status || 'active'}
    onValueChange={(status) => updateDecisionStatus(index, status)}
  >
    <SelectItem value="active">Active</SelectItem>
    <SelectItem value="completed">Completed</SelectItem>
    <SelectItem value="tendering">Tendering</SelectItem>
    <SelectItem value="not_yet_tendered">Not Yet Tendered</SelectItem>
    <SelectItem value="planned">Planned</SelectItem>
  </Select>
</TableCell>
```

**Default Logic**:
```typescript
// Auto-set status based on whether company name is filled
const defaultStatus = sub.company ? 'active' : 'not_yet_tendered'

return {
  ...sub,
  status: defaultStatus,  // User can change this
}
```

#### Step 2.2: Update API Import
**File**: `src/app/api/projects/[projectId]/import-scan/route.ts`

```typescript
// Include status in project_assignments insert
await serviceSupabase
  .from('project_assignments')
  .insert({
    ...existing fields,
    status: sub.status || 'active',
    status_updated_at: new Date().toISOString(),
    status_updated_by: user.id,
  })
```

### Phase 3: Mapping Sheet Display

#### Step 3.1: Update MappingSubcontractorsTable
**File**: `src/components/projects/mapping/MappingSubcontractorsTable.tsx`

**Add Status Column**:
```typescript
type Row = {
  ...existing fields,
  status?: 'planned' | 'tendering' | 'not_yet_tendered' | 'active' | 'completed' | 'cancelled' | 'on_hold';
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
}
```

**Display**:
```tsx
<TableCell>
  <StatusBadge 
    status={row.status || 'active'}
    updatedAt={row.statusUpdatedAt}
  />
</TableCell>
```

**Inline Editing**:
```tsx
<Select
  value={row.status}
  onValueChange={(status) => updateRowStatus(row, status)}
>
  <SelectItem value="active">🟢 Active</SelectItem>
  <SelectItem value="completed">✅ Completed</SelectItem>
  <SelectItem value="tendering">📋 Tendering</SelectItem>
  <SelectItem value="not_yet_tendered">📅 Not Yet Tendered</SelectItem>
</Select>
```

#### Step 3.2: Update useMappingSheetData Hook
**File**: `src/hooks/useMappingSheetData.ts`

```typescript
// Update query to include status fields
.select(`
  id,
  employer_id,
  status,                    // NEW
  status_updated_at,         // NEW
  status_updated_by,         // NEW
  ...existing fields
`)

// Update TradeContractor interface
export interface TradeContractor {
  ...existing fields,
  status?: string;           // NEW
  statusUpdatedAt?: string;  // NEW
  statusUpdatedBy?: string;  // NEW
}
```

### Phase 4: Employer Worksites Tab

#### Step 4.1: Add Status to Employer Card
**File**: `src/components/employers/EmployerWorkSitesTab.tsx` (to be confirmed)

**Display**:
```tsx
<Table>
  <TableHead>Project</TableHead>
  <TableHead>Site</TableHead>
  <TableHead>Trade</TableHead>
  <TableHead>Status</TableHead>  {/* NEW */}
  <TableHead>Updated</TableHead> {/* NEW */}
</Table>

<TableBody>
  {worksites.map(ws => (
    <TableRow>
      <TableCell>{ws.projectName}</TableCell>
      <TableCell>{ws.siteName}</TableCell>
      <TableCell>{ws.tradeLabel}</TableCell>
      <TableCell>
        <StatusBadge status={ws.status} />  {/* NEW */}
      </TableCell>
      <TableCell>
        {ws.statusUpdatedAt && formatDistanceToNow(ws.statusUpdatedAt)}
      </TableCell>
    </TableRow>
  ))}
</TableBody>
```

### Phase 5: Shared Components

#### Step 5.1: Create StatusBadge Component
**File**: `src/components/ui/StatusBadge.tsx` (new)

```typescript
export function StatusBadge({ 
  status, 
  showLabel = true,
  showDate = false,
  updatedAt 
}: StatusBadgeProps) {
  const config = {
    planned: { 
      color: 'bg-gray-100 text-gray-700',
      icon: '📅',
      label: 'Planned'
    },
    tendering: {
      color: 'bg-blue-100 text-blue-700',
      icon: '📋',
      label: 'Tendering'
    },
    not_yet_tendered: {
      color: 'bg-purple-100 text-purple-700',
      icon: '⏳',
      label: 'Not Yet Tendered'
    },
    active: {
      color: 'bg-green-100 text-green-700',
      icon: '🟢',
      label: 'Active'
    },
    completed: {
      color: 'bg-emerald-100 text-emerald-700',
      icon: '✅',
      label: 'Completed'
    },
    cancelled: {
      color: 'bg-red-100 text-red-700',
      icon: '❌',
      label: 'Cancelled'
    },
    on_hold: {
      color: 'bg-yellow-100 text-yellow-700',
      icon: '⏸️',
      label: 'On Hold'
    }
  }[status] || { color: 'bg-gray-100', icon: '?', label: 'Unknown' }
  
  return (
    <Badge className={config.color}>
      {config.icon} {showLabel && config.label}
      {showDate && updatedAt && (
        <span className="text-[10px] ml-1">
          ({formatDistanceToNow(updatedAt)})
        </span>
      )}
    </Badge>
  )
}
```

#### Step 5.2: Create StatusSelect Component
**File**: `src/components/ui/StatusSelect.tsx` (new)

```typescript
export function StatusSelect({
  value,
  onChange,
  disabled = false
}: StatusSelectProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="active">🟢 Active (on site now)</SelectItem>
        <SelectItem value="completed">✅ Completed (work done)</SelectItem>
        <SelectItem value="tendering">📋 Tendering (out to tender)</SelectItem>
        <SelectItem value="not_yet_tendered">⏳ Not Yet Tendered</SelectItem>
        <SelectItem value="planned">📅 Planned (contract signed)</SelectItem>
        <SelectItem value="on_hold">⏸️ On Hold</SelectItem>
        <SelectItem value="cancelled">❌ Cancelled</SelectItem>
      </SelectContent>
    </Select>
  )
}
```

## Risk Assessment

### 🔴 HIGH RISK

#### 1. Database Migration Complexity
**Risk**: `project_contractor_trades` table has **no status field**

**Options**:
- **A) Add column to legacy table** - Simpler, maintains dual-table system
- **B) Migrate all to project_assignments** - Cleaner, breaks legacy components
- **C) Read-only for legacy, write-only for new** - Phased transition

**Recommendation**: Option A (add column) for safety

**Impact**: 
- ~5000-10000 existing rows to migrate
- Need default status ('active' for most)
- Legacy components may break if they don't expect the column

#### 2. Dual Table System
**Risk**: Data written to BOTH tables in some places, ONE table in others

**Current State**:
- Scan imports → `project_assignments` only ✅
- Manual mapping sheet → `project_assignments` ✅
- StageTradeAssignmentManager → `project_contractor_trades` ❌ (legacy)

**Conflict Scenario**:
1. User adds trade via mapping sheet → goes to `project_assignments` with status
2. User views via StageTradeAssignmentManager → reads from `project_contractor_trades`
3. Status not visible in that view

**Mitigation**: Audit all write paths, ensure consistency

#### 3. Status Transition Logic
**Risk**: Invalid status transitions (e.g., 'completed' → 'tendering')

**Questions**:
- Can a completed trade go back to active?
- Can you cancel a tendering process?
- What happens when status changes - notify anyone?

**Recommendation**: 
- Allow all transitions (organizers know best)
- Track history in `updated_at` + `status_updated_by`
- Future: Add audit trail if needed

### 🟡 MEDIUM RISK

#### 4. UI Performance
**Risk**: Adding status column to already-wide mapping sheet table

**Current Columns**: 9 columns
- Stage, Trade, Current Employer, Scanned Company, Matched Employer, Action, EBA, Confidence, Actions

**With Status**: 11 columns
- + Status, Updated On

**Mitigation**:
- Make table horizontally scrollable (already is)
- Responsive design for mobile (collapse some columns)
- Consider two-row display on narrow screens

#### 5. Existing Data Defaults
**Risk**: 10,000 existing trade assignments with no status

**Migration**:
```sql
-- Set default status based on end_date
UPDATE project_assignments
SET status = CASE
  WHEN end_date < CURRENT_DATE THEN 'completed'
  WHEN start_date > CURRENT_DATE THEN 'planned'
  ELSE 'active'
END
WHERE status IS NULL;
```

**Considerations**:
- May incorrectly mark some as completed
- Need manual review of important projects
- Could add "needs_review" status for auto-migrated

#### 6. Filter/Search Impact
**Risk**: Existing filters may need updating

**Components That Filter Trades**:
- Dashboard stats (count active vs all)
- Project overview cards
- Employer worksite lists
- Reports/exports

**Recommendation**: Add status filters gradually

### 🟢 LOW RISK

#### 7. Backward Compatibility
**Risk**: Old code expects no status field

**Current State**: Status has DEFAULT value ('active')
- Old INSERT statements work (use default) ✅
- Old SELECT statements ignore column ✅
- Only queries explicitly using status need update

**Mitigation**: Graceful degradation

#### 8. Performance
**Risk**: Additional column slows queries

**Impact**: Minimal
- Status is indexed text field
- Adding one column doesn't significantly impact query time
- Timestamp adds ~8 bytes per row

## Upstream/Downstream Impact Analysis

### Upstream (Data Sources)

#### 1. Scan Imports ⚠️ HIGH IMPACT
**Current**: Auto-sets status to 'active' (default)

**Change Needed**:
- Add status selector in SubcontractorsReview UI
- Default logic: company filled = 'active', empty = 'not_yet_tendered'
- Pass status to API
- Store in database

**Files Modified**:
- `SubcontractorsReview.tsx` - Add status UI
- `ScanReviewContainer.tsx` - Pass status in decisions
- `import-scan/route.ts` - Insert status value
- `new-from-scan/route.ts` - Insert status value

#### 2. Manual Mapping Sheet Entry ⚠️ HIGH IMPACT
**Current**: No status selection

**Change Needed**:
- Add status dropdown when selecting employer
- Auto-set to 'active' when employer assigned
- Allow changing status after creation

**Files Modified**:
- `MappingSubcontractorsTable.tsx` - Add status column + editing

#### 3. BCI/CSV Imports ⚠️ MEDIUM IMPACT
**Current**: Bulk imports set all to 'active'

**Change Needed**:
- Could infer from dates (past end_date = completed)
- Or default all to 'active' (current behavior)

**Files Modified**:
- `BCIProjectImport.tsx` - Add status inference logic (optional)

### Downstream (Data Consumers)

#### 1. Mapping Sheets Tab ⚠️ HIGH IMPACT
**Component**: `MappingSubcontractorsTable.tsx`

**Changes Needed**:
- Add "Status" column to table
- Add status filtering (show active only, show all, etc.)
- Add inline status editing
- Show status update timestamp on hover

**Visual Mock**:
```
Stage | Trade    | Employer | Status      | Updated
─────────────────────────────────────────────────────
Early | Demo     | ABC Demo | ✅ Completed | 2 days ago
Early | Piling   | XYZ Pile | 🟢 Active   | 1 week ago
Early | Scaffold | No match | ⏳ Not Yet  | -
```

#### 2. Project Contractors Tab ⚠️ MEDIUM IMPACT
**Component**: `ContractorsSummary.tsx`

**Changes Needed**:
- Add status badge next to employer name
- Filter to show only active contractors (toggle)
- Show completion date when status = completed

#### 3. Employer Worksites Tab ⚠️ MEDIUM IMPACT
**Component**: `EmployerWorkSitesTab.tsx` (need to verify)

**Changes Needed**:
- Show status for each project assignment
- Filter to show only active projects
- Highlight completed projects differently

#### 4. Project Overview Cards 🟢 LOW IMPACT
**Component**: `ProjectCard.tsx`, `ProjectOverview.tsx`

**Changes Needed**:
- Could show "X active trades" instead of "X total trades"
- Minimal change, mostly visual

#### 5. Dashboard Stats ⚠️ MEDIUM IMPACT
**Components**: Various dashboard components

**Changes Needed**:
- Update queries to count only active assignments
- Or add new metrics (active vs total)
- May affect materialized views

**Example**:
```sql
-- Before
SELECT COUNT(*) FROM project_assignments

-- After  
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) FILTER (WHERE status = 'completed') as completed
FROM project_assignments
```

#### 6. Reports/Exports 🟢 LOW IMPACT
**Components**: CSV exports, PDF reports

**Changes Needed**:
- Include status column in exports
- Add status filters to report generation

## Data Integrity Considerations

### Automated Status Updates

#### Option 1: End Date Triggers
```sql
-- Auto-complete when end_date passes
CREATE OR REPLACE FUNCTION auto_complete_past_trades()
RETURNS void AS $$
BEGIN
  UPDATE project_assignments
  SET status = 'completed',
      status_updated_at = now()
  WHERE status = 'active'
    AND end_date < CURRENT_DATE
    AND end_date IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Run daily via cron or manual
```

**Pros**: Automatically maintains accuracy
**Cons**: May override manual status changes

**Recommendation**: Add but make opt-in per project

#### Option 2: Warning System
Instead of auto-updating, show warnings:
```tsx
{assignment.status === 'active' && isPastEndDate(assignment.endDate) && (
  <Alert variant="warning">
    ⚠️ End date passed - consider marking as Completed
  </Alert>
)}
```

### Status History Tracking

#### Option 1: Separate History Table (Recommended)
```sql
CREATE TABLE project_assignment_status_history (
  id uuid PRIMARY KEY,
  assignment_id uuid REFERENCES project_assignments(id),
  old_status text,
  new_status text,
  changed_by uuid REFERENCES auth.users(id),
  changed_at timestamptz DEFAULT now(),
  notes text
);
```

**Pros**: Complete audit trail
**Cons**: More storage, more complex queries

#### Option 2: JSONB History Column
```sql
ALTER TABLE project_assignments
  ADD COLUMN status_history jsonb DEFAULT '[]';

-- Structure: [
--   { status: 'active', timestamp: '2025-10-01', by: 'uuid' },
--   { status: 'completed', timestamp: '2025-10-15', by: 'uuid' }
-- ]
```

**Pros**: Simpler, keeps data together
**Cons**: Harder to query, less normalized

#### Option 3: Only Track Current (Simplest)
Just `status_updated_at` and `status_updated_by` (already planned)

**Pros**: Simple, covers most use cases
**Cons**: No historical tracking

**Recommendation**: Start with Option 3, add Option 1 if needed later

## Feature Comparison Matrix

| Feature | Current State | After Implementation |
|---------|---------------|---------------------|
| **Track trade status** | ❌ (field exists but unused) | ✅ Full UI support |
| **Status options** | 5 values (missing tendering) | 7 values (all requested) |
| **Scan import status** | Auto 'active' | User selectable with smart defaults |
| **Manual entry status** | Auto 'active' | User selectable dropdown |
| **Mapping sheet display** | No status shown | Status badge + updated timestamp |
| **Employer worksites** | No status shown | Status shown per project |
| **Status editing** | ❌ No UI | ✅ Inline dropdown edit |
| **Status history** | ❌ None | Timestamp + updated_by |
| **Filtering by status** | ❌ Not possible | ✅ Filter active/completed/all |
| **Auto-completion** | ❌ Manual only | Optional based on end_date |

## Recommended Implementation Sequence

### Sprint 1: Foundation (Low Risk, High Value)
1. ✅ Update database constraint to add 'tendering' and 'not_yet_tendered'
2. ✅ Add `status_updated_at` and `status_updated_by` columns
3. ✅ Create status update trigger
4. ✅ Migrate existing NULL statuses to 'active'
5. ✅ Create `StatusBadge` component
6. ✅ Create `StatusSelect` component

**Deliverable**: Database ready, shared components available

### Sprint 2: Scan Import (High Value)
1. ✅ Add status selection to `SubcontractorsReview.tsx`
2. ✅ Update scan import APIs to store status
3. ✅ Add smart defaults (filled = active, empty = not_yet_tendered)
4. ✅ Test full scan import flow with status

**Deliverable**: Scan imports capture status data

### Sprint 3: Display (High Value)
1. ✅ Add status column to `MappingSubcontractorsTable.tsx`
2. ✅ Update `useMappingSheetData` hook to fetch status
3. ✅ Add status editing UI to mapping sheet
4. ✅ Test status updates save correctly

**Deliverable**: Mapping sheets show and edit status

### Sprint 4: Employer View (Medium Value)
1. ✅ Add status to employer worksites tab
2. ✅ Add status filtering (active projects only)
3. ✅ Show last updated timestamp

**Deliverable**: Employers can see their project statuses

### Sprint 5: Reporting (Optional)
1. ✅ Add status filters to contractor summary
2. ✅ Update dashboard stats to count by status
3. ✅ Add status to CSV exports

**Deliverable**: Complete status tracking across all views

## Alternative Approaches Considered

### Approach A: Simple Text Field (Rejected)
**Idea**: Add free-text "notes" field for status

**Pros**: Flexible, no enum constraints
**Cons**: No standardization, can't filter/report

### Approach B: Separate Status Table (Rejected)
**Idea**: `trade_statuses` table with history

**Pros**: Full audit trail, flexible
**Cons**: Overly complex for MVP, performance impact

### Approach C: Use Existing Status + Notes (Rejected)
**Idea**: Keep current 5 statuses, add details in notes

**Pros**: No schema change
**Cons**: Doesn't meet user requirements (missing tendering states)

### Approach D: Status Enum + Timestamp (RECOMMENDED)
**Idea**: Expand existing status CHECK constraint, add updated_at

**Pros**: 
- Builds on existing architecture
- Minimal schema change
- Standardized values for reporting
- Simple to implement
- Easy to query and filter

**Cons**:
- Less flexible than free text
- Can't add custom statuses without migration

## Estimated Effort

### Development Time
- **Database migrations**: 2-4 hours
- **Shared components**: 2-3 hours
- **Scan import updates**: 3-4 hours
- **Mapping sheet updates**: 4-6 hours
- **Employer view updates**: 2-3 hours
- **Testing & polish**: 4-6 hours

**Total**: 17-26 hours (~3-5 days)

### Testing Time
- **Unit tests**: Each component (8-10 hours)
- **Integration tests**: Full flow (4-6 hours)
- **Manual testing**: All views (4-6 hours)
- **Edge cases**: Legacy data, migrations (4-6 hours)

**Total**: 20-28 hours (~4-5 days)

### Documentation
- **Migration guide**: 2 hours
- **User guide**: 2 hours
- **API documentation**: 2 hours

**Total**: 6 hours (~1 day)

**GRAND TOTAL**: 43-60 hours (~8-12 days with testing)

## Dependencies & Prerequisites

### Before Starting
1. ✅ Confirm all trade data uses `project_assignments` (or migrate)
2. ✅ Audit existing status values (are there any non-standard?)
3. ✅ Decide on legacy table strategy (Option A, B, or C)
4. ✅ Get user confirmation on status transition rules

### During Implementation
1. ✅ Deploy database changes to staging first
2. ✅ Test with real project data
3. ✅ Get organizer feedback on UI
4. ✅ Verify materialized views still work

### After Implementation
1. ✅ Train users on new status workflow
2. ✅ Monitor for data quality issues
3. ✅ Gather feedback for iteration 2

## Open Questions for User

1. **Legacy Table Strategy**: 
   - Add status column to `project_contractor_trades`? OR
   - Migrate all data to `project_assignments`?
   - **Recommended**: Add column for safety

2. **Default Status for Scans**:
   - Should empty companies be 'not_yet_tendered' or 'planned'?
   - Should filled companies always be 'active' or allow selection?
   - **Recommended**: Smart default but allow override

3. **Auto-Completion**:
   - Should trades auto-complete when end_date passes?
   - Or always require manual status updates?
   - **Recommended**: Manual only (organizers know reality)

4. **Status Visibility**:
   - Show status everywhere trades appear? OR
   - Only on mapping sheet + employer worksites?
   - **Recommended**: Everywhere for consistency

5. **Filtering Default**:
   - Should mapping sheet default to "active only" filter?
   - Or show all statuses by default?
   - **Recommended**: Show all, with easy toggle

6. **Tendering Details**:
   - Do you need to track WHO is tendering?
   - Or just the fact that it's out to tender?
   - **Recommended**: Just status for MVP

## Success Criteria

### Must Have
- ✅ Status field added to database with all requested values
- ✅ Status visible on mapping sheets with clear badges
- ✅ Status editable inline on mapping sheets
- ✅ Status captured during scan imports with smart defaults
- ✅ Status shown on employer worksites tab
- ✅ Last updated timestamp visible

### Should Have
- ✅ Status filtering (show active only, show all)
- ✅ Status transition history (who, when)
- ✅ Validation prevents invalid data
- ✅ Legacy data migrated with sensible defaults

### Nice to Have
- ⏳ Auto-completion based on dates (optional)
- ⏳ Notifications when status changes (future)
- ⏳ Bulk status updates (mark all as completed)
- ⏳ Status analytics (average time to completion)

## Conclusion

**Feasibility**: ✅ Highly feasible - infrastructure already exists

**Recommendation**: **PROCEED** with phased implementation

**Biggest Challenge**: Handling legacy `project_contractor_trades` table consistently

**Biggest Value**: Organizers get real-time visibility into project progression

**Timeline**: 2-3 weeks including testing

**Next Step**: Get user approval on:
1. Legacy table strategy
2. Default status rules
3. Auto-completion behavior

Then proceed with Sprint 1 (database foundation).

---

**Analysis Date**: October 19, 2025
**Analyst**: AI Assistant
**Status**: Ready for Implementation Approval


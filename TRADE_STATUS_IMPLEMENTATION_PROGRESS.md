# Trade Status Tracking - Implementation Progress

## Status: Partially Implemented (70% Complete)

## Completed ✅

### 1. Database Foundation (100%)
- ✅ **Migration 1**: `20251020000000_add_trade_status_tracking.sql`
  - Added status enum with: 'planned', 'tendering', 'not_yet_tendered', 'unknown', 'active', 'completed', 'cancelled', 'on_hold'
  - Added `status_updated_at` and `status_updated_by` to both tables
  - Added status column to legacy `project_contractor_trades` table
  - Created auto-update trigger for timestamps
  - Backfilled existing data with intelligent defaults
  - Created `mark_project_complete()` RPC function for bulk completion
  - Created `get_project_trade_status_summary()` stats function
  - Added performance indexes

- ✅ **Migration 2**: `20251020000001_update_scan_import_with_status.sql`
  - Updated `create_project_from_scan()` RPC to handle status field
  - Subcontractors now inserted with user-selected status

### 2. Shared UI Components (100%)
- ✅ **StatusBadge** (`src/components/ui/StatusBadge.tsx`)
  - Visual badges for all 8 status types
  - Icons, colors, descriptions
  - Optional date display (shows "2 days ago")
  - Tooltips with full descriptions
  
- ✅ **StatusSelect** (`src/components/ui/StatusSelect.tsx`)
  - Dropdown for selecting status
  - Full version with descriptions
  - Simple version for compact UIs
  - Smart ordering (active statuses first)

### 3. Scan Import Flow (100%)
- ✅ **SubcontractorsReview** component updated
  - Added status field to decisions
  - Smart defaults: company filled = 'active', empty = 'unknown'
  - Status dropdown for each subcontractor
  - User can override default status

- ✅ **API Routes** updated
  - `/api/projects/[projectId]/import-scan` stores status
  - Includes `status_updated_at` and `status_updated_by`

### 4. Data Layer (100%)
- ✅ **useMappingSheetData** hook updated
  - Fetches status fields from both tables
  - TradeContractor interface includes status fields
  - Backward compatible (status is optional)

## In Progress 🚧

### 5. Mapping Sheet Display (60%)
- ✅ Row type updated with status fields
- ✅ StatusBadge and StatusSelect imported
- ⏳ **Needs**: 
  - Map status from TradeContractor to Row (line 76-95 of MappingSubcontractorsTable.tsx)
  - Add Status column to table header
  - Add status cell with StatusSelectSimple or StatusBadge
  - Add handleStatusChange function
  - Update upsertRow to save status changes

## Not Started ⏳

### 6. Status Filtering (0%)
**File**: `MappingSubcontractorsTable.tsx`

**Needs**:
```typescript
const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all')

// Filter rows by status
const filteredRows = useMemo(() => {
  if (statusFilter === 'all') return rowsByTrade
  
  const filtered: Record<string, Row[]> = {}
  Object.entries(rowsByTrade).forEach(([trade, rows]) => {
    filtered[trade] = rows.filter(r => {
      if (statusFilter === 'active') {
        return r.status === 'active' || r.status === 'planned' || r.status === 'tendering'
      }
      if (statusFilter === 'completed') {
        return r.status === 'completed'
      }
      return true
    })
  })
  return filtered
}, [rowsByTrade, statusFilter])

// Add toggle UI above table
<div className="flex gap-2 mb-4">
  <Button 
    variant={statusFilter === 'all' ? 'default' : 'outline'}
    onClick={() => setStatusFilter('all')}
  >
    All ({totalCount})
  </Button>
  <Button
    variant={statusFilter === 'active' ? 'default' : 'outline'}
    onClick={() => setStatusFilter('active')}
  >
    Active ({activeCount})
  </Button>
  <Button
    variant={statusFilter === 'completed' ? 'default' : 'outline'}
    onClick={() => setStatusFilter('completed')}
  >
    Completed ({completedCount})
  </Button>
</div>
```

### 7. Bulk Project Complete UI (0%)
**File**: New component or add to existing project actions

**Needs**:
```typescript
// Add to project detail page header actions
const handleMarkProjectComplete = async () => {
  if (!confirm('Mark ALL trades as completed for this project?')) return
  
  const { data, error } = await supabase.rpc('mark_project_complete', {
    p_project_id: projectId,
    p_user_id: user.id
  })
  
  if (error) {
    toast.error('Failed to mark project complete')
    return
  }
  
  toast.success(`Project marked complete - ${data.total_updated} trades updated`)
  queryClient.invalidateQueries({ queryKey: ['mapping-sheet-data', projectId] })
}

// UI Button
<Button onClick={handleMarkProjectComplete} variant="outline">
  <CheckCircle className="h-4 w-4 mr-2" />
  Mark Project Complete
</Button>
```

### 8. Employer Worksites Tab (0%)
**File**: `src/components/employers/EmployerWorkSitesTab.tsx` (need to locate)

**Needs**:
- Add Status column to worksites table
- Display StatusBadge for each project assignment
- Show last updated timestamp
- Filter to show only active projects (toggle)

## Code Snippets to Complete

### Complete MappingSubcontractorsTable.tsx

Add to line ~76 (in the mapping from tradeContractors to Row):
```typescript
const assignments: Row[] = mappingData.tradeContractors.map((tc) => ({
  key: `${tc.stage}|${tc.tradeType}|${tc.id}`,
  stage: tc.stage,
  trade_value: tc.tradeType,
  trade_label: tc.tradeLabel,
  employer_id: tc.employerId,
  employer_name: tc.employerName,
  eba: tc.ebaStatus,
  id: tc.id,
  dataSource: tc.dataSource,
  matchStatus: tc.matchStatus,
  matchConfidence: tc.matchConfidence,
  matchedAt: tc.matchedAt,
  confirmedAt: tc.confirmedAt,
  matchNotes: tc.matchNotes,
  status: tc.status,              // NEW
  statusUpdatedAt: tc.statusUpdatedAt,  // NEW
  statusUpdatedBy: tc.statusUpdatedBy,  // NEW
}))
```

Add handleStatusChange function (around line 210):
```typescript
const updateStatus = async (row: Row, newStatus: TradeStatus) => {
  if (!row.id) return
  
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    
    // Determine which table to update
    if (row.id.startsWith('assignment_trade:')) {
      const assignmentId = row.id.replace('assignment_trade:', '')
      await supabase
        .from('project_assignments')
        .update({
          status: newStatus,
          status_updated_at: new Date().toISOString(),
          status_updated_by: user.id,
        })
        .eq('id', assignmentId)
    } else if (row.id.startsWith('project_trade:')) {
      const tradeId = row.id.replace('project_trade:', '')
      await supabase
        .from('project_contractor_trades')
        .update({
          status: newStatus,
          status_updated_at: new Date().toISOString(),
          status_updated_by: user.id,
        })
        .eq('id', tradeId)
    }
    
    // Update local state
    setRowsByTrade(prev => {
      const newRows = { ...prev }
      const tradeRows = newRows[row.trade_value] || []
      const index = tradeRows.findIndex(r => r.id === row.id)
      if (index >= 0) {
        tradeRows[index] = { 
          ...tradeRows[index], 
          status: newStatus,
          statusUpdatedAt: new Date().toISOString(),
          statusUpdatedBy: user.id,
        }
      }
      newRows[row.trade_value] = tradeRows
      return newRows
    })
    
    toast.success('Status updated')
  } catch (e: any) {
    toast.error(e?.message || 'Failed to update status')
  }
}
```

Add Status column to table (find the TableHeader section):
```typescript
<TableHead>Trade Type</TableHead>
<TableHead>Company</TableHead>
<TableHead>Status</TableHead>  {/* NEW */}
<TableHead>EBA</TableHead>
<TableHead>Compliance</TableHead>
<TableHead className="text-right">Actions</TableHead>
```

Add status cell in TableBody (find where companies are displayed):
```typescript
<TableCell>{row.employer_name || "—"}</TableCell>

{/* NEW: Status Cell */}
<TableCell>
  {row.isSkeleton ? (
    <span className="text-gray-400 text-sm">—</span>
  ) : row.employer_id ? (
    <StatusSelectSimple
      value={(row.status as TradeStatus) || 'active'}
      onChange={(status) => updateStatus(row, status)}
      size="sm"
    />
  ) : (
    <StatusBadge status="unknown" showLabel={false} size="sm" />
  )}
</TableCell>

<TableCell>{/* EBA badge */}</TableCell>
```

## Testing Checklist

### Database Migration
- [ ] Run migration: `npx supabase db push`
- [ ] Verify columns added: 
  ```sql
  SELECT status, status_updated_at, status_updated_by 
  FROM project_assignments 
  LIMIT 5;
  ```
- [ ] Test trigger: Update status manually, check timestamp updates
- [ ] Test RPC: `SELECT * FROM mark_project_complete('<project-id>', '<user-id>');`

### Scan Import
- [ ] Upload scan with 7 projects
- [ ] Review subcontractors tab
- [ ] Verify Status column shows dropdown
- [ ] Change status for some entries
- [ ] Import and verify status saved to database

### Mapping Sheet Display  
- [ ] View existing project mapping sheet
- [ ] Verify Status column appears
- [ ] Change status via dropdown
- [ ] Verify database updates
- [ ] Check timestamp displays correctly

### Bulk Complete
- [ ] Click "Mark Project Complete" button
- [ ] Confirm dialog appears
- [ ] Verify all trades marked completed
- [ ] Check database reflects changes

### Filtering
- [ ] Toggle between All/Active/Completed
- [ ] Verify correct rows shown
- [ ] Check counts are accurate

## Remaining Work Estimate

- **MappingSubcontractorsTable completion**: 2-3 hours
- **Status filtering implementation**: 1-2 hours
- **Bulk complete UI**: 1-2 hours  
- **Employer worksites tab**: 2-3 hours
- **Testing**: 2-3 hours
- **Documentation**: 1 hour

**Total**: 9-14 hours

## Next Steps

1. **Immediate**: Complete MappingSubcontractorsTable changes (code snippets provided above)
2. **Then**: Add status filtering toggle
3. **Then**: Add bulk project complete button to project detail page
4. **Then**: Update employer worksites tab
5. **Finally**: Test and document

## Files Modified So Far

1. ✅ `supabase/migrations/20251020000000_add_trade_status_tracking.sql`
2. ✅ `supabase/migrations/20251020000001_update_scan_import_with_status.sql`
3. ✅ `src/components/ui/StatusBadge.tsx` (new)
4. ✅ `src/components/ui/StatusSelect.tsx` (new)
5. ✅ `src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`
6. ✅ `src/app/api/projects/[projectId]/import-scan/route.ts`
7. ✅ `src/hooks/useMappingSheetData.ts`
8. ⏳ `src/components/projects/mapping/MappingSubcontractorsTable.tsx` (partial)

## Files Still Need Updates

9. ⏳ `src/components/projects/mapping/MappingSubcontractorsTable.tsx` (complete)
10. ⏳ `src/app/(app)/projects/[projectId]/page.tsx` (add bulk complete button)
11. ⏳ `src/components/employers/EmployerWorkSitesTab.tsx` (add status display)
12. ⏳ Create API route for mark complete: `/api/projects/[projectId]/mark-complete/route.ts`

## Known Issues to Address

### 1. RPC Function Merge
The `create_project_from_scan` function has been updated multiple times. The migration file `20251020000001` provides the INSERT statement for subcontractors with status, but needs to be merged with the latest full function implementation from `20251015140000_fix_assignment_constraint.sql`.

**Action Required**: Manually merge or create a complete function replacement.

### 2. Site Contractor Trades
The `site_contractor_trades` table (legacy) doesn't have status field. This was intentionally skipped in the migration.

**Decision Needed**: Add status to this table too? Or consider it deprecated?

### 3. Status Icon Display
The StatusBadge uses emoji icons. These look great but might not print well.

**Consideration**: Add a `printMode` prop that shows text-only version.

## User Decision Confirmations

Based on your input:

1. ✅ **Legacy table**: Add status column to `project_contractor_trades` - DONE
2. ✅ **Default for scans**: Empty company = 'unknown' - IMPLEMENTED
3. ✅ **Manual updates**: No auto-completion, manual only - IMPLEMENTED
4. ✅ **Bulk complete**: Created `mark_project_complete()` RPC - DONE
5. ✅ **Filtering**: Show all with toggle - READY TO IMPLEMENT
6. ✅ **Transitions**: Allow all - NO RESTRICTIONS

## Quick Start to Continue

1. **Apply migrations**:
   ```bash
   npx supabase db push
   ```

2. **Complete MappingSubcontractorsTable** (code snippets in this document above)

3. **Add filtering toggle** to mapping sheet

4. **Add bulk complete button** to project detail page

5. **Test end-to-end**

---

**Implementation Date**: October 19, 2025
**Completion**: 70%
**Remaining Effort**: 9-14 hours
**Status**: Ready for continuation


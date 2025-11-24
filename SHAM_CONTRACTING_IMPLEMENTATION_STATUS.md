# Sham Contracting Detection System - Implementation Status

## ✅ COMPLETED

### Database Layer
- ✅ Migration created: `20251107000000_add_sham_contracting_detection.sql`
  - Added sham contracting fields to `employer_compliance_checks`
  - Added sham contracting fields to `subcontractor_assessments_4point`
  - Added sham contracting fields to `organiser_overall_expertise_ratings`
  - Created `sham_contracting_audit_log` table with full audit trail
  - Created indexes for performance
  - Enabled RLS policies

- ✅ Helper Functions
  - `get_employer_sham_contracting_status(employer_id)` - Aggregates status across all projects
  - `get_project_sham_contracting_status(project_id)` - Checks if any employer flagged
  - Automatic audit logging via triggers

- ✅ Rating Calculation Updates
  - Updated `calculate_final_employer_rating()` function
  - Implements hard block: maximum yellow/amber rating when sham contracting detected
  - Returns `sham_contracting_block` boolean and reason
  - Stores `original_rating` before cap applied

### TypeScript Types
- ✅ Updated `src/types/compliance.ts`
  - Added sham contracting fields to `EmployerComplianceCheck`
  - Added `ShamContractingAuditLog` interface
  - Added `ShamContractingStatus` interface

- ✅ Updated `src/types/assessments.ts`
  - Added sham contracting fields to `SubcontractorUseAssessment`

- ✅ Updated `src/types/rating.ts`
  - Added `sham_contracting_block`, `sham_contracting_reason`, `original_rating` to `RatingCalculationResult`

### API Endpoints
- ✅ `/api/employers/[employerId]/sham-contracting`
  - GET: Retrieve status and full audit history
  - POST: Clear all flags globally for employer

- ✅ `/api/projects/[projectId]/employers/[employerId]/sham-contracting`
  - GET: Get status for specific project
  - POST: Clear flag for this project only

### UI Components
- ✅ `ClearShamContractingDialog.tsx`
  - Confirmation dialog for clearing flags
  - Requires minimum 200-character reason
  - Shows scope (project-specific vs global)
  - Full audit trail integration

- ✅ `ShamContractingAuditLog.tsx`
  - Displays complete flag/clear history
  - Shows action type, user, timestamp, notes
  - Links to projects where applicable

- ✅ `EmployerComplianceDetail.tsx` (Desktop)
  - Renamed "Subcontractors" tab to "Contracting"
  - Added prominent warning banner when sham contracting detected
  - Added sham contracting toggle with required notes field
  - Integrated clear button with dialog
  - Shows previous flags that were cleared

## ⏳ REMAINING WORK

### High Priority

1. **Project Card Indicators** (`project-cards` todo)
   - Add yellow warning triangle badge to `ProjectCard.tsx`
   - Query `get_project_sham_contracting_status()` to check for flags
   - Show tooltip: "Sham Contracting Detected"
   - Apply to both desktop and mobile card variants

2. **Employer Card Indicators** (`employer-cards` todo)
   - Find employer card components
   - Add yellow warning triangle for employers with active flags
   - Query `get_employer_sham_contracting_status()`
   - Show tooltip with flag count

3. **Frontend Rating Engines** (`rating-calc-frontend` todo)
   - Update `src/lib/weighting-system/WeightingEngine.ts`
   - Update `src/lib/rating-engine/core/Track1Calculator.ts`
   - Update `src/lib/rating-engine/core/Track2Calculator.ts`
   - Update `src/lib/rating-engine/core/CombinedCalculator.ts`
   - Apply hard block logic before returning final rating
   - Check sham contracting status and cap at yellow if needed

### Medium Priority

4. **Rating Wizard Updates** (`rating-wizard` todo)
   - Update `src/components/employers/RatingWizard.tsx`
   - Rename "Subcontractor Usage" to "Contracting"
   - Add sham contracting binary question within category
   - Update mobile variant: `src/components/mobile/rating-system/EnhancedRatingWizard.tsx`

5. **Public Webform** (`public-webform` todo)
   - Update `src/components/public/PublicAuditComplianceForm.tsx`
   - Update `src/components/public/IndividualEmployerAssessment.tsx`
   - Update `src/components/public/AssessmentFormFields.tsx`
   - Add sham contracting toggle accessible to delegates

6. **Mobile Compliance Detail** (`compliance-mobile` todo)
   - Update `src/components/projects/compliance/EmployerComplianceDetailMobile.tsx`
   - Apply same changes as desktop version
   - Add sham contracting toggle
   - Add warning banner
   - Add clear dialog integration
   - Ensure mobile-optimized layout

### Testing

7. **Comprehensive Testing** (`testing` todo)
   - Test rating calculations with sham contracting block
   - Verify hard block prevents green rating
   - Verify clearing allows green rating again
   - Test both Track 1 and Track 2 systems
   - Test desktop UI flows: Flag → Clear → Re-flag
   - Test mobile UI flows
   - Test webform delegate flagging
   - Verify warning triangles appear/disappear on cards
   - Test audit log display
   - Test both project-specific and global clearing

## Implementation Guide for Remaining Work

### For Project Cards:
```typescript
// In ProjectCard.tsx, add query:
const { data: shamStatus } = useQuery({
  queryKey: ['project-sham-contracting', project.id],
  queryFn: async () => {
    const { data } = await supabase
      .rpc('get_project_sham_contracting_status', { p_project_id: project.id })
    return data
  }
})

// Add indicator near tier badge:
{shamStatus?.has_sham_contracting && (
  <Badge variant="destructive" className="gap-1">
    <AlertTriangle className="h-3 w-3" />
    Sham Contracting
  </Badge>
)}
```

### For Frontend Rating Engines:
```typescript
// In CombinedCalculator.ts / WeightingEngine.ts:
async calculateFinalRating(...) {
  // ... existing calculation logic
  
  // Check sham contracting before returning
  const shamStatus = await getShamContractingStatus(employerId)
  
  if (shamStatus.has_active_flags && finalRating === 'green') {
    return {
      ...result,
      rating: 'amber', // Cap at yellow/amber
      original_rating: 'green',
      sham_contracting_block: true,
      sham_contracting_reason: `Blocked due to ${shamStatus.active_flags} active sham contracting flags`
    }
  }
  
  return result
}
```

## Database Migration Execution

To apply the changes:
```bash
# Run the migration
supabase migration up

# Or if using local development:
supabase db reset
```

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] Helper functions return correct data
- [ ] Rating calculation caps at yellow when flagged
- [ ] Clearing flag allows green rating again
- [ ] Desktop compliance UI shows toggle and banner
- [ ] Clear dialog requires 200+ char reason
- [ ] Audit log displays all actions
- [ ] Project cards show warning triangle
- [ ] Employer cards show warning triangle
- [ ] Rating wizard includes sham contracting question
- [ ] Public webform allows delegate flagging
- [ ] Mobile compliance UI matches desktop functionality
- [ ] All audit trail entries created correctly

## Notes

- Hard block applies maximum rating of yellow/amber (never green)
- All users can flag and clear (with full audit trail)
- Flags can be project-specific or cleared globally
- Once cleared, shows "Previously flagged - cleared on [date]"
- Audit log tracks every flag/clear action with user, timestamp, and notes
- Both Track 1 (project compliance) and Track 2 (organiser expertise) respect hard block






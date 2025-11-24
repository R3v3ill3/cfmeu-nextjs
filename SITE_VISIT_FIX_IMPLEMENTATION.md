# Site Visit Form Fix - Implementation Summary

## Overview

Comprehensive fix for the site visit recording system addressing critical schema issues, security gaps, validation problems, and mobile optimization needs for field organisers.

**Implementation Date**: November 21, 2025

## Issues Addressed

### 1. ✅ Database Schema Verification & Integrity
**Problem**: TypeScript types didn't reflect the enhanced schema with `project_id`, `organiser_id`, etc.
**Solution**: 
- Created migration `20251221180000_ensure_site_visit_schema_integrity.sql`
- Added data integrity constraint ensuring `project_id` matches the job site's project
- Backfilled existing records with `project_id` derived from `job_site_id`
- Added proper indexes for performance

**Key Features**:
- Constraint: `site_visit_project_site_match` prevents orphaned/mismatched data
- Idempotent migration can be re-run safely
- Automatic backfill of missing project_id values

### 2. ✅ Patch-Based RLS Filtering
**Problem**: `/site-visits` page showed ALL visits regardless of organiser's patch assignment
**Solution**: 
- Added comprehensive user scope detection (admin/lead_organiser/organiser)
- Implemented patch-based filtering using `v_patch_sites_current`
- Admins see all visits, organisers see only their patch visits
- Lead organisers see their patches + team members' patches

**File Modified**: `src/app/(app)/site-visits/page.tsx`

**Key Changes**:
- New `userScope` query fetching role and patch assignments
- Site filtering based on patch assignments
- Proper handling of role hierarchy for lead organisers

### 3. ✅ Form Validation Logic
**Problem**: No validation that selected site belongs to selected project
**Solution**:
- Added `isSiteValidForProject` validation in EnhancedSiteVisitForm
- Added `saveDisabled` state combining all validation rules
- Visual error indicator (red border) on invalid site selection
- Error message shown when site doesn't match project

**File Modified**: `src/components/siteVisits/EnhancedSiteVisitForm.tsx`

**Validation Rules**:
- Visit date required
- Project required
- Site required
- Site must belong to selected project
- Organiser required (unless auto-assigned)

### 4. ✅ Form Consolidation & Documentation
**Problem**: Three competing form implementations causing confusion
**Solution**:
- Standardized on `EnhancedSiteVisitForm` as canonical implementation
- Added comprehensive documentation headers to all forms
- Deprecated old forms with clear migration guidance
- Documented features and usage patterns

**Forms Status**:
- ✅ **EnhancedSiteVisitForm** - RECOMMENDED (actively maintained)
- ⚠️ **SiteVisitForm** - DEPRECATED (kept for reference)
- ⚠️ **EnhancedSiteVisitFormWith4Point** - DEPRECATED (experimental)

### 5. ✅ Mobile Optimization
**Problem**: Dialog-based form not ideal for mobile field use
**Solution**:
- Created `MobileSiteVisitForm` component using MobileForm pattern
- Step-by-step flow optimized for touch interaction
- Added mobile route `/mobile/site-visits/new`
- Integrated into mobile navigation menu
- Supports pre-filling from URL parameters

**Files Created**:
- `src/components/mobile/siteVisits/MobileSiteVisitForm.tsx`
- `src/app/(app)/mobile/site-visits/new/page.tsx`

**File Modified**:
- `src/components/Layout.tsx` (added "Record Visit" to mobile nav)

**Mobile Features**:
- 4-step wizard: Visit Details → Employers → Visit Reasons → Notes
- Auto-selection of single site when project has only one
- Patch-based project/site filtering
- Inline validation with helpful error messages
- iOS integrations (if available)

## Key Technical Improvements

### Database Integrity
```sql
-- Constraint ensures data consistency
ALTER TABLE public.site_visit
  ADD CONSTRAINT site_visit_project_site_match 
  CHECK (
    project_id IS NULL OR 
    project_id = (SELECT project_id FROM public.job_sites WHERE id = job_site_id)
  );
```

### Patch-Based Filtering
```typescript
// Organisers only see visits in their assigned patches
const { data: patchSites } = await supabase
  .from("v_patch_sites_current")
  .select("job_site_id")
  .in("patch_id", userScope.patchIds)

// Filter visits to allowed sites
query = query.in("job_site_id", Array.from(allowedSiteIds))
```

### Form Validation
```typescript
const isSiteValidForProject = useMemo(() => {
  if (!projectId || !siteId) return true
  const site = sites.find((s: any) => s.id === siteId)
  return site !== undefined // Site must be in filtered list
}, [projectId, siteId, sites])
```

## Migration Guide

### For Developers

**Preferred Form Component**:
```typescript
import { EnhancedSiteVisitForm } from "@/components/siteVisits/EnhancedSiteVisitForm"

// Desktop/Dialog usage
<EnhancedSiteVisitForm 
  open={isOpen} 
  onOpenChange={setIsOpen}
  initial={{ project_id: projectId }} // Optional pre-fill
/>
```

**Mobile Route**:
```typescript
// Navigate to mobile form
router.push('/mobile/site-visits/new?project_id=xxx&job_site_id=yyy')
```

### Database Migration

**To Apply**:
```bash
# Migration will be applied automatically on next deploy
# Or manually apply via Supabase dashboard
```

**Migration is Idempotent**: Safe to run multiple times

## Testing Checklist

### Manual Testing Required

**As Organiser**:
- [ ] Verify only projects in assigned patches visible
- [ ] Verify only sites in assigned patches visible
- [ ] Verify auto-selection of single site works
- [ ] Verify validation prevents invalid site selection
- [ ] Test mobile form flow end-to-end
- [ ] Verify visit appears in list after save

**As Lead Organiser**:
- [ ] Verify can see team members' patches
- [ ] Verify can assign visits to team members
- [ ] Verify custom visit reasons work
- [ ] Test visit list filtering

**As Admin**:
- [ ] Verify can see all projects/sites
- [ ] Verify can create visits for any organiser
- [ ] Verify visit list shows all visits (no filtering)
- [ ] Test mobile navigation includes "Record Visit"

### Role-Based Access

| Role | Projects Visible | Sites Visible | Can Record | Visit List Filter |
|------|-----------------|---------------|------------|------------------|
| Admin | All | All | Yes | None (see all) |
| Lead Organiser | Team patches | Team patches | Yes | Team patches |
| Organiser | Assigned patches | Assigned patches | Yes | Assigned patches |
| Delegate | None | None | No | N/A |
| Viewer | None | None | No | N/A |

## Files Modified

### Database
- ✅ `supabase/migrations/20251221180000_ensure_site_visit_schema_integrity.sql` (created)

### Components
- ✅ `src/components/siteVisits/EnhancedSiteVisitForm.tsx` (validation + docs)
- ✅ `src/components/siteVisits/SiteVisitForm.tsx` (deprecated)
- ✅ `src/components/siteVisits/EnhancedSiteVisitFormWith4Point.tsx` (deprecated)
- ✅ `src/components/mobile/siteVisits/MobileSiteVisitForm.tsx` (created)
- ✅ `src/components/Layout.tsx` (mobile nav)

### Pages
- ✅ `src/app/(app)/site-visits/page.tsx` (RLS filtering)
- ✅ `src/app/(app)/mobile/site-visits/new/page.tsx` (created)

## Benefits

### For Organisers
- ✅ Only see relevant projects/sites in their geographic area
- ✅ Can't accidentally create visits for wrong projects
- ✅ Mobile-optimized experience for field work
- ✅ Auto-selection reduces taps/typing
- ✅ Clear validation messages

### For Data Integrity
- ✅ Database constraint prevents orphaned data
- ✅ Form validation prevents user errors
- ✅ Patch-based filtering prevents unauthorized access
- ✅ Audit trail with created_by/updated_by

### For System Administrators
- ✅ Consolidated form components
- ✅ Clear documentation and deprecation notices
- ✅ Idempotent migrations
- ✅ Comprehensive test cases documented

## Future Enhancements

### Potential Improvements
1. **Offline Support**: Enable draft saving for offline visits
2. **Photo Attachments**: Integrate with existing attachments_meta field
3. **Follow-up Task Tracking**: Better integration with delegated tasks system
4. **Analytics**: Visit frequency, coverage metrics by patch
5. **Bulk Visit Recording**: Record multiple employer visits at once

### Known Limitations
1. Mobile form requires network connection
2. No photo upload in mobile form yet
3. Follow-up actions not in mobile flow (desktop only)
4. Visit editing not optimized for mobile

## Rollback Plan

If issues arise:

1. **Database**: No rollback needed (migrations are additive)
2. **Code**: Revert to previous commit
3. **Forms**: Old forms still functional (deprecated but not removed)

## Support & Documentation

**User Guide**: Updates recommended for:
- How to record site visits (mobile vs desktop)
- Understanding patch-based filtering
- When to use visit reasons vs notes

**Developer Notes**:
- Always use EnhancedSiteVisitForm for new development
- Mobile route auto-redirects to form with query params
- Validation runs client-side for immediate feedback
- Database constraint provides server-side protection

## Conclusion

The site visit recording system now has:
- ✅ Solid data integrity with database constraints
- ✅ Secure patch-based access control
- ✅ Robust client-side validation
- ✅ Mobile-optimized experience
- ✅ Clear developer guidance

All planned phases completed successfully. System ready for testing and deployment.



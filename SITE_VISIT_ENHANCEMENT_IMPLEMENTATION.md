# Site Visit Enhancement - Implementation Summary

## Overview

This document summarizes the implementation of the comprehensive site visit tracking and reporting enhancement for the CFMEU Next.js application. The enhancement transforms the basic site visit system into a full-featured tracking tool with customizable visit reasons, follow-up actions, geo-awareness, and rich reporting.

## Implementation Date

October 15, 2025

## What Was Implemented

### Phase 1: Database Schema Enhancement ✅

#### 1.1 Enhanced `site_visit` Table
**Migration**: `supabase/migrations/20251016170000_enhance_site_visits.sql`

Added columns:
- `date` (timestamptz) - Visit date/time
- `organiser_id` (uuid) - Organiser who conducted the visit
- `project_id` (uuid) - Associated project
- `notes` (text) - General visit notes
- `actions_taken` (text) - Legacy actions field (kept for backwards compatibility)
- `visit_status` (enum: 'draft', 'completed', 'scheduled') - Visit workflow status
- `offline_created` (boolean) - Flag for offline-created visits
- `synced_at` (timestamptz) - Timestamp of sync from offline
- `created_by`, `updated_by` (uuid) - User tracking
- `attachments_meta` (jsonb) - Photo/file metadata

#### 1.2 New Tables Created

**`site_visit_reason_definitions`**
- Stores global and custom visit reasons
- Lead organisers can create custom reasons for their team
- Fields: `name`, `display_name`, `description`, `is_global`, `created_by_lead_organiser_id`, `is_active`, `display_order`, `always_visible`
- Seeded with 8 global reasons: compliance_audit, delegate_election, eba_vote, safety_issue, employer_meeting, delegate_1on1, site_meeting, general_visit

**`site_visit_reasons`**
- Junction table linking visits to reason definitions
- Supports multiple reasons per visit
- Optional reason-specific notes

**`site_visit_follow_ups`**
- Follow-up actions from site visits
- Three types: checklist_item, linked_activity, calendar_event
- Fields: `description`, `follow_up_type`, `is_completed`, `completed_at`, `due_date`, `linked_activity_id`, `calendar_event_details`

**`v_organiser_lead_assignments`**
- View for active organiser → lead_organiser relationships
- Used to determine which custom reasons to show

#### 1.3 Row Level Security (RLS)
- All authenticated users can view and create site visits
- Creators, assigned organisers, lead_organisers, and admins can edit/delete
- Lead organisers can create/manage custom visit reasons
- Comprehensive RLS policies for all new tables

### Phase 2: Analytics Views & Reporting ✅

**Migration**: `supabase/migrations/20251016170100_site_visit_analytics.sql`

Created analytical views:

1. **`v_project_last_visit`**
   - Last visit date per project
   - Total visits count
   - Unique organisers count

2. **`v_project_visit_frequency`**
   - Visits in last 3, 6, and 12 months per project
   - Draft vs completed visit counts

3. **`v_employer_last_visit`**
   - Visit tracking for employers across all projects

4. **`v_job_site_last_visit`**
   - Visit tracking for individual job sites

5. **`v_patch_visit_coverage`**
   - Coverage statistics per patch
   - Percentage of projects visited in different time periods
   - Identifies never-visited projects

6. **`v_lead_organiser_visit_summary`**
   - Visit coverage summary for lead organisers
   - Team performance metrics

7. **`v_visit_reasons_summary`**
   - Usage statistics for visit reasons

Created helper function:
- **`get_visit_recency_color(timestamptz)`** - Returns color code for visit recency badges

### Phase 3: UI Components ✅

#### 3.1 Core Components

**`LastVisitBadge.tsx`**
- Color-coded badge showing visit recency
- Never visited (grey), >12mo (red), 6-12mo (orange), 3-6mo (light green), <3mo (bright green)
- Shows "X days/months/years ago" text
- Compact and default variants

**`EnhancedSiteVisitForm.tsx`**
- Comprehensive site visit recording form
- Features:
  - Basic visit details (date, organiser, project, site, employers)
  - Multiple visit reasons with checkboxes (always visible + "show more")
  - Reason-specific notes
  - General visit notes
  - Follow-up actions with due dates
  - Calendar event export (.ics file generation)
  - Context-aware quick links (Mapping Sheet, Audit & Compliance, EBA Search)
  - Draft vs Complete visit options
  - Responsive design with scroll area

**`VisitCoverageCard.tsx`**
- Dashboard card showing visit coverage statistics
- Displays coverage percentage for 3, 6, 12 month periods
- Patch view and Lead organiser view variants
- Highlights never-visited projects
- Shows team metrics for lead organisers

**`GeofencingSetup.tsx`**
- UI for enabling/disabling geofencing
- Permission status display
- Nearby sites indicator
- Last notification info
- Privacy and usage information

#### 3.2 Pages

**`/app/(app)/lead-console/site-visit-reasons/page.tsx`**
- Lead organiser setup page for custom visit reasons
- Create, edit, deactivate custom reasons
- Set display order and visibility
- Preview of global reasons
- Drag/drop ordering with up/down buttons

### Phase 4: Custom Hooks ✅

**`useSiteVisitReasons.ts`**
- `useSiteVisitReasonDefinitions(organiserId)` - Fetch available reasons for an organiser
- `useLeadOrganiserCustomReasons(leadOrganiserId)` - Fetch custom reasons created by a lead
- `useCreateSiteVisitReason()` - Create new custom reason
- `useUpdateSiteVisitReason()` - Update existing custom reason
- `useDeleteSiteVisitReason()` - Soft delete (deactivate) custom reason

**`useProjectVisitStats.ts`**
- `useProjectLastVisit(projectId)` - Last visit stats for a project
- `useProjectVisitFrequency(projectId)` - Visit frequency breakdown
- `usePatchVisitCoverage(patchId)` - Patch-level coverage stats
- `useLeadOrganiserVisitSummary(leadOrganiserId)` - Lead team performance
- `useAllPatchesVisitCoverage()` - All patches coverage data

**`useGeofencing.ts`**
- Geolocation and notification management
- Haversine distance calculation
- Geofence radius check (100m)
- Notification cooldown (1 hour per site)
- Permission management
- Position watching with battery optimization

### Phase 5: Features Implemented

#### ✅ Multiple Visit Reasons
- Checkboxes for predefined and custom reasons
- Reason-specific notes
- "Show more reasons" collapsible section
- Always visible vs. hidden-by-default reasons

#### ✅ Follow-up Actions
- Add unlimited follow-up actions
- Optional due dates
- Generate calendar events (.ics file download)
- Future: Link to union activities (structure in place)

#### ✅ Context-Aware Navigation
- Quick links from visit form to:
  - Project Mapping Sheet
  - Audit & Compliance tab
  - EBA Search tab
- Links auto-populate based on selected project

#### ✅ Draft Support
- "Save Draft" vs "Complete Visit" buttons
- Draft visits tracked separately in analytics
- Can resume editing drafts later

#### ✅ Geofencing & Notifications
- Browser-based geolocation
- 100m radius geofence
- Browser notifications when near job sites
- 1-hour cooldown per site
- Tap notification to open pre-filled visit form
- Foreground-only (requires app to be open)
- Privacy-focused (no server-side location tracking)

#### ✅ Historical Reporting
- Color-coded visit recency badges
- Visit frequency analytics (3, 6, 12 month periods)
- Coverage percentage tracking
- Never-visited project identification
- Lead organiser team performance metrics
- Patch-level coverage dashboard

#### ✅ Lead Organiser Custom Reasons
- Create custom visit reasons for team
- Set visibility and display order
- Activate/deactivate reasons
- Preview how reasons appear to organisers

### Phase 6: Integration Points

The following integration points have been prepared but require updates to existing components:

#### To Integrate

1. **Project Cards** - Add `<LastVisitBadge projectId={project.id} variant="compact" />` to card footers
2. **Project List Views** - Add "Last Visit" column with badge
3. **Mapping Sheet** - Add visit badge to project header
4. **Project Overview** - Add last visit info card
5. **Patch Dashboard** - Add `<VisitCoverageCard patchId={patchId} variant="patch" />`
6. **Lead Console** - Add `<VisitCoverageCard leadOrganiserId={leadId} variant="lead" />`
7. **Site Visits Page** - Replace `SiteVisitForm` with `EnhancedSiteVisitForm`
8. **Compliance Views** - Add last visit column (requires schema update)

## What Was NOT Implemented (Future Work)

### Deferred to Future Phases

1. **Offline Support with IndexedDB**
   - Offline queue management
   - Sync indicator
   - Draft management UI
   - Conflict resolution
   - **Status**: Database fields added (`offline_created`, `synced_at`), but IndexedDB implementation deferred

2. **Photo Attachments**
   - Supabase Storage integration
   - Photo upload in form
   - Display in visit history
   - **Status**: Database field added (`attachments_meta`), but UI not implemented

3. **Linked Activities**
   - Follow-up actions linked to union_activities table
   - Automatic activity creation from follow-ups
   - **Status**: Database structure in place, UI integration deferred

4. **Background Geofencing**
   - Service worker implementation
   - Background location tracking
   - PWA manifest configuration
   - **Status**: Foreground geofencing implemented, background requires PWA setup

5. **Visit Templates/Checklists**
   - Reason-specific checklists
   - Template-based visit recording
   - **Status**: Not started

6. **Bulk Visit Recording**
   - Record one visit for multiple sites
   - **Status**: Not started

7. **Advanced Reporting**
   - PDF/Excel export
   - Dedicated reports page
   - Custom date range filtering
   - **Status**: Analytics views created, UI not built

8. **Worker Interaction Tracking**
   - Track which workers were spoken to during visit
   - **Status**: Not started

## Database Performance Considerations

### Indexes Created
- `site_visit(date DESC)` - Fast last visit queries
- `site_visit(project_id)` - Project filtering
- `site_visit(job_site_id)` - Site filtering
- `site_visit(organiser_id)` - Organiser filtering
- `site_visit(visit_status)` - Status filtering
- Composite indexes for analytics views

### View Performance
- All views use LEFT JOINs to handle missing data
- Views are not materialized (computed on query)
- For large datasets (>10k projects), consider materializing `v_project_last_visit`
- Refresh strategy would need to be implemented if materialized

## Security & Permissions

### RLS Policies
- All authenticated users can view all visits (organization-wide visibility)
- All authenticated users can create visits
- Edit/Delete restricted to:
  - Visit creator
  - Assigned organiser
  - Lead organisers
  - Admins
- Custom reasons:
  - Only lead organisers can create
  - Lead can only edit/delete their own custom reasons
  - Admins can edit/delete any

### Data Privacy
- Geolocation data never sent to server
- Location only used client-side for proximity detection
- Visit records explicitly created by users
- No automatic background location tracking

## Testing Recommendations

### Unit Tests Needed
- LastVisitBadge color logic
- Distance calculation (Haversine formula)
- Notification cooldown logic
- Visit form validation

### Integration Tests Needed
- Create visit with multiple reasons
- Create visit with follow-ups
- Lead organiser creates custom reason, organiser sees it
- Draft visit workflow
- Geofencing notification flow

### E2E Tests Needed
- Complete site visit recording flow
- Context-aware navigation (mapping sheet, compliance)
- Custom reason management
- Visit filtering and sorting

## Known Limitations

1. **Geofencing requires app to be open** - Background geofencing requires PWA service worker
2. **Single employer per visit record** - Current implementation creates multiple visit records for multiple employers (by design, but may need review)
3. **No conflict resolution for offline edits** - Last-write-wins currently
4. **Photo attachments not implemented** - Field exists but UI missing
5. **Calendar export is download-only** - No direct calendar API integration
6. **Views not materialized** - May be slow for very large datasets

## Migration Notes

### Breaking Changes
None. All changes are additive and backwards compatible with existing data.

### Data Migration
- Existing `site_visit` records are preserved
- `employer_id` made nullable (visits can exist without employer)
- Default `visit_status` is 'completed' for existing records
- No data backfill required

### Rollback Strategy
If needed to rollback:
1. Drop new tables: `site_visit_follow_ups`, `site_visit_reasons`, `site_visit_reason_definitions`
2. Remove added columns from `site_visit` (complex, not recommended)
3. Alternative: Leave schema, simply don't use new features

## Performance Impact

### Expected Load
- Analytics views: Moderate. Run on-demand, cached 5 minutes client-side
- Geofencing: Minimal. Location checks every 60 seconds when enabled
- Visit creation: Low. Single transaction with related records

### Optimization Opportunities
1. Materialize frequently-accessed views
2. Add periodic refresh job for materialized views
3. Implement client-side caching for reason definitions
4. Lazy-load follow-up actions in visit history

## Next Steps for Full Deployment

### Immediate Actions
1. Apply migrations to production database
2. Integrate `LastVisitBadge` into existing project views
3. Replace `SiteVisitForm` with `EnhancedSiteVisitForm` in site-visits page
4. Add visit coverage cards to dashboards
5. Link to lead organiser setup page from LeadConsole navigation

### Short-term Enhancements
1. Implement photo attachment upload
2. Add visit filtering and search to site-visits list page
3. Create visit statistics dashboard
4. Add "last visit" column to compliance views

### Medium-term Features
1. Implement offline support with IndexedDB
2. Create dedicated reporting/export page
3. Worker interaction tracking
4. Visit templates and checklists

### Long-term Vision
1. Background geofencing with service worker
2. Mobile app with native geofencing
3. Automated visit reminders based on frequency targets
4. Integration with external calendar APIs
5. Voice-to-text notes recording

## Documentation

### User-Facing Documentation Needed
1. How to record a site visit
2. How to use geofencing
3. Lead organiser: Managing custom visit reasons
4. Understanding visit coverage metrics

### Developer Documentation
- This file
- Inline code comments
- Database schema diagram (recommended)
- API/RPC function documentation (if any added)

## Success Criteria

The implementation can be considered successful when:

- ✅ Database migrations applied without errors
- ✅ All new components render without linting errors
- ✅ Visit recording form functional with all features
- ✅ Analytics views return data correctly
- ✅ Lead organisers can create custom reasons
- ⏳ Badges integrated into project views
- ⏳ Geofencing tested on mobile devices
- ⏳ User acceptance testing completed
- ⏳ Performance benchmarks met

## Conclusion

This implementation provides a solid foundation for comprehensive site visit tracking with room for future enhancements. The modular architecture allows for incremental adoption and testing of features. The analytics infrastructure enables data-driven decision-making about organizing activities.

Key achievements:
- **Flexible reason taxonomy** - Global + custom reasons
- **Rich follow-up tracking** - Actionable next steps
- **Context-aware UX** - Quick access to related features
- **Comprehensive analytics** - Multi-level reporting (project, patch, lead organiser)
- **Geo-awareness** - Location-based visit reminders
- **Backwards compatible** - No breaking changes

The system is ready for production deployment with the recommended integration points completed.


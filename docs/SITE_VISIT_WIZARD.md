# Site Visit Wizard - Development Documentation

## Overview

The Site Visit Wizard is a simplified, mobile-first UI component designed for CFMEU NSW construction union organisers with limited technical skills. It provides a streamlined interface for recording site visits and accessing key project information while in the field on iPhone devices (model 13+).

## Current Status: ✅ Implemented and Functional

**Last Updated:** November 2024

The wizard is fully implemented with all core features working. Recent fixes addressed navigation issues and improved the UX by removing intrusive entry popups.

---

## Purpose & User Context

### Target Users
- **Primary:** Field organisers using iPhones (model 13+)
- **Technical Skill Level:** Low - users need simple, intuitive interfaces
- **Environment:** Construction sites, outdoor/field conditions
- **User Count:** 30-50 verified users across closed testing and production environments

### Core Questions the Wizard Helps Answer
1. What projects are in my geographic area?
2. Who is the builder on each project?
3. Do they have an EBA (Enterprise Bargaining Agreement)?
4. Are they compliant?
5. Who are the key trade employers on those projects?
6. What is their compliance status (traffic light rating)?

---

## Architecture

### Route Structure
```
/site-visit-wizard              → Main wizard entry point (inside (app) route group)
/mobile/projects/[id]/mapping   → Mobile mapping workflow
/mobile/projects/[id]/compliance → Mobile compliance audit workflow
```

### Component Structure
```
src/components/siteVisitWizard/
├── SiteVisitWizard.tsx              # Main orchestrating component
├── WizardFloatingButton.tsx         # FAB for launching (shown on mobile)
├── phases/
│   ├── ProjectSelector.tsx          # Phase 1: Geolocation + fallback search
│   └── ActionMenu.tsx               # Phase 2: 7-button action grid
├── views/
│   ├── ContactsView.tsx             # Site contacts (PM, SM, Delegate, HSR)
│   ├── MappingView.tsx              # Trade summary + mapping actions
│   ├── RatingsView.tsx              # Traffic light ratings + compliance
│   ├── EbaView.tsx                  # EBA status display
│   ├── IncolinkView.tsx             # Incolink integration status
│   └── ProjectDetailsView.tsx       # Project information
├── shared/
│   ├── SiteVisitRecordDialog.tsx    # Record visit prompt (exit only)
│   ├── WizardHeader.tsx             # Navigation header
│   └── WizardButton.tsx             # Large touch-friendly buttons
└── hooks/
    └── useWizardState.ts            # State management with URL sync
```

---

## User Flow

### Phase 1: Project Selection
1. **Geolocation Available:**
   - Shows closest project with "Is this your job?" prompt
   - Large YES/NO buttons for easy selection
   - "Other" shows list of nearby projects
   - Search option for name/address lookup

2. **Geolocation Unavailable/Denied (Fallback):**
   - Shows friendly message about location unavailable
   - Displays searchable list of user's assigned projects
   - Projects filtered by user's accessible patches via `useAccessiblePatches`
   - Uses `patch_project_mapping_view` for efficient patch-to-project filtering

### Phase 2: Action Menu
Seven large buttons in a 2-column grid:
- **Contacts** - Site contacts with 4 fixed roles
- **Mapping** - Trade summary + add/share mapping
- **Ratings** - Traffic light compliance ratings
- **EBA** - Enterprise agreement status
- **Incolink** - Incolink data integration
- **Project Details** - Project information
- **Pick New Project** - Return to project selection

### Site Visit Recording
- **NOT shown on entry** - Users go directly to action menu
- **Shown only on exit** - When user tries to leave wizard
- **Pre-selects reasons** based on visited views:
  - Visited Ratings → "Compliance Audit" pre-selected
  - Visited other views → "General Visit" as fallback
- User can record visit or skip

---

## Key Implementation Details

### State Management (`useWizardState.ts`)
- Uses React useState with URL synchronization for deep linking
- Tracks `visitedViews` Set to know which sections user accessed
- Handles navigation with `goBack` using functional state updates to avoid stale closures
- Key state properties:
  ```typescript
  interface WizardState {
    phase: 'project-selection' | 'action-menu'
    view: 'contacts' | 'mapping' | 'ratings' | 'eba' | 'incolink' | 'project-details' | null
    selectedProject: SelectedProject | null
    showSiteVisitDialog: boolean
    siteVisitDialogMode: 'entry' | 'exit'
    visitedViews: Set<WizardView>
  }
  ```

### Project Selection (`ProjectSelector.tsx`)
- Uses `find_nearby_projects` RPC for geolocation-based search
- Fallback uses `patch_project_mapping_view` → then fetches projects by ID
- **Important:** Must use `job_sites!project_id` hint for Supabase join (multiple FKs exist)
- Filter: `organising_universe IN ('active', 'potential')` - NOT 'monitoring' (invalid enum)

### Contacts View (`ContactsView.tsx`)
- Displays 4 fixed roles: Project Manager, Site Manager, Site Delegate, Site HSR
- Uses same `site_contacts` table as mapping sheet
- Auto-saves with 800ms debounce (no save button needed)
- Data syncs with full mapping sheet

### Mapping & Ratings Views
Each has three action buttons:
1. **Add [Mapping/Rating]** - Opens mobile workflow (`/mobile/projects/[id]/mapping` or `/compliance`)
2. **Share [Mapping Sheet/Audit Form]** - Generates shareable link/QR code
3. **Full [Mapping Sheet/Compliance View]** - Opens detailed page in new tab

---

## Known Issues & Troubleshooting

### Issue: "Error: Event handlers cannot be passed to Client Component props"
**Cause:** A Server Component is passing an event handler to a Client Component.
**Solution:** Add `"use client"` directive to the component file, or ensure parent layouts that pass event handlers are client components.
**Example Fix:** `src/app/mobile/projects/layout.tsx` was changed from async Server Component to Client Component.

### Issue: "Could not embed because more than one relationship found"
**Cause:** Supabase finds multiple foreign keys between tables (e.g., `projects` ↔ `job_sites`).
**Solution:** Use relationship hints like `job_sites!project_id` to specify which FK to use.

### Issue: "Invalid input value for enum project_organising_universe"
**Cause:** Using invalid enum value (e.g., 'monitoring' instead of valid values).
**Solution:** Valid values are: `'active'`, `'potential'`, `'excluded'`

### Issue: Navigation shows exit dialog instead of returning to action menu
**Cause:** Stale closure in `goBack` callback reading old state values.
**Solution:** Use functional state update `setState(currentState => ...)` to read current state.

### Issue: Projects not loading in fallback search
**Cause:** Not properly filtering by user's patches.
**Solution:** Query `patch_project_mapping_view` first to get project IDs, then fetch projects.

---

## Database Dependencies

### Tables Used
- `site_visit` - Visit records
- `site_visit_reasons` - Junction table for visit reasons
- `site_visit_reason_definitions` - Reason taxonomy (compliance_audit, general_visit, etc.)
- `site_contacts` - Site contact information
- `projects` - Project data
- `job_sites` - Job site locations
- `project_assignments` - Employer/trade assignments
- `employers` - Employer data
- `employer_compliance_checks` - Traffic light ratings
- `patch_project_mapping_view` - Materialized view for patch→project mapping

### Key RPC Functions
- `find_nearby_projects` - Geolocation-based project search

---

## Deployment Environments

1. **Closed Testing:** Apps built locally, accessed via localhost
2. **Production:** 
   - Main app: Vercel (cfmeu.uconstruct.app)
   - Workers: Railway.app
   - Both use single Supabase project

---

## UX Design Principles

### For Low-Tech Users
- **Touch targets:** Minimum 56px height, 12px+ spacing
- **Visual hierarchy:** Large icons (32px) with text labels
- **Navigation:** Persistent back button, clear breadcrumbs
- **Feedback:** Haptic feedback on button presses
- **Typography:** 18px+ base font, high contrast
- **Loading states:** Skeleton screens preferred over spinners

### Mobile Optimizations
- Safe area insets for iPhone notch/home indicator
- `touch-manipulation` CSS for responsive touch
- Debounced inputs for auto-save features
- Offline awareness (though not full offline support yet)

---

## Future Enhancements

### Potential Improvements
1. **Offline Support:** Cache project data, queue site visits for sync
2. **Mapping Reason:** Add specific "mapping" reason to visit reason definitions
3. **Photo Capture:** Add ability to attach photos to site visits
4. **Delegate Quick Actions:** One-tap delegate contact/messaging
5. **Visit History:** Show recent visits for the project

### Technical Debt
1. Consider extracting more shared components
2. Add comprehensive Playwright mobile tests
3. Add error boundary around wizard for graceful failures

---

## Related Documentation

- `/claude.md` - Project-wide development guide
- `/docs/SITE_VISIT_ENHANCEMENT_IMPLEMENTATION.md` - Original site visit table enhancements
- `/supabase/migrations/20251016170000_enhance_site_visits.sql` - Visit schema migration

---

## Change History

### November 2024 - Initial Implementation
- Created two-phase wizard (project selection → action menu)
- Implemented geolocation with fallback to patch-filtered search
- Added 6 view components (contacts, mapping, ratings, EBA, incolink, project details)
- Integrated with existing mapping sheet and compliance components
- Added site visit recording on exit with pre-selected reasons

### November 2024 - Navigation & UX Fixes
- Fixed Server Component error in `/mobile/projects/layout.tsx`
- Fixed Supabase join ambiguity with `!project_id` hint
- Fixed enum value error (removed 'monitoring')
- Removed intrusive entry popup - dialog now only shows on exit
- Fixed stale closure in `goBack` using functional state updates
- Added visited views tracking for intelligent reason pre-selection








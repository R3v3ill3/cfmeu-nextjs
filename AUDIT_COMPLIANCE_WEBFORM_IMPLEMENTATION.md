# Audit & Compliance Webform Implementation Summary

## Overview

Successfully implemented a shareable webform system for Audit & Compliance assessments, mirroring the existing Mapping Sheets workflow. This allows organisers to generate secure, time-limited links for external users to complete employer compliance assessments (CBUS/Incolink checks) for selected project employers.

## Implementation Date

October 31, 2025

## Key Features Implemented

### 1. Database Infrastructure ✅

**Migration File:** `supabase/migrations/20251031000000_audit_compliance_public_forms.sql`

- Added `metadata` jsonb column to `secure_access_tokens` table for storing employer selection
- Created `get_public_audit_form_data(p_token text)` RPC function
  - Validates token and resource type
  - Retrieves project and selected employer data
  - Returns current compliance records for each employer
- Created `submit_public_audit_form(p_token text, p_submission jsonb)` RPC function
  - Validates token and employer permissions
  - Updates employer compliance records with versioning
  - Marks token as used after successful submission

### 2. Backend API Updates ✅

**Modified Files:**
- `src/app/api/projects/[projectId]/generate-share-link/route.ts`
  - Added `PROJECT_AUDIT_COMPLIANCE` to valid resource types
  - Added `employerIds` parameter support
  - Validation: requires at least one employer for audit compliance forms
  - Stores employer selection in token metadata

- `src/app/api/public/form-data/[token]/route.ts`
  - Extended GET endpoint to detect audit compliance resource type
  - Calls `get_public_audit_form_data` RPC for audit forms
  - Extended POST endpoint to handle audit compliance submissions
  - Calls `submit_public_audit_form` RPC with employer updates

### 3. Share Link Generator Component ✅

**New File:** `src/components/projects/compliance/ShareAuditFormGenerator.tsx`

Features:
- Employer multi-select with "Select All" option
- Fetches employers from mapping data (contractor roles + trade contractors)
- Sorted alphabetically for easy selection
- Expiry time options: 24h, 48h, 72h, 1 week
- Same UI/UX as mapping sheet generator:
  - Copy link, external link, QR code tabs
  - Mobile-optimized QR code instructions
  - Expiry countdown badge
- Validation: minimum one employer required
- Shows selected employer count and names

### 4. Integration into Compliance Views ✅

**Modified Files:**
- `src/components/projects/compliance/ComplianceDesktopView.tsx`
  - Added "Share Audit & Compliance Form" button in header
  - Fetches project name via useQuery for share link
  - Positioned next to Reporting settings button

- `src/components/projects/compliance/ComplianceMobileView.tsx`
  - Added share button at top of view
  - Mobile-optimized layout

### 5. Public Audit Compliance Form ✅

**New File:** `src/components/public/PublicAuditComplianceForm.tsx`

Features:
- **Adaptive Layout:**
  - Single employer: Direct form with employer name as subtitle
  - Multiple employers: Tabbed interface (one tab per employer)
  
- **CBUS Compliance Fields:**
  - Check conducted checkbox
  - Check date picker
  - 3-Point Check with visual status indicators:
    1. Payment Status (correct/incorrect/uncertain)
    2. Payment Timing (on time/late/uncertain)
    3. Worker Count Status (correct/incorrect)
  - Enforcement flag checkbox
  - Follow-up required checkbox
  - Notes textarea

- **INCOLINK Compliance Fields:**
  - Check conducted checkbox
  - Check date picker
  - 3-Point Check with visual status indicators:
    1. Payment Status (correct/incorrect/uncertain)
    2. Payment Timing (on time/late/uncertain)
    3. Worker Count Status (correct/incorrect)
  - Company ID text input
  - Enforcement flag checkbox
  - Follow-up required checkbox
  - Notes textarea

- **UI/UX Design:**
  - CFMEU branding with Building2 icon
  - Project name display
  - Expiry countdown badge (color-coded: green > yellow > red)
  - Responsive mobile design
  - Color-coded compliance indicators (green=correct, red=incorrect, yellow=uncertain)
  - Success screen after submission
  - Loading states during submission

### 6. Public Page Integration ✅

**Modified File:** `src/app/share/[token]/page.tsx`

- Added import for `PublicAuditComplianceForm`
- Detects `PROJECT_AUDIT_COMPLIANCE` resource type after data fetch
- Renders audit compliance form instead of mapping sheet form
- Maintains existing mapping sheet functionality

## User Workflow

### Organiser Workflow (App User)

1. Navigate to project detail page → Audit & Compliance tab
2. Click "Share Audit & Compliance Form" button
3. Dialog opens with:
   - Employer multi-select (checkboxes with employer names and roles)
   - "Select All" option
   - Expiry time dropdown
4. Select one or more employers
5. Click "Generate Share Link"
6. Share link generated with three options:
   - **Link tab**: Copy link or open in new window
   - **QR Code tab**: Display QR code with mobile scanning instructions
7. Share link/QR code with external assessor (delegate, CBUS officer, etc.)

### External User Workflow (Form Recipient)

**Single Employer Scenario:**
1. Open shared link (or scan QR code)
2. See form with employer name prominently displayed
3. Complete CBUS and/or INCOLINK assessments directly
4. Click "Submit Compliance Assessment"
5. See success confirmation

**Multiple Employers Scenario:**
1. Open shared link (or scan QR code)
2. See tabbed interface with employer names as tabs
3. Click each employer tab to complete their assessment
4. Navigate between employers as needed
5. Click "Submit All Assessments (N)" when complete
6. See success confirmation

## Technical Architecture

### Security

- Cryptographically secure 48-character tokens
- Time-limited access (configurable expiry)
- Token-based employer scoping (can only edit authorized employers)
- RLS-backed RPCs for database operations
- No service role key exposure in public endpoints
- Token marked as "used" after successful submission

### Data Flow

```
1. Generate Share Link:
   Organiser → ShareAuditFormGenerator → 
   POST /api/projects/[projectId]/generate-share-link →
   Database: secure_access_tokens (with metadata.employerIds)

2. Load Form:
   External User → /share/[token] →
   GET /api/public/form-data/[token] →
   RPC: get_public_audit_form_data →
   Returns: project + employers + current compliance

3. Submit Form:
   External User → PublicAuditComplianceForm →
   POST /api/public/form-data/[token] →
   RPC: submit_public_audit_form →
   Updates: employer_compliance_checks (with versioning)
```

### Database Schema

- **secure_access_tokens.metadata**: Stores `{ "employerIds": ["uuid1", "uuid2", ...] }`
- **employer_compliance_checks**: Updated with new compliance records (versioned)
- Historical records preserved with `is_current = false`

## Files Created

1. `supabase/migrations/20251031000000_audit_compliance_public_forms.sql` - Database migration
2. `src/components/projects/compliance/ShareAuditFormGenerator.tsx` - Share link generator
3. `src/components/public/PublicAuditComplianceForm.tsx` - Public form component

## Files Modified

1. `src/app/api/projects/[projectId]/generate-share-link/route.ts` - Added audit compliance support
2. `src/app/api/public/form-data/[token]/route.ts` - Extended for audit forms
3. `src/app/share/[token]/page.tsx` - Added audit form detection and rendering
4. `src/components/projects/compliance/ComplianceDesktopView.tsx` - Added share button
5. `src/components/projects/compliance/ComplianceMobileView.tsx` - Added share button

## Testing Checklist

### Database Migration
- [ ] Run migration in development environment
- [ ] Verify `metadata` column added to `secure_access_tokens`
- [ ] Test `get_public_audit_form_data` RPC with sample token
- [ ] Test `submit_public_audit_form` RPC with sample submission
- [ ] Verify RLS permissions for anon role

### Share Link Generation
- [ ] Generate link with single employer selected
- [ ] Generate link with multiple employers selected
- [ ] Verify error when no employers selected
- [ ] Test all expiry time options (24h, 48h, 72h, 1 week)
- [ ] Verify QR code generation and display
- [ ] Test copy to clipboard functionality
- [ ] Test external link opening

### Public Form - Single Employer
- [ ] Open link with single employer
- [ ] Verify direct form layout (no tabs)
- [ ] Complete CBUS assessment (all fields)
- [ ] Complete INCOLINK assessment (all fields)
- [ ] Submit form successfully
- [ ] Verify success confirmation screen
- [ ] Check database for compliance record
- [ ] Test mobile responsiveness

### Public Form - Multiple Employers
- [ ] Open link with 2-3 employers
- [ ] Verify tabbed interface
- [ ] Switch between employer tabs
- [ ] Complete assessments for all employers
- [ ] Submit all assessments
- [ ] Verify all records in database
- [ ] Test mobile tab navigation

### Token Expiry
- [ ] Test form with expired token (manually set expiry in past)
- [ ] Verify appropriate error message
- [ ] Test token at various expiry stages (hours remaining)
- [ ] Verify expiry badge color changes

### Edge Cases
- [ ] Test with project having no employers
- [ ] Test with employer having existing compliance records
- [ ] Test concurrent submissions (two users, same token)
- [ ] Test token after first use (should still work until expired)
- [ ] Test form with partial data submission
- [ ] Verify versioning of compliance records

### Cross-Browser Testing
- [ ] Chrome/Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] iOS Safari (mobile)
- [ ] Chrome (Android)

## Known Limitations

1. **Token Reuse**: Tokens can be used multiple times until expiry (by design, allows corrections)
2. **No Draft Saving**: Form must be completed in single session
3. **No Email Notifications**: System doesn't send emails when forms are submitted
4. **No Audit Trail**: No tracking of who submitted the form (intentionally anonymous)

## Future Enhancements

1. **Email Integration**: Send notification when form is completed
2. **Draft Saving**: Allow external users to save partial progress
3. **Bulk Generation**: Generate multiple links at once for different employer groups
4. **Template System**: Pre-configure common employer selection patterns
5. **Analytics**: Track submission rates and completion times
6. **PDF Export**: Generate PDF of completed assessments
7. **Photo Upload**: Allow attachment of compliance evidence photos

## Deployment Notes

### Prerequisites
- Database migration must be applied before deploying code
- No environment variables needed (uses existing secure token system)
- QR code library already in dependencies (`react-qr-code`)

### Deployment Order
1. Apply database migration: `20251031000000_audit_compliance_public_forms.sql`
2. Deploy backend API changes
3. Deploy frontend components
4. Test in staging environment
5. Deploy to production

### Rollback Plan
If issues arise:
1. Revert frontend changes (forms will show error for audit compliance tokens)
2. Revert API changes
3. Keep database migration (no harm, just unused column and RPCs)
4. Or full rollback including migration if needed

## Success Metrics

Track the following to measure adoption:
- Number of audit compliance share links generated
- Submission rate (links clicked → forms completed)
- Average time between link generation and form submission
- Number of employers assessed per form
- Mobile vs desktop usage

## Support Documentation

For end users, create:
1. Quick start guide for organisers (how to generate and share links)
2. Form filling guide for external users (how to complete assessments)
3. QR code scanning instructions (step-by-step with screenshots)
4. FAQ document

## Conclusion

The Audit & Compliance shareable webform system has been successfully implemented following the same proven pattern as the Mapping Sheets webforms. The system is secure, user-friendly, and provides adaptive interfaces for both single and multiple employer scenarios. All components are in place and ready for testing and deployment.


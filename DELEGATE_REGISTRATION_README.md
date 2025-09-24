# CFMEU Delegate Registration Integration

This document describes the implementation of the CFMEU delegate registration functionality that allows organisers to register site delegates and HSRs through the app and submit their details to the official CFMEU registration form.

## Overview

The delegate registration system integrates with the existing project mapping workflow to provide a seamless way to:

1. **Assign representatives** to project sites from existing workers or new workers
2. **Capture registration details** including election information and training dates
3. **Submit to CFMEU** via the official NSW CFMEU delegate registration form
4. **Track registration status** and maintain records in the app

## User Workflow

### From Project Mapping Sheet

1. Navigate to a project's "Mapping Sheets" tab
2. In the "Site Contacts" section, find the Site Delegate or Site HSR rows
3. Click the appropriate action button:
   - **"Add Representative"** - When no representative is assigned
   - **"Add Additional"** - To add more representatives to existing ones
   - **"Change"** - To replace the current representative
   - **"Register"** - To register/nominate an existing representative

### Registration Process

The registration dialog guides users through 4 steps:

#### Step 1: Worker Selection
- **Search existing workers** assigned to the project
- **Add new worker** if the person isn't in the system yet
- Workers can be searched by name across all project assignments

#### Step 2: Worker Details Review
- Review and update worker contact information
- Ensure all required fields are complete:
  - First name, surname (required)
  - Mobile phone, email (recommended)
  - Home address (required for CFMEU form)
  - Union membership status

#### Step 3: Registration Details
- **Select employer** from project-assigned employers
- **Choose representative type**:
  - Delegate Only
  - OHS Rep Only  
  - Delegate & OHS Rep (creates both union roles)
- **Election information**:
  - Elected by (free text)
  - Date elected
- **Training dates**:
  - OHS training completion date
  - OHS refresher training date
- **Notes** (optional)

#### Step 4: CFMEU Form Submission
- Review registration summary
- Click "Open CFMEU Registration Form" to launch the official form
- Complete any remaining fields and submit to CFMEU

## Technical Implementation

### Database Schema Changes

New migration `0027_delegate_registration_fields.sql` adds:

```sql
-- New fields in union_roles table
ALTER TABLE union_roles ADD COLUMN elected_by TEXT;
ALTER TABLE union_roles ADD COLUMN date_elected DATE;
ALTER TABLE union_roles ADD COLUMN ohs_training_date DATE;
ALTER TABLE union_roles ADD COLUMN ohs_refresher_training_date DATE;
ALTER TABLE union_roles ADD COLUMN cfmeu_registration_submitted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE union_roles ADD COLUMN cfmeu_registration_data JSONB;

-- New union role type
ALTER TYPE union_role_name ADD VALUE 'ohs_committee_chair';
```

### Key Components

#### `MappingSiteContactsTable.tsx`
- Updated to show action buttons for delegate/HSR roles
- Integrates with the registration dialog
- Maintains existing site contacts functionality

#### `DelegateRegistrationDialog.tsx`
- Multi-step registration wizard
- Worker search and selection
- Form validation and data management
- Integration with CFMEU form submission

#### `cfmeuFormSubmission.ts`
- Utility functions for CFMEU form integration
- Data validation and mapping
- Form data generation and submission helpers

### Data Flow

1. **Worker Assignment**: Workers are linked to employers and job sites via `worker_placements`
2. **Union Role Creation**: Creates appropriate union roles (`site_delegate`, `hsr`, or both)
3. **Site Contact Update**: Updates the `site_contacts` table with representative details
4. **CFMEU Integration**: Generates form data and opens official registration form

### Representative Type Mapping

| Internal Union Roles | CFMEU Rep Type | Description |
|---------------------|----------------|-------------|
| `site_delegate` | Delegate Only | Site delegate role only |
| `hsr` | OHS Rep Only | Health & Safety Representative only |
| `site_delegate` + `hsr` | Delegate & OHS Rep | Both roles assigned |
| `ohs_committee_chair` | OHS Rep Only | OHS Committee Chair (maps to HSR) |

## Integration Points

### Existing Systems
- **Worker Management**: Leverages existing worker data and search
- **Project Assignments**: Uses project-employer relationships
- **Site Contacts**: Updates existing site contacts system
- **Union Roles**: Extends existing union role management

### External Integration
- **CFMEU Form**: Opens official NSW CFMEU registration form
- **Data Pre-filling**: Provides structured data for form completion
- **Manual Submission**: User completes and submits official form

## Configuration

### Environment Variables
No additional environment variables required. The system uses existing Supabase configuration.

### CFMEU Form URL
Currently configured for NSW CFMEU: `https://nsw.cfmeu.org/members/health-safety/delegate-hsr-registration/`

## Future Enhancements

### Potential Improvements
1. **Automated Form Submission**: Direct API integration with CFMEU systems
2. **QR Code Generation**: Generate QR codes for mobile registration
3. **Bulk Registration**: Support for registering multiple representatives
4. **Registration Tracking**: Track submission status and follow-up
5. **Document Generation**: Generate registration certificates or confirmations

### Additional Features
1. **Training Management**: Track and schedule OHS training
2. **Election Management**: Manage election processes and voting
3. **Renewal Tracking**: Track registration renewals and expiry dates
4. **Reporting**: Generate registration reports and statistics

## Troubleshooting

### Common Issues

**Worker not found in search**
- Ensure worker is assigned to the project via worker placements
- Check if worker exists in the workers table
- Use "Add New Worker" if worker doesn't exist

**Employer not available**
- Ensure employer is assigned to the project via project_assignments
- Check project-employer relationships in the database

**CFMEU form not opening**
- Check popup blocker settings
- Ensure external links are allowed
- Try opening form manually if automatic opening fails

### Data Validation
- All required fields are validated before submission
- Worker contact information is verified
- Registration dates are validated for logical consistency

## Support

For technical issues or questions about the delegate registration system:

1. Check the browser console for error messages
2. Verify database connectivity and permissions
3. Ensure all required data relationships exist
4. Contact system administrators for database-level issues

## Related Documentation

- [Worker Management System](./WORKER_MANAGEMENT.md)
- [Project Assignment System](./PROJECT_ASSIGNMENTS.md)
- [Union Roles Documentation](./UNION_ROLES.md)
- [Site Contacts Management](./SITE_CONTACTS.md)

# Secure Webforms Feature

This feature allows authenticated users (organisers) to generate secure, time-limited access links for non-registered users to view and update specific project information.

## Overview

The system uses cryptographically secure tokens to grant temporary access to specific resources without requiring user registration or authentication from the external user.

## Architecture

### Database Schema

#### `secure_access_tokens` Table
- `id`: UUID primary key
- `token`: Unique cryptographically secure token (48 characters)
- `resource_type`: Type of resource ('PROJECT_MAPPING_SHEET', etc.)
- `resource_id`: UUID of the specific resource (e.g., project ID)
- `created_by`: UUID of the user who generated the token
- `expires_at`: Expiry timestamp
- `used_at`: Timestamp when form was submitted (nullable, for tracking)
- `created_at`, `updated_at`: Standard audit fields

### API Endpoints

#### Authenticated Endpoints
- `POST /api/projects/[projectId]/generate-share-link`
  - Generates a new secure access token
  - Requires organiser, lead_organiser, or admin role
  - Body: `{ resourceType: 'PROJECT_MAPPING_SHEET', expiresInHours?: 48 }`

#### Public Endpoints  
- `GET /api/public/form-data/[token]`
  - Validates token and returns form data
  - No authentication required
  - Returns project data, mapping sheet data, and available employers

- `POST /api/public/form-data/[token]`
  - Submits form updates
  - Validates token before processing
  - Updates project information and marks token as used

### Frontend Components

#### `ShareLinkGenerator`
- Modal dialog for generating share links
- Configurable expiry times (24h, 48h, 72h, 1 week)
- Copy to clipboard and external link functionality
- Located in mapping sheet header (non-print area)

#### Public Form Page (`/share/[token]`)
- Fully functional form accessible via shared link
- Displays project information with edit capabilities
- Shows contractor roles and EBA status (read-only)
- Responsive design with CFMEU branding
- Real-time expiry status indicator

## Security Features

1. **Cryptographically Secure Tokens**: 48-character random strings using `gen_random_bytes()`
2. **Time-Based Expiry**: Configurable expiry times, default 48 hours
3. **Resource Scoping**: Tokens are tied to specific resources and types
4. **Usage Tracking**: Tracks when forms are submitted
5. **Access Control**: Only authenticated organisers can generate tokens
6. **Automatic Cleanup**: Database function to remove expired tokens

## Usage Flow

1. **Organiser generates link**: 
   - Opens mapping sheet for a project
   - Clicks "Share Mapping Sheet" button
   - Configures expiry time and generates secure link

2. **Delegate receives link**:
   - Clicks the shared link (e.g., `https://app.cfmeu.org/share/abc123...`)
   - Accesses the public form with existing project data pre-filled

3. **Delegate updates information**:
   - Edits project details, dates, funding information
   - Views contractor information (read-only)
   - Submits updates

4. **System processes updates**:
   - Validates token and processes form submission
   - Updates project and job site records
   - Marks token as used

## Implementation Details

### Environment Variables Required
- `SUPABASE_SERVICE_ROLE_KEY`: For bypassing RLS in public endpoints
- `NEXT_PUBLIC_APP_URL` or `VERCEL_URL`: For generating share URLs

### Database Migration
Run the migration: `supabase/migrations/20250924100000_create_secure_access_tokens.sql`

### Resource Types
Currently supported:
- `PROJECT_MAPPING_SHEET`: Full project mapping sheet access

Easily extensible for future resource types:
- `PROJECT_SITE_VISIT`: Site visit forms
- `EMPLOYER_VERIFICATION`: Employer information verification
- `WORKER_REGISTRATION`: Worker registration forms

### Integration Points

#### In Existing Components
- Added `ShareLinkGenerator` to `MappingSheetPage1`
- Uses existing `useMappingSheetData` hook for data consistency
- Integrates with existing UI components and styling

#### Public Form Features
- Reuses existing UI components (`Button`, `Input`, `Card`, etc.)
- Consistent CFMEU branding and styling
- Mobile-responsive design
- Real-time form validation

## Monitoring & Maintenance

### Token Cleanup
Use the provided database function to clean up expired tokens:
```sql
SELECT cleanup_expired_tokens();
```

### Monitoring
Track token usage through the `secure_access_tokens` table:
- Generation patterns by user
- Expiry rates vs. usage rates  
- Resource type popularity

## Future Enhancements

1. **Single-Use Tokens**: Option to invalidate tokens after first submission
2. **Email Integration**: Automatic email sending with links
3. **Audit Logging**: Detailed logs of token usage and form submissions
4. **Advanced Permissions**: Role-based resource access controls
5. **Bulk Operations**: Generate multiple tokens for different resources
6. **Analytics Dashboard**: Usage statistics and link performance

## Testing

1. **Generate Link**: Test link generation from mapping sheet
2. **Access Form**: Verify public form loads with correct data
3. **Submit Updates**: Test form submission and data persistence  
4. **Token Validation**: Test expired/invalid token handling
5. **Security**: Verify access controls and token security

## Troubleshooting

### Common Issues

1. **"Token not found" error**: Check token hasn't expired or been used
2. **Permission denied**: Verify user has organiser+ role
3. **Form won't load**: Check `SUPABASE_SERVICE_ROLE_KEY` is set
4. **Links not generating**: Verify `NEXT_PUBLIC_APP_URL` is configured

### Debug Tips

1. Check browser network tab for API call responses  
2. Verify database token records are being created
3. Test with different expiry times
4. Check console logs for detailed error messages

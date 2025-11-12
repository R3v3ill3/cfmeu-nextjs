# Delegated Tasks Tracking Methodology

## Overview

This document describes the methodology for tracking and monitoring delegated tasks (webforms) in the CFMEU NSW Construction Union Organising Database. The system provides comprehensive analytics and three-level drill-down visibility: Summary Stats → Individual Links → Submitted Content.

## Purpose and Scope

The delegated tasks tracking system allows:
- **Organisers**: Track their own webform generation and submission rates
- **Lead Organisers**: View universe stats, all teams, and their team organisers' performance
- **Admins**: View universe stats, all teams, and all organisers' performance

The system is designed to be extensible to support multiple delegated task types:
- `PROJECT_AUDIT_COMPLIANCE` - Audit & Compliance webforms
- `PROJECT_MAPPING_SHEET` - Shared mapping sheet webforms (future)

## Database Schema

### Core Table: `secure_access_tokens`

The `secure_access_tokens` table is the foundation for all delegated task tracking. It stores:

**Core Fields:**
- `id` - UUID primary key
- `token` - Unique secure token (48 characters)
- `resource_type` - Type of delegated task (e.g., `PROJECT_AUDIT_COMPLIANCE`)
- `resource_id` - UUID of the resource (e.g., project ID)
- `created_by` - UUID of the user who generated the token
- `expires_at` - Expiry timestamp
- `used_at` - When token was marked as used (legacy field)

**Tracking Fields (Added in migration):**
- `submitted_at` - When form was successfully submitted
- `submission_count` - Number of times form was submitted
- `viewed_at` - First time token was accessed/viewed
- `view_count` - Number of times form was viewed
- `submission_data` - JSONB storing actual submitted form content
- `metadata` - JSONB for additional context (e.g., selected employer IDs)

**Indexes:**
- `idx_secure_access_tokens_created_by_created_at` - For organiser queries
- `idx_secure_access_tokens_resource_type_created_at` - For filtering by type
- `idx_secure_access_tokens_submitted_at` - For submission tracking
- `idx_secure_access_tokens_resource_id_type` - For project-based queries

### Analytics Views

#### `delegated_tasks_organiser_view`
Aggregates stats per organiser by time period (week/month/3months).

**Columns:**
- `organiser_id`, `organiser_name`, `resource_type`
- `generated_week`, `generated_month`, `generated_3months`
- `submitted_week`, `submitted_month`, `submitted_3months`

#### `delegated_tasks_team_view`
Aggregates stats per lead organiser team (grouped by patches → organisers → lead_organiser).

**Columns:**
- `lead_organiser_id`, `lead_organiser_name`, `resource_type`, `team_size`
- `generated_week`, `generated_month`, `generated_3months`
- `submitted_week`, `submitted_month`, `submitted_3months`

#### `delegated_tasks_universe_view`
Universe-wide statistics.

**Columns:**
- `resource_type`
- `generated_week`, `generated_month`, `generated_3months`
- `submitted_week`, `submitted_month`, `submitted_3months`
- `unique_organisers`, `unique_teams`

### RPC Functions

#### `get_delegated_tasks_organiser(p_user_id uuid, p_period text, p_resource_type text)`
Returns webform stats for a specific organiser.

**Parameters:**
- `p_user_id` - Organiser user ID
- `p_period` - 'week', 'month', or '3months'
- `p_resource_type` - Resource type (e.g., 'PROJECT_AUDIT_COMPLIANCE')

**Returns:**
```json
{
  "generated": 10,
  "submitted": 8,
  "pending": 2,
  "submissionRate": 80.0,
  "links": [...]
}
```

#### `get_delegated_tasks_team(p_lead_user_id uuid, p_period text, p_resource_type text)`
Returns aggregated stats for all organisers under a lead organiser.

**Returns:**
```json
{
  "teamTotals": {
    "generated": 50,
    "submitted": 40,
    "submissionRate": 80.0
  },
  "organisers": [...]
}
```

#### `get_delegated_tasks_universe(p_period text, p_resource_type text)`
Returns universe-wide statistics.

**Returns:**
```json
{
  "universe": {
    "generated": 200,
    "submitted": 160,
    "submissionRate": 80.0,
    "uniqueOrganisers": 15,
    "uniqueTeams": 5
  },
  "teams": [...],
  "organisers": [...]
}
```

#### `get_delegated_tasks_submission_content(p_token text, p_requesting_user_id uuid)`
Returns the actual submitted content for a specific webform link.

**Permission Checks:**
- User created the token (organiser)
- User is lead organiser of the organiser who created it
- User is an admin

**Returns:**
```json
{
  "token": "...",
  "projectId": "...",
  "projectName": "...",
  "submissionData": {...},
  "metadata": {...}
}
```

## API Pattern

### Standard Endpoint Structure

All delegated tasks API endpoints follow this pattern:

**Base Path:** `/api/delegated-tasks/`

**Endpoints:**
1. `GET /api/delegated-tasks/analytics` - Get analytics based on user role
2. `GET /api/delegated-tasks/links` - Get list of links with filtering
3. `GET /api/delegated-tasks/submissions/[token]` - Get submission content

### Query Parameters

**Common Parameters:**
- `period` - 'week', 'month', or '3months' (default: 'month')
- `resourceType` - Resource type (default: 'PROJECT_AUDIT_COMPLIANCE')
- `page` - Page number for pagination (default: 1)
- `limit` - Items per page (default: 50)

**Links Endpoint Additional Parameters:**
- `status` - 'all', 'pending', 'submitted', or 'expired' (default: 'all')
- `organiserId` - Filter by organiser (for lead_organiser/admin)
- `teamLeadId` - Filter by team lead (for admin)

### Role-Based Responses

**Organiser:**
- Returns `personal` stats only
- Links filtered to their own tokens

**Lead Organiser:**
- Returns `universe`, `teams`, and `organisers` (their team only)
- Can filter links by `organiserId` (must be in their team)

**Admin:**
- Returns `universe`, `teams`, and `organisers` (all)
- Can filter links by `organiserId` or `teamLeadId`

## Frontend Pattern

### Component Structure

**Base Component:** `DelegatedTasksDashboard`
- Period selector (Week / Month / 3 Months)
- Resource type selector
- Role-based component rendering

**Role-Specific Views:**
- `OrganiserSummaryView` - Personal stats and links
- `LeadOrganiserSummaryView` - Universe + Teams + My Team
- `AdminSummaryView` - Universe + Teams + All Organisers

**Supporting Components:**
- `LinksList` - Expandable list of individual links
- `SubmissionContentViewer` - Modal/dialog showing submitted content

### Three-Level Drill-Down

1. **Level 1: Summary Stats**
   - Cards showing aggregated metrics
   - Expandable sections for teams/organisers
   - Mobile: Cards stack, accordion pattern

2. **Level 2: Links List**
   - Expandable from summary cards
   - Table/card view of individual webform links
   - Status badges, dates, project names
   - Click to expand to Level 3

3. **Level 3: Submission Content**
   - Expandable from individual link
   - Full submitted form content viewer
   - Read-only display of all submitted fields
   - Back button to return to links list

### Mobile-First Design

- Touch-friendly expandable sections
- Card-based layouts instead of tables
- Full-screen modals for submission content
- Responsive typography and spacing

## Implementation Checklist

### Adding Tracking to a New Delegated Task Type

1. **Database:**
   - ✅ No changes needed - `secure_access_tokens` table already supports all types
   - ✅ Analytics views automatically include new type (filtered by `resource_type`)

2. **Backend:**
   - ✅ Update `VALID_RESOURCE_TYPES` in API endpoints
   - ✅ Add resource type to frontend selector
   - ✅ Ensure submission handlers store `submission_data`

3. **Frontend:**
   - ✅ Add new option to resource type selector
   - ✅ Analytics automatically work (filtered by `resourceType` parameter)

4. **Submission Tracking:**
   - ✅ Update submission handler to:
     - Call `track_token_view()` on GET requests
     - Set `submitted_at` and increment `submission_count` on submission
     - Store `submission_data` with full submission payload

## Example: Adding PROJECT_MAPPING_SHEET Tracking

### Step 1: Update API Endpoints

```typescript
// src/app/api/delegated-tasks/analytics/route.ts
const VALID_RESOURCE_TYPES = [
  'PROJECT_AUDIT_COMPLIANCE', 
  'PROJECT_MAPPING_SHEET'  // Already included!
] as const;
```

### Step 2: Update Frontend Selector

```typescript
// src/components/delegated-tasks/DelegatedTasksDashboard.tsx
<SelectItem value="PROJECT_MAPPING_SHEET">Mapping Sheets</SelectItem>
```

### Step 3: Update Submission Handler

```typescript
// In your mapping sheet submission handler
await supabase
  .from('secure_access_tokens')
  .update({
    submitted_at: new Date().toISOString(),
    submission_count: submission_count + 1,
    submission_data: submissionPayload,
  })
  .eq('token', token);
```

That's it! The analytics system will automatically track the new type.

## Key Reusability Points

1. **Single Table**: All delegated task types use `secure_access_tokens`
2. **Type Filtering**: Analytics views filter by `resource_type`
3. **API Parameters**: Endpoints accept `resourceType` parameter
4. **Frontend Props**: Components accept `resourceType` prop
5. **RLS Policies**: Same policies apply to all types
6. **Drill-Down Pattern**: Three-level pattern applies to all types
7. **Role-Based Views**: Same role-based rendering pattern

## Security Considerations

### Row Level Security (RLS)

**Policies:**
- Users can view their own tokens
- Lead organisers can view their team's tokens (via `role_hierarchy`)
- Admins can view all tokens

**Permission Checks:**
- Submission content access validated in RPC function
- Team membership verified via `role_hierarchy` table
- Active status and end dates respected

### Data Privacy

- Submission content only accessible to:
  - Organiser who created the token
  - Lead organiser of that organiser
  - Admins
- No sensitive data exposed in summary views
- Full content only shown when explicitly requested

## Performance Considerations

### Indexing Strategy

- Indexes on `created_by + created_at` for organiser queries
- Indexes on `resource_type + created_at` for type filtering
- Indexes on `submitted_at` for submission tracking
- Composite indexes for common query patterns

### Query Optimization

- Materialized views for aggregated stats (if needed)
- RPC functions use efficient joins
- Pagination for large link lists
- Lazy loading of submission content

### Caching

- React Query caching for analytics data
- Stale time: 30 seconds (configurable)
- Refetch on window focus: false
- Background refetch: enabled

## Future Enhancements

### Potential Additions

1. **Email Notifications**
   - Alert organisers when links are submitted
   - Weekly summary emails for lead organisers

2. **Export Functionality**
   - CSV export of links and stats
   - PDF reports for management

3. **Advanced Analytics**
   - Average time to submission
   - Most active projects
   - Submission trends over time
   - Geographic distribution

4. **Bulk Operations**
   - Bulk link generation
   - Bulk status updates
   - Bulk expiration management

5. **Integration Points**
   - Slack notifications
   - Calendar reminders
   - Dashboard widgets

## Troubleshooting

### Common Issues

**Issue**: Analytics not showing data
- **Check**: Ensure `submitted_at` is being set on submission
- **Check**: Verify RLS policies allow user to see tokens
- **Check**: Confirm `resource_type` matches exactly

**Issue**: Submission content not accessible
- **Check**: Verify user has permission (organiser/lead/admin)
- **Check**: Confirm token exists and is valid
- **Check**: Ensure `submission_data` was stored

**Issue**: Performance issues with large datasets
- **Check**: Indexes are created and up to date
- **Check**: Pagination is being used
- **Check**: Consider materialized views for heavy queries

## Related Documentation

- `SECURE_WEBFORMS_README.md` - Original webform implementation
- `AUDIT_COMPLIANCE_WEBFORM_IMPLEMENTATION.md` - Audit compliance forms
- Database migrations:
  - `20250924100000_create_secure_access_tokens.sql`
  - `20251112105313_enhance_delegated_tasks_tracking.sql`
  - `20251112105314_update_submission_tracking.sql`


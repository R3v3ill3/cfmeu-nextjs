# Integration Guide: Enhanced Project Review Dialog

## Quick Start

### Step 1: Verify Database Setup

Ensure the following RPC function exists in your database:

```sql
-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'search_projects_by_name_similarity';
```

If not present, create it:

```sql
CREATE OR REPLACE FUNCTION search_projects_by_name_similarity(
  p_project_name TEXT,
  p_exclude_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 10,
  p_threshold REAL DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  approval_status TEXT,
  value NUMERIC,
  stage_class TEXT,
  project_status TEXT,
  address TEXT,
  builder_name TEXT,
  created_at TIMESTAMPTZ,
  similarity REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.approval_status::TEXT,
    p.value,
    p.stage_class,
    p.project_status,
    js.full_address as address,
    b.name as builder_name,
    p.created_at,
    similarity(p.name, p_project_name) as similarity
  FROM projects p
  LEFT JOIN job_sites js ON p.main_job_site_id = js.id
  LEFT JOIN LATERAL (
    SELECT e.name
    FROM project_assignments pa
    JOIN employers e ON pa.employer_id = e.id
    WHERE pa.project_id = p.id AND pa.assignment_type = 'builder'
    LIMIT 1
  ) b ON true
  WHERE (p_exclude_id IS NULL OR p.id != p_exclude_id)
    AND similarity(p.name, p_project_name) >= p_threshold
  ORDER BY similarity DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
```

### Step 2: Update Admin Page

The PendingProjectsTable component has already been updated to use the new EnhancedProjectReviewDialog.

If you have other locations using the old ProjectReviewDialog:

**Before:**
```tsx
import { ProjectReviewDialog } from '@/components/admin/ProjectReviewDialog'
```

**After:**
```tsx
import { EnhancedProjectReviewDialog } from '@/components/admin/EnhancedProjectReviewDialog'
```

### Step 3: Test the Integration

1. Navigate to your admin pending projects page
2. Click "Review" on any pending project
3. Verify all 5 tabs load correctly:
   - Overview (with inline editing)
   - Contacts
   - Employers
   - Duplicates
   - Source

### Step 4: Verify Permissions

Ensure RLS policies allow:

```sql
-- Projects table
CREATE POLICY "Admins can update pending projects"
ON projects FOR UPDATE
TO authenticated
USING (
  approval_status = 'pending'
  AND auth.uid() IN (
    SELECT id FROM profiles
    WHERE role IN ('admin', 'lead_organiser')
  )
);

-- Read permissions for related tables
CREATE POLICY "Admins can read job sites"
ON job_sites FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT id FROM profiles
    WHERE role IN ('admin', 'lead_organiser', 'organiser')
  )
);
```

## API Endpoints

### 1. Duplicate Detection
**Endpoint:** `POST /api/projects/check-duplicates`

**Request:**
```json
{
  "name": "Sydney Metro Project",
  "projectId": "uuid-to-exclude"  // optional
}
```

**Response:**
```json
{
  "has_exact_matches": true,
  "has_fuzzy_matches": false,
  "exact_matches": [
    {
      "id": "uuid",
      "name": "Sydney Metro Project",
      "approval_status": "active",
      "value": 5000000,
      "address": "123 Main St",
      "builder_name": "ABC Construction",
      "created_at": "2024-01-01T00:00:00Z",
      "match_type": "exact"
    }
  ],
  "fuzzy_matches": [],
  "searched_name": "Sydney Metro Project"
}
```

### 2. Update Pending Project
**Endpoint:** `PATCH /api/admin/pending-projects/:id`

**Request:**
```json
{
  "name": "Updated Project Name",
  "value": 5000000,
  "proposed_start_date": "2024-06-01",
  "project_stage": "Planning"
}
```

**Response:**
```json
{
  "success": true,
  "project": { /* updated project data */ }
}
```

## Component Usage

### EnhancedProjectReviewDialog

```tsx
import { EnhancedProjectReviewDialog } from '@/components/admin/EnhancedProjectReviewDialog';

function AdminPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const handleApprove = async (projectId: string, notes?: string) => {
    await fetch('/api/admin/approve-project', {
      method: 'POST',
      body: JSON.stringify({ projectId, notes })
    });
  };

  const handleReject = async (projectId: string, reason: string) => {
    await fetch('/api/admin/reject-project', {
      method: 'POST',
      body: JSON.stringify({ projectId, reason })
    });
  };

  return (
    <EnhancedProjectReviewDialog
      open={isOpen}
      onOpenChange={setIsOpen}
      projectId={selectedProjectId}
      onApprove={handleApprove}
      onReject={handleReject}
      onRefresh={() => {
        // Refresh your project list
      }}
    />
  );
}
```

## Troubleshooting

### Issue: "Failed to fetch project data"
**Solution:** Check RLS policies on the projects table and related tables. Ensure the user has appropriate roles.

### Issue: Duplicate detection returns empty results
**Solution:** Verify the `search_projects_by_name_similarity` function exists and has correct permissions.

### Issue: Cannot save edits
**Solution:** Check that the `/api/admin/pending-projects/[id]` endpoint is accessible and the user has admin permissions.

### Issue: Tabs not displaying data
**Solution:** Verify the project has the related data (contacts, assignments, etc.) and the Supabase query includes all necessary joins.

## Migration from Old Dialog

If you have existing code using `ProjectReviewDialog`:

1. **Update imports:**
   ```tsx
   // Old
   import { ProjectReviewDialog } from '@/components/admin/ProjectReviewDialog'

   // New
   import { EnhancedProjectReviewDialog } from '@/components/admin/EnhancedProjectReviewDialog'
   ```

2. **Update props:**
   ```tsx
   // Old
   <ProjectReviewDialog
     open={isOpen}
     onOpenChange={setIsOpen}
     project={selectedProject}  // Passed entire object
     onApprove={handleApprove}
     onReject={handleReject}
   />

   // New
   <EnhancedProjectReviewDialog
     open={isOpen}
     onOpenChange={setIsOpen}
     projectId={selectedProjectId}  // Just pass ID
     onApprove={handleApprove}
     onReject={handleReject}
     onRefresh={refreshData}  // New callback
   />
   ```

3. **Update state management:**
   ```tsx
   // Old
   const [selectedProject, setSelectedProject] = useState<Project | null>(null);

   // New
   const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
   ```

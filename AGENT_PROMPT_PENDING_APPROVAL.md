# Agent Task: Implement Pending Approval Workflow for Scan Uploads

## Context

You are working on a Next.js application with Supabase backend that allows users to upload and scan mapping sheets to create new projects or add employers. Currently, all uploads directly create projects and employers immediately.

**Your task**: Implement a pending approval workflow where new projects and new employers created through scan uploads require admin/lead_organiser review and approval before becoming active in the system.

## Scope

Implement pending approval for these **specific upload streams**:

1. **New Project Upload Stream** (`/api/projects/new-from-scan`)
   - New projects created from scans → require approval
   - New employers created within new project flow → require approval

2. **Existing Project Upload Stream** (`/api/projects/[projectId]/import-scan`)
   - New employers created when adding scan to existing project → require approval
   - NOTE: Adding scan to existing project does NOT require approval (only new employers)

## Technical Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, RLS, RPC functions, Auth)
- **Current Architecture**:
  - Scan uploads → AI extraction → Review page → RPC `create_project_from_scan`
  - Files already in place: migrations, RPC functions, review UI components

## Implementation Phases

### PHASE 1: Database Schema & Backend (START HERE)

#### 1.1 Create Migration File

**File**: `supabase/migrations/20251010010000_add_approval_workflow.sql`

```sql
-- Add approval workflow for projects and employers created from scans

-- 1. Add approval_status to projects table
ALTER TABLE projects
ADD COLUMN approval_status text DEFAULT 'active' CHECK (approval_status IN ('pending', 'active', 'rejected'));

ALTER TABLE projects
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

ALTER TABLE projects
ADD COLUMN approved_at timestamptz;

ALTER TABLE projects
ADD COLUMN rejection_reason text;

CREATE INDEX idx_projects_approval_status ON projects(approval_status);

-- 2. Add approval_status to employers table
ALTER TABLE employers
ADD COLUMN approval_status text DEFAULT 'active' CHECK (approval_status IN ('pending', 'active', 'rejected'));

ALTER TABLE employers
ADD COLUMN approved_by uuid REFERENCES auth.users(id);

ALTER TABLE employers
ADD COLUMN approved_at timestamptz;

ALTER TABLE employers
ADD COLUMN rejection_reason text;

CREATE INDEX idx_employers_approval_status ON employers(approval_status);

-- 3. Create approval_history audit table
CREATE TABLE approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('project', 'employer')),
  entity_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('approved', 'rejected', 'resubmitted')),
  performed_by uuid NOT NULL REFERENCES auth.users(id),
  performed_at timestamptz NOT NULL DEFAULT now(),
  previous_status text,
  new_status text NOT NULL,
  reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_approval_history_entity ON approval_history(entity_type, entity_id);
CREATE INDEX idx_approval_history_performed_by ON approval_history(performed_by);
CREATE INDEX idx_approval_history_created_at ON approval_history(created_at DESC);

-- RLS for approval_history
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all approval history"
  ON approval_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

CREATE POLICY "Users can view approval history for their submissions"
  ON approval_history FOR SELECT
  TO authenticated
  USING (
    (entity_type = 'project' AND EXISTS (
      SELECT 1 FROM projects p
      JOIN mapping_sheet_scans mss ON mss.created_project_id = p.id
      WHERE p.id = entity_id AND mss.uploaded_by = auth.uid()
    ))
    OR
    (entity_type = 'employer' AND EXISTS (
      -- Users can see approval history for employers they created through scans
      SELECT 1 FROM employers e
      WHERE e.id = entity_id
      -- Add additional logic if needed to track employer creator
    ))
  );

GRANT SELECT ON approval_history TO authenticated;

COMMENT ON TABLE approval_history IS 'Audit trail for all approval/rejection actions on projects and employers';
```

#### 1.2 Modify RPC: create_project_from_scan

**File**: Update existing function in new migration or create override

**Changes needed**:
- Add parameter: `p_require_approval boolean DEFAULT false`
- When creating project, set `approval_status = 'pending'` if `p_require_approval = true`
- When creating new employer, set `approval_status = 'pending'` if `p_require_approval = true`
- Insert record into `approval_history` when creating pending items

**Key section to modify**:

```sql
-- In create_project_from_scan function

-- 1. Create project (around line 68)
INSERT INTO projects (
  name,
  value,
  proposed_start_date,
  proposed_finish_date,
  roe_email,
  project_type,
  state_funding,
  federal_funding,
  approval_status  -- NEW
) VALUES (
  COALESCE(
    p_project_data->>'name',
    v_scan_record.extracted_data->'project'->>'project_name',
    'New Project'
  ),
  (p_project_data->>'value')::numeric,
  (p_project_data->>'proposed_start_date')::date,
  (p_project_data->>'proposed_finish_date')::date,
  p_project_data->>'roe_email',
  p_project_data->>'project_type',
  COALESCE((p_project_data->>'state_funding')::numeric, 0),
  COALESCE((p_project_data->>'federal_funding')::numeric, 0),
  CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END  -- NEW
)
RETURNING id INTO v_project_id;

-- Add approval history entry if pending
IF p_require_approval THEN
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    metadata
  ) VALUES (
    'project',
    v_project_id,
    'resubmitted',  -- Initial submission
    p_user_id,
    NULL,
    'pending',
    jsonb_build_object(
      'scan_id', p_scan_id,
      'source', 'scan_upload'
    )
  );
END IF;

-- 2. Create new employer (around line 130)
IF v_builder_id IS NULL AND (p_project_data->'builder'->>'createNew')::boolean THEN
  INSERT INTO employers (
    name,
    employer_type,
    website,
    notes,
    approval_status  -- NEW
  ) VALUES (
    p_project_data->'builder'->'newEmployerData'->>'name',
    p_project_data->'builder'->'newEmployerData'->>'employer_type',
    p_project_data->'builder'->'newEmployerData'->>'website',
    p_project_data->'builder'->'newEmployerData'->>'notes',
    CASE WHEN p_require_approval THEN 'pending' ELSE 'active' END  -- NEW
  )
  RETURNING id INTO v_builder_id;

  -- Add approval history entry if pending
  IF p_require_approval THEN
    INSERT INTO approval_history (
      entity_type,
      entity_id,
      action,
      performed_by,
      previous_status,
      new_status,
      metadata
    ) VALUES (
      'employer',
      v_builder_id,
      'resubmitted',
      p_user_id,
      NULL,
      'pending',
      jsonb_build_object(
        'scan_id', p_scan_id,
        'project_id', v_project_id,
        'source', 'scan_upload'
      )
    );
  END IF;
END IF;
```

#### 1.3 Create New RPC Functions for Approval Actions

**Add to same migration file**:

```sql
-- Function: approve_project
CREATE OR REPLACE FUNCTION approve_project(
  p_project_id uuid,
  p_admin_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load project
  SELECT * INTO v_project_record
  FROM projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;

  IF v_project_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Project is not pending approval',
      'status', 400
    );
  END IF;

  -- Update project
  UPDATE projects
  SET
    approval_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = now()
  WHERE id = p_project_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'project',
    p_project_id,
    'approved',
    p_admin_user_id,
    'pending',
    'active',
    p_notes,
    jsonb_build_object('approved_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'projectId', p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_project(uuid, uuid, text) TO authenticated;

-- Function: reject_project
CREATE OR REPLACE FUNCTION reject_project(
  p_project_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load project
  SELECT * INTO v_project_record
  FROM projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Project not found',
      'status', 404
    );
  END IF;

  IF v_project_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Project is not pending approval',
      'status', 400
    );
  END IF;

  -- Update project
  UPDATE projects
  SET
    approval_status = 'rejected',
    approved_by = p_admin_user_id,
    approved_at = now(),
    rejection_reason = p_reason
  WHERE id = p_project_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'project',
    p_project_id,
    'rejected',
    p_admin_user_id,
    'pending',
    'rejected',
    p_reason,
    jsonb_build_object('rejected_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'projectId', p_project_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_project(uuid, uuid, text) TO authenticated;

-- Function: approve_employer
CREATE OR REPLACE FUNCTION approve_employer(
  p_employer_id uuid,
  p_admin_user_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employer_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load employer
  SELECT * INTO v_employer_record
  FROM employers
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Employer not found',
      'status', 404
    );
  END IF;

  IF v_employer_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Employer is not pending approval',
      'status', 400
    );
  END IF;

  -- Update employer
  UPDATE employers
  SET
    approval_status = 'active',
    approved_by = p_admin_user_id,
    approved_at = now()
  WHERE id = p_employer_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'employer',
    p_employer_id,
    'approved',
    p_admin_user_id,
    'pending',
    'active',
    p_notes,
    jsonb_build_object('approved_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'employerId', p_employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION approve_employer(uuid, uuid, text) TO authenticated;

-- Function: reject_employer
CREATE OR REPLACE FUNCTION reject_employer(
  p_employer_id uuid,
  p_admin_user_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_employer_record RECORD;
  v_is_admin boolean;
BEGIN
  -- Verify user is admin or lead_organiser
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_admin_user_id
    AND role IN ('admin', 'lead_organiser')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized - admin or lead_organiser role required',
      'status', 403
    );
  END IF;

  -- Load employer
  SELECT * INTO v_employer_record
  FROM employers
  WHERE id = p_employer_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'error', 'Employer not found',
      'status', 404
    );
  END IF;

  IF v_employer_record.approval_status != 'pending' THEN
    RETURN jsonb_build_object(
      'error', 'Employer is not pending approval',
      'status', 400
    );
  END IF;

  -- Update employer
  UPDATE employers
  SET
    approval_status = 'rejected',
    approved_by = p_admin_user_id,
    approved_at = now(),
    rejection_reason = p_reason
  WHERE id = p_employer_id;

  -- Record in history
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    action,
    performed_by,
    previous_status,
    new_status,
    reason,
    metadata
  ) VALUES (
    'employer',
    p_employer_id,
    'rejected',
    p_admin_user_id,
    'pending',
    'rejected',
    p_reason,
    jsonb_build_object('rejected_at', now())
  );

  RETURN jsonb_build_object(
    'success', true,
    'employerId', p_employer_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION reject_employer(uuid, uuid, text) TO authenticated;

COMMENT ON FUNCTION approve_project(uuid, uuid, text) IS 'Approves a pending project. Admin/lead_organiser only.';
COMMENT ON FUNCTION reject_project(uuid, uuid, text) IS 'Rejects a pending project with reason. Admin/lead_organiser only.';
COMMENT ON FUNCTION approve_employer(uuid, uuid, text) IS 'Approves a pending employer. Admin/lead_organiser only.';
COMMENT ON FUNCTION reject_employer(uuid, uuid, text) IS 'Rejects a pending employer with reason. Admin/lead_organiser only.';
```

#### 1.4 Update RLS Policies

**Add to same migration file**:

```sql
-- Update RLS policies to hide pending items from regular users

-- Projects: Regular users cannot see pending projects (unless they created them via scan)
CREATE POLICY "Users cannot see pending projects unless creator"
  ON projects FOR SELECT
  USING (
    approval_status != 'pending'
    OR
    EXISTS (
      SELECT 1 FROM mapping_sheet_scans mss
      WHERE mss.created_project_id = projects.id
      AND mss.uploaded_by = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

-- Employers: Regular users cannot see pending employers
CREATE POLICY "Users cannot see pending employers unless admin"
  ON employers FOR SELECT
  USING (
    approval_status != 'pending'
    OR
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

-- NOTE: You may need to drop existing policies first if they conflict
-- DROP POLICY IF EXISTS "existing_policy_name" ON projects;
-- Then recreate with new logic
```

### PHASE 2: API Routes

#### 2.1 Update New Project API Route

**File**: `src/app/api/projects/new-from-scan/route.ts`

**Changes**:
```typescript
// Around line 52, add requireApproval parameter
const { data: result, error: rpcError } = await supabase.rpc('create_project_from_scan', {
  p_user_id: user.id,
  p_scan_id: scanId,
  p_project_data: projectData as any,
  p_contacts: (contactsDecisions || []) as any,
  p_subcontractors: (subcontractorDecisions || []) as any,
  p_employer_creations: (employerCreations || []) as any,
  p_require_approval: true,  // NEW - always require approval for scan uploads
})
```

#### 2.2 Create Approval API Routes

**File**: `src/app/api/admin/approve-project/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { projectId, notes } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('approve_project', {
      p_project_id: projectId,
      p_admin_user_id: user.id,
      p_notes: notes || null,
    })

    if (rpcError) {
      console.error('RPC error approving project:', rpcError)
      return NextResponse.json({ error: 'Failed to approve project' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, projectId: result.projectId })
  } catch (error) {
    console.error('Approve project error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}
```

**File**: `src/app/api/admin/reject-project/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { projectId, reason } = await request.json()

    if (!projectId || !reason) {
      return NextResponse.json({ error: 'Missing projectId or reason' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('reject_project', {
      p_project_id: projectId,
      p_admin_user_id: user.id,
      p_reason: reason,
    })

    if (rpcError) {
      console.error('RPC error rejecting project:', rpcError)
      return NextResponse.json({ error: 'Failed to reject project' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, projectId: result.projectId })
  } catch (error) {
    console.error('Reject project error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rejection failed' },
      { status: 500 }
    )
  }
}
```

**File**: `src/app/api/admin/approve-employer/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { employerId, notes } = await request.json()

    if (!employerId) {
      return NextResponse.json({ error: 'Missing employerId' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('approve_employer', {
      p_employer_id: employerId,
      p_admin_user_id: user.id,
      p_notes: notes || null,
    })

    if (rpcError) {
      console.error('RPC error approving employer:', rpcError)
      return NextResponse.json({ error: 'Failed to approve employer' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, employerId: result.employerId })
  } catch (error) {
    console.error('Approve employer error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Approval failed' },
      { status: 500 }
    )
  }
}
```

**File**: `src/app/api/admin/reject-employer/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { employerId, reason } = await request.json()

    if (!employerId || !reason) {
      return NextResponse.json({ error: 'Missing employerId or reason' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: result, error: rpcError } = await supabase.rpc('reject_employer', {
      p_employer_id: employerId,
      p_admin_user_id: user.id,
      p_reason: reason,
    })

    if (rpcError) {
      console.error('RPC error rejecting employer:', rpcError)
      return NextResponse.json({ error: 'Failed to reject employer' }, { status: 500 })
    }

    if (result?.error) {
      return NextResponse.json({ error: result.error }, { status: result.status || 500 })
    }

    return NextResponse.json({ success: true, employerId: result.employerId })
  } catch (error) {
    console.error('Reject employer error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Rejection failed' },
      { status: 500 }
    )
  }
}
```

**File**: `src/app/api/admin/pending-items/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or lead_organiser
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'lead_organiser'])

    if (!userRoles || userRoles.length === 0) {
      return NextResponse.json({ error: 'Forbidden - admin access required' }, { status: 403 })
    }

    // Fetch pending projects with scan info
    const { data: pendingProjects, error: projectsError } = await supabase
      .from('projects')
      .select(`
        id,
        name,
        value,
        proposed_start_date,
        created_at,
        main_job_site:job_sites!main_job_site_id (
          full_address
        ),
        scan:mapping_sheet_scans!created_project_id (
          id,
          file_name,
          uploaded_by,
          uploader:users!uploaded_by (
            email,
            full_name
          )
        )
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })

    if (projectsError) {
      console.error('Error fetching pending projects:', projectsError)
    }

    // Fetch pending employers
    const { data: pendingEmployers, error: employersError } = await supabase
      .from('employers')
      .select(`
        id,
        name,
        employer_type,
        website,
        created_at
      `)
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: false })

    if (employersError) {
      console.error('Error fetching pending employers:', employersError)
    }

    return NextResponse.json({
      projects: pendingProjects || [],
      employers: pendingEmployers || [],
    })
  } catch (error) {
    console.error('Pending items fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    )
  }
}
```

### PHASE 3: Admin Dashboard UI

#### 3.1 Create Pending Projects Table Component

**File**: `src/components/admin/PendingProjectsTable.tsx` (NEW)

```typescript
'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Check, X, Eye } from 'lucide-react'
import { ProjectReviewDialog } from './ProjectReviewDialog'

interface PendingProject {
  id: string
  name: string
  value: number | null
  proposed_start_date: string | null
  created_at: string
  main_job_site?: {
    full_address: string | null
  } | null
  scan?: {
    id: string
    file_name: string
    uploader?: {
      email: string
      full_name: string | null
    } | null
  }[]
}

interface PendingProjectsTableProps {
  projects: PendingProject[]
  onApprove: (projectId: string, notes?: string) => Promise<void>
  onReject: (projectId: string, reason: string) => Promise<void>
  onRefresh: () => void
}

export function PendingProjectsTable({
  projects,
  onApprove,
  onReject,
  onRefresh,
}: PendingProjectsTableProps) {
  const [selectedProject, setSelectedProject] = useState<PendingProject | null>(null)
  const [isReviewOpen, setIsReviewOpen] = useState(false)

  const handleReview = (project: PendingProject) => {
    setSelectedProject(project)
    setIsReviewOpen(true)
  }

  const handleApproveFromDialog = async (notes?: string) => {
    if (selectedProject) {
      await onApprove(selectedProject.id, notes)
      setIsReviewOpen(false)
      setSelectedProject(null)
    }
  }

  const handleRejectFromDialog = async (reason: string) => {
    if (selectedProject) {
      await onReject(selectedProject.id, reason)
      setIsReviewOpen(false)
      setSelectedProject(null)
    }
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending projects
      </div>
    )
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project Name</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Submitted By</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => (
            <TableRow key={project.id}>
              <TableCell className="font-medium">{project.name}</TableCell>
              <TableCell>
                {project.main_job_site?.full_address || 'No address'}
              </TableCell>
              <TableCell>
                {project.value
                  ? `$${project.value.toLocaleString()}`
                  : 'N/A'}
              </TableCell>
              <TableCell>
                {project.scan?.[0]?.uploader?.full_name ||
                  project.scan?.[0]?.uploader?.email ||
                  'Unknown'}
              </TableCell>
              <TableCell>
                {format(new Date(project.created_at), 'MMM d, yyyy')}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReview(project)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Review
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedProject && (
        <ProjectReviewDialog
          open={isReviewOpen}
          onOpenChange={setIsReviewOpen}
          project={selectedProject}
          onApprove={handleApproveFromDialog}
          onReject={handleRejectFromDialog}
        />
      )}
    </>
  )
}
```

#### 3.2 Create Project Review Dialog

**File**: `src/components/admin/ProjectReviewDialog.tsx` (NEW)

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

interface ProjectReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: any
  onApprove: (notes?: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ProjectReviewDialog({
  open,
  onOpenChange,
  project,
  onApprove,
  onReject,
}: ProjectReviewDialogProps) {
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(notes || undefined)
      setNotes('')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      return
    }
    setIsRejecting(true)
    try {
      await onReject(rejectionReason)
      setRejectionReason('')
      setShowRejectConfirm(false)
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Project: {project.name}</DialogTitle>
          <DialogDescription>
            Submitted {format(new Date(project.created_at), 'MMMM d, yyyy')} by{' '}
            {project.scan?.[0]?.uploader?.full_name ||
              project.scan?.[0]?.uploader?.email}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicate Check</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Project Name</Label>
                <p className="font-medium">{project.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Value</Label>
                <p className="font-medium">
                  {project.value
                    ? `$${project.value.toLocaleString()}`
                    : 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Address</Label>
                <p className="font-medium">
                  {project.main_job_site?.full_address || 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Start Date</Label>
                <p className="font-medium">
                  {project.proposed_start_date
                    ? format(new Date(project.proposed_start_date), 'MMM d, yyyy')
                    : 'Not specified'}
                </p>
              </div>
            </div>

            {/* TODO: Add more project details, contacts, subcontractors */}
          </TabsContent>

          <TabsContent value="duplicates">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Duplicate detection not yet implemented. Manually verify this
                project does not already exist in the system.
              </AlertDescription>
            </Alert>
            {/* TODO: Implement duplicate detection logic */}
          </TabsContent>
        </Tabs>

        {!showRejectConfirm ? (
          <DialogFooter className="mt-6">
            <div className="flex flex-col gap-4 w-full">
              <div className="space-y-2">
                <Label htmlFor="approval-notes">
                  Approval Notes (optional)
                </Label>
                <Textarea
                  id="approval-notes"
                  placeholder="Add any notes about this approval..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isApproving || isRejecting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={isApproving || isRejecting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isApproving ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        ) : (
          <div className="space-y-4 mt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to reject this project? This action cannot
                be undone.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason (required)
              </Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this project is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectConfirm(false)
                  setRejectionReason('')
                }}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

#### 3.3 Create Pending Employers Table

**File**: `src/components/admin/PendingEmployersTable.tsx` (NEW)

```typescript
'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { Check, X } from 'lucide-react'

interface PendingEmployer {
  id: string
  name: string
  employer_type: string | null
  website: string | null
  created_at: string
}

interface PendingEmployersTableProps {
  employers: PendingEmployer[]
  onApprove: (employerId: string, notes?: string) => Promise<void>
  onReject: (employerId: string, reason: string) => Promise<void>
}

export function PendingEmployersTable({
  employers,
  onApprove,
  onReject,
}: PendingEmployersTableProps) {
  if (employers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending employers
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Website</TableHead>
          <TableHead>Submitted</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employers.map((employer) => (
          <TableRow key={employer.id}>
            <TableCell className="font-medium">{employer.name}</TableCell>
            <TableCell>
              {employer.employer_type ? (
                <Badge variant="outline">{employer.employer_type}</Badge>
              ) : (
                'N/A'
              )}
            </TableCell>
            <TableCell>
              {employer.website ? (
                <a
                  href={employer.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {employer.website}
                </a>
              ) : (
                'N/A'
              )}
            </TableCell>
            <TableCell>
              {format(new Date(employer.created_at), 'MMM d, yyyy')}
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    window.confirm('Reject this employer?') &&
                    onReject(
                      employer.id,
                      prompt('Rejection reason:') || 'No reason provided'
                    )
                  }
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onApprove(employer.id)}
                >
                  <Check className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
```

#### 3.4 Update Admin Page with Pending Approvals Tab

**File**: `src/app/(app)/admin/page.tsx`

**Add import**:
```typescript
import { PendingProjectsTable } from '@/components/admin/PendingProjectsTable'
import { PendingEmployersTable } from '@/components/admin/PendingEmployersTable'
```

**Add state and fetch logic** (in component):
```typescript
const [pendingProjects, setPendingProjects] = useState<any[]>([])
const [pendingEmployers, setPendingEmployers] = useState<any[]>([])
const [isLoadingPending, setIsLoadingPending] = useState(false)

const fetchPendingItems = async () => {
  setIsLoadingPending(true)
  try {
    const response = await fetch('/api/admin/pending-items')
    if (response.ok) {
      const data = await response.json()
      setPendingProjects(data.projects || [])
      setPendingEmployers(data.employers || [])
    }
  } catch (error) {
    console.error('Error fetching pending items:', error)
  } finally {
    setIsLoadingPending(false)
  }
}

useEffect(() => {
  fetchPendingItems()
}, [])

const handleApproveProject = async (projectId: string, notes?: string) => {
  try {
    const response = await fetch('/api/admin/approve-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, notes }),
    })
    if (response.ok) {
      toast.success('Project approved')
      await fetchPendingItems()
    } else {
      toast.error('Failed to approve project')
    }
  } catch (error) {
    console.error('Error approving project:', error)
    toast.error('Failed to approve project')
  }
}

const handleRejectProject = async (projectId: string, reason: string) => {
  try {
    const response = await fetch('/api/admin/reject-project', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, reason }),
    })
    if (response.ok) {
      toast.success('Project rejected')
      await fetchPendingItems()
    } else {
      toast.error('Failed to reject project')
    }
  } catch (error) {
    console.error('Error rejecting project:', error)
    toast.error('Failed to reject project')
  }
}

const handleApproveEmployer = async (employerId: string, notes?: string) => {
  try {
    const response = await fetch('/api/admin/approve-employer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employerId, notes }),
    })
    if (response.ok) {
      toast.success('Employer approved')
      await fetchPendingItems()
    } else {
      toast.error('Failed to approve employer')
    }
  } catch (error) {
    console.error('Error approving employer:', error)
    toast.error('Failed to approve employer')
  }
}

const handleRejectEmployer = async (employerId: string, reason: string) => {
  try {
    const response = await fetch('/api/admin/reject-employer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employerId, reason }),
    })
    if (response.ok) {
      toast.success('Employer rejected')
      await fetchPendingItems()
    } else {
      toast.error('Failed to reject employer')
    }
  } catch (error) {
    console.error('Error rejecting employer:', error)
    toast.error('Failed to reject employer')
  }
}
```

**Add tab to Tabs component**:
```typescript
<TabsList>
  {/* existing tabs */}
  <TabsTrigger value="pending">
    Pending Approvals
    {(pendingProjects.length + pendingEmployers.length > 0) && (
      <Badge variant="destructive" className="ml-2">
        {pendingProjects.length + pendingEmployers.length}
      </Badge>
    )}
  </TabsTrigger>
</TabsList>

<TabsContent value="pending">
  <div className="space-y-8">
    <div>
      <h3 className="text-lg font-semibold mb-4">
        Pending Projects ({pendingProjects.length})
      </h3>
      <PendingProjectsTable
        projects={pendingProjects}
        onApprove={handleApproveProject}
        onReject={handleRejectProject}
        onRefresh={fetchPendingItems}
      />
    </div>

    <div>
      <h3 className="text-lg font-semibold mb-4">
        Pending Employers ({pendingEmployers.length})
      </h3>
      <PendingEmployersTable
        employers={pendingEmployers}
        onApprove={handleApproveEmployer}
        onReject={handleRejectEmployer}
      />
    </div>
  </div>
</TabsContent>
```

### PHASE 4: User-Facing UI Updates

#### 4.1 Show Pending Status in Review Page

**File**: `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx`

**Add after successful import** (around line where redirect happens):
```typescript
// After import succeeds
if (result.success) {
  toast.success(
    'Project submitted for review. An admin will review and approve it soon.',
    { duration: 5000 }
  )

  // Still redirect to project page, but it will show "Pending Approval" badge
  router.push(`/projects/${result.projectId}`)
}
```

#### 4.2 Show Pending Badge on Project Detail Page

**File**: Find project detail page (likely `src/app/(app)/projects/[projectId]/page.tsx`)

**Add badge display**:
```typescript
{project.approval_status === 'pending' && (
  <Badge variant="warning" className="ml-2">
    Pending Approval
  </Badge>
)}

{project.approval_status === 'rejected' && (
  <Alert variant="destructive" className="mt-4">
    <AlertTriangle className="h-4 w-4" />
    <AlertDescription>
      This project was rejected: {project.rejection_reason}
    </AlertDescription>
  </Alert>
)}
```

### PHASE 5: Testing & Deployment

#### 5.1 Manual Testing Checklist

**Test Case 1: New Project Upload with Approval**
1. Upload scan via "Create from Scanned Data"
2. Complete review and click "Confirm Import"
3. Verify project created with `approval_status = 'pending'`
4. Verify approval_history entry created
5. Verify user sees "Pending Approval" message
6. Verify user can view their pending project
7. Verify regular users CANNOT see this pending project
8. Admin reviews and approves
9. Verify project becomes active
10. Verify approval_history updated

**Test Case 2: New Employer in New Project**
1. Upload scan with "Create new employer" option
2. Verify employer created with `approval_status = 'pending'`
3. Verify employer appears in admin pending list
4. Admin approves employer
5. Verify employer becomes active

**Test Case 3: Rejection Flow**
1. Admin rejects project with reason
2. Verify project status = 'rejected'
3. Verify user sees rejection reason
4. Verify approval_history contains rejection

#### 5.2 Database Verification Queries

```sql
-- Check pending counts
SELECT
  (SELECT COUNT(*) FROM projects WHERE approval_status = 'pending') as pending_projects,
  (SELECT COUNT(*) FROM employers WHERE approval_status = 'pending') as pending_employers;

-- Check approval history
SELECT * FROM approval_history ORDER BY created_at DESC LIMIT 10;

-- Check RLS policies working
SET ROLE authenticated;
SET request.jwt.claim.sub = '[regular-user-id]';
SELECT COUNT(*) FROM projects WHERE approval_status = 'pending';
-- Should return 0 or only user's own pending projects

RESET ROLE;
```

### Implementation Notes

1. **Start with Phase 1** - Get database and backend working first
2. **Test RPC functions** directly before building UI
3. **Add logging** to RPC functions for debugging
4. **Consider notifications** - email alerts when items need approval (future enhancement)
5. **Duplicate detection** - Implement fuzzy matching in ProjectReviewDialog (future enhancement)

### Success Criteria

- ✅ New projects from scans require approval
- ✅ New employers from scans require approval
- ✅ Admin can see pending items in dashboard
- ✅ Admin can approve/reject with notes/reasons
- ✅ Approval history is tracked
- ✅ RLS prevents regular users from seeing pending items
- ✅ User sees pending status on their submissions
- ✅ All actions are logged and auditable

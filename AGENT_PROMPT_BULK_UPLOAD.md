# Agent Task: Implement Bulk Upload for Multiple Projects from Single PDF

## Context

You are working on a Next.js application with Supabase backend that allows users to upload and scan mapping sheets. Currently, users can only upload one project at a time.

**Your task**: Implement a bulk upload feature that allows users to upload a single PDF containing multiple projects (mix of new and existing), intelligently split the PDF by project boundaries, match each project to existing records or mark as new, and route each through the appropriate workflow.

## Background

**Current Architecture**:
- Single-project uploads via `UploadMappingSheetDialog`
- AI extraction using Claude API
- Worker processing via Railway
- Two workflows: "new project" and "existing project"
- Review pages for both workflows

**New Requirement**:
Mapping sheets are typically 2 pages per project and use standardized forms. Users often receive batches of 5-20 projects at once and want to upload them all together instead of one at a time.

## Technical Stack

- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (PostgreSQL, RLS, RPC functions)
- **Worker**: Railway worker for background processing
- **PDF Processing**: pdf-lib (already used for page selection)
- **AI**: Claude API via Anthropic SDK

## Key Design Decisions

### 1. PDF Splitting Strategy

**Option A: User-specified page ranges** (RECOMMENDED)
- User uploads PDF
- System shows preview of all pages
- User manually draws boundaries ("Project 1: pages 1-2", "Project 2: pages 3-4")
- Pro: 100% accurate, works with variable-length projects
- Con: Requires user interaction

**Option B: AI-based automatic detection**
- AI analyzes PDF and detects project boundaries
- Pro: Fully automatic
- Con: Complex, potential for errors, expensive
- Recommend as Phase 2 enhancement

**DECISION: Start with Option A, add Option B later**

### 2. Batch Processing Model

**Approach: Parent-Child with Batch ID**
- Create `batch_uploads` table (parent)
- Link multiple `mapping_sheet_scans` to batch_id (children)
- Each child scan processes independently
- Batch tracks overall progress
- Allows partial failures without blocking entire batch

### 3. User Experience Flow

```
1. User clicks "Bulk Upload" in Projects page
2. Upload PDF (5-50 pages)
3. PDF Preview: User defines project boundaries
   - Drag to select page ranges
   - Assign tentative names
   - Mark as "new" or "match to existing"
4. Submit batch
5. Background: Split PDF into individual project PDFs
6. Background: Create scan record for each project
7. Background: Workers process each scan in parallel
8. User returns to "My Batches" page
9. For each project:
   - If "new": Review and create
   - If "existing": Select project and attach
10. Batch completion when all projects processed
```

## Implementation Phases

### PHASE 1: Database Schema & Backend

#### 1.1 Create Migration File

**File**: `supabase/migrations/20251010020000_add_bulk_upload.sql`

```sql
-- Add bulk upload support for multiple projects from single PDF

-- 1. Create batch_uploads table
CREATE TABLE batch_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  original_file_url text NOT NULL,
  original_file_name text NOT NULL,
  original_file_size_bytes bigint NOT NULL,
  total_pages integer NOT NULL,
  total_projects integer NOT NULL,
  projects_completed integer DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',      -- User defining boundaries
    'processing',   -- Splitting PDF and creating scans
    'in_progress',  -- Some scans processing
    'completed',    -- All scans processed successfully
    'partial',      -- Some scans failed
    'failed'        -- Batch processing failed
  )),
  project_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Format: [{ startPage: 1, endPage: 2, tentativeName: "Project A", mode: "new" | "existing", projectId?: uuid }]

  error_message text,
  created_at timestamptz DEFAULT now(),
  processing_started_at timestamptz,
  processing_completed_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX idx_batch_uploads_uploaded_by ON batch_uploads(uploaded_by);
CREATE INDEX idx_batch_uploads_status ON batch_uploads(status);
CREATE INDEX idx_batch_uploads_created_at ON batch_uploads(created_at DESC);

COMMENT ON TABLE batch_uploads IS 'Parent records for bulk PDF uploads containing multiple projects';

-- 2. Add batch_id to mapping_sheet_scans
ALTER TABLE mapping_sheet_scans
ADD COLUMN batch_id uuid REFERENCES batch_uploads(id) ON DELETE CASCADE;

CREATE INDEX idx_mapping_sheet_scans_batch_id ON mapping_sheet_scans(batch_id);

COMMENT ON COLUMN mapping_sheet_scans.batch_id IS 'Links scan to parent batch upload if part of bulk upload';

-- 3. RLS for batch_uploads
ALTER TABLE batch_uploads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own batch uploads"
  ON batch_uploads FOR SELECT
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Users can insert their own batch uploads"
  ON batch_uploads FOR INSERT
  TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Users can update their own batch uploads"
  ON batch_uploads FOR UPDATE
  TO authenticated
  USING (uploaded_by = auth.uid())
  WITH CHECK (uploaded_by = auth.uid());

CREATE POLICY "Admins can view all batch uploads"
  ON batch_uploads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'lead_organiser')
    )
  );

GRANT SELECT, INSERT, UPDATE ON batch_uploads TO authenticated;

-- 4. Function to update batch progress
CREATE OR REPLACE FUNCTION update_batch_progress(p_batch_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total integer;
  v_completed integer;
  v_failed integer;
  v_new_status text;
BEGIN
  -- Count scan statuses
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'under_review', 'confirmed')),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_completed, v_failed
  FROM mapping_sheet_scans
  WHERE batch_id = p_batch_id;

  -- Determine batch status
  IF v_completed = v_total THEN
    v_new_status := 'completed';
  ELSIF v_failed > 0 AND (v_completed + v_failed) = v_total THEN
    v_new_status := 'partial';
  ELSIF v_completed > 0 OR v_failed > 0 THEN
    v_new_status := 'in_progress';
  ELSE
    v_new_status := 'processing';
  END IF;

  -- Update batch
  UPDATE batch_uploads
  SET
    projects_completed = v_completed,
    status = v_new_status,
    processing_completed_at = CASE WHEN v_new_status IN ('completed', 'partial') THEN now() ELSE NULL END
  WHERE id = p_batch_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_batch_progress(uuid) TO authenticated;

COMMENT ON FUNCTION update_batch_progress(uuid) IS 'Updates batch upload progress based on child scan statuses';

-- 5. Trigger to auto-update batch progress when scans change
CREATE OR REPLACE FUNCTION trigger_update_batch_progress()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.batch_id IS NOT NULL THEN
    PERFORM update_batch_progress(NEW.batch_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_batch_on_scan_change
  AFTER INSERT OR UPDATE OF status ON mapping_sheet_scans
  FOR EACH ROW
  WHEN (NEW.batch_id IS NOT NULL)
  EXECUTE FUNCTION trigger_update_batch_progress();

COMMENT ON TRIGGER update_batch_on_scan_change ON mapping_sheet_scans IS 'Auto-updates parent batch progress when child scan status changes';
```

#### 1.2 Create RPC for Batch Creation

**Add to migration or new file**:

```sql
-- Function to initialize batch upload after PDF split
CREATE OR REPLACE FUNCTION create_batch_upload_with_scans(
  p_user_id uuid,
  p_batch_data jsonb,
  p_scans jsonb  -- Array of scan records to create
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_batch_id uuid;
  v_scan jsonb;
  v_scan_id uuid;
  v_scan_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  -- Verify user is authenticated
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RETURN jsonb_build_object(
      'error', 'Unauthorized',
      'status', 403
    );
  END IF;

  -- Create batch record
  INSERT INTO batch_uploads (
    uploaded_by,
    original_file_url,
    original_file_name,
    original_file_size_bytes,
    total_pages,
    total_projects,
    project_definitions,
    status,
    processing_started_at
  ) VALUES (
    p_user_id,
    p_batch_data->>'original_file_url',
    p_batch_data->>'original_file_name',
    (p_batch_data->>'original_file_size_bytes')::bigint,
    (p_batch_data->>'total_pages')::integer,
    (p_batch_data->>'total_projects')::integer,
    p_batch_data->'project_definitions',
    'processing',
    now()
  )
  RETURNING id INTO v_batch_id;

  -- Create scan records for each project
  FOR v_scan IN SELECT * FROM jsonb_array_elements(p_scans)
  LOOP
    INSERT INTO mapping_sheet_scans (
      batch_id,
      project_id,
      uploaded_by,
      file_url,
      file_name,
      file_size_bytes,
      status,
      upload_mode,
      notes,
      page_count
    ) VALUES (
      v_batch_id,
      (v_scan->>'project_id')::uuid,  -- NULL for new projects
      p_user_id,
      v_scan->>'file_url',
      v_scan->>'file_name',
      (v_scan->>'file_size_bytes')::bigint,
      'pending',
      v_scan->>'upload_mode',
      v_scan->>'notes',
      (v_scan->>'page_count')::integer
    )
    RETURNING id INTO v_scan_id;

    v_scan_ids := array_append(v_scan_ids, v_scan_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'batchId', v_batch_id,
    'scanIds', to_jsonb(v_scan_ids)
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'status', 500
    );
END;
$$;

GRANT EXECUTE ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb) TO authenticated;

COMMENT ON FUNCTION create_batch_upload_with_scans(uuid, jsonb, jsonb) IS 'Creates batch upload record and all child scan records in a transaction';
```

### PHASE 2: PDF Splitting Service

#### 2.1 Create PDF Splitting Utility

**File**: `src/lib/pdf/splitPdfByProjects.ts` (NEW)

```typescript
import { PDFDocument } from 'pdf-lib'

export interface ProjectDefinition {
  startPage: number  // 1-indexed
  endPage: number    // 1-indexed
  tentativeName: string
  mode: 'new_project' | 'existing_project'
  projectId?: string  // For existing_project mode
}

export interface SplitResult {
  fileName: string
  pdfBytes: Uint8Array
  pageCount: number
  definition: ProjectDefinition
}

/**
 * Splits a PDF into multiple PDFs based on project definitions
 * @param pdfBytes Original PDF as Uint8Array
 * @param definitions Project boundary definitions
 * @returns Array of split PDF results
 */
export async function splitPdfByProjects(
  pdfBytes: Uint8Array,
  definitions: ProjectDefinition[]
): Promise<SplitResult[]> {
  // Load the source PDF
  const sourcePdf = await PDFDocument.load(pdfBytes)
  const totalPages = sourcePdf.getPageCount()

  // Validate definitions
  for (const def of definitions) {
    if (def.startPage < 1 || def.startPage > totalPages) {
      throw new Error(
        `Invalid startPage ${def.startPage} for "${def.tentativeName}"`
      )
    }
    if (def.endPage < def.startPage || def.endPage > totalPages) {
      throw new Error(
        `Invalid endPage ${def.endPage} for "${def.tentativeName}"`
      )
    }
  }

  // Check for overlaps (optional but recommended)
  const usedPages = new Set<number>()
  for (const def of definitions) {
    for (let i = def.startPage; i <= def.endPage; i++) {
      if (usedPages.has(i)) {
        throw new Error(`Page ${i} is assigned to multiple projects`)
      }
      usedPages.add(i)
    }
  }

  // Split PDFs
  const results: SplitResult[] = []

  for (const definition of definitions) {
    // Create new PDF document
    const newPdf = await PDFDocument.create()

    // Copy pages from source (convert to 0-indexed)
    const pageIndices = []
    for (let i = definition.startPage - 1; i < definition.endPage; i++) {
      pageIndices.push(i)
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices)
    copiedPages.forEach((page) => newPdf.addPage(page))

    // Serialize to bytes
    const pdfBytes = await newPdf.save()

    // Generate filename
    const sanitizedName = definition.tentativeName
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .substring(0, 50)

    const fileName = `${sanitizedName}-pages-${definition.startPage}-${definition.endPage}.pdf`

    results.push({
      fileName,
      pdfBytes,
      pageCount: definition.endPage - definition.startPage + 1,
      definition,
    })
  }

  return results
}
```

#### 2.2 Create PDF Upload Helper

**File**: `src/lib/pdf/uploadSplitPdfs.ts` (NEW)

```typescript
import { createBrowserClient } from '@/lib/supabase/client'
import { SplitResult } from './splitPdfByProjects'

export interface UploadedSplitPdf {
  path: string
  url: string
  fileName: string
  size: number
  definition: SplitResult['definition']
}

/**
 * Uploads split PDFs to Supabase Storage
 * @param batchId Batch upload ID for organizing files
 * @param userId User ID for file path
 * @param splitResults Results from splitPdfByProjects
 * @returns Array of upload results with storage paths
 */
export async function uploadSplitPdfs(
  batchId: string,
  userId: string,
  splitResults: SplitResult[]
): Promise<UploadedSplitPdf[]> {
  const supabase = createBrowserClient()
  const uploadedFiles: UploadedSplitPdf[] = []

  for (const result of splitResults) {
    // Create storage path: mapping-sheets/{userId}/batch-{batchId}/{fileName}
    const storagePath = `${userId}/batch-${batchId}/${result.fileName}`

    // Convert Uint8Array to Blob
    const blob = new Blob([result.pdfBytes], { type: 'application/pdf' })

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('mapping-sheets')
      .upload(storagePath, blob, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (error) {
      console.error(`Failed to upload ${result.fileName}:`, error)
      throw new Error(`Upload failed for ${result.fileName}: ${error.message}`)
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('mapping-sheets')
      .getPublicUrl(data.path)

    uploadedFiles.push({
      path: data.path,
      url: urlData.publicUrl,
      fileName: result.fileName,
      size: result.pdfBytes.length,
      definition: result.definition,
    })
  }

  return uploadedFiles
}
```

### PHASE 3: API Routes

#### 3.1 Batch Upload Initialization API

**File**: `src/app/api/projects/batch-upload/init/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

/**
 * POST /api/projects/batch-upload/init
 *
 * Step 1: Upload original PDF to storage
 * Returns batchId and upload URL for client to proceed with splitting
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const totalPages = parseInt(formData.get('totalPages') as string)

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Generate unique batch ID
    const batchId = crypto.randomUUID()

    // Upload original PDF to storage
    const storagePath = `${user.id}/batch-${batchId}/original-${file.name}`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('mapping-sheets')
      .upload(storagePath, file, {
        contentType: 'application/pdf',
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to upload file' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      batchId,
      fileUrl: uploadData.path,
      fileName: file.name,
      fileSize: file.size,
      totalPages,
    })
  } catch (error) {
    console.error('Batch init error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Init failed' },
      { status: 500 }
    )
  }
}
```

#### 3.2 Batch Upload Processing API

**File**: `src/app/api/projects/batch-upload/process/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { ProjectDefinition } from '@/lib/pdf/splitPdfByProjects'

/**
 * POST /api/projects/batch-upload/process
 *
 * Step 2: After client has split PDFs and uploaded them
 * Creates batch record and scan records, triggers worker processing
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      batchId,
      originalFileUrl,
      originalFileName,
      originalFileSize,
      totalPages,
      projectDefinitions,
      uploadedScans,  // Array of { fileUrl, fileName, fileSize, pageCount, definition }
    } = body

    if (!batchId || !projectDefinitions || !uploadedScans) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Prepare batch data
    const batchData = {
      original_file_url: originalFileUrl,
      original_file_name: originalFileName,
      original_file_size_bytes: originalFileSize,
      total_pages: totalPages,
      total_projects: projectDefinitions.length,
      project_definitions: projectDefinitions,
    }

    // Prepare scan records
    const scanRecords = uploadedScans.map((scan: any) => ({
      project_id: scan.definition.projectId || null,
      file_url: scan.fileUrl,
      file_name: scan.fileName,
      file_size_bytes: scan.fileSize,
      upload_mode: scan.definition.mode,
      notes: `Part of batch upload. Pages ${scan.definition.startPage}-${scan.definition.endPage} of original PDF.`,
      page_count: scan.pageCount,
    }))

    // Call RPC to create batch and scans
    const { data: result, error: rpcError } = await supabase.rpc(
      'create_batch_upload_with_scans',
      {
        p_user_id: user.id,
        p_batch_data: batchData as any,
        p_scans: scanRecords as any,
      }
    )

    if (rpcError) {
      console.error('RPC error creating batch:', rpcError)
      return NextResponse.json(
        { error: 'Failed to create batch upload' },
        { status: 500 }
      )
    }

    if (result?.error) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status || 500 }
      )
    }

    // Enqueue worker jobs for each scan
    const scanIds = result.scanIds as string[]
    for (const scanId of scanIds) {
      await supabase.from('scraper_jobs').insert({
        job_type: 'mapping_sheet_scan',
        payload: { scanId },
        status: 'pending',
      })
    }

    return NextResponse.json({
      success: true,
      batchId: result.batchId,
      scanIds: result.scanIds,
    })
  } catch (error) {
    console.error('Batch process error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Process failed' },
      { status: 500 }
    )
  }
}
```

#### 3.3 Batch Status API

**File**: `src/app/api/projects/batch-upload/[batchId]/status/route.ts` (NEW)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const { batchId } = params

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch batch with child scans
    const { data: batch, error: batchError } = await supabase
      .from('batch_uploads')
      .select(`
        *,
        scans:mapping_sheet_scans(
          id,
          file_name,
          status,
          upload_mode,
          project_id,
          created_project_id,
          page_count,
          confidence_scores
        )
      `)
      .eq('id', batchId)
      .single()

    if (batchError || !batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
    }

    // Verify ownership
    if (batch.uploaded_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(batch)
  } catch (error) {
    console.error('Batch status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Fetch failed' },
      { status: 500 }
    )
  }
}
```

### PHASE 4: Frontend UI Components

#### 4.1 Bulk Upload Button

**File**: Update `src/components/projects/ProjectsDesktopView.tsx`

**Add button next to "New Project"**:
```typescript
import { Upload } from 'lucide-react'
import { BulkUploadDialog } from './BulkUploadDialog'

// In component:
const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false)

// In header actions:
<Button
  variant="outline"
  onClick={() => setIsBulkUploadOpen(true)}
>
  <Upload className="h-4 w-4 mr-2" />
  Bulk Upload
</Button>

// At bottom of component:
<BulkUploadDialog
  open={isBulkUploadOpen}
  onOpenChange={setIsBulkUploadOpen}
/>
```

#### 4.2 Bulk Upload Dialog with PDF Preview

**File**: `src/components/projects/BulkUploadDialog.tsx` (NEW)

This is a complex component with multiple steps. Key features:

```typescript
'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { PDFPageSelector } from './bulk-upload/PDFPageSelector'
import { ProjectDefinitionEditor } from './bulk-upload/ProjectDefinitionEditor'
import { BatchProcessingSummary } from './bulk-upload/BatchProcessingSummary'

type Step = 'upload' | 'define' | 'processing' | 'complete'

interface BulkUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BulkUploadDialog({ open, onOpenChange }: BulkUploadDialogProps) {
  const [step, setStep] = useState<Step>('upload')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [totalPages, setTotalPages] = useState(0)
  const [projectDefinitions, setProjectDefinitions] = useState<ProjectDefinition[]>([])
  const [batchId, setBatchId] = useState<string | null>(null)

  // Implementation steps:
  // 1. Upload PDF, extract page count
  // 2. Show PDF preview with page thumbnails
  // 3. User draws boundaries and defines projects
  // 4. Split PDF client-side using pdf-lib
  // 5. Upload split PDFs
  // 6. Call process API
  // 7. Show progress/completion

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        {/* Step-based rendering */}
        {step === 'upload' && <UploadStep />}
        {step === 'define' && <DefineStep />}
        {step === 'processing' && <ProcessingStep />}
        {step === 'complete' && <CompleteStep />}
      </DialogContent>
    </Dialog>
  )
}
```

**Sub-components needed**:
1. **PDFPageSelector** - Thumbnail grid with page selection
2. **ProjectDefinitionEditor** - Form for each project definition
3. **BatchProcessingSummary** - Progress tracking during processing

#### 4.3 My Batches Page

**File**: `src/app/(app)/projects/batches/page.tsx` (NEW)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import Link from 'next/link'

interface Batch {
  id: string
  original_file_name: string
  total_projects: number
  projects_completed: number
  status: string
  created_at: string
}

export default function BatchesPage() {
  const [batches, setBatches] = useState<Batch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchBatches()
  }, [])

  const fetchBatches = async () => {
    const supabase = createBrowserClient()
    const { data, error } = await supabase
      .from('batch_uploads')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      setBatches(data)
    }
    setIsLoading(false)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      completed: 'default',
      in_progress: 'secondary',
      partial: 'outline',
      failed: 'destructive',
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">My Batch Uploads</h1>

      <div className="grid gap-4">
        {batches.map((batch) => (
          <Link key={batch.id} href={`/projects/batches/${batch.id}`}>
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{batch.original_file_name}</CardTitle>
                  {getStatusBadge(batch.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Projects:</span>{' '}
                    {batch.total_projects}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Completed:</span>{' '}
                    {batch.projects_completed}
                  </div>
                  <div>
                    <span className="text-muted-foreground">Uploaded:</span>{' '}
                    {format(new Date(batch.created_at), 'MMM d, yyyy')}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}

        {batches.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No batch uploads yet. Upload multiple projects at once from the
            Projects page.
          </div>
        )}
      </div>
    </div>
  )
}
```

#### 4.4 Batch Detail Page

**File**: `src/app/(app)/projects/batches/[batchId]/page.tsx` (NEW)

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function BatchDetailPage({
  params,
}: {
  params: { batchId: string }
}) {
  const router = useRouter()
  const [batch, setBatch] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchBatch()
    // Set up real-time subscription
    const supabase = createBrowserClient()
    const channel = supabase
      .channel(`batch-${params.batchId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'mapping_sheet_scans',
          filter: `batch_id=eq.${params.batchId}`,
        },
        () => {
          fetchBatch()
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [params.batchId])

  const fetchBatch = async () => {
    const response = await fetch(
      `/api/projects/batch-upload/${params.batchId}/status`
    )
    if (response.ok) {
      const data = await response.json()
      setBatch(data)
    }
    setIsLoading(false)
  }

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!batch) {
    return <div>Batch not found</div>
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold">{batch.original_file_name}</h1>
          <p className="text-muted-foreground">
            {batch.total_projects} projects •{' '}
            {batch.projects_completed} completed
          </p>
        </div>
        <Badge>{batch.status}</Badge>
      </div>

      <div className="grid gap-4">
        <h2 className="text-xl font-semibold">Projects in Batch</h2>

        {batch.scans?.map((scan: any, index: number) => (
          <Card key={scan.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle>
                  Project {index + 1}: {scan.file_name}
                </CardTitle>
                <Badge>{scan.status}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {scan.page_count} pages • {scan.upload_mode}
                </div>
                {scan.status === 'review_new_project' && (
                  <Button
                    onClick={() =>
                      router.push(`/projects/new-scan-review/${scan.id}`)
                    }
                  >
                    Review & Create Project
                  </Button>
                )}
                {scan.status === 'completed' && scan.upload_mode === 'existing_project' && (
                  <Button
                    onClick={() =>
                      router.push(`/projects/${scan.project_id}/scan-review/${scan.id}`)
                    }
                  >
                    Review & Attach
                  </Button>
                )}
                {scan.created_project_id && (
                  <Link href={`/projects/${scan.created_project_id}`}>
                    <Button variant="outline">View Project</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
```

### PHASE 5: Worker Updates

No worker changes needed! Existing worker already processes `mapping_sheet_scans` by ID. Batch scans will be queued and processed in parallel automatically.

**Optional optimization**: Add batch-aware priority so scans from same batch process concurrently.

### PHASE 6: Testing & Deployment

#### 6.1 Manual Testing Checklist

**Test Case 1: Simple Batch (2 new projects)**
1. Upload 4-page PDF
2. Define 2 projects: pages 1-2, pages 3-4
3. Mark both as "new_project"
4. Submit batch
5. Verify batch created with status "processing"
6. Verify 2 scans created with batch_id
7. Verify 2 worker jobs enqueued
8. Verify workers process both scans
9. Verify batch status updates to "in_progress" then "completed"
10. Review each project and create
11. Verify batch shows both projects completed

**Test Case 2: Mixed Batch (new + existing)**
1. Upload 6-page PDF
2. Define 3 projects: pages 1-2 (new), pages 3-4 (existing), pages 5-6 (new)
3. Assign project ID to existing project
4. Submit batch
5. Verify routing logic works for both modes

**Test Case 3: Partial Failure**
1. Upload batch with intentionally bad data
2. Verify batch status becomes "partial"
3. Verify user can retry failed scans

#### 6.2 Performance Considerations

**PDF Size Limits**:
- Client-side splitting: Max 50MB per PDF (browser memory)
- Total batch size: Max 20 projects recommended
- Page limit: 100 pages total

**Parallelization**:
- Workers process scans concurrently (Railway scales automatically)
- API calls are sequential (upload split PDFs one by one)
- Consider parallel uploads with Promise.all() for optimization

### Implementation Timeline Estimate

**Week 1: Backend**
- Day 1-2: Database schema and migrations
- Day 3-4: RPC functions and API routes
- Day 5: Testing backend with Postman/SQL

**Week 2: PDF Processing**
- Day 1-2: PDF splitting utility
- Day 3-4: Upload helpers and API integration
- Day 5: Testing with sample PDFs

**Week 3: Core UI**
- Day 1-2: BulkUploadDialog with file upload
- Day 3-4: PDFPageSelector component
- Day 5: ProjectDefinitionEditor

**Week 4: UI Polish & Pages**
- Day 1-2: Batch list page
- Day 3-4: Batch detail page with real-time updates
- Day 5: Error handling and edge cases

**Week 5: Testing & Deployment**
- Day 1-2: End-to-end testing
- Day 3-4: Bug fixes and optimization
- Day 5: Production deployment

**Total: 4-5 weeks** (matches earlier estimate)

### Success Criteria

- ✅ User can upload PDF with multiple projects
- ✅ User can define project boundaries visually
- ✅ PDFs are split accurately
- ✅ Each project is processed independently
- ✅ Batch progress is tracked and updated real-time
- ✅ User can review and create/attach each project
- ✅ Partial failures don't block entire batch
- ✅ All batch operations are logged and auditable
- ✅ RLS prevents users from seeing other users' batches

### Future Enhancements (Phase 2)

1. **AI-Based Auto-Detection**
   - Automatically detect project boundaries
   - User reviews/adjusts boundaries instead of defining from scratch
   - Estimate: +2 weeks

2. **Advanced Duplicate Detection**
   - Fuzzy matching during project definition
   - Warn user if project appears to already exist
   - Estimate: +1 week

3. **Batch Templates**
   - Save common patterns (e.g., "always 2 pages per project")
   - Apply template to new batch
   - Estimate: +3 days

4. **Export/Import Batch Definitions**
   - Save project definitions as JSON
   - Reuse for similar PDFs
   - Estimate: +2 days

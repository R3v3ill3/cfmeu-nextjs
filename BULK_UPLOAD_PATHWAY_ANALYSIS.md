# Bulk Upload Feature - Pathway Analysis & Recommendation

## Current State Analysis

### What's Working ✅
- PDF upload successfully captures file
- Page count detection working correctly
- Database schema and API routes in place
- Worker infrastructure ready for processing

### Issues Identified ❌

#### 1. **Projects Dropdown is Empty**
**Root Cause**: RLS Policy Restriction

```sql
-- Current policy (from 0000_remote_schema.sql):
CREATE POLICY "projects_select" ON "public"."projects" FOR SELECT
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM job_sites js
      WHERE js.project_id = projects.id
      AND can_access_job_site(js.id)
    )
  );
```

**Impact**: Regular users can ONLY see projects they're associated with via job_sites, not all projects in the system. This makes the dropdown empty for most users when trying to match to existing projects.

#### 2. **No Search Functionality**
- Current implementation uses basic `<Select>` dropdown
- No filtering, no fuzzy search
- Poor UX for databases with 100+ projects
- No project preview/details to help with matching

#### 3. **Manual Project Definition**
- User must manually specify:
  - Number of projects in the PDF
  - Page ranges for each project
  - Whether each is new or existing
- Time-consuming for 10-20 project batches
- Error-prone (overlapping pages, gaps)

---

## Infrastructure Already in Place

### ✅ AI Capabilities Available
You already have a **Claude-powered mapping sheet scanner** that:

1. **Reads PDFs Directly** (`railway_workers/mapping-sheet-scanner-worker/src/ai/claude.ts`)
   - Uses Anthropic Claude with PDF document support
   - No need for image conversion
   - Can process multi-page PDFs

2. **Extracts Project Information** (from `types.ts`):
   ```typescript
   export interface ExtractedMappingSheetData {
     project?: {
       project_name?: string        // ✅ Already extracts project names!
       project_value?: number
       address?: string
       builder?: string
       // ... other fields
     }
     confidence: {
       overall: number
       project?: Record<string, number>
     }
   }
   ```

3. **Has Page-Specific Processing**
   - Can focus on specific pages: `selectedPages?: number[]`
   - Can process page ranges independently

### ✅ Standardized Forms
From `AGENT_PROMPT_BULK_UPLOAD.md`:
> "Mapping sheets are typically **2 pages per project** and use **standardized forms**"

This predictable structure makes AI detection highly reliable.

---

## Option A: AI-Based Auto-Detection

### How It Would Work

```
1. User uploads PDF (e.g., 20 pages)

2. AI Analysis Phase (NEW):
   - Claude analyzes full PDF
   - Detects project boundaries by:
     * Identifying page 1 of standardized form pattern
     * Detecting project name/header changes
     * Using 2-page default with confidence scoring
   - Extracts tentative project name from each section

3. Present to User:
   ┌─────────────────────────────────────────┐
   │ Detected 10 Projects:                   │
   │                                         │
   │ ✓ Project 1: "Collins St Tower"        │
   │   Pages 1-2 | Confidence: 95%          │
   │   [Search Existing] [Create New] [Edit]│
   │                                         │
   │ ✓ Project 2: "West Gate Tunnel"        │
   │   Pages 3-4 | Confidence: 98%          │
   │   [Search Existing] [Create New] [Edit]│
   │                                         │
   │ ⚠ Project 3: "Unknown Project"         │
   │   Pages 5-7 | Confidence: 60%          │
   │   [Search Existing] [Create New] [Edit]│
   └─────────────────────────────────────────┘

4. User Reviews & Matches:
   - Click "Search Existing" → Searchable dialog opens
   - Type project name → Fuzzy search all projects
   - Select match OR click "Create New"
   - Adjust page boundaries if needed (rare)

5. Process batch (existing flow continues)
```

### Implementation Steps

#### Step 1: Create AI Boundary Detection API
**File**: `src/app/api/projects/batch-upload/analyze/route.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File

  // Convert to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Call Claude to analyze structure
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
        },
        {
          type: 'text',
          text: `Analyze this PDF containing multiple construction project mapping sheets.

Each project is typically 2 pages with a standardized form.

Your task:
1. Detect project boundaries (which pages belong to which project)
2. Extract the project name from the first page of each project
3. Provide confidence scores

Return JSON:
{
  "projects": [
    {
      "startPage": 1,
      "endPage": 2,
      "projectName": "Collins Street Tower",
      "confidence": 0.95
    },
    ...
  ],
  "totalPages": 20,
  "notes": ["Any warnings or observations"]
}`
        }
      ]
    }]
  })

  // Parse response and return
  const analysis = JSON.parse(message.content[0].text)
  return NextResponse.json(analysis)
}
```

#### Step 2: Update Dialog Flow
Add "analyze" step between upload and define:

```typescript
// In BulkUploadDialog.tsx
const [step, setStep] = useState<Step>('upload' | 'analyze' | 'define' | 'processing' | 'complete')

// After file upload:
const analyzeWithAI = async () => {
  setStep('analyze')
  setProcessingStatus('Analyzing PDF with AI...')

  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch('/api/projects/batch-upload/analyze', {
    method: 'POST',
    body: formData,
  })

  const analysis = await response.json()

  // Pre-populate project definitions
  setProjectDefinitions(
    analysis.projects.map((p: any) => ({
      id: crypto.randomUUID(),
      startPage: p.startPage,
      endPage: p.endPage,
      tentativeName: p.projectName,
      mode: 'new', // default
      confidence: p.confidence,
    }))
  )

  setStep('define')
}
```

#### Step 3: Add Project Search Component
**File**: `src/components/projects/ProjectSearchDialog.tsx`

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Command, CommandGroup, CommandItem } from '@/components/ui/command'

interface ProjectSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectProject: (project: Project) => void
  suggestedName?: string
}

export function ProjectSearchDialog({
  open,
  onOpenChange,
  onSelectProject,
  suggestedName
}: ProjectSearchDialogProps) {
  const [search, setSearch] = useState(suggestedName || '')
  const [results, setResults] = useState<Project[]>([])

  useEffect(() => {
    if (search.length > 2) {
      searchProjects(search)
    }
  }, [search])

  const searchProjects = async (query: string) => {
    // Use dedicated search API (bypasses RLS restrictions)
    const response = await fetch(`/api/projects/search?q=${encodeURIComponent(query)}`)
    const data = await response.json()
    setResults(data.projects || [])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Search for Existing Project</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mb-4"
        />

        <Command>
          <CommandGroup>
            {results.map((project) => (
              <CommandItem
                key={project.id}
                onSelect={() => {
                  onSelectProject(project)
                  onOpenChange(false)
                }}
              >
                <div>
                  <div className="font-medium">{project.project_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {project.project_address}
                    {project.project_number && ` • ${project.project_number}`}
                  </div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>

        {results.length === 0 && search.length > 2 && (
          <div className="text-center py-6 text-muted-foreground">
            No matching projects found
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

#### Step 4: Create Project Search API (Bypasses RLS)
**File**: `src/app/api/projects/search/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.get('q')

  if (!query || query.length < 3) {
    return NextResponse.json({ projects: [] })
  }

  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use service role client to bypass RLS for search
  const { data, error } = await supabase
    .rpc('search_all_projects', { search_query: query })

  if (error) {
    console.error('Search error:', error)
    return NextResponse.json({ projects: [] })
  }

  return NextResponse.json({ projects: data })
}
```

#### Step 5: Create Search RPC Function
**Add to migration**:

```sql
CREATE OR REPLACE FUNCTION search_all_projects(search_query text)
RETURNS TABLE (
  id uuid,
  project_name text,
  project_address text,
  project_number text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.project_name,
    p.project_address,
    p.project_number
  FROM projects p
  WHERE
    p.project_name ILIKE '%' || search_query || '%'
    OR p.project_address ILIKE '%' || search_query || '%'
    OR p.project_number ILIKE '%' || search_query || '%'
  ORDER BY
    CASE
      WHEN p.project_name ILIKE search_query || '%' THEN 1
      WHEN p.project_name ILIKE '%' || search_query || '%' THEN 2
      ELSE 3
    END,
    p.project_name
  LIMIT 50;
END;
$$;

GRANT EXECUTE ON FUNCTION search_all_projects(text) TO authenticated;
```

### Pros of Option A ✅
- **Automated boundary detection** - saves significant user time
- **Pre-populated project names** - helps with matching
- **High accuracy** - standardized 2-page forms are predictable
- **Leverages existing infrastructure** - Claude already integrated
- **Better UX** - user confirms rather than creates from scratch
- **Confidence scoring** - user knows which detections to review carefully

### Cons of Option A ❌
- **Additional AI costs** (~$0.05-0.15 per 20-page batch)
- **Processing time** (~10-20 seconds for analysis)
- **Potential errors** - non-standard PDFs may confuse detection
- **Complexity** - more moving parts to debug

---

## Option B: Enhanced Manual with Search

### How It Would Work

```
1. User uploads PDF (e.g., 20 pages)

2. Auto-Segmentation Helper (NEW):
   - Assume 2 pages per project by default
   - Pre-populate project definitions:
     * Project 1: pages 1-2
     * Project 2: pages 3-4
     * ...
     * Project 10: pages 19-20

3. Present to User:
   ┌─────────────────────────────────────────┐
   │ 10 Projects Detected (2 pages each)     │
   │                                         │
   │ Project 1 | Pages 1-2                   │
   │ [1] [2] [Edit Range]                    │
   │ Mode: ⚪ New  ⚫ Match Existing          │
   │ [Search Projects...]                    │
   │                                         │
   │ Project 2 | Pages 3-4                   │
   │ [3] [4] [Edit Range]                    │
   │ Mode: ⚫ New  ⚪ Match Existing          │
   └─────────────────────────────────────────┘

4. User Actions:
   - Adjust page ranges if needed
   - For "Match Existing": Click search → Fuzzy search dialog
   - For "New": Leave as is

5. Process batch (existing flow continues)
```

### Implementation Steps

#### Step 1: Auto-segmentation Logic
```typescript
// In BulkUploadDialog.tsx - after file upload
const autoSegmentProjects = (totalPages: number) => {
  const pagesPerProject = 2 // configurable
  const numProjects = Math.ceil(totalPages / pagesPerProject)

  const definitions: ProjectDefinitionForm[] = []

  for (let i = 0; i < numProjects; i++) {
    const startPage = i * pagesPerProject + 1
    const endPage = Math.min((i + 1) * pagesPerProject, totalPages)

    definitions.push({
      id: crypto.randomUUID(),
      startPage,
      endPage,
      mode: 'new',
    })
  }

  setProjectDefinitions(definitions)
}
```

#### Step 2: Enhanced Project Definition UI
```typescript
{projectDefinitions.map((def, index) => (
  <div key={def.id} className="border rounded-lg p-4 space-y-3">
    <div className="flex items-center justify-between">
      <h4 className="font-medium">Project {index + 1}</h4>
      <div className="flex gap-2">
        <Input
          type="number"
          value={def.startPage}
          onChange={(e) => updateDef(def.id, { startPage: parseInt(e.target.value) })}
          className="w-20"
        />
        <span>to</span>
        <Input
          type="number"
          value={def.endPage}
          onChange={(e) => updateDef(def.id, { endPage: parseInt(e.target.value) })}
          className="w-20"
        />
      </div>
    </div>

    <RadioGroup value={def.mode} onValueChange={(v) => updateDef(def.id, { mode: v })}>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="new" id={`new-${def.id}`} />
        <Label htmlFor={`new-${def.id}`}>Create New Project</Label>
      </div>
      <div className="flex items-center space-x-2">
        <RadioGroupItem value="match" id={`match-${def.id}`} />
        <Label htmlFor={`match-${def.id}`}>Match to Existing</Label>
      </div>
    </RadioGroup>

    {def.mode === 'match' && (
      <Button
        variant="outline"
        onClick={() => openProjectSearch(def.id)}
        className="w-full"
      >
        <Search className="h-4 w-4 mr-2" />
        Search for Project...
      </Button>
    )}

    {def.projectId && (
      <div className="text-sm bg-muted p-2 rounded">
        Selected: {selectedProjectNames[def.projectId]}
      </div>
    )}
  </div>
))}
```

#### Step 3: Same Search Components as Option A
- ProjectSearchDialog component
- `/api/projects/search` endpoint
- `search_all_projects()` RPC function

### Pros of Option B ✅
- **No AI costs** for boundary detection
- **Instant results** - no analysis wait time
- **100% user control** - no AI errors to debug
- **Simpler implementation** - fewer moving parts
- **Predictable behavior** - works for any PDF structure

### Cons of Option B ❌
- **More manual work** - user must review/adjust all boundaries
- **No project name extraction** - harder to match without names
- **Time-consuming** for large batches (20+ projects)
- **Error-prone** - user might miss boundary adjustments

---

## RECOMMENDATION: Hybrid Approach (Best of Both Worlds)

### The Optimal Solution

Implement **Option A (AI Detection) with Option B (Manual) as fallback**:

```
┌─────────────────────────────────────────────────┐
│  Upload PDF                                     │
│  ↓                                              │
│  AI Analysis (Claude detects boundaries + names)│
│  ↓                                              │
│  Present AI Results to User                     │
│  ├─ High confidence (>85%) → Auto-filled        │
│  ├─ Medium confidence (60-85%) → Flagged        │
│  └─ Low confidence (<60%) → Manual required     │
│  ↓                                              │
│  User Reviews & Searches Projects               │
│  ├─ Adjust boundaries if needed                 │
│  ├─ Search & match existing projects            │
│  └─ Mark new projects                           │
│  ↓                                              │
│  [Skip AI Next Time] checkbox available         │
│  ↓                                              │
│  Process Batch                                  │
└─────────────────────────────────────────────────┘
```

### Why This is Best

1. **Addresses User's Original Intent**
   - "wanted the pdf to be analysed to determine the number of projects"
   - "analyse them to determine project name"
   - AI does exactly this

2. **Leverages Existing Infrastructure**
   - Claude integration already exists
   - Already extracts project_name field
   - Standardized forms = high AI accuracy

3. **Provides Flexibility**
   - AI wrong? User can manually adjust
   - Want speed? Trust AI suggestions
   - Want control? Review everything
   - Don't want AI? Checkbox to skip and use manual mode

4. **Solves All Current Issues**
   - ✅ Auto-detects projects → saves time
   - ✅ Extracts names → helps with matching
   - ✅ Searchable project matching → fixes RLS issue
   - ✅ Manual override → handles edge cases

5. **Acceptable Trade-offs**
   - ~$0.05-0.15 per batch = minimal cost
   - 10-20 second analysis = acceptable UX
   - Can disable AI if budget concern

### Cost Analysis

**AI Detection Costs** (using Claude Sonnet 3.5):
- Input: ~$3 per million tokens
- 20-page PDF ≈ 50k tokens
- Analysis cost ≈ $0.15 per batch

**Time Savings**:
- Manual: ~5 minutes to define 10 projects
- AI: ~30 seconds (10s AI + 20s review)
- Savings: ~4.5 minutes per batch

**ROI**: If user time is valued at >$2/minute, AI pays for itself immediately.

---

## Implementation Priorities

### Phase 1 (Immediate - Fix Current Issues)
1. ✅ Create `search_all_projects()` RPC function
2. ✅ Create `/api/projects/search` endpoint
3. ✅ Create `ProjectSearchDialog` component
4. ✅ Add auto-segmentation (2 pages per project default)
5. ✅ Update `BulkUploadDialog` to use search

**Timeline**: 2-3 days
**Result**: Functional bulk upload with manual project definition

### Phase 2 (Enhancement - Add AI)
1. ✅ Create `/api/projects/batch-upload/analyze` endpoint
2. ✅ Add AI boundary detection logic
3. ✅ Add "analyze" step to dialog
4. ✅ Add confidence indicators to UI
5. ✅ Add "Skip AI" option

**Timeline**: 3-4 days
**Result**: AI-assisted bulk upload with manual fallback

---

## Next Steps

**Please confirm your preferred approach:**

- **Option 1**: Start with Phase 1 only (manual with search) - ~2-3 days
- **Option 2**: Implement full hybrid solution (Phases 1 + 2) - ~5-7 days
- **Option 3**: Alternative suggestion?

Once you confirm, I will begin implementation immediately.

---

## Technical Notes

### RLS Policy Fix Required
The current `projects_select` policy prevents regular users from searching all projects. We need to either:

**A. Create dedicated search RPC** (RECOMMENDED)
```sql
-- Service role function bypasses RLS
CREATE FUNCTION search_all_projects(search_query text)
SECURITY DEFINER  -- Runs with function owner's permissions
```

**B. Modify RLS policy** (NOT RECOMMENDED - security risk)
```sql
-- Would expose all projects to all users
ALTER POLICY "projects_select" ON projects
USING (true);  -- Too permissive!
```

### Storage Bucket Note
The plan document mentions `'mapping-sheets'` bucket, but your init route uses `'mapping-sheet-scans'`. Verify which bucket name is correct.

# Bulk Mapping Sheet Upload - Implementation Plan & Analysis

## Executive Summary

This document analyzes the feasibility and implementation approach for a **bulk upload feature** that allows users to upload a multi-project PDF (e.g., 10 projects × 2 pages = 20 pages), have the system:
1. Split the PDF into individual 2-page project sections
2. Extract data from each project via AI
3. Present a matching interface to link each extracted project to existing projects OR mark as new
4. Route each matched scan through the appropriate workflow

**TL;DR:** This is **architecturally feasible** but presents **significant complexity** in UX, state management, batch processing, error handling, and cost control. Estimated effort: **2-3 weeks** for MVP.

---

## 1. Current Architecture Review

### 1.1 Existing Single-Upload Flow

**Upload Path:**
```
User → UploadMappingSheetDialog → Supabase Storage
  → mapping_sheet_scans record created (status: 'pending')
  → scraper_jobs record created (job_type: 'mapping_sheet_scan')
  → Worker reserves job
  → Claude AI extracts data from PDF
  → Scan status updated to 'review_new_project' or 'completed'
  → User reviews in ScanReviewContainer
  → Import via /api/projects/new-from-scan or /api/projects/[id]/import-scan
```

**Key Components:**
- **UploadMappingSheetDialog**: Handles single PDF upload (max 3 pages)
- **Worker (mappingSheetProcessor.ts)**: Processes one scan at a time
- **Claude AI**: Expects 1-3 pages for a single project
- **mapping_sheet_scans table**: 1 record = 1 scan = 1 project
- **ScanReviewContainer**: Reviews ONE scan at a time

### 1.2 Data Model Constraints

**Current Schema:**
```sql
mapping_sheet_scans:
  - id (UUID, PK)
  - project_id (UUID, nullable) -- Links to ONE project
  - uploaded_by (UUID)
  - file_url (TEXT) -- ONE PDF file
  - status ('pending', 'processing', 'completed', etc.)
  - extracted_data (JSONB) -- ONE project's data
  - upload_mode ('existing_project' | 'new_project')
```

**Limitations for Bulk:**
- ❌ One scan record = one project (no concept of "batch" or "parent scan")
- ❌ No way to track relationships between scans from same upload
- ❌ No mechanism to split PDF before processing
- ❌ Worker expects one project per job

---

## 2. Proposed Bulk Upload Architecture

### 2.1 High-Level Flow

```
User uploads 20-page PDF
  ↓
[NEW] PDF Splitter Service
  - Detects page boundaries (every 2 pages = 1 project)
  - Creates 10 individual 2-page PDFs
  - Uploads each to storage
  ↓
[NEW] Batch Scan Record (parent)
  - batch_id: UUID
  - original_file_url: '20-page.pdf'
  - total_projects: 10
  - status: 'splitting' → 'processing' → 'review'
  ↓
10 × mapping_sheet_scans records (children)
  - Each linked to batch_id
  - Each with 2-page PDF chunk
  - status: 'pending'
  ↓
10 × scraper_jobs created
  - Worker processes in parallel
  ↓
[NEW] Bulk Match Interface
  - Shows all 10 extracted projects
  - User matches each to existing project OR marks as new
  ↓
Route each scan:
  - Existing project → /projects/[id]/scan-review/[scanId]
  - New project → /projects/new-scan-review/[scanId]
```

### 2.2 New Data Model

**New Table: `batch_uploads`**
```sql
CREATE TABLE batch_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID REFERENCES auth.users(id),

  -- Original file
  original_file_url TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  original_page_count INTEGER,

  -- Processing state
  status TEXT NOT NULL,
  -- 'pending', 'splitting', 'processing', 'ready_for_review', 'completed', 'failed'

  -- Tracking
  total_projects INTEGER NOT NULL, -- How many projects detected
  completed_projects INTEGER DEFAULT 0, -- How many finished review

  -- Costs
  total_cost_usd DECIMAL(10, 6),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_batch_status CHECK (
    status IN ('pending', 'splitting', 'processing', 'ready_for_review', 'completed', 'failed')
  )
);
```

**Modified Table: `mapping_sheet_scans`**
```sql
ALTER TABLE mapping_sheet_scans
  ADD COLUMN batch_id UUID REFERENCES batch_uploads(id) ON DELETE CASCADE,
  ADD COLUMN batch_index INTEGER, -- Position in batch (1, 2, 3, ...)
  ADD COLUMN project_match_status TEXT DEFAULT 'pending';
  -- 'pending', 'matched_existing', 'marked_new', 'skipped'

CREATE INDEX idx_mapping_sheet_scans_batch_id ON mapping_sheet_scans(batch_id);
```

**Why this approach:**
- ✅ Maintains backward compatibility (batch_id nullable)
- ✅ Clear parent-child relationship
- ✅ Can track batch-level progress
- ✅ Enables batch-wide operations (cancel all, retry all)

---

## 3. Implementation Challenges & Solutions

### 3.1 Challenge: PDF Splitting

**Problem:** How to reliably split a 20-page PDF into 10 × 2-page chunks?

**Considerations:**
- PDFs are typically in order (Project 1: pages 1-2, Project 2: pages 3-4, etc.)
- BUT what if user scanned out of order?
- What if some projects are 3 pages instead of 2?
- What if page boundaries are unclear?

**Solution Option A: Simple Even Split (Recommended for MVP)**
```typescript
// Assume every 2 pages = 1 project
const pagesPerProject = 2
const totalPages = 20
const numProjects = totalPages / pagesPerProject // 10

for (let i = 0; i < numProjects; i++) {
  const startPage = i * pagesPerProject + 1
  const endPage = startPage + pagesPerProject - 1
  // Extract pages [startPage, endPage] to new PDF
}
```

**Tools:**
- **pdf-lib** (Node.js): Can split PDFs programmatically
- Or **pdftk** (command-line): More reliable but requires system dependency

**Code Example (pdf-lib):**
```typescript
import { PDFDocument } from 'pdf-lib'

async function splitPdf(
  pdfBuffer: Buffer,
  pagesPerProject: number = 2
): Promise<Buffer[]> {
  const pdfDoc = await PDFDocument.load(pdfBuffer)
  const totalPages = pdfDoc.getPageCount()
  const numProjects = Math.ceil(totalPages / pagesPerProject)
  const chunks: Buffer[] = []

  for (let i = 0; i < numProjects; i++) {
    const newPdf = await PDFDocument.create()
    const startIdx = i * pagesPerProject
    const endIdx = Math.min(startIdx + pagesPerProject, totalPages)

    for (let pageIdx = startIdx; pageIdx < endIdx; pageIdx++) {
      const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIdx])
      newPdf.addPage(copiedPage)
    }

    const pdfBytes = await newPdf.save()
    chunks.push(Buffer.from(pdfBytes))
  }

  return chunks
}
```

**Challenges:**
- ❌ Large PDFs (100+ pages) may timeout
- ❌ Memory usage for holding entire PDF in memory
- ❌ What if PDF is corrupted or password-protected?

**Mitigation:**
- Set max file size limit (e.g., 50MB, ~100 pages)
- Stream processing if needed
- Add validation before splitting

**Solution Option B: AI-Assisted Boundary Detection (Future Enhancement)**
- Use Claude to analyze page thumbnails and detect project boundaries
- More flexible but significantly more complex and expensive

**Recommendation:** Start with **Option A** (simple even split), add validation for page count.

---

### 3.2 Challenge: Worker Processing & Parallelization

**Problem:** Current worker processes ONE job at a time. How to efficiently process 10 scans in parallel?

**Current Worker Architecture:**
```typescript
// Infinite loop
for (;;) {
  const job = await reserveNextJob(client) // Gets ONE job
  if (!job) {
    await sleep(pollIntervalMs)
    continue
  }
  await handleJob(job)
}
```

**Issues for Bulk:**
- Processing 10 scans sequentially takes 10× longer (e.g., 10 minutes vs 1 minute)
- User experience: waiting 10 minutes for batch to complete
- Cost: Claude API calls are expensive (10× the cost)

**Solution Options:**

**Option A: Multiple Worker Instances (Recommended)**
- Deploy 3-5 worker instances on Railway
- Each worker picks up jobs independently
- Natural parallelization via job queue

**Pros:**
- ✅ No code changes needed
- ✅ Auto-scales with queue depth
- ✅ Fault tolerant (if one worker crashes, others continue)

**Cons:**
- ❌ Requires infrastructure changes (Railway scaling)
- ❌ Increased costs (more compute)

**Option B: Multi-threaded Worker**
```typescript
const MAX_CONCURRENT_JOBS = 5

async function workerLoop() {
  const activeJobs: Promise<void>[] = []

  for (;;) {
    if (activeJobs.length < MAX_CONCURRENT_JOBS) {
      const job = await reserveNextJob(client)
      if (job) {
        const jobPromise = handleJob(job).finally(() => {
          const index = activeJobs.indexOf(jobPromise)
          if (index > -1) activeJobs.splice(index, 1)
        })
        activeJobs.push(jobPromise)
      }
    }

    await Promise.race([
      sleep(pollIntervalMs),
      ...activeJobs
    ])
  }
}
```

**Pros:**
- ✅ Single worker instance
- ✅ Faster batch processing

**Cons:**
- ❌ More complex error handling
- ❌ Memory usage (holding multiple Claude responses in memory)
- ❌ Claude API rate limits may throttle

**Recommendation:** Use **Option A** (multiple workers) for reliability and simplicity.

---

### 3.3 Challenge: Cost Management

**Problem:** Bulk uploads multiply AI processing costs.

**Current Costs (Estimated):**
- Claude Sonnet 4: ~$3 per 1M input tokens, ~$15 per 1M output tokens
- One 2-page PDF scan: ~10k input tokens (with document encoding)
- Cost per scan: ~$0.05-0.10

**Bulk Upload Cost:**
- 10 projects = 10 scans = **$0.50-$1.00 per batch**
- 100 projects = **$5-$10 per batch**

**Risks:**
- User accidentally uploads 200-page PDF → $20 in costs
- Malicious user spam uploads → unlimited costs

**Mitigation Strategies:**

**1. Hard Limits:**
```typescript
const MAX_PAGES_PER_UPLOAD = 100 // Max 50 projects
const MAX_PROJECTS_PER_BATCH = 50

if (pageCount > MAX_PAGES_PER_UPLOAD) {
  throw new Error('PDF exceeds maximum page limit')
}
```

**2. Cost Estimation Before Processing:**
```typescript
// Show user estimated cost before confirming upload
const estimatedProjects = pageCount / 2
const estimatedCost = estimatedProjects * 0.10
toast.info(`This will process ${estimatedProjects} projects (~$${estimatedCost.toFixed(2)})`)
```

**3. User Quotas:**
```sql
CREATE TABLE user_scan_quotas (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  scans_this_month INTEGER DEFAULT 0,
  monthly_limit INTEGER DEFAULT 100,
  total_cost_usd DECIMAL(10, 2) DEFAULT 0,
  reset_at TIMESTAMPTZ
);
```

**4. Admin Approval for Large Batches:**
- Batches >20 projects require admin approval
- Send notification to admin dashboard

**Recommendation:** Implement **limits + cost estimation** at minimum. Quotas and approval for production.

---

### 3.4 Challenge: UI/UX Complexity

**Problem:** How to present 10 extracted projects for matching in a usable interface?

**Current Flow (Single Upload):**
```
ProjectQuickFinder Dialog
  → Search for ONE project
  → Match OR create new
  → Redirect to review page
```

**Bulk Flow Requirements:**
```
Bulk Matching Interface
  → Show all 10 extracted projects in a list
  → For each project:
    - Display extracted name, address, builder
    - Provide search input to find existing project
    - Show match suggestions (fuzzy matching)
    - Allow "Create new" option
    - Allow "Skip" option
  → Track progress (3/10 matched)
  → "Confirm All Matches" button
  → Route each scan to appropriate review flow
```

**UI Design Challenges:**

**Challenge 1: Overwhelming Information**
- Showing 10 projects at once is cognitively demanding
- User might make mistakes in matching

**Solution: Progressive Disclosure**
```
Step 1: Upload & Split (progress bar)
Step 2: AI Processing (show processing status for each)
Step 3: Match Projects (accordion/stepper interface)
  - One project at a time
  - Clear "Next" and "Back" buttons
  - Progress indicator (3 of 10 matched)
Step 4: Review Summary (show all matches before confirming)
Step 5: Confirm & Route
```

**Challenge 2: Search Performance**
- User needs to search 10 times
- Slow if each search hits database

**Solution: Pre-fetch Suggestions**
```typescript
// When batch processing completes, run fuzzy matching
// for all extracted projects in one go
const suggestions = await Promise.all(
  extractedProjects.map(project =>
    findSimilarProjects(project.name, project.address)
  )
)
// Cache results, show immediately in UI
```

**Challenge 3: Partial Completion**
- What if user matches 5/10 then closes dialog?
- How to resume later?

**Solution: Save Match State**
```sql
-- Store intermediate matching decisions
ALTER TABLE mapping_sheet_scans
  ADD COLUMN user_match_decision JSONB;

-- Example:
{
  "action": "match_existing",
  "matched_project_id": "uuid",
  "confidence": 0.95,
  "user_confirmed": true
}
```

Allow user to return to batch and continue where they left off.

**UI Component Structure:**
```tsx
<BulkMatchInterface batchId={batchId}>
  <BulkMatchHeader
    totalProjects={10}
    matchedCount={3}
    onCancel={handleCancel}
  />

  <ProjectMatchStepper
    projects={extractedProjects}
    currentIndex={currentIndex}
    onNext={handleNext}
    onPrevious={handlePrevious}
  >
    <ProjectMatchCard
      extractedData={project}
      suggestions={suggestions[currentIndex]}
      onMatch={handleMatch}
      onCreateNew={handleCreateNew}
      onSkip={handleSkip}
    />
  </ProjectMatchStepper>

  <BulkMatchSummary
    matches={matchDecisions}
    onConfirm={handleConfirmAll}
  />
</BulkMatchInterface>
```

**Recommendation:** Use **stepper interface** (one project at a time) with pre-fetched suggestions for better UX.

---

### 3.5 Challenge: Error Handling & Partial Failures

**Problem:** What happens if:
- 3 scans extract successfully, 7 fail?
- User matches 5 projects, then network error occurs?
- One project's import fails but others succeed?

**Current Behavior:**
- Single upload: If scan fails, entire flow fails
- User sees error, can retry

**Bulk Upload Failure Modes:**

**1. Splitting Failure**
```
User uploads 20-page PDF
  → PDF splitter fails on page 7 (corrupted)
  → Entire batch fails
```

**Mitigation:**
- Validate PDF before splitting
- Implement retry logic
- Show clear error message: "Page 7 is corrupted"

**2. Partial AI Extraction Failure**
```
10 scans created
  → 7 extract successfully
  → 3 fail (poor handwriting, corrupted pages)
```

**Mitigation:**
- Allow batch to continue even if some scans fail
- Mark failed scans with status 'failed'
- Show summary: "7 of 10 projects extracted successfully"
- Give user option to:
  - Proceed with 7 successful scans
  - Retry 3 failed scans
  - Cancel entire batch

**3. Matching Interface Crash**
```
User matches 5/10 projects
  → Browser crashes / network error
  → Progress lost
```

**Mitigation:**
- Auto-save match decisions to database
- Allow resuming from batch_uploads table
- Show "Resume Batch" option in UI

**4. Import Failure (Partial Success)**
```
User confirms all 10 matches
  → 8 imports succeed
  → 2 fail (duplicate project, validation error)
```

**Mitigation:**
- Transactional imports (each project in separate transaction)
- Collect results and show summary:
  ```
  ✅ 8 projects imported successfully
  ❌ 2 projects failed:
    - Project "ABC Tower": Duplicate project detected
    - Project "XYZ Plaza": Invalid geocoding
  ```
- Allow user to retry failed imports

**Recommended Error Handling Architecture:**
```typescript
interface BatchProcessingResult {
  batchId: string
  totalProjects: number
  successful: {
    scanId: string
    projectName: string
    status: 'extracted' | 'matched' | 'imported'
  }[]
  failed: {
    scanId: string
    projectName: string
    error: string
    canRetry: boolean
  }[]
}
```

**UI Display:**
```tsx
<BatchResultsSummary>
  <SuccessSection>
    <h3>✅ 8 Projects Processed Successfully</h3>
    <ProjectList items={results.successful} />
  </SuccessSection>

  <FailureSection>
    <h3>❌ 2 Projects Failed</h3>
    <ErrorList
      items={results.failed}
      onRetry={handleRetryFailed}
    />
  </FailureSection>

  <Actions>
    <Button onClick={() => navigateToProjects()}>
      View Imported Projects
    </Button>
    <Button onClick={() => handleRetryFailed()}>
      Retry Failed Projects
    </Button>
  </Actions>
</BatchResultsSummary>
```

---

### 3.6 Challenge: State Management & Routing

**Problem:** Managing complex state across multiple steps and 10+ projects.

**State Requirements:**

```typescript
interface BulkUploadState {
  // Step 1: Upload
  uploadedFile: File | null
  uploadProgress: number

  // Step 2: Splitting
  splittingProgress: number
  chunksCreated: number

  // Step 3: Processing
  scans: {
    scanId: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    extractedData: ExtractedMappingSheetData | null
    error: string | null
  }[]

  // Step 4: Matching
  currentMatchIndex: number
  matchDecisions: {
    scanId: string
    action: 'match_existing' | 'create_new' | 'skip'
    matchedProjectId?: string
    matchedProjectName?: string
  }[]

  // Step 5: Import
  importResults: {
    scanId: string
    success: boolean
    projectId?: string
    error?: string
  }[]
}
```

**State Management Options:**

**Option A: React Context + useState**
```tsx
const BulkUploadContext = createContext<BulkUploadState>()

function BulkUploadProvider({ children }) {
  const [state, setState] = useState<BulkUploadState>(initialState)

  return (
    <BulkUploadContext.Provider value={{ state, setState }}>
      {children}
    </BulkUploadContext.Provider>
  )
}
```

**Pros:**
- ✅ Simple
- ✅ Built-in React

**Cons:**
- ❌ State lost on page refresh
- ❌ No persistence

**Option B: Zustand + Local Storage**
```typescript
import create from 'zustand'
import { persist } from 'zustand/middleware'

const useBulkUploadStore = create(
  persist(
    (set) => ({
      ...initialState,
      setScans: (scans) => set({ scans }),
      setMatchDecision: (scanId, decision) => set((state) => ({
        matchDecisions: [
          ...state.matchDecisions.filter(d => d.scanId !== scanId),
          { scanId, ...decision }
        ]
      })),
    }),
    {
      name: 'bulk-upload-state',
      storage: localStorage,
    }
  )
)
```

**Pros:**
- ✅ Persists across refreshes
- ✅ Clean API

**Cons:**
- ❌ LocalStorage has size limits
- ❌ Doesn't sync across tabs

**Option C: Database-backed State (Recommended)**
```typescript
// Store all state in batch_uploads and mapping_sheet_scans tables
// No local state needed
// UI fetches from database

function BulkMatchInterface({ batchId }) {
  const { data: batch } = useQuery(['batch', batchId], () =>
    supabase
      .from('batch_uploads')
      .select(`
        *,
        scans:mapping_sheet_scans(*)
      `)
      .eq('id', batchId)
      .single()
  )

  // All state comes from database
  // Updates write directly to database
}
```

**Pros:**
- ✅ Survives refresh, tab close, etc.
- ✅ Can resume on different device
- ✅ Audit trail

**Cons:**
- ❌ More database queries
- ❌ Potential performance issues

**Recommendation:** Use **Option C** (database-backed) for resilience, with react-query for caching.

**Routing Strategy:**
```
/projects/bulk-upload
  → Step 1: Upload file

/projects/bulk-upload/[batchId]
  → Step 2-4: Processing, Matching

/projects/bulk-upload/[batchId]/match
  → Interactive matching interface

/projects/bulk-upload/[batchId]/summary
  → Final review before confirm

After confirm:
  → Redirect to /projects with toast:
    "8 projects imported successfully. 2 failed (view details)"
```

---

## 4. Upstream & Downstream Interactions

### 4.1 Upstream Dependencies (Input)

**Who triggers bulk upload?**
- Admin users (most likely)
- Power users with special permissions
- Batch import from scanning station

**Concerns:**
- **Permissions:** Need role check (not all users should bulk upload)
- **Audit:** Track who uploaded which batch
- **Notifications:** Notify admins when large batch starts

**Solution:**
```sql
CREATE POLICY "Only admins can create batch uploads"
  ON batch_uploads FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'batch_uploader')
    )
  );
```

### 4.2 Downstream Dependencies (Output)

**What happens after bulk import?**

**1. Project Dashboard**
- Suddenly 10 new projects appear
- May affect pagination, filters
- Project list query performance

**Mitigation:**
- Existing pagination handles this
- Add filter: "Show only my projects" or "Created today"

**2. Patch Assignment**
- 10 new projects need patch assignment
- Geocoding required for all
- May trigger bulk patch reallocation

**Concern:**
- Patch assignment is expensive (spatial queries)
- Doing 10× simultaneously may cause slowdown

**Mitigation:**
- Queue patch assignments (don't run synchronously during import)
- Background job processes patch assignment after import

**3. Organiser Assignments**
- New projects may need organiser assignment
- Manual process or automated?

**Impact:**
- Minimal - existing flow handles this

**4. Notifications**
- Should organisers be notified of 10 new projects?
- Email blast risk

**Mitigation:**
- Single digest email: "10 new projects added to your patch"
- Not 10 individual emails

**5. Analytics & Reporting**
- Sudden spike in project count
- May skew dashboards (e.g., "Projects created this week")

**Impact:**
- Acceptable - represents real work

---

## 5. Data Management Challenges

### 5.1 Storage

**Problem:** Bulk uploads create many files.

**Current:**
- 1 upload = 1 file in `mapping-sheet-scans` bucket
- File path: `{userId}/{projectId}/{timestamp}_{filename}.pdf`

**Bulk:**
- 1 upload = 1 original + 10 chunks = 11 files
- File path structure:
  ```
  {userId}/batch-{batchId}/original.pdf
  {userId}/batch-{batchId}/chunk-1.pdf
  {userId}/batch-{batchId}/chunk-2.pdf
  ...
  ```

**Storage Costs:**
- Supabase Storage: $0.021/GB/month
- 20-page PDF ~5MB
- 10 chunks × 1MB each = 10MB
- Total per batch: ~15MB
- 100 batches/month = 1.5GB = $0.03/month

**Impact:** Negligible

**Cleanup Strategy:**
- Delete chunks after successful import?
- Or keep for audit trail?

**Recommendation:** Keep for 30 days, then auto-delete.

```sql
-- Scheduled job
DELETE FROM mapping_sheet_scans
WHERE created_at < NOW() - INTERVAL '30 days'
AND status = 'confirmed';

-- Cascade deletes files via trigger
```

### 5.2 Database

**Problem:** Batch uploads create many records.

**Scale Analysis:**
- 1 batch = 1 batch_uploads record + 10 mapping_sheet_scans records
- 100 batches/month = 100 + 1000 records
- Acceptable scale

**Index Requirements:**
```sql
CREATE INDEX idx_batch_uploads_status ON batch_uploads(status);
CREATE INDEX idx_batch_uploads_uploaded_by ON batch_uploads(uploaded_by);
CREATE INDEX idx_mapping_sheet_scans_batch_id ON mapping_sheet_scans(batch_id);
CREATE INDEX idx_mapping_sheet_scans_batch_index ON mapping_sheet_scans(batch_id, batch_index);
```

**Query Performance:**
- Fetching batch with 10 scans: JOIN query
- Needs optimization for large batches (50+ projects)

**Optimization:**
```sql
-- Materialized view for batch summaries
CREATE MATERIALIZED VIEW batch_upload_summaries AS
SELECT
  b.id,
  b.status,
  b.total_projects,
  COUNT(s.id) FILTER (WHERE s.status = 'completed') AS completed_scans,
  COUNT(s.id) FILTER (WHERE s.status = 'failed') AS failed_scans,
  SUM(s.extraction_cost_usd) AS total_cost
FROM batch_uploads b
LEFT JOIN mapping_sheet_scans s ON s.batch_id = b.id
GROUP BY b.id;

-- Refresh periodically
REFRESH MATERIALIZED VIEW batch_upload_summaries;
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1)
**Goal:** Basic bulk upload infrastructure

**Tasks:**
1. ✅ Database schema changes
   - Create `batch_uploads` table
   - Add `batch_id`, `batch_index` to `mapping_sheet_scans`
   - Add indexes

2. ✅ PDF splitting service
   - Implement `splitPdf()` function
   - Add validation (page count, file size)
   - Upload chunks to storage

3. ✅ Batch creation flow
   - New upload dialog mode: 'bulk'
   - Create batch record
   - Create child scan records
   - Create scraper jobs

**Deliverable:** Can upload multi-page PDF, splits into chunks, creates database records

---

### Phase 2: Processing (Week 2)
**Goal:** AI extraction for all chunks

**Tasks:**
1. ✅ Worker modifications
   - No changes needed if using multiple workers
   - OR implement concurrent processing

2. ✅ Progress tracking
   - Real-time status updates for each scan
   - Batch-level progress calculation

3. ✅ Error handling
   - Partial failure support
   - Retry mechanism for failed scans

**Deliverable:** Batch processing completes, all scans have extracted data (or error status)

---

### Phase 3: Matching UI (Week 2-3)
**Goal:** User can match projects

**Tasks:**
1. ✅ Bulk match interface component
   - List view of all extracted projects
   - OR stepper interface (one at a time)

2. ✅ Fuzzy matching suggestions
   - Pre-fetch similar projects
   - Display match confidence scores

3. ✅ Match decision storage
   - Save user choices to database
   - Allow resuming

**Deliverable:** User can match all projects in batch to existing projects or mark as new

---

### Phase 4: Routing & Import (Week 3)
**Goal:** Route each matched scan to appropriate flow

**Tasks:**
1. ✅ Routing logic
   - Matched existing → `/projects/[id]/scan-review/[scanId]`
   - Marked new → `/projects/new-scan-review/[scanId]`

2. ✅ Batch import orchestration
   - Sequential vs parallel import
   - Error collection
   - Results summary

3. ✅ Success/failure UI
   - Summary page with results
   - Retry failed imports

**Deliverable:** Complete end-to-end bulk upload flow

---

### Phase 5: Polish (Week 3+)
**Goal:** Production-ready

**Tasks:**
1. Cost controls & limits
2. Admin dashboard for batches
3. Email notifications
4. Audit logging
5. Performance optimization
6. User documentation

---

## 7. Risk Assessment

### 7.1 Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| PDF splitting fails for edge cases | Medium | High | Extensive validation, fallback to manual split |
| Claude API rate limits | Medium | Medium | Queue throttling, backpressure handling |
| Memory issues with large PDFs | Low | High | Stream processing, chunk size limits |
| Database performance degradation | Low | Medium | Proper indexing, query optimization |
| Concurrent job race conditions | Medium | Medium | Proper locking in job reservation |

### 7.2 UX Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| User overwhelmed by matching UI | High | Medium | Stepper interface, progressive disclosure |
| Confusion about batch status | Medium | Medium | Clear progress indicators, notifications |
| Accidental uploads | Medium | Low | Confirmation dialog, cost estimation |
| Partial completion abandoned | Medium | Medium | Save state, allow resuming |

### 7.3 Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Cost overruns from spam uploads | Low | High | Quotas, admin approval for large batches |
| Poor extraction quality at scale | Medium | Medium | Confidence thresholds, manual review option |
| Support burden | Medium | Medium | Good error messages, comprehensive docs |

---

## 8. Alternative Approaches

### 8.1 Sequential Upload (Simpler)
**Instead of true batch upload:**
- User uploads single PDF
- UI splits into chunks
- User uploads each chunk individually
- Each goes through normal single-upload flow

**Pros:**
- ✅ No new architecture needed
- ✅ Reuses existing code

**Cons:**
- ❌ Poor UX (user clicks "upload" 10 times)
- ❌ No batch tracking
- ❌ Can't optimize for parallelization

### 8.2 Offline Processing (Async)
**Batch upload returns immediately:**
- User uploads large PDF
- System sends email when processing complete
- User returns later to match projects

**Pros:**
- ✅ No waiting on upload page
- ✅ Better for very large batches

**Cons:**
- ❌ Disconnect from flow
- ❌ User may forget to return

### 8.3 Two-Stage Upload
**Stage 1: Upload & Extract (No Matching)**
- Upload PDF → AI extracts → Saves as drafts

**Stage 2: Review Drafts (Later)**
- User goes to "Draft Projects" page
- Reviews and confirms each

**Pros:**
- ✅ Separates upload from decision-making
- ✅ Less cognitive load

**Cons:**
- ❌ More steps
- ❌ Drafts may accumulate

---

## 9. Recommendations

### 9.1 MVP Scope (Recommended)

**Include:**
1. ✅ Simple even split (every 2 pages = 1 project)
2. ✅ Basic batch tracking (new tables)
3. ✅ Stepper UI for matching (one project at a time)
4. ✅ Pre-fetched fuzzy suggestions
5. ✅ Partial failure handling
6. ✅ Cost limits (max 50 projects per batch)
7. ✅ Database-backed state
8. ✅ Multiple worker instances for parallelization

**Exclude (Future):**
1. ❌ AI-powered boundary detection
2. ❌ Variable pages per project
3. ❌ Advanced retry mechanisms
4. ❌ Batch-level rollback
5. ❌ Real-time collaboration (multiple users on same batch)

### 9.2 Estimated Effort

**Development:**
- Backend (DB, API, worker): 1 week
- Frontend (UI components): 1-1.5 weeks
- Testing & bug fixes: 0.5 week
- **Total: 2.5-3 weeks**

**Testing:**
- Unit tests: 3 days
- Integration tests: 2 days
- E2E tests: 2 days
- Manual QA: 3 days
- **Total: 1.5 weeks**

**Overall: 4-5 weeks for production-ready feature**

### 9.3 Go/No-Go Decision

**GO IF:**
- ✅ Bulk uploads are a frequent workflow (saves significant time)
- ✅ Users are willing to tolerate some complexity
- ✅ Budget allows for AI costs scaling
- ✅ Team capacity for 4-5 week project

**NO-GO IF:**
- ❌ Single uploads are sufficient for 90%+ cases
- ❌ Team is already at capacity
- ❌ Cost concerns outweigh time savings
- ❌ Simpler alternative (e.g., sequential upload) meets needs

---

## 10. Conclusion

**Summary:**

The bulk upload feature is **technically feasible** and **architecturally sound**, but requires **significant investment** in:
- Database schema extensions
- PDF processing infrastructure
- Complex UI for matching
- Robust error handling
- Cost management

**Key Success Factors:**
1. Clear user flow with progressive disclosure
2. Reliable PDF splitting (start simple, iterate)
3. Parallel processing infrastructure (multiple workers)
4. Comprehensive error handling (partial failures)
5. Cost controls and quotas

**Biggest Risks:**
1. UX complexity overwhelming users
2. Cost overruns from uncontrolled usage
3. Partial failures creating messy state

**Mitigation:**
- Start with MVP (simple split, stepper UI, limits)
- Iterate based on user feedback
- Monitor costs and performance closely

**Final Recommendation:**

**Proceed with MVP** if bulk uploads represent >20% of workflow and justify the investment. Otherwise, consider simpler alternatives (sequential upload, better single-upload UX) first.

---

## Appendix A: API Endpoints

```typescript
// New endpoints needed

POST /api/batch-uploads
  Body: { file: File }
  Returns: { batchId: string, projectsDetected: number }

GET /api/batch-uploads/:batchId
  Returns: BatchUpload with scans[]

POST /api/batch-uploads/:batchId/match
  Body: { scanId: string, action: 'match_existing' | 'create_new' | 'skip', projectId?: string }
  Returns: { success: boolean }

POST /api/batch-uploads/:batchId/confirm
  Body: { matches: MatchDecision[] }
  Returns: { results: ImportResult[] }

POST /api/batch-uploads/:batchId/cancel
  Returns: { success: boolean }
```

---

## Appendix B: Component Hierarchy

```
<BulkUploadFlow>
  └─ <BulkUploadDialog>
       ├─ Step 1: <FileUpload>
       ├─ Step 2: <SplittingProgress>
       └─ Step 3: <ProcessingProgress>

  └─ <BulkMatchInterface batchId={batchId}>
       ├─ <BulkMatchHeader />
       ├─ <ProjectMatchStepper>
       │    └─ <ProjectMatchCard>
       │         ├─ <ExtractedDataPreview />
       │         ├─ <ProjectSearchInput />
       │         ├─ <MatchSuggestions />
       │         └─ <MatchActions />
       └─ <BulkMatchSummary />

  └─ <BulkImportResults>
       ├─ <SuccessSection />
       ├─ <FailureSection />
       └─ <ActionButtons />
```

---

**Document Version:** 1.0
**Date:** 2025-01-10
**Author:** Claude Code Analysis
**Status:** Draft - Awaiting Approval

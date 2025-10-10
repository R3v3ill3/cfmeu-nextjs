# Mobile Camera Uploads & Pending Approval Workflow - Analysis

## Executive Summary

This document analyzes two additional enhancements to the mapping sheet scan system:

1. **iPhone Camera Photo Uploads** - Allow users to photograph physical forms with their phone camera instead of requiring PDF scans
2. **Pending Approval Workflow** - Flag new projects/employers as "pending" and route them through admin/lead_organiser review before activation

**Key Findings:**

**Mobile Camera Uploads:**
- ✅ **Technically Feasible** - Claude AI already supports image analysis
- ⚠️ **Quality Challenges** - Photos introduce significant variability (lighting, angle, focus, shadows)
- ⚠️ **Multi-page UX Complexity** - User must take 2+ photos and ensure correct order
- 📊 **Extraction Quality:** Expected 10-20% reduction in accuracy vs. clean PDF scans

**Pending Approval Workflow:**
- ✅ **Architecturally Straightforward** - Database schema supports status fields
- ✅ **Minimal Breaking Changes** - Can be implemented with existing patterns
- ⚠️ **Admin Workload** - Creates new approval bottleneck requiring monitoring
- 📊 **Estimated Effort:** 1-2 weeks for full implementation

---

## Part 1: iPhone Camera Upload Analysis

### 1.1 Technical Feasibility

**Current Architecture:**
- Worker accepts PDF files via `pdfBuffer: Buffer`
- Claude API called with document type: `media_type: 'application/pdf'`
- System prompt says "analyze images of handwritten forms"

**Required Changes:**

**Option A: Convert Photos to PDF (Recommended)**
```typescript
// Client-side: User takes photos with iPhone
// Upload as JPEG/HEIC images
// Server-side: Convert to PDF before processing

import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

async function convertImagesToPdf(imageBuffers: Buffer[]): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create()

  for (const imageBuffer of imageBuffers) {
    // Optimize image (reduce size, normalize orientation)
    const optimized = await sharp(imageBuffer)
      .rotate() // Auto-rotate based on EXIF
      .resize(2480, 3508, { // A4 at 300 DPI
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 85 })
      .toBuffer()

    // Embed in PDF
    const image = await pdfDoc.embedJpg(optimized)
    const page = pdfDoc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }

  return Buffer.from(await pdfDoc.save())
}
```

**Pros:**
- ✅ No changes to worker/AI code
- ✅ Reuses entire PDF processing pipeline
- ✅ Supports multi-page capture

**Cons:**
- ❌ Extra conversion step
- ❌ Still doesn't fix photo quality issues

**Option B: Direct Image Processing**
```typescript
// Send images directly to Claude

const content: any[] = imageBuffers.map(buffer => ({
  type: 'image' as const,
  source: {
    type: 'base64' as const,
    media_type: 'image/jpeg' as const, // or 'image/png', 'image/heic'
    data: buffer.toString('base64'),
  },
}))

// Add text prompt
content.push({
  type: 'text',
  text: CLAUDE_USER_PROMPT(1, imageBuffers.length)
})
```

**Pros:**
- ✅ No PDF conversion overhead
- ✅ Slightly lower file sizes

**Cons:**
- ❌ Requires code changes in worker
- ❌ Need to handle multiple image formats (JPEG, PNG, HEIC)
- ❌ HEIC conversion complexity on server

**Recommendation:** Use **Option A** (convert to PDF) for consistency and minimal code changes.

---

### 1.2 Practical Quality Challenges

**Challenge 1: Lighting & Shadows**

**Problem:**
- Phone cameras auto-adjust exposure
- Overhead lighting creates shadows across form
- Glare from glossy paper
- Dim lighting reduces legibility

**Examples:**
| Scenario | Impact on Extraction |
|----------|---------------------|
| Office fluorescent lighting | ✅ Generally good (even lighting) |
| Construction site (outdoor) | ⚠️ Variable (bright sun creates harsh shadows) |
| Evening/indoor dim light | ❌ Poor (low contrast, blurry text) |
| Flash photography | ❌ Very poor (hot spots, uneven exposure) |

**Mitigation:**
- **UI Guidance:** Show tips before capture
  ```
  📸 Tips for Best Results:
  - Use natural daylight if possible
  - Avoid shadows across the page
  - No flash (causes glare)
  - Ensure all text is clearly visible
  ```
- **Preview & Retake:** Let user review photo before uploading
- **Automatic Quality Check:**
  ```typescript
  async function analyzeImageQuality(buffer: Buffer): Promise<{ score: number; issues: string[] }> {
    const metadata = await sharp(buffer).metadata()
    const stats = await sharp(buffer).stats()

    const issues: string[] = []
    let score = 100

    // Check brightness
    const avgBrightness = (stats.channels[0].mean + stats.channels[1].mean + stats.channels[2].mean) / 3
    if (avgBrightness < 80) {
      issues.push('Image too dark - try better lighting')
      score -= 20
    }
    if (avgBrightness > 200) {
      issues.push('Image overexposed - reduce brightness')
      score -= 20
    }

    // Check contrast
    const contrast = stats.channels[0].stdev
    if (contrast < 30) {
      issues.push('Low contrast - may affect text recognition')
      score -= 15
    }

    // Check blur (sharpness estimation)
    // Complex - requires Laplacian variance calculation
    // Simplified: check if image was resized significantly by camera

    return { score, issues }
  }
  ```

**Challenge 2: Camera Angle & Perspective Distortion**

**Problem:**
- Users rarely hold phone perfectly perpendicular to paper
- Angled photos cause perspective skew
- Text at edges becomes distorted and harder to read

**Examples:**
```
Ideal (perpendicular):        Typical (angled 20°):
┌─────────────┐               ╱─────────────╲
│  Clear text │              ╱  Skewed text  ╲
│  readable   │             │   harder to     │
└─────────────┘              ╲    read       ╱
```

**Mitigation:**

**Option 1: Manual Perspective Correction**
```typescript
// Detect document edges and apply perspective transform
import cv from '@techstark/opencv-js'

function correctPerspective(imageBuffer: Buffer): Buffer {
  // Convert to OpenCV Mat
  // Detect edges (Canny edge detection)
  // Find largest quadrilateral (the paper)
  // Apply perspective transform to make it rectangular
  // Return corrected image
}
```

**Pros:**
- ✅ Can fix moderate angle distortion
- ✅ Improves extraction quality

**Cons:**
- ❌ Requires OpenCV (large dependency)
- ❌ May fail on complex backgrounds
- ❌ Processing time overhead

**Option 2: UI Guidance with Overlay**
```tsx
<CameraCapture>
  {/* Show rectangular overlay guide */}
  <div className="camera-overlay">
    <div className="guide-rectangle">
      {/* Corner markers */}
      <div className="corner top-left" />
      <div className="corner top-right" />
      <div className="corner bottom-left" />
      <div className="corner bottom-right" />
    </div>
    <p>Align paper within guides</p>
  </div>
</CameraCapture>
```

**Pros:**
- ✅ Simple implementation
- ✅ Educates user to take better photos
- ✅ No processing overhead

**Cons:**
- ❌ Relies on user compliance
- ❌ Still gets some skewed photos

**Recommendation:** Use **Option 2** (UI guidance) for MVP, consider **Option 1** (auto-correction) if quality issues persist.

**Challenge 3: Focus & Blur**

**Problem:**
- Users may not wait for camera to focus
- Movement during capture causes motion blur
- Small text (phone numbers, emails) becomes illegible

**Mitigation:**
- **Auto-focus enforcement:**
  ```typescript
  // Using browser MediaStream API
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      facingMode: 'environment', // Rear camera
      focusMode: 'continuous', // Auto-focus
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    }
  })
  ```
- **Capture on tap & hold:**
  ```tsx
  <button
    onTouchStart={() => setFocusing(true)}
    onTouchEnd={capturePhoto}
  >
    Hold to focus, release to capture
  </button>
  ```
- **Blur detection:**
  ```typescript
  // Reject blurry photos automatically
  const blurScore = detectBlur(imageBuffer)
  if (blurScore < threshold) {
    alert('Image too blurry - please retake')
  }
  ```

**Challenge 4: Multi-Page Capture & Ordering**

**Problem:**
- Typical mapping sheet is 2 pages
- User must take 2 separate photos
- Photos may be out of order or duplicated

**Current PDF Flow:**
```
User selects single PDF file (already contains pages 1-2 in order)
```

**Camera Flow:**
```
User takes Photo 1 → Review → Accept
User takes Photo 2 → Review → Accept
Upload both photos
```

**UX Challenges:**
- User forgets to take second photo
- User uploads page 2 twice by accident
- User reverses order (page 2, then page 1)

**Mitigation:**

**Step-by-step capture UI:**
```tsx
<MultiPageCameraCapture>
  {/* Step 1 */}
  <Step active={currentStep === 1}>
    <h3>Page 1: Project Details</h3>
    <CameraView onCapture={handlePage1} />
    {page1Captured && (
      <Thumbnail src={page1Preview} onRetake={() => setPage1(null)} />
    )}
  </Step>

  {/* Step 2 */}
  <Step active={currentStep === 2} disabled={!page1Captured}>
    <h3>Page 2: Subcontractors</h3>
    <CameraView onCapture={handlePage2} />
    {page2Captured && (
      <Thumbnail src={page2Preview} onRetake={() => setPage2(null)} />
    )}
  </Step>

  {/* Optional Step 3 */}
  <Step active={currentStep === 3} optional>
    <h3>Page 3 (Optional): Additional Subcontractors</h3>
    <CameraView onCapture={handlePage3} />
  </Step>

  <Button
    disabled={!page1Captured || !page2Captured}
    onClick={uploadPhotos}
  >
    Upload {capturedCount} Pages
  </Button>
</MultiPageCameraCapture>
```

**Features:**
- ✅ Clear step indicators
- ✅ Preview thumbnails with retake option
- ✅ Enforces correct order
- ✅ Prevents upload until minimum pages captured

**Challenge 5: File Size & Upload Speed**

**Problem:**
- iPhone photos are 3-6 MB each (HEIC format, 12MP+)
- Multiple photos = large uploads
- Slow upload on poor mobile network

**Comparison:**
| Format | Single Page Size | 2-Page Upload |
|--------|-----------------|---------------|
| PDF (scanned at 300 DPI) | 0.5-1 MB | 1-2 MB |
| iPhone Photo (HEIC, 12MP) | 3-5 MB | 6-10 MB |
| iPhone Photo (JPEG, compressed) | 1-2 MB | 2-4 MB |

**Mitigation:**

**Client-side compression:**
```typescript
// Using browser-image-compression library
import imageCompression from 'browser-image-compression'

async function compressPhoto(file: File): Promise<File> {
  const options = {
    maxSizeMB: 1, // Max 1MB per photo
    maxWidthOrHeight: 2480, // A4 width at 300 DPI
    useWebWorker: true,
    fileType: 'image/jpeg', // Convert HEIC to JPEG
  }

  return await imageCompression(file, options)
}
```

**Result:**
- 12MP iPhone photo: 5 MB → 800 KB (~85% reduction)
- Still maintains adequate quality for OCR

**Challenge 6: HEIC Format Compatibility**

**Problem:**
- iPhone default format is HEIC (High Efficiency Image Container)
- Not universally supported on server-side
- Sharp library supports HEIC but requires libheif

**Mitigation:**

**Option A: Client-side conversion to JPEG**
```typescript
// Use browser canvas API or compression library
// Convert HEIC to JPEG before upload
```

**Pros:**
- ✅ Server receives standard JPEG
- ✅ No server-side dependencies

**Option B: Server-side HEIC support**
```typescript
// Install sharp with HEIC support
// Handle both JPEG and HEIC

const imageBuffer = await sharp(uploadedFile)
  .toFormat('jpeg') // Convert to JPEG if HEIC
  .toBuffer()
```

**Pros:**
- ✅ Preserves original quality
- ✅ Automatic format detection

**Cons:**
- ❌ Requires libheif on server (Railway buildpack needed)

**Recommendation:** Use **Option A** (client-side conversion) for simplicity.

---

### 1.3 Expected Extraction Quality Impact

**Baseline (Clean PDF Scan):**
- Overall confidence: 0.85-0.95
- Field extraction accuracy: ~92%
- Error rate: ~8% (mostly illegible handwriting)

**Estimated (iPhone Camera Photos):**
- Overall confidence: 0.70-0.85
- Field extraction accuracy: ~75-85%
- Error rate: ~15-25%

**Breakdown by Issue:**
| Issue | Frequency | Impact on Accuracy |
|-------|-----------|-------------------|
| Poor lighting | 20-30% of photos | -10% accuracy |
| Perspective distortion | 40-50% of photos | -5% accuracy |
| Motion blur | 10-15% of photos | -15% accuracy |
| Low resolution | 5-10% of photos | -10% accuracy |
| Combined issues | 15-20% of photos | -20% accuracy |

**Conclusion:**
- 📊 Expect **10-20% reduction in extraction quality** vs. clean PDF scans
- ⚠️ May require additional user review/correction
- ✅ Still **viable for MVP** if users are willing to accept trade-off

---

### 1.4 Mobile UX Implementation

**Component Hierarchy:**

```tsx
<MobileUploadOption>
  {/* Choice: PDF or Camera */}
  <UploadModeSelector>
    <Button onClick={() => setMode('pdf')}>
      📄 Upload PDF
    </Button>
    <Button onClick={() => setMode('camera')}>
      📸 Take Photos
    </Button>
  </UploadModeSelector>

  {mode === 'camera' && (
    <CameraUploadFlow>
      <CameraGuidance /> {/* Tips for best results */}

      <MultiPageCapture
        pages={[
          { label: 'Page 1: Project Details', required: true },
          { label: 'Page 2: Subcontractors', required: true },
          { label: 'Page 3: Additional (optional)', required: false },
        ]}
        onComplete={handlePhotosReady}
      >
        {({ captureNext, retake, previews }) => (
          <>
            <CameraView
              onCapture={captureNext}
              overlay={<AlignmentGuide />}
            />

            <CapturedPreviews
              images={previews}
              onRetake={retake}
            />
          </>
        )}
      </MultiPageCapture>

      <QualityCheck images={capturedImages} />

      <UploadButton
        disabled={!allPagesReady}
        onClick={uploadAndProcess}
      />
    </CameraUploadFlow>
  )}
</MobileUploadOption>
```

**Libraries Needed:**
- `react-camera-pro` or custom `getUserMedia` wrapper
- `browser-image-compression` for client-side optimization
- `sharp` (server-side) for image processing
- `pdf-lib` for image-to-PDF conversion

---

### 1.5 Recommended Implementation Approach

**Phase 1: Basic Camera Support (Week 1)**
- ✅ Add camera mode to upload dialog
- ✅ Multi-page capture UI
- ✅ Client-side JPEG conversion
- ✅ Image-to-PDF conversion on server
- ✅ Reuse existing worker pipeline

**Phase 2: Quality Enhancements (Week 2)**
- ✅ Preview & retake functionality
- ✅ Quality check with warnings
- ✅ User guidance (tips, alignment overlay)
- ✅ Client-side compression

**Phase 3: Advanced Features (Week 3+)**
- ⚠️ Perspective correction (OpenCV)
- ⚠️ Blur detection & auto-reject
- ⚠️ Batch camera upload (10 projects × 2 photos each)

**Estimated Effort:**
- MVP (Phase 1): **1 week**
- Production-ready (Phases 1-2): **2-3 weeks**

---

## Part 2: Pending Approval Workflow Analysis

### 2.1 Architecture Overview

**Current Flow (No Approval):**
```
Scan Upload → AI Extraction → User Review → Confirm Import
  → Project/Employer created with ACTIVE status
  → Immediately visible in dashboards
```

**Proposed Flow (With Approval):**
```
Scan Upload → AI Extraction → User Review → Confirm Import
  → Project/Employer created with PENDING status
  → Admin/Lead Organiser notified
  → Admin reviews & edits
  → Admin approves OR rejects
  → Status changes to ACTIVE or REJECTED
```

---

### 2.2 Database Schema Changes

**New Status Fields:**

**Projects Table:**
```sql
-- Already has project_status field (text, nullable)
-- Expand usage to include approval states

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_via TEXT, -- 'manual', 'scanned_sheet', 'bulk_upload'
  ADD COLUMN IF NOT EXISTS pending_reason TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE projects
  ADD CONSTRAINT valid_approval_status CHECK (
    approval_status IN ('pending', 'active', 'rejected', 'under_review')
  );

-- Index for pending projects query
CREATE INDEX idx_projects_approval_status ON projects(approval_status);
CREATE INDEX idx_projects_created_via ON projects(created_via);
```

**Employers Table:**
```sql
-- No status field currently exists
-- Add approval tracking

ALTER TABLE employers
  ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_via TEXT, -- 'manual', 'scanned_sheet', 'bulk_upload'
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

ALTER TABLE employers
  ADD CONSTRAINT valid_approval_status CHECK (
    approval_status IN ('pending', 'active', 'rejected', 'under_review')
  );

CREATE INDEX idx_employers_approval_status ON employers(approval_status);
```

**Approval Audit Table (Optional but Recommended):**
```sql
CREATE TABLE approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What was approved
  entity_type TEXT NOT NULL, -- 'project', 'employer'
  entity_id UUID NOT NULL,
  entity_name TEXT, -- Snapshot for historical reference

  -- Who and when
  action TEXT NOT NULL, -- 'submitted', 'approved', 'rejected', 'updated'
  performed_by UUID REFERENCES auth.users(id),
  performed_at TIMESTAMPTZ DEFAULT now(),

  -- Details
  previous_status TEXT,
  new_status TEXT,
  notes TEXT,
  changes JSONB, -- Snapshot of what changed

  created_at TIMESTAMPTZ DEFAULT now(),

  CONSTRAINT valid_entity_type CHECK (entity_type IN ('project', 'employer')),
  CONSTRAINT valid_action CHECK (action IN ('submitted', 'approved', 'rejected', 'updated', 'under_review'))
);

CREATE INDEX idx_approval_history_entity ON approval_history(entity_type, entity_id);
CREATE INDEX idx_approval_history_status ON approval_history(new_status);
CREATE INDEX idx_approval_history_performed_by ON approval_history(performed_by);
```

**Why approval_history?**
- ✅ Audit trail (who approved what and when)
- ✅ Tracks changes made during review
- ✅ Compliance / accountability
- ✅ Can revert if needed

---

### 2.3 RPC Function Modifications

**Modify: `create_project_from_scan`**

```sql
CREATE OR REPLACE FUNCTION create_project_from_scan(
  p_user_id uuid,
  p_scan_id uuid,
  p_project_data jsonb,
  p_contacts jsonb DEFAULT '[]'::jsonb,
  p_subcontractors jsonb DEFAULT '[]'::jsonb,
  p_employer_creations jsonb DEFAULT '[]'::jsonb,
  p_require_approval boolean DEFAULT true -- NEW PARAMETER
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id uuid;
  v_employer_id uuid;
  v_approval_status text;
BEGIN
  -- Determine approval status
  v_approval_status := CASE
    WHEN p_require_approval THEN 'pending'
    ELSE 'active'
  END;

  -- Create project with approval status
  INSERT INTO projects (
    name,
    value,
    -- ... other fields ...
    approval_status,
    created_via,
    pending_reason
  ) VALUES (
    -- ... values ...
    v_approval_status,
    'scanned_sheet',
    CASE
      WHEN v_approval_status = 'pending' THEN 'Created from scanned mapping sheet - requires approval'
      ELSE NULL
    END
  )
  RETURNING id INTO v_project_id;

  -- Create builder employer (if new)
  IF p_project_data->'builder'->>'createNew' = 'true' THEN
    INSERT INTO employers (
      name,
      employer_type,
      approval_status,
      created_via,
      created_by
    ) VALUES (
      p_project_data->'builder'->'newEmployerData'->>'name',
      p_project_data->'builder'->'newEmployerData'->>'employer_type',
      v_approval_status, -- Same status as project
      'scanned_sheet',
      p_user_id
    )
    RETURNING id INTO v_employer_id;

    -- Log to approval_history
    IF v_approval_status = 'pending' THEN
      INSERT INTO approval_history (
        entity_type,
        entity_id,
        entity_name,
        action,
        performed_by,
        new_status
      ) VALUES (
        'employer',
        v_employer_id,
        p_project_data->'builder'->'newEmployerData'->>'name',
        'submitted',
        p_user_id,
        'pending'
      );
    END IF;
  END IF;

  -- Log project to approval_history
  IF v_approval_status = 'pending' THEN
    INSERT INTO approval_history (
      entity_type,
      entity_id,
      entity_name,
      action,
      performed_by,
      new_status
    ) VALUES (
      'project',
      v_project_id,
      p_project_data->>'name',
      'submitted',
      p_user_id,
      'pending'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'projectId', v_project_id,
    'approvalRequired', v_approval_status = 'pending'
  );
END;
$$;
```

**New RPC: `approve_project`**

```sql
CREATE OR REPLACE FUNCTION approve_project(
  p_admin_id uuid,
  p_project_id uuid,
  p_edits jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_name text;
BEGIN
  -- Check user has admin/lead_organiser role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_admin_id
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  -- Apply any edits
  IF p_edits IS NOT NULL THEN
    UPDATE projects
    SET
      name = COALESCE(p_edits->>'name', name),
      value = COALESCE((p_edits->>'value')::numeric, value),
      address = COALESCE(p_edits->>'address', address),
      -- ... other editable fields ...
      updated_at = now()
    WHERE id = p_project_id;
  END IF;

  -- Approve project
  UPDATE projects
  SET
    approval_status = 'active',
    approved_by = p_admin_id,
    approved_at = now()
  WHERE id = p_project_id
  RETURNING name INTO v_project_name;

  -- Log approval
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    entity_name,
    action,
    performed_by,
    previous_status,
    new_status,
    changes
  ) VALUES (
    'project',
    p_project_id,
    v_project_name,
    'approved',
    p_admin_id,
    'pending',
    'active',
    p_edits
  );

  RETURN jsonb_build_object('success', true, 'projectId', p_project_id);
END;
$$;

GRANT EXECUTE ON FUNCTION approve_project(uuid, uuid, jsonb) TO authenticated;
```

**New RPC: `reject_project`**

```sql
CREATE OR REPLACE FUNCTION reject_project(
  p_admin_id uuid,
  p_project_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_name text;
BEGIN
  -- Check user has admin/lead_organiser role
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_admin_id
    AND role IN ('admin', 'lead_organiser')
  ) THEN
    RETURN jsonb_build_object('error', 'Unauthorized', 'status', 403);
  END IF;

  -- Reject project
  UPDATE projects
  SET
    approval_status = 'rejected',
    rejected_by = p_admin_id,
    rejected_at = now(),
    rejection_reason = p_reason
  WHERE id = p_project_id
  RETURNING name INTO v_project_name;

  -- Log rejection
  INSERT INTO approval_history (
    entity_type,
    entity_id,
    entity_name,
    action,
    performed_by,
    previous_status,
    new_status,
    notes
  ) VALUES (
    'project',
    p_project_id,
    v_project_name,
    'rejected',
    p_admin_id,
    'pending',
    'rejected',
    p_reason
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION reject_project(uuid, uuid, text) TO authenticated;
```

**Similar RPCs for Employers:**
- `approve_employer(p_admin_id, p_employer_id, p_edits)`
- `reject_employer(p_admin_id, p_employer_id, p_reason)`

---

### 2.4 Notification System

**Challenge:** How to alert admins when new pending items appear?

**Option A: Real-time Polling (Simple)**

```typescript
// Admin dashboard polls every 30 seconds
const { data: pendingCount } = useQuery({
  queryKey: ['pending-approvals'],
  queryFn: async () => {
    const [projects, employers] = await Promise.all([
      supabase
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending'),

      supabase
        .from('employers')
        .select('id', { count: 'exact', head: true })
        .eq('approval_status', 'pending'),
    ])

    return {
      projects: projects.count || 0,
      employers: employers.count || 0,
      total: (projects.count || 0) + (employers.count || 0)
    }
  },
  refetchInterval: 30000, // Poll every 30 seconds
})

// Show badge on admin nav
<Badge>{pendingCount.total}</Badge>
```

**Pros:**
- ✅ Simple to implement
- ✅ No infrastructure needed

**Cons:**
- ❌ Delay up to 30 seconds
- ❌ Not truly "real-time"

**Option B: Supabase Realtime Subscriptions**

```typescript
// Subscribe to changes on projects table
useEffect(() => {
  const channel = supabase
    .channel('pending-projects')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'projects',
        filter: 'approval_status=eq.pending'
      },
      (payload) => {
        toast.info('New pending project requires approval')
        queryClient.invalidateQueries(['pending-approvals'])
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}, [])
```

**Pros:**
- ✅ True real-time updates
- ✅ Instant notifications

**Cons:**
- ❌ Realtime only works if admin has page open
- ❌ Doesn't notify if admin is offline

**Option C: Email Notifications**

```sql
-- Trigger function to send email when project is pending
CREATE OR REPLACE FUNCTION notify_admins_new_pending_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_emails text[];
BEGIN
  IF NEW.approval_status = 'pending' AND OLD.approval_status IS NULL THEN
    -- Get all admin/lead_organiser emails
    SELECT array_agg(email) INTO v_admin_emails
    FROM profiles p
    JOIN auth.users u ON u.id = p.id
    WHERE p.role IN ('admin', 'lead_organiser');

    -- Send email via Supabase Edge Function or external service
    -- (Requires additional implementation)
    PERFORM pg_notify('new_pending_project', json_build_object(
      'project_id', NEW.id,
      'project_name', NEW.name,
      'admin_emails', v_admin_emails
    )::text);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_project_pending
  AFTER INSERT OR UPDATE OF approval_status ON projects
  FOR EACH ROW
  EXECUTE FUNCTION notify_admins_new_pending_project();
```

**Email Service Integration:**
- Use **Supabase Edge Function** to send emails via **SendGrid** or **Resend**
- Listen to `pg_notify` channel
- Send digest email (not one per project)

**Example Email:**
```
Subject: [CFMEU] 3 New Projects Awaiting Approval

You have 3 new projects and 2 new employers pending approval:

PROJECTS:
1. ABC Tower - Sydney - $15M
   Created by: John Smith
   View: https://app.cfmeu.com/admin?tab=pending-projects

2. XYZ Plaza - Parramatta - $8M
   Created by: Jane Doe
   View: https://app.cfmeu.com/admin?tab=pending-projects

EMPLOYERS:
1. Greenview Commercial (Builder)
   Created by: John Smith
   View: https://app.cfmeu.com/admin?tab=pending-employers

[View All Pending Approvals]
```

**Recommendation:** Use **combination**:
- Polling (Option A) for immediate UI updates when admin is logged in
- Email notifications (Option C) for offline admins
- Optional: Realtime (Option B) for extra responsiveness

---

### 2.5 Admin Dashboard UI

**New Tab in Admin Page:**

```tsx
// Add to /admin page
<Tabs value={tabValue} onValueChange={setTabValue}>
  <TabsList>
    <TabsTrigger value="users">Users</TabsTrigger>
    <TabsTrigger value="pending-approvals">
      Pending Approvals
      {pendingCount > 0 && (
        <Badge variant="destructive" className="ml-2">
          {pendingCount}
        </Badge>
      )}
    </TabsTrigger>
    <TabsTrigger value="roles">Roles</TabsTrigger>
    {/* ... other tabs ... */}
  </TabsList>

  <TabsContent value="pending-approvals">
    <PendingApprovalsManager />
  </TabsContent>
</Tabs>
```

**PendingApprovalsManager Component:**

```tsx
function PendingApprovalsManager() {
  const [activeSection, setActiveSection] = useState<'projects' | 'employers'>('projects')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pending Approvals</h2>
        <ToggleGroup type="single" value={activeSection} onValueChange={setActiveSection}>
          <ToggleGroupItem value="projects">
            Projects ({pendingProjects.length})
          </ToggleGroupItem>
          <ToggleGroupItem value="employers">
            Employers ({pendingEmployers.length})
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {activeSection === 'projects' && <PendingProjectsTable />}
      {activeSection === 'employers' && <PendingEmployersTable />}
    </div>
  )
}
```

**PendingProjectsTable:**

```tsx
function PendingProjectsTable() {
  const { data: pendingProjects, isLoading } = useQuery({
    queryKey: ['pending-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id,
          name,
          value,
          address,
          created_via,
          created_at,
          created_by:profiles!projects_created_by_fkey(full_name, email),
          scan:mapping_sheet_scans(id, file_name, extracted_data)
        `)
        .eq('approval_status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    }
  })

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Project Name</TableHead>
          <TableHead>Value</TableHead>
          <TableHead>Address</TableHead>
          <TableHead>Created By</TableHead>
          <TableHead>Source</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingProjects?.map(project => (
          <PendingProjectRow
            key={project.id}
            project={project}
            onApprove={() => handleApprove(project.id)}
            onReject={() => handleReject(project.id)}
            onReview={() => openReviewDialog(project)}
          />
        ))}
      </TableBody>
    </Table>
  )
}
```

**Review Dialog (Duplicate Check + Edit):**

```tsx
function ProjectReviewDialog({ project, onClose }) {
  const [edits, setEdits] = useState({})
  const [duplicates, setDuplicates] = useState([])

  // Fetch potential duplicates
  useEffect(() => {
    async function checkDuplicates() {
      // Fuzzy search for similar projects
      const similar = await searchSimilarProjects(project.name, project.address)
      setDuplicates(similar)
    }
    checkDuplicates()
  }, [project])

  return (
    <Dialog>
      <DialogHeader>
        <DialogTitle>Review Project: {project.name}</DialogTitle>
      </DialogHeader>

      {/* Duplicate Warning */}
      {duplicates.length > 0 && (
        <Alert variant="warning">
          <AlertCircle />
          <AlertDescription>
            <strong>Potential duplicates found:</strong>
            {duplicates.map(dup => (
              <div key={dup.id}>
                {dup.name} - {dup.address} (
                <Link href={`/projects/${dup.id}`}>View</Link>)
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Editable Fields */}
      <div className="space-y-4">
        <div>
          <Label>Project Name</Label>
          <Input
            value={edits.name ?? project.name}
            onChange={(e) => setEdits({ ...edits, name: e.target.value })}
          />
        </div>

        <div>
          <Label>Value (AUD)</Label>
          <Input
            type="number"
            value={edits.value ?? project.value}
            onChange={(e) => setEdits({ ...edits, value: e.target.value })}
          />
        </div>

        <div>
          <Label>Address</Label>
          <GoogleAddressInput
            value={edits.address ?? project.address}
            onChange={(addr) => setEdits({ ...edits, address: addr.formatted, latitude: addr.lat, longitude: addr.lng })}
          />
        </div>

        {/* ... more editable fields ... */}
      </div>

      {/* Original Scan Data (Read-only) */}
      <Collapsible>
        <CollapsibleTrigger>
          <Button variant="ghost">View Original Scan Data</Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <pre className="bg-gray-100 p-4 rounded overflow-auto">
            {JSON.stringify(project.scan?.extracted_data, null, 2)}
          </pre>
        </CollapsibleContent>
      </Collapsible>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button
          variant="destructive"
          onClick={() => handleReject(project.id, rejectReason)}
        >
          Reject
        </Button>
        <Button
          onClick={() => handleApprove(project.id, edits)}
        >
          Approve {Object.keys(edits).length > 0 && '(with changes)'}
        </Button>
      </DialogFooter>
    </Dialog>
  )
}
```

**Key Features:**
- ✅ Duplicate detection (fuzzy matching)
- ✅ Side-by-side comparison with potential duplicates
- ✅ Edit capability before approval
- ✅ View original scan data for reference
- ✅ Reject with reason
- ✅ Approve (with or without edits)

---

### 2.6 RLS Policy Updates

**Problem:** Pending projects/employers should NOT be visible to regular users.

**Current Policy (Projects):**
```sql
-- Users can view all projects (too permissive for pending)
CREATE POLICY "Users can view projects"
  ON projects FOR SELECT
  USING (auth.role() = 'authenticated');
```

**Updated Policy:**
```sql
-- Drop old policy
DROP POLICY IF EXISTS "Users can view projects" ON projects;

-- New policy: Hide pending projects from non-admins
CREATE POLICY "Users can view active projects"
  ON projects FOR SELECT
  USING (
    approval_status = 'active'
    OR (
      approval_status IN ('pending', 'under_review')
      AND (
        -- Allow admins/lead_organisers to see pending
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'lead_organiser')
        )
        -- Allow creator to see their own pending project
        OR created_by = auth.uid()
      )
    )
  );
```

**Similar for Employers:**
```sql
CREATE POLICY "Users can view active employers"
  ON employers FOR SELECT
  USING (
    approval_status = 'active'
    OR (
      approval_status IN ('pending', 'under_review')
      AND (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = auth.uid()
          AND role IN ('admin', 'lead_organiser')
        )
        OR created_by = auth.uid()
      )
    )
  );
```

**Why allow creator to see their own pending items?**
- ✅ Transparency (user can check status)
- ✅ Allows user to provide additional context if needed
- ✅ User can cancel/withdraw submission

---

### 2.7 Impact on Existing Workflows

**Concern 1: Slow Admin Response Time**

**Problem:**
- If approval takes 2-3 days, projects are "stuck" in limbo
- Organisers can't start work on project
- Delays onboarding

**Mitigation:**
- **SLA Tracking:** Show "Days Pending" in admin dashboard
- **Auto-escalation:** Email reminder if pending >3 days
- **Batch Approval:** Admin can approve multiple at once
- **Optional:** Allow admin to delegate approval to specific lead_organisers

**Concern 2: Duplicate Projects Created Before Approval**

**Problem:**
- User A creates "ABC Tower" (pending)
- User B creates "ABC Tower" (pending) 2 hours later
- Admin approves both → duplicates in system

**Mitigation:**
- **Fuzzy matching BEFORE submission:**
  ```typescript
  // When user confirms import, check for duplicates
  const similar = await searchSimilarProjects(projectName, address)

  if (similar.length > 0) {
    showWarning('Potential duplicate found. Are you sure this is a NEW project?')
  }
  ```
- **Admin sees all pending + active during review** (not just pending)
- **Approval_history prevents accidental approval** (admin can see recent approvals)

**Concern 3: Builder/Subcontractor Assignment Before Approval**

**Problem:**
- Project is pending
- Employer is pending
- Assignment created via `project_assignments`
- What happens if employer is rejected?

**Solution:**
- **Cascade rejection:**
  ```sql
  -- When employer is rejected, also reject projects that ONLY have this employer
  -- OR remove the assignment and set project to 'under_review'
  ```
- **Alternative:** Don't create assignments until both project AND employer are approved

**Recommended Approach:**
```sql
-- Modify create_project_from_scan to NOT create assignments if approval required
-- Instead, store in temporary table: pending_project_assignments

CREATE TABLE pending_project_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  employer_id UUID REFERENCES employers(id),
  assignment_type TEXT,
  -- ... other fields ...
  created_at TIMESTAMPTZ DEFAULT now()
);

-- On approval, migrate to project_assignments
CREATE OR REPLACE FUNCTION approve_project(...)
  -- ...

  -- Migrate pending assignments
  INSERT INTO project_assignments (project_id, employer_id, ...)
  SELECT project_id, employer_id, ...
  FROM pending_project_assignments
  WHERE project_id = p_project_id
  AND employer_id IN (
    SELECT id FROM employers WHERE approval_status = 'active'
  );

  -- Delete pending assignments
  DELETE FROM pending_project_assignments WHERE project_id = p_project_id;
END;
$$;
```

---

### 2.8 User Flow Changes

**Before (No Approval):**
```
User uploads scan
  → Reviews extracted data
  → Confirms import
  → Toast: "Project created successfully!"
  → Redirects to /projects/[newProjectId]
  → Project immediately visible in dashboards
```

**After (With Approval):**
```
User uploads scan
  → Reviews extracted data
  → Confirms import
  → Toast: "Project submitted for approval. Admins will review and you'll be notified."
  → Redirects to /projects with banner:
      "Your project 'ABC Tower' is pending admin approval. Track status here."
  → User sees project in "My Pending Projects" section
  → Email sent to user: "Your project has been submitted and is awaiting approval"

[Admin reviews and approves]

  → User receives email: "Your project 'ABC Tower' has been approved!"
  → Project now visible in main project list
  → Project available for organising workflow
```

**User Visibility of Pending Items:**

```tsx
// Projects page - add filter
<Tabs>
  <TabsTrigger value="active">Active Projects</TabsTrigger>
  <TabsTrigger value="pending">
    My Pending Projects
    {userPendingCount > 0 && <Badge>{userPendingCount}</Badge>}
  </TabsTrigger>
</Tabs>

<TabsContent value="pending">
  <PendingProjectsList
    projects={userPendingProjects}
    onWithdraw={handleWithdraw}
  />
</TabsContent>
```

---

### 2.9 Implementation Phases

**Phase 1: Database Schema (2-3 days)**
- ✅ Add approval_status fields to projects and employers
- ✅ Create approval_history table
- ✅ Update RLS policies
- ✅ Create approval RPCs (approve_project, reject_project, etc.)
- ✅ Indexes for performance

**Phase 2: Backend Integration (2-3 days)**
- ✅ Modify create_project_from_scan to set approval_status = 'pending'
- ✅ Modify import-scan API route
- ✅ Add notification trigger (email or realtime)
- ✅ Test approval/rejection flows

**Phase 3: Admin Dashboard UI (3-4 days)**
- ✅ New "Pending Approvals" tab in admin page
- ✅ PendingProjectsTable component
- ✅ PendingEmployersTable component
- ✅ Review dialog with duplicate checking
- ✅ Edit capability
- ✅ Approve/reject actions
- ✅ Notification badge

**Phase 4: User-facing UI (2 days)**
- ✅ Update import success messaging
- ✅ "My Pending Projects" section
- ✅ Withdraw/cancel capability
- ✅ Status tracking

**Phase 5: Notifications (2-3 days)**
- ✅ Email template for new pending items
- ✅ Email template for approval/rejection
- ✅ Digest functionality (batch emails)
- ✅ Realtime subscriptions (optional)

**Total Estimated Effort: 1.5-2 weeks**

---

### 2.10 Configuration Options

**Should approval be ALWAYS required or configurable?**

**Option A: Always Required (Strict)**
- All scanned projects/employers go through approval
- Simple to implement and understand

**Option B: Configurable by User Role**
```sql
-- Only require approval for certain user roles
CREATE TABLE user_approval_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  auto_approve_projects BOOLEAN DEFAULT false,
  auto_approve_employers BOOLEAN DEFAULT false
);

-- Admin/Lead Organisers can auto-approve
UPDATE user_approval_settings
SET auto_approve_projects = true, auto_approve_employers = true
WHERE user_id IN (
  SELECT id FROM profiles WHERE role IN ('admin', 'lead_organiser')
);
```

**Option C: Configurable by Creation Method**
```typescript
// Config in environment or settings table
const approvalConfig = {
  manual_projects: false, // Manual creation doesn't require approval
  scanned_projects: true, // Scanned projects require approval
  bulk_upload_projects: true, // Bulk uploads require approval
}
```

**Recommendation:** Use **Option C** (by creation method) for flexibility:
- Manual projects created by trusted users → No approval
- Scanned projects → Approval (higher error rate)
- Bulk uploads → Approval (high volume, higher risk)

---

## Part 3: Combined Implementation Considerations

### 3.1 Mobile Camera + Pending Approval

**User Flow:**
```
[User on iPhone]
  → Opens camera mode
  → Takes 2 photos of mapping sheet
  → Uploads
  → Worker processes (converts to PDF, runs AI extraction)
  → User reviews extracted data
  → Confirms import
  → Project created with approval_status = 'pending'
  → Toast: "Photos uploaded. Project pending admin approval."

[Admin on Desktop]
  → Receives email notification
  → Opens admin dashboard → Pending Approvals tab
  → Reviews project
  → Sees note: "Created via: Mobile Camera Upload"
  → Checks for duplicates
  → Edits fields (fixes any camera quality issues)
  → Approves
  → User notified

[User receives email]
  → "Your project ABC Tower has been approved!"
```

**Why this combination makes sense:**
- ✅ Mobile photos have lower quality → Admin can catch errors before activation
- ✅ Admin can fix extraction errors during approval
- ✅ Reduces risk of bad data entering system

### 3.2 Data Quality Tracking

**Track extraction method and quality:**
```sql
ALTER TABLE projects
  ADD COLUMN extraction_method TEXT, -- 'pdf_scan', 'mobile_camera', 'manual_entry'
  ADD COLUMN extraction_confidence DECIMAL(3, 2), -- Overall confidence from AI
  ADD COLUMN required_edits_count INTEGER DEFAULT 0; -- How many fields admin changed

-- Analyze quality over time
SELECT
  extraction_method,
  AVG(extraction_confidence) AS avg_confidence,
  AVG(required_edits_count) AS avg_edits,
  COUNT(*) AS total_projects
FROM projects
WHERE created_via = 'scanned_sheet'
GROUP BY extraction_method;

-- Results might show:
-- pdf_scan:      0.90 confidence, 1.2 avg edits
-- mobile_camera: 0.75 confidence, 3.8 avg edits
```

**Use this data to:**
- Improve camera guidance
- Identify problematic fields (e.g., "phone numbers always wrong in photos")
- Train users on better photo techniques

---

## Part 4: Risk Assessment

### 4.1 Mobile Camera Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Poor photo quality causes extraction failures | High | Medium | Quality check UI, retake option, user guidance |
| Users frustrated by multi-photo process | Medium | Low | Clear step-by-step UI, progress indicators |
| HEIC format compatibility issues | Low | Medium | Client-side conversion to JPEG |
| Large file uploads on slow mobile networks | Medium | Low | Client-side compression, progress UI |
| Admin workload increased by low-quality photos | Medium | High | Approval workflow catches errors before activation |

### 4.2 Pending Approval Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Admin approval bottleneck delays work | Medium | High | SLA tracking, email reminders, batch approval |
| Duplicate projects created during pending period | Low | Medium | Fuzzy matching before submission |
| Confusion about project visibility | Medium | Low | Clear status messaging, "My Pending" section |
| Admin overwhelmed by high volume | Medium | High | Batch operations, delegation to lead_organisers |
| Security: Non-admin accessing approval API | Low | High | RLS policies, role checks in RPCs |

---

## Part 5: Recommendations

### 5.1 Mobile Camera Upload

**Proceed with MVP if:**
- ✅ Users frequently create mapping sheets in the field
- ✅ Immediate mobile capture is a workflow priority
- ✅ Quality trade-off is acceptable (10-20% accuracy reduction)
- ✅ Approval workflow is in place to catch errors

**Implementation Priority:**
1. **Week 1:** Basic camera UI + image-to-PDF conversion
2. **Week 2:** Quality guidance + preview/retake
3. **Week 3+:** Advanced features (perspective correction, blur detection)

**Success Metrics:**
- % of uploads via mobile camera (target: >30% if successful)
- Extraction confidence comparison (mobile vs PDF)
- Admin edit rate (fields changed during approval)
- User satisfaction (survey: "Was camera upload easy to use?")

### 5.2 Pending Approval Workflow

**Proceed with implementation:**
- ✅ **YES** - Provides essential quality control
- ✅ Particularly important with mobile camera uploads
- ✅ Prevents duplicate projects
- ✅ Allows admin to verify employer matches
- ✅ Creates audit trail

**Implementation Priority:**
1. **Week 1:** Database schema + RLS policies + RPCs
2. **Week 2:** Admin dashboard UI + duplicate checking
3. **Week 2-3:** Notifications + user-facing status UI

**Success Metrics:**
- Average time to approval (target: <24 hours)
- % of projects approved without edits (target: >70%)
- % of projects rejected (should be <5% if fuzzy matching works)
- Duplicate prevention rate

---

## Part 6: Alternative Approaches

### 6.1 Mobile Camera: Hybrid Approach

**Instead of converting to PDF, use dedicated mobile app:**

**Pros:**
- Native camera controls (better focus, exposure)
- HEIC handling automatic
- Can use on-device ML for quality pre-check
- Better UX (mobile-first)

**Cons:**
- Requires iOS app development
- Separate codebase to maintain
- App store approval process
- Not all users may install app

**Verdict:** Progressive Web App (PWA) with camera API is better for MVP.

### 6.2 Pending Approval: Auto-Approval with Post-Review

**Instead of blocking activation, auto-activate with "flagged for review":**

```
Project created → approval_status = 'active_pending_review'
  → Visible in system immediately
  → Flagged for admin review
  → Admin can retroactively reject/edit
```

**Pros:**
- No delay for users
- Less admin bottleneck
- Faster workflow

**Cons:**
- Bad data enters system immediately
- Harder to reject after users start working on it
- Duplicates harder to prevent

**Verdict:** Pre-approval is safer for data quality.

---

## Conclusion

Both features are **architecturally feasible** and **strategically valuable**:

**Mobile Camera Upload:**
- Enables field-based data capture
- Reduces dependency on scanners/computers
- Accepts quality trade-off for convenience
- **Estimated: 2-3 weeks** for production-ready

**Pending Approval Workflow:**
- Essential quality control mechanism
- Particularly valuable WITH mobile camera uploads
- Prevents duplicates and bad data
- **Estimated: 1.5-2 weeks** for full implementation

**Combined Timeline: 3-4 weeks** if implemented sequentially

**Recommended Implementation Order:**
1. **Phase 1:** Pending approval workflow (foundational)
2. **Phase 2:** Mobile camera upload (builds on approval)

This sequence ensures quality controls are in place BEFORE lower-quality mobile uploads begin flowing through the system.

---

**Document Version:** 1.0
**Date:** 2025-01-10
**Author:** Claude Code Analysis
**Status:** Draft - Awaiting Approval

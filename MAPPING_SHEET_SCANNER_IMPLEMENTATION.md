# Mapping Sheet Scanner - Implementation Summary

## Files Created ✅

### 1. Database Migration
- ✅ `supabase/migrations/20250930000000_mapping_sheet_scanner.sql`

### 2. Railway Worker (Complete)
- ✅ `railway_workers/mapping-sheet-scanner-worker/package.json`
- ✅ `railway_workers/mapping-sheet-scanner-worker/tsconfig.json`
- ✅ `railway_workers/mapping-sheet-scanner-worker/Dockerfile`
- ✅ `railway_workers/mapping-sheet-scanner-worker/railway.toml`
- ✅ `railway_workers/mapping-sheet-scanner-worker/README.md`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/config.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/types.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/supabase.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/jobs.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/index.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/ai/prompts.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/ai/claude.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/ai/openai.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/pdf/converter.ts`
- ✅ `railway_workers/mapping-sheet-scanner-worker/src/processors/mappingSheetProcessor.ts`

### 3. Frontend - Types
- ✅ `src/types/mappingSheetScan.ts`

### 4. Frontend - Upload Flow
- ✅ `src/components/projects/mapping/UploadMappingSheetDialog.tsx`
- ✅ `src/app/(app)/projects/[projectId]/scan-review/[scanId]/page.tsx`
- ✅ `src/components/projects/mapping/scan-review/ConfidenceIndicator.tsx`

### 5. Documentation
- ✅ `MAPPING_SHEET_SCANNER_TESTING.md`

## Frontend - Review Components (Complete ✅)
- ✅ `src/components/projects/mapping/scan-review/ScanReviewContainer.tsx`
- ✅ `src/components/projects/mapping/scan-review/ProjectFieldsReview.tsx`
- ✅ `src/components/projects/mapping/scan-review/SiteContactsReview.tsx`
- ✅ `src/components/projects/mapping/scan-review/SubcontractorsReview.tsx`
- ✅ `src/components/projects/mapping/scan-review/EmployerMatchDialog.tsx`

## API Route (Complete ✅)
- ✅ `src/app/api/projects/[projectId]/import-scan/route.ts`

## Integration Points

### Add Upload Button to Existing Mapping Sheet Component

In `src/components/projects/mapping/MappingSheetPage1.tsx`, add:

```typescript
import { UploadMappingSheetDialog } from './UploadMappingSheetDialog'
import { Upload } from 'lucide-react'
import { useState } from 'react'

// In component:
const [showUploadDialog, setShowUploadDialog] = useState(false)

// Add button in header:
<div className="flex items-center justify-between mb-4">
  <h2 className="text-xl font-semibold">Project Mapping</h2>
  <Button 
    onClick={() => setShowUploadDialog(true)}
    variant="outline"
    size="sm"
  >
    <Upload className="h-4 w-4 mr-2" />
    Upload Scanned Sheet
  </Button>
</div>

// Add dialog at end:
{showUploadDialog && (
  <UploadMappingSheetDialog
    projectId={projectData.id}
    projectName={projectData.name}
    open={showUploadDialog}
    onOpenChange={setShowUploadDialog}
  />
)}
```

## Setup Instructions

### 1. Database Setup
```bash
# Apply migration
supabase db push

# Verify tables created
supabase db status
```

### 2. Worker Setup (Local Testing)
```bash
cd railway_workers/mapping-sheet-scanner-worker
npm install

# Create .env file
cat > .env << EOF
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_key
CLAUDE_API_KEY=your_claude_key
OPENAI_API_KEY=your_openai_key
POLL_INTERVAL_MS=5000
MAX_RETRIES=3
EOF

# Run worker
npm run dev
```

### 3. Frontend Integration
```bash
# Install new dependency (if not already present)
npm install react-dropzone

# The upload dialog requires react-dropzone for file handling
```

## Architecture Flow

```
User uploads PDF
    ↓
Upload Dialog Component
    ↓
Supabase Storage (PDF stored)
    ↓
mapping_sheet_scans record created
    ↓
scraper_jobs record created (job_type: 'mapping_sheet_scan')
    ↓
Railway Worker polls and picks up job
    ↓
PDF → Images → Claude AI → JSON
    ↓
mapping_sheet_scans updated with extracted_data
    ↓
User reviews in ScanReviewContainer
    ↓
Employer matching with fuzzy logic
    ↓
User confirms import
    ↓
API route imports to project
    ↓
mapping_sheet_scans marked 'confirmed'
```

## Cost Tracking

All API costs are tracked in `mapping_sheet_scan_costs` table:
- Claude 3.5 Sonnet: ~$0.003/1K input, $0.015/1K output
- Average per scan: $0.10 - $0.30

Query total costs:
```sql
SELECT 
  DATE(created_at) as date,
  ai_provider,
  COUNT(*) as scans,
  SUM(cost_usd) as total_cost
FROM mapping_sheet_scan_costs
GROUP BY DATE(created_at), ai_provider
ORDER BY date DESC;
```

## Next Steps

1. ✅ Database migration applied
2. ✅ Worker code complete
3. ✅ All review components created
4. ✅ API import route created
5. ⏳ **Add upload button to MappingSheetPage1** (see Integration Points section)
6. ⏳ Install dependencies: `npm install react-dropzone`
7. ⏳ Test locally with sample PDFs
8. ⏳ Deploy worker to Railway
9. ⏳ Test in production

## Testing Priority

1. **Worker functionality** - Test PDF processing locally first
2. **Upload flow** - Ensure PDFs upload and jobs create
3. **AI extraction** - Verify Claude/OpenAI return good data
4. **Review UI** - Check user can review and make decisions
5. **Import logic** - Verify data imports correctly
6. **Error handling** - Test failure scenarios

## Known Dependencies

### Railway Worker
- `@anthropic-ai/sdk` - Claude AI
- `openai` - OpenAI fallback
- `pdfjs-dist` - PDF parsing
- `canvas` - Image rendering (requires native libs)
- `sharp` - Image optimization

### Frontend
- `react-dropzone` - File upload UI
- `@tanstack/react-query` - Data fetching (already in project)

## Production Deployment

### Railway Worker Deploy
```bash
# From root of project
git add railway_workers/mapping-sheet-scanner-worker
git commit -m "Add mapping sheet scanner worker"
git push origin main

# Railway will auto-deploy from the worker subfolder
```

### Environment Variables in Railway
Set these in Railway dashboard:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLAUDE_API_KEY`
- `OPENAI_API_KEY`

## Support

For issues or questions:
1. Check worker logs in Railway dashboard
2. Query `mapping_sheet_scans` table for errors
3. Review `scraper_jobs` for stuck jobs
4. Check browser console for frontend errors

# Mapping Sheet Scanner - Testing Guide

## Prerequisites

1. **Database Migration Applied**
   ```bash
   # Apply migration to local Supabase
   supabase db reset
   # OR push migration
   supabase db push
   ```

2. **Environment Variables Set**
   - Worker needs: `CLAUDE_API_KEY`, `OPENAI_API_KEY`
   - Check `.env.local` has Supabase credentials

3. **Railway Worker Running Locally**
   ```bash
   cd railway_workers/mapping-sheet-scanner-worker
   npm install
   npm run dev
   # Should start on localhost polling scraper_jobs
   ```

## Test Scenarios

### 1. Upload Flow Test
- [ ] Navigate to a project's Mapping Sheets tab
- [ ] Click "Upload Scanned Sheet" button
- [ ] Verify dialog opens
- [ ] Try uploading non-PDF (should reject)
- [ ] Try uploading PDF > 10MB (should reject)
- [ ] Upload valid PDF (use sample provided)
- [ ] Verify upload progress shows
- [ ] Verify processing status updates
- [ ] Wait for completion (30-60 seconds)
- [ ] Verify navigation to review page

### 2. AI Extraction Quality Test
- [ ] Check extracted data accuracy
- [ ] Verify confidence scores make sense
- [ ] Check for warnings on illegible fields
- [ ] Validate dates are parsed correctly
- [ ] Validate dollar amounts are correct
- [ ] Check phone numbers extracted properly
- [ ] Check email addresses validated

### 3. Review UI Test
- [ ] Project tab shows extracted vs existing side-by-side
- [ ] Can toggle between keep/replace/custom
- [ ] Custom input validation works
- [ ] Confidence indicators display correctly
- [ ] Site contacts tab loads
- [ ] Can toggle import checkboxes
- [ ] Subcontractors tab loads
- [ ] Employer matching suggestions appear

### 4. Employer Matching Test
- [ ] Exact matches auto-selected
- [ ] Fuzzy matches marked for review
- [ ] Can search for different employer
- [ ] Can create new employer
- [ ] Match confirmation updates decision

### 5. Import Test
- [ ] Click "Confirm & Import"
- [ ] Verify loading state
- [ ] Check success toast
- [ ] Navigate back to project
- [ ] Verify project fields updated
- [ ] Verify site contacts created/updated
- [ ] Verify subcontractors appear in mapping sheet
- [ ] Check scan status = 'confirmed'

### 6. Error Handling Test
- [ ] Upload corrupted PDF
- [ ] Kill worker mid-processing
- [ ] Verify error message displayed
- [ ] Check retry logic works
- [ ] Reject scan and verify status

### 7. Cost Tracking Test
- [ ] Check `mapping_sheet_scan_costs` table populated
- [ ] Verify cost calculated correctly
- [ ] Check AI provider recorded

### 8. Concurrent Scan Prevention Test
- [ ] Upload scan for project
- [ ] Try uploading another scan for same project
- [ ] Verify blocked with message
- [ ] Complete first scan
- [ ] Verify can upload new scan

## Sample Test Data

Place sample handwritten mapping sheet PDFs in `/test-data/mapping-sheets/`

## Database Queries for Verification

```sql
-- Check scan status
SELECT id, project_id, status, ai_provider, extraction_cost_usd 
FROM mapping_sheet_scans 
ORDER BY created_at DESC 
LIMIT 10;

-- Check extracted data
SELECT id, extracted_data->'project'->>'project_name' as name,
       confidence_scores->'overall' as confidence
FROM mapping_sheet_scans 
WHERE status = 'completed';

-- Check costs
SELECT scan_id, ai_provider, cost_usd, processing_time_ms
FROM mapping_sheet_scan_costs
ORDER BY created_at DESC;

-- Check imported assignments
SELECT p.name, e.name, tt.name as trade
FROM project_assignments pa
JOIN projects p ON p.id = pa.project_id
JOIN employers e ON e.id = pa.employer_id
JOIN trade_types tt ON tt.id = pa.trade_type_id
WHERE pa.source = 'scanned_mapping_sheet';
```

## Local Worker Testing Steps

### 1. Set up environment
```bash
cd railway_workers/mapping-sheet-scanner-worker
cp .env.example .env
# Edit .env with your API keys
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start worker in dev mode
```bash
npm run dev
```

Expected output:
```
[worker] Starting mapping sheet scanner worker
[worker] Configuration: {
  supabaseUrl: 'https://your-project.supabase.co',
  pollIntervalMs: 5000,
  maxRetries: 3,
  claudeModel: 'claude-3-5-sonnet-20241022'
}
```

### 4. Upload a test scan
- Use the main app to upload a PDF
- Watch worker console for job processing
- Should see: "Handling job [id]"
- Then: "Converting PDF to images"
- Then: "Attempting extraction with Claude"
- Finally: "Extraction successful with claude"

### 5. Check results
- Query database for scan record
- Verify `extracted_data` JSON is populated
- Check confidence scores
- Review any warnings

## Troubleshooting

### Worker not picking up jobs
- Check `scraper_jobs` table for queued jobs
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Check worker logs for connection errors

### PDF conversion fails
- Ensure all native dependencies installed (canvas, cairo)
- Check PDF is not corrupted
- Verify PDF is under 10MB and 3 pages

### AI extraction fails
- Verify API keys are correct
- Check AI API rate limits
- Review error message in scan record
- Check worker console for detailed errors

### Import fails
- Check user has permissions
- Verify project exists
- Check for database constraints
- Review API route logs

## Performance Benchmarks

Expected timings:
- PDF upload: 2-5 seconds
- PDF to image conversion: 3-5 seconds
- Claude AI extraction: 15-30 seconds
- OpenAI fallback: 20-40 seconds
- Total processing: 30-60 seconds

Costs:
- Claude 3.5 Sonnet: $0.10 - $0.25 per 3-page scan
- OpenAI GPT-4 Vision: $0.15 - $0.35 per 3-page scan

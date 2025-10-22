# Idempotency Implementation for Batch Upload Job Creation

## Overview

This implementation adds idempotency keys to batch uploads and scraper job creation to prevent duplicate job creation from network retries, user double-clicks, or concurrent requests. It ensures exactly-once semantics for job creation.

## Problem Statement

Without idempotency:
- Network timeouts/retries could create duplicate batches and jobs
- User double-clicking "Upload" button creates duplicate processing
- Concurrent requests (e.g., from multiple tabs) create duplicate work
- Workers could process the same scan multiple times
- Database contains duplicate records with no way to detect them

## Solution Architecture

### 1. Database Schema Changes

**File:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/supabase/migrations/20251023000002_add_idempotency_keys.sql`

Added `idempotency_key` columns to:
- `batch_uploads` table
- `scraper_jobs` table

Both with:
- Unique partial indexes (allows NULL for backwards compatibility)
- Composite indexes with user_id for fast lookups
- Comments documenting the key format

### 2. Idempotency Key Generation

**File:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/src/lib/idempotency.ts`

Three key generation functions:

#### `generateBatchIdempotencyKey()`
Generates deterministic key for batch uploads from:
- User ID
- File name and size
- Total pages
- Project definitions (sorted for determinism)

Returns: `batch_{sha256_hash}`

#### `generateJobIdempotencyKey()`
Generates deterministic key for scraper jobs from:
- User ID
- Scan ID
- Job type
- Key payload fields (fileUrl, uploadMode, selectedPages)
- Retry attempt (for retries to generate new keys)

Returns: `job_{sha256_hash}`

#### Key Properties
- **Deterministic**: Same input always produces same key
- **Content-addressable**: Key derived from immutable content
- **Collision-resistant**: SHA-256 provides strong uniqueness guarantees
- **Sorted arrays**: Arrays are sorted before hashing for consistency

### 3. API Endpoint Updates

#### Batch Upload Process Endpoint
**File:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/src/app/api/projects/batch-upload/process/route.ts`

Changes:
1. Generate idempotency key from batch content
2. Check for existing batch via `get_batch_by_idempotency_key()` RPC
3. Return existing batch if found (idempotent response)
4. Create new batch with idempotency key via updated `create_batch_upload_with_scans()` RPC
5. For each scan, generate job idempotency key
6. Check for existing job before creation
7. Handle unique violations gracefully (race conditions)

#### Retry Failed Endpoint
**File:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/src/app/api/projects/batch-upload/retry-failed/route.ts`

Changes:
1. Generate idempotency key for retry job (includes retryAttempt)
2. Check for existing retry job
3. Create new job with idempotency key
4. Handle race conditions gracefully

#### Single Upload Dialog
**File:** `/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/src/components/projects/mapping/UploadMappingSheetDialog.tsx`

Changes:
1. Generate idempotency key before job creation
2. Check for existing job
3. Skip creation if job exists
4. Handle unique violations from race conditions

### 4. Database Functions

#### `get_batch_by_idempotency_key()`
RPC function to lookup existing batch by idempotency key:
- Returns batch ID, scan IDs, status, createdAt
- Returns NULL if not found
- Enforces user ownership (security)

#### Updated `create_batch_upload_with_scans()`
Enhanced to accept optional idempotency key:
- Checks for existing batch first
- Returns existing batch if found
- Creates new batch with idempotency key
- Handles unique violations from race conditions
- Returns `isExisting` flag in response

## Idempotency Guarantees

### Batch Upload Creation
1. **Same content = same key**: Uploading the same file with same project definitions generates identical key
2. **First wins**: First request to create batch succeeds, subsequent requests return existing batch
3. **Race condition safe**: Concurrent requests handled via database unique constraint
4. **Transparent to client**: Client receives valid response whether batch is new or existing

### Scraper Job Creation
1. **Scan + payload = unique key**: Each scan with specific configuration gets unique key
2. **Duplicate detection**: Attempting to create duplicate job returns existing job
3. **Retry support**: Retry attempts generate new keys (includes retryAttempt in hash)
4. **Concurrent request safe**: Multiple workers/clients can't create duplicate jobs

## Edge Cases Handled

### 1. Network Retry
**Scenario**: Client request times out, retries same upload
- **Behavior**: Second request generates same idempotency key, returns existing batch
- **Result**: No duplicate batch or jobs created

### 2. User Double-Click
**Scenario**: User clicks "Upload" button twice quickly
- **Behavior**: Second click generates same key, finds existing job
- **Result**: Only one job created and processed

### 3. Concurrent Requests
**Scenario**: User opens two tabs, uploads same file in both
- **Behavior**: Both generate same key, one succeeds, one gets existing batch
- **Result**: Single batch and jobs, both tabs see same result

### 4. Race Condition (Database Level)
**Scenario**: Two requests hit database simultaneously with same key
- **Behavior**: Unique constraint violation on second INSERT
- **Result**: Code catches `unique_violation` error, treats as success

### 5. Modified Content
**Scenario**: User changes project definitions and re-uploads
- **Behavior**: Different project definitions = different idempotency key
- **Result**: New batch created (correct behavior)

### 6. Retry After Failure
**Scenario**: Job fails, user clicks "Retry Failed"
- **Behavior**: Retry includes `retryAttempt` in hash, generates new key
- **Result**: New job created for retry (correct behavior)

### 7. Expired Keys (Optional Cleanup)
**Scenario**: Old batches with idempotency keys accumulate
- **Current**: Keys remain indefinitely (safe, prevents duplicates forever)
- **Optional**: Could add TTL cleanup for old completed batches
- **Recommendation**: Keep keys indefinitely for audit trail

## Testing Recommendations

### Unit Tests
```typescript
// Test idempotency key generation
describe('generateBatchIdempotencyKey', () => {
  it('should generate consistent keys for same input', async () => {
    const key1 = await generateBatchIdempotencyKey(userId, file, size, pages, defs)
    const key2 = await generateBatchIdempotencyKey(userId, file, size, pages, defs)
    expect(key1).toBe(key2)
  })

  it('should generate different keys for different inputs', async () => {
    const key1 = await generateBatchIdempotencyKey(userId, file, size, pages, defs1)
    const key2 = await generateBatchIdempotencyKey(userId, file, size, pages, defs2)
    expect(key1).not.toBe(key2)
  })

  it('should be insensitive to project definition order', async () => {
    const key1 = await generateBatchIdempotencyKey(userId, file, size, pages, [def1, def2])
    const key2 = await generateBatchIdempotencyKey(userId, file, size, pages, [def2, def1])
    expect(key1).toBe(key2)
  })
})
```

### Integration Tests

#### Test 1: Duplicate Batch Prevention
```typescript
test('duplicate batch upload returns existing batch', async () => {
  // Upload batch once
  const response1 = await POST('/api/projects/batch-upload/process', batchData)
  expect(response1.success).toBe(true)
  const batchId1 = response1.batchId

  // Upload same batch again
  const response2 = await POST('/api/projects/batch-upload/process', batchData)
  expect(response2.success).toBe(true)
  expect(response2.batchId).toBe(batchId1)
  expect(response2.isExisting).toBe(true)
})
```

#### Test 2: Duplicate Job Prevention
```typescript
test('duplicate job creation skipped', async () => {
  const scanId = 'test-scan-id'

  // Create job once
  await createScraperJob(scanId, payload)
  const job1 = await getJobByScanId(scanId)

  // Attempt to create duplicate job
  await createScraperJob(scanId, payload)
  const jobs = await getJobsByScanId(scanId)

  expect(jobs.length).toBe(1)
  expect(jobs[0].id).toBe(job1.id)
})
```

#### Test 3: Race Condition Handling
```typescript
test('concurrent batch creation handled safely', async () => {
  const promises = Array(10).fill(null).map(() =>
    POST('/api/projects/batch-upload/process', batchData)
  )

  const responses = await Promise.all(promises)

  // All should succeed
  responses.forEach(r => expect(r.success).toBe(true))

  // All should have same batch ID
  const batchIds = responses.map(r => r.batchId)
  const uniqueBatchIds = [...new Set(batchIds)]
  expect(uniqueBatchIds.length).toBe(1)
})
```

### Manual Testing

#### Test Scenario 1: Network Retry
1. Open DevTools Network tab
2. Upload a batch
3. Before response completes, duplicate the request in DevTools
4. Verify only one batch created
5. Verify both requests return same batch ID

#### Test Scenario 2: Double Click
1. Upload a batch
2. Rapidly click "Process Upload" button multiple times
3. Verify only one batch created
4. Check database for duplicate jobs

#### Test Scenario 3: Concurrent Tabs
1. Open app in two browser tabs
2. Upload identical file in both tabs simultaneously
3. Define same project boundaries in both
4. Click "Process Upload" in both tabs
5. Verify only one batch exists
6. Verify both tabs show same batch status

#### Test Scenario 4: Modified Content
1. Upload a batch with specific project definitions
2. Change project definitions (add/remove/modify boundaries)
3. Upload again
4. Verify NEW batch created (different idempotency key)

## Monitoring and Debugging

### Log Messages
The implementation logs important events:
- `Returning existing batch for idempotency key: {key}` - Duplicate batch detected
- `Job already exists for scan {scanId}: {jobId}` - Duplicate job detected
- `Job already created by concurrent request for scan {scanId}` - Race condition handled

### Database Queries

Check for duplicate attempts:
```sql
-- Find batches with same idempotency key (should never happen)
SELECT idempotency_key, COUNT(*)
FROM batch_uploads
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1;

-- Find jobs with same idempotency key (should never happen)
SELECT idempotency_key, COUNT(*)
FROM scraper_jobs
WHERE idempotency_key IS NOT NULL
GROUP BY idempotency_key
HAVING COUNT(*) > 1;

-- Find scans with multiple jobs (check if idempotency working)
SELECT ms.id, ms.file_name, COUNT(sj.id) as job_count
FROM mapping_sheet_scans ms
JOIN scraper_jobs sj ON sj.payload->>'scanId' = ms.id::text
GROUP BY ms.id, ms.file_name
HAVING COUNT(sj.id) > 1;
```

### Metrics to Track
- Idempotent responses (existing batch returned) vs new batches
- Unique violation errors caught
- Average time to check for existing batch/job
- Distribution of idempotency key collisions (should be zero)

## Migration Strategy

### Backwards Compatibility
- `idempotency_key` columns allow NULL
- Existing batches/jobs without keys continue to work
- New uploads automatically get keys
- No data migration required

### Rollout Plan
1. Apply database migration (adds columns and indexes)
2. Deploy code changes (all endpoints)
3. Monitor for errors
4. Verify idempotency working via logs and database queries

### Rollback Plan
If issues occur:
1. Revert code changes
2. Keep database columns (nullable, no harm)
3. Idempotency keys ignored by old code
4. System works as before

### Optional: Backfill Existing Data
```sql
-- Generate idempotency keys for existing batches (optional, for completeness)
-- Not strictly necessary since they're already created
UPDATE batch_uploads
SET idempotency_key = encode(digest(
  uploaded_by::text ||
  original_file_name ||
  original_file_size_bytes::text ||
  total_pages::text ||
  project_definitions::text,
  'sha256'
), 'hex')
WHERE idempotency_key IS NULL;
```

## Performance Considerations

### Index Usage
- Unique indexes enable fast duplicate detection
- Composite indexes (user_id + idempotency_key) optimize user-specific lookups
- Partial indexes (WHERE idempotency_key IS NOT NULL) save space

### Hash Computation
- SHA-256 computation is fast (<1ms for typical inputs)
- Computed once per request
- Cached in request lifecycle

### Database Queries
- Idempotency check adds one SELECT per batch/job
- SELECT by unique index is very fast (index scan)
- Negligible impact on overall request time

### Optimization Opportunities
1. **Client-side caching**: Store idempotency key in client to detect duplicates before API call
2. **Batch job creation**: Create all jobs in single transaction with UPSERT
3. **TTL cleanup**: Periodically clean up old idempotency keys (if storage becomes concern)

## Security Considerations

### Access Control
- Idempotency key includes user ID (prevents cross-user collision)
- RLS policies enforce user can only access their own batches/jobs
- `get_batch_by_idempotency_key()` verifies auth.uid() matches request

### Key Collision Attacks
- SHA-256 provides 256-bit security
- Computationally infeasible to generate collision
- User ID in hash prevents cross-user attacks

### Information Disclosure
- Idempotency key is opaque hash (no content leaked)
- Keys not exposed in public APIs
- Only accessible to batch owner

## Future Enhancements

### 1. Idempotency Key Expiration
- Add `idempotency_key_expires_at` column
- Automatically clean up old keys after 30 days
- Allows duplicate uploads after expiration (acceptable for old data)

### 2. Client-Side Key Generation
- Compute key in browser before upload
- Include key in request header: `Idempotency-Key: batch_...`
- Early duplicate detection (no API call needed)

### 3. Cross-Device Duplicate Detection
- Store idempotency keys in user profile
- Show warning: "You uploaded this file last week"
- Offer to link to existing batch

### 4. Idempotency for Other Operations
- Apply pattern to employer creation
- Apply pattern to project creation
- Apply pattern to bulk worker imports

### 5. Audit Trail
- Log all idempotent responses to separate table
- Track retry patterns and duplicate attempts
- Alert on suspicious duplicate patterns

## Caveats and Limitations

### 1. Not a Distributed Lock
- Idempotency prevents duplicates but doesn't serialize requests
- Multiple requests may start processing simultaneously
- First to commit wins, others return existing record

### 2. Doesn't Prevent Partial Failures
- If batch creation succeeds but job creation fails
- Retry will create jobs for existing batch (correct behavior)
- Not a transaction across batch + all jobs (by design)

### 3. Key Generation Must Be Deterministic
- Code must always produce same key for same input
- Changing key generation algorithm breaks idempotency
- Must version key format if algorithm changes

### 4. Retry Attempts Generate New Keys
- Each retry creates new job (by design)
- Multiple retries = multiple jobs for same scan
- This is correct: we want each retry attempt to be processed

### 5. Doesn't Handle Content Deduplication
- Two users uploading same file create separate batches
- Idempotency is per-user, not global
- This is correct: different users = different data ownership

## Summary

This implementation provides robust idempotency for batch upload job creation:

**Benefits:**
- Prevents duplicate batches and jobs
- Safe against network retries, double-clicks, and concurrent requests
- Transparent to clients (idempotent responses look like success)
- Backwards compatible (no migration needed)
- Performant (minimal overhead)

**Key Features:**
- Deterministic key generation from content
- Database-level uniqueness enforcement
- Graceful handling of race conditions
- Comprehensive error handling
- Security built-in (user-scoped keys)

**Testing:**
- Unit tests for key generation
- Integration tests for duplicate prevention
- Manual testing for user scenarios
- Database monitoring for issues

**Next Steps:**
1. Apply migration: `supabase/migrations/20251023000002_add_idempotency_keys.sql`
2. Deploy code changes
3. Monitor logs for idempotent responses
4. Verify no duplicate batches/jobs in database
5. Consider adding client-side key generation for performance

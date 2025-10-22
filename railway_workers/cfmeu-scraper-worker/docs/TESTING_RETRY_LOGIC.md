# Testing the FWC Scraper Retry Logic

## Overview

This guide provides instructions for testing the retry logic implementation in various scenarios.

## Prerequisites

- FWC scraper worker running locally or in staging
- Access to Supabase database
- Test employer data in the database

## Testing Scenarios

### 1. Test Normal Operation (No Retries)

**Goal**: Verify that successful operations don't trigger retries.

**Steps**:
1. Start the worker with default configuration
   ```bash
   cd railway_workers/cfmeu-scraper-worker
   npm run dev
   ```

2. Create a test FWC lookup job via the UI or API

3. Monitor logs for successful completion
   ```
   [worker] FWC employer lookup { employerId: '...', employerName: '...' }
   [worker] FWC search { query: '...', resultCount: 5, waitedForViewModel: true, waitWarning: false }
   ```

4. Verify no retry events in database
   ```sql
   SELECT * FROM scraper_job_events
   WHERE event_type LIKE '%retry%'
   AND job_id = 'your-job-id';
   ```

**Expected Result**: Job completes successfully on first attempt, no retry events.

---

### 2. Test Network Timeout Retry

**Goal**: Verify retry logic handles network timeouts.

**Setup**: Temporarily reduce navigation timeout to trigger failures.

**Steps**:
1. Modify `src/processors/fwc.ts` temporarily:
   ```typescript
   // Change line 252
   await page.goto(searchUrl.toString(), { waitUntil: 'networkidle2', timeout: 5000 }) // Reduced from 45000
   ```

2. Set aggressive retry config
   ```bash
   RETRY_MAX_ATTEMPTS=3 RETRY_INITIAL_DELAY_MS=1000 npm run dev
   ```

3. Create FWC lookup job for an employer

4. Monitor logs for retry attempts
   ```
   [worker] FWC search retry: Retry attempt 1/3 after 1000ms total delay...
   [worker] FWC search retry: Retry attempt 2/3 after 3000ms total delay...
   ```

5. Check database for retry events
   ```sql
   SELECT event_type, payload
   FROM scraper_job_events
   WHERE job_id = 'your-job-id'
   AND event_type IN ('fwc_search_retry', 'fwc_search_success_after_retry', 'fwc_search_retry_exhausted')
   ORDER BY created_at;
   ```

**Expected Result**:
- Retry events logged
- Job either succeeds after retries or fails gracefully
- Database contains retry event records

**Cleanup**: Restore original timeout value.

---

### 3. Test Rate Limit Handling

**Goal**: Verify retry logic respects rate limiting.

**Note**: Difficult to test without actually triggering rate limits. This is a manual verification test.

**Steps**:
1. Create multiple FWC jobs simultaneously (10+)

2. Monitor for rate limit responses
   ```
   [worker] FWC search retry: HTTP 429 detected
   ```

3. Verify longer delays when rate limited
   ```sql
   SELECT payload->>'attempt' as attempt,
          payload->>'totalDelayMs' as delay_ms,
          payload->>'error' as error
   FROM scraper_job_events
   WHERE event_type = 'fwc_search_retry'
   ORDER BY created_at;
   ```

**Expected Result**:
- Delays increase with each retry
- Rate limit retries use longer delays
- Jobs eventually succeed after rate limit clears

---

### 4. Test Database Connection Retry

**Goal**: Verify database operations retry on connection issues.

**Setup**: This requires simulating database issues (advanced).

**Alternative Test**: Review code paths to ensure database operations are wrapped with retry logic.

**Steps**:
1. Review `src/processors/fwc.ts` lines 210-226 for database retry wrapper

2. Verify retry configuration for database operations:
   ```typescript
   const upsertResult = await withRetry(
     () => upsertEbaRecord(client, employerId, bestResult),
     {
       maxAttempts: 3,
       initialDelayMs: 1000,
       backoffMultiplier: 2,
     },
     // ... retry callback
   )
   ```

3. Check logs for database retry events during high load:
   ```
   [worker] Database upsert retry: Retry attempt 1/3...
   ```

**Expected Result**: Database operations are protected by retry logic.

---

### 5. Test Non-Retryable Errors

**Goal**: Verify non-retryable errors fail immediately.

**Steps**:
1. Create a test with invalid configuration (e.g., bad employer ID)

2. Monitor logs to ensure no retry attempts:
   ```
   [worker] fwc_lookup employer failed { employerId: 'invalid', error: '...' }
   ```

3. Verify only one attempt in events:
   ```sql
   SELECT COUNT(*) as retry_count
   FROM scraper_job_events
   WHERE job_id = 'your-job-id'
   AND event_type = 'fwc_search_retry';
   -- Should return 0
   ```

**Expected Result**: No retry attempts for non-retryable errors.

---

### 6. Test Retry Exhaustion

**Goal**: Verify behavior when all retries fail.

**Setup**: Disconnect from network or use invalid FWC URL.

**Steps**:
1. Temporarily modify FWC URL to trigger failures:
   ```typescript
   // In src/processors/fwc.ts, line 240
   const searchUrl = new URL('https://invalid-url-that-does-not-exist.com/document-search')
   ```

2. Set retry config
   ```bash
   RETRY_MAX_ATTEMPTS=3 RETRY_INITIAL_DELAY_MS=1000 npm run dev
   ```

3. Create FWC job

4. Monitor for retry exhaustion:
   ```
   [worker] FWC search failed after retries: { employerId: '...', attempts: 3, error: '...' }
   ```

5. Check database for exhaustion event:
   ```sql
   SELECT payload
   FROM scraper_job_events
   WHERE job_id = 'your-job-id'
   AND event_type = 'fwc_search_retry_exhausted';
   ```

**Expected Result**:
- All retry attempts logged
- Final failure after max attempts
- `fwc_search_retry_exhausted` event created
- Job continues with next employer (doesn't crash)

**Cleanup**: Restore original FWC URL.

---

### 7. Test Exponential Backoff

**Goal**: Verify delays increase exponentially.

**Steps**:
1. Use scenario 2 or 6 to trigger multiple retries

2. Analyze retry delays from events:
   ```sql
   SELECT
     payload->>'attempt' as attempt,
     payload->>'totalDelayMs' as cumulative_delay_ms,
     created_at
   FROM scraper_job_events
   WHERE job_id = 'your-job-id'
   AND event_type = 'fwc_search_retry'
   ORDER BY created_at;
   ```

3. Calculate actual delays between attempts:
   ```sql
   SELECT
     event_type,
     payload->>'attempt' as attempt,
     created_at,
     LAG(created_at) OVER (ORDER BY created_at) as prev_time,
     EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) as delay_seconds
   FROM scraper_job_events
   WHERE job_id = 'your-job-id'
   AND event_type LIKE 'fwc_search%'
   ORDER BY created_at;
   ```

**Expected Result**:
- Delay increases exponentially: ~2s, ~4s, ~8s, ~16s
- Small jitter variation (0-1 second)

---

### 8. Test Configuration Changes

**Goal**: Verify environment variables control retry behavior.

**Steps**:
1. Test with different configurations:

   **Short retries:**
   ```bash
   RETRY_MAX_ATTEMPTS=2 RETRY_INITIAL_DELAY_MS=500 npm run dev
   ```

   **Long retries:**
   ```bash
   RETRY_MAX_ATTEMPTS=5 RETRY_INITIAL_DELAY_MS=5000 npm run dev
   ```

2. Trigger retries (use scenario 2 or 6)

3. Verify configuration is respected:
   ```
   [worker] FWC search retry: Retry attempt 1/2...  (for short config)
   [worker] FWC search retry: Retry attempt 1/5...  (for long config)
   ```

**Expected Result**: Retry behavior matches environment configuration.

---

## Performance Testing

### Test Job Throughput

**Goal**: Measure impact of retries on job processing speed.

**Steps**:
1. Create 100 FWC lookup jobs with mixed success/failure rates

2. Time job completion:
   ```sql
   SELECT
     job_id,
     created_at,
     completed_at,
     EXTRACT(EPOCH FROM (completed_at - created_at)) as duration_seconds,
     (SELECT COUNT(*)
      FROM scraper_job_events
      WHERE job_id = scraper_jobs.id
      AND event_type = 'fwc_search_retry') as retry_count
   FROM scraper_jobs
   WHERE job_type = 'fwc_lookup'
   AND created_at > NOW() - INTERVAL '1 hour'
   ORDER BY created_at DESC;
   ```

3. Calculate averages:
   ```sql
   SELECT
     AVG(EXTRACT(EPOCH FROM (completed_at - created_at))) as avg_duration_seconds,
     AVG((SELECT COUNT(*) FROM scraper_job_events WHERE job_id = scraper_jobs.id AND event_type = 'fwc_search_retry')) as avg_retry_count
   FROM scraper_jobs
   WHERE job_type = 'fwc_lookup'
   AND completed_at > NOW() - INTERVAL '1 hour';
   ```

**Expected Result**:
- Most jobs complete without retries
- Small percentage require retries
- Average duration minimally impacted

---

## Monitoring in Production

### Key Metrics Dashboard

Create monitoring queries:

**1. Retry Rate:**
```sql
WITH retry_stats AS (
  SELECT
    job_id,
    BOOL_OR(event_type LIKE '%retry%') as had_retry
  FROM scraper_job_events
  WHERE created_at > NOW() - INTERVAL '24 hours'
  GROUP BY job_id
)
SELECT
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE had_retry) as jobs_with_retry,
  ROUND(100.0 * COUNT(*) FILTER (WHERE had_retry) / COUNT(*), 2) as retry_rate_pct
FROM retry_stats;
```

**2. Success After Retry:**
```sql
SELECT COUNT(*) as success_after_retry_count
FROM scraper_job_events
WHERE event_type = 'fwc_search_success_after_retry'
AND created_at > NOW() - INTERVAL '24 hours';
```

**3. Retry Exhaustion Rate:**
```sql
SELECT COUNT(*) as exhausted_retry_count
FROM scraper_job_events
WHERE event_type = 'fwc_search_retry_exhausted'
AND created_at > NOW() - INTERVAL '24 hours';
```

**4. Average Retry Delay:**
```sql
SELECT
  AVG((payload->>'totalDelayMs')::numeric) / 1000 as avg_retry_delay_seconds,
  MAX((payload->>'totalDelayMs')::numeric) / 1000 as max_retry_delay_seconds
FROM scraper_job_events
WHERE event_type = 'fwc_search_success_after_retry'
AND created_at > NOW() - INTERVAL '24 hours';
```

**5. Error Distribution:**
```sql
SELECT
  payload->>'error' as error_type,
  COUNT(*) as occurrence_count
FROM scraper_job_events
WHERE event_type = 'fwc_search_retry'
AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY payload->>'error'
ORDER BY COUNT(*) DESC
LIMIT 10;
```

---

## Troubleshooting

### Issue: Too many retries

**Symptoms**: High retry rate (>20%)

**Diagnosis**:
```sql
SELECT payload->>'error', COUNT(*)
FROM scraper_job_events
WHERE event_type = 'fwc_search_retry'
AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY payload->>'error';
```

**Solutions**:
- If timeouts: Increase navigation timeout
- If rate limits: Reduce concurrent jobs
- If network errors: Check network connectivity

### Issue: Jobs taking too long

**Symptoms**: Job duration increased significantly

**Diagnosis**:
```sql
SELECT
  job_id,
  EXTRACT(EPOCH FROM (completed_at - created_at)) as duration,
  (SELECT COUNT(*) FROM scraper_job_events WHERE job_id = scraper_jobs.id AND event_type = 'fwc_search_retry') as retries
FROM scraper_jobs
WHERE completed_at > NOW() - INTERVAL '1 hour'
ORDER BY duration DESC
LIMIT 10;
```

**Solutions**:
- Reduce max delay: `RETRY_MAX_DELAY_MS=15000`
- Reduce max attempts: `RETRY_MAX_ATTEMPTS=3`

### Issue: Retry exhaustion too common

**Symptoms**: Many jobs failing after all retries

**Diagnosis**:
```sql
SELECT payload
FROM scraper_job_events
WHERE event_type = 'fwc_search_retry_exhausted'
ORDER BY created_at DESC
LIMIT 10;
```

**Solutions**:
- Increase max attempts: `RETRY_MAX_ATTEMPTS=5`
- Increase delays: `RETRY_INITIAL_DELAY_MS=3000`
- Check FWC website status

---

## Test Checklist

- [ ] Normal operation (no retries)
- [ ] Network timeout retry
- [ ] Rate limit handling
- [ ] Database retry (code review)
- [ ] Non-retryable errors
- [ ] Retry exhaustion
- [ ] Exponential backoff verification
- [ ] Configuration changes
- [ ] Performance impact
- [ ] Production monitoring setup

---

## Additional Resources

- **Full Documentation**: `docs/RETRY_IMPLEMENTATION.md`
- **Configuration**: `.env.example`
- **Unit Tests**: `src/utils/__tests__/retry.test.ts`
- **Summary**: `RETRY_SUMMARY.md`

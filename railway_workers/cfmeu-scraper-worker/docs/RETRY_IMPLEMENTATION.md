# FWC Scraper Retry Logic Implementation

## Overview

This document describes the comprehensive retry logic implementation for the FWC (Fair Work Commission) scraper to handle transient failures and improve reliability.

## Problem Statement

The FWC scraper interacts with external websites that can be unreliable:
- Network timeouts and connection failures
- Rate limiting (HTTP 429)
- Server errors (HTTP 5xx)
- Temporary service unavailability
- DNS resolution failures
- Parse errors due to page loading issues

Without retry logic, these transient failures cause jobs to fail unnecessarily, requiring manual intervention and reducing system reliability.

## Solution Architecture

### Components

1. **Retry Utility Module** (`src/utils/retry.ts`)
   - Generic retry logic with exponential backoff
   - Jitter to prevent thundering herd
   - Configurable retry behavior
   - Retry-After header support

2. **FWC Processor Integration** (`src/processors/fwc.ts`)
   - Wraps FWC search operations with retry logic
   - Wraps database operations with retry logic
   - Emits retry events for monitoring

3. **Configuration** (`src/config.ts`)
   - Environment-based retry configuration
   - Sensible defaults for production use

## Retry Strategy

### Exponential Backoff with Jitter

The retry logic uses exponential backoff with jitter:

```
delay = min(initialDelay * (backoffMultiplier ^ attempt) + random(0, jitterMax), maxDelay)
```

**Default Configuration:**
- Initial delay: 2 seconds
- Backoff multiplier: 2x
- Maximum delay: 30 seconds
- Jitter: 0-1 second
- Maximum attempts: 4

**Retry sequence:**
1. First retry: ~2 seconds (2s + 0-1s jitter)
2. Second retry: ~4 seconds (4s + 0-1s jitter)
3. Third retry: ~8 seconds (8s + 0-1s jitter)
4. Fourth retry: ~16 seconds (16s + 0-1s jitter)

### Retryable vs Non-Retryable Errors

**Retryable Errors:**
- Network errors (ECONNRESET, ETIMEDOUT, ECONNREFUSED, etc.)
- HTTP 408 (Request Timeout)
- HTTP 429 (Too Many Requests)
- HTTP 5xx (Server Errors)
- HTTP 520-524 (Cloudflare errors)
- Timeout errors from Puppeteer
- Navigation timeouts

**Non-Retryable Errors:**
- HTTP 400 (Bad Request)
- HTTP 401 (Unauthorized)
- HTTP 403 (Forbidden)
- HTTP 404 (Not Found)
- Parse errors (structural issues)
- Invalid configuration errors

### Rate Limit Handling

The retry logic respects HTTP `Retry-After` headers:

```typescript
// If server returns Retry-After: 10
// Next retry will wait at least 10 seconds (plus jitter)
```

This prevents overwhelming rate-limited services and respects backoff requests.

### Jitter Implementation

Random jitter prevents the "thundering herd" problem where multiple workers retry simultaneously:

```typescript
const jitter = Math.random() * config.jitterMaxMs
const totalDelay = exponentialDelay + jitter
```

## Implementation Details

### Retry Utility API

```typescript
// Simple usage
const result = await withRetry(
  () => searchFwcAgreements(browser, query),
  { maxAttempts: 4, initialDelayMs: 2000 }
)

if (result.success) {
  console.log('Success after', result.attempts, 'attempts')
  return result.data
} else {
  console.error('Failed after', result.attempts, 'attempts')
  throw result.error
}

// With retry callback for logging
const result = await withRetry(
  () => searchFwcAgreements(browser, query),
  { maxAttempts: 4 },
  async (context) => {
    console.log(`Retry ${context.attempt}: ${context.lastError?.message}`)
    await logToDatabase(context)
  }
)
```

### Integration Points

#### 1. FWC Search Operations

Each FWC search query is wrapped with retry logic:

```typescript
const retryResult = await withRetry(
  () => searchFwcAgreements(browser, query),
  FWC_RETRY_CONFIG,
  async (retryContext) => {
    console.warn('[worker] FWC search retry:', formatRetryLog(retryContext, config))
    await appendEvent(client, job.id, 'fwc_search_retry', {
      employerId,
      query,
      attempt: retryContext.attempt,
      error: retryContext.lastError?.message,
    })
  }
)
```

#### 2. Database Operations

Database upserts are also retried (with shorter backoff):

```typescript
const upsertResult = await withRetry(
  () => upsertEbaRecord(client, employerId, result),
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
  }
)
```

## Configuration

### Environment Variables

The retry behavior can be configured via environment variables:

```bash
# Maximum number of retry attempts (default: 4)
RETRY_MAX_ATTEMPTS=5

# Initial delay in milliseconds (default: 2000)
RETRY_INITIAL_DELAY_MS=3000

# Maximum delay cap in milliseconds (default: 30000)
RETRY_MAX_DELAY_MS=60000

# Exponential backoff multiplier (default: 2)
RETRY_BACKOFF_MULTIPLIER=2

# Maximum jitter in milliseconds (default: 1000)
RETRY_JITTER_MAX_MS=2000
```

### Configuration in Code

```typescript
// config.ts
export const config = {
  // ... other config
  retry: {
    maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS ?? 4),
    initialDelayMs: Number(process.env.RETRY_INITIAL_DELAY_MS ?? 2000),
    maxDelayMs: Number(process.env.RETRY_MAX_DELAY_MS ?? 30000),
    backoffMultiplier: Number(process.env.RETRY_BACKOFF_MULTIPLIER ?? 2),
    jitterMaxMs: Number(process.env.RETRY_JITTER_MAX_MS ?? 1000),
  },
}
```

## Monitoring and Logging

### Event Types

New event types for monitoring retry behavior:

1. **`fwc_search_retry`** - Emitted before each retry attempt
   ```json
   {
     "employerId": "uuid",
     "employerName": "Company Name",
     "query": "search query",
     "attempt": 2,
     "totalDelayMs": 4000,
     "error": "Navigation timeout exceeded"
   }
   ```

2. **`fwc_search_success_after_retry`** - Emitted when search succeeds after retries
   ```json
   {
     "employerId": "uuid",
     "employerName": "Company Name",
     "query": "search query",
     "attempts": 3,
     "totalDelayMs": 7500
   }
   ```

3. **`fwc_search_retry_exhausted`** - Emitted when all retries fail
   ```json
   {
     "employerId": "uuid",
     "employerName": "Company Name",
     "query": "search query",
     "attempts": 4,
     "totalDelayMs": 31000,
     "error": "Connection timeout"
   }
   ```

4. **`fwc_upsert_retry`** - Emitted when database upsert is retried
   ```json
   {
     "employerId": "uuid",
     "employerName": "Company Name",
     "attempt": 2,
     "error": "Connection pool exhausted"
   }
   ```

### Console Logging

Retry attempts are logged with structured information:

```typescript
console.warn('[worker] FWC search retry:', {
  attempt: 2,
  maxAttempts: 4,
  totalDelayMs: 4500,
  error: 'Navigation timeout exceeded',
  errorCode: 'ETIMEDOUT'
})
```

### Metrics to Monitor

1. **Retry Rate**: Percentage of operations requiring retries
2. **Success After Retry**: Operations that succeed after 1+ retries
3. **Retry Exhaustion**: Operations that fail after all retries
4. **Average Retry Delay**: Mean time spent in retries
5. **Error Distribution**: Which errors trigger most retries

## Error Handling

### Failure Scenarios

#### 1. Transient Network Failure
```
Attempt 1: ETIMEDOUT (wait 2s)
Attempt 2: ETIMEDOUT (wait 4s)
Attempt 3: Success
Result: Success after 3 attempts, 6s total delay
```

#### 2. Rate Limiting
```
Attempt 1: HTTP 429, Retry-After: 10s (wait 10s)
Attempt 2: Success
Result: Success after 2 attempts, 10s total delay
```

#### 3. Permanent Failure
```
Attempt 1: HTTP 404
Result: Immediate failure (non-retryable)
```

#### 4. Retry Exhaustion
```
Attempt 1: ECONNRESET (wait 2s)
Attempt 2: ECONNRESET (wait 4s)
Attempt 3: ECONNRESET (wait 8s)
Attempt 4: ECONNRESET
Result: Failure after 4 attempts, 14s total delay
```

### Graceful Degradation

When retries are exhausted:
1. Error is logged with full context
2. Job continues with next employer (doesn't fail entire job)
3. Failed employer is marked in job events
4. Summary includes failed count for reporting

## Performance Impact

### Time Costs

**Without retries:**
- Success: ~45s per employer
- Transient failure: Job fails immediately

**With retries (4 attempts max):**
- Success on first attempt: ~45s (no change)
- Success on second attempt: ~47s (+2s)
- Success on third attempt: ~51s (+6s)
- Success on fourth attempt: ~59s (+14s)
- All retries fail: ~59s (+14s)

**Typical impact:**
- 90% success on first attempt: No delay
- 8% success after retry: +2-6s average
- 2% retry exhaustion: +14s

### Resource Usage

- **Network**: No additional load (only retries failed requests)
- **CPU**: Minimal (waiting, not computing)
- **Memory**: Negligible (no accumulation)
- **Database**: Retry events add minimal storage

## Testing

### Unit Tests

Run retry utility tests:

```bash
cd railway_workers/cfmeu-scraper-worker
npm test -- retry.test.ts
```

### Integration Testing

Test retry behavior with network issues:

```typescript
// Simulate transient failure
const mockBrowser = {
  newPage: jest.fn()
    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
    .mockRejectedValueOnce(new Error('ETIMEDOUT'))
    .mockResolvedValue(mockPage)
}

const result = await processFwcJob(client, job)
// Should succeed after retries
```

### Manual Testing

Test rate limiting:

```bash
# Set aggressive retry config
RETRY_MAX_ATTEMPTS=10 RETRY_INITIAL_DELAY_MS=1000 npm run dev

# Monitor retry behavior in logs
```

## Best Practices

### Do's

1. **Use retry for external operations**: Network calls, API requests
2. **Log retry attempts**: Essential for debugging and monitoring
3. **Respect Retry-After headers**: Be a good citizen
4. **Add jitter**: Prevent thundering herd
5. **Set reasonable limits**: Don't retry forever
6. **Distinguish error types**: Retry only transient failures

### Don'ts

1. **Don't retry non-idempotent operations** without checks
2. **Don't retry authentication failures**: Usually permanent
3. **Don't retry validation errors**: Won't succeed on retry
4. **Don't use linear backoff**: Exponential is more effective
5. **Don't retry without logging**: Makes debugging impossible
6. **Don't set maxAttempts too high**: Can delay failure detection

## Troubleshooting

### High Retry Rates

**Symptoms**: Many `fwc_search_retry` events

**Possible causes:**
- FWC website experiencing issues
- Network connectivity problems
- Rate limiting (need longer delays)

**Solutions:**
- Increase initial delay
- Reduce concurrent job processing
- Check FWC website status

### Retry Exhaustion

**Symptoms**: Many `fwc_search_retry_exhausted` events

**Possible causes:**
- FWC website down
- Incorrect retry configuration
- Blocking/IP banned

**Solutions:**
- Check FWC website availability
- Increase max attempts
- Verify IP not blocked
- Check Puppeteer configuration

### Long Processing Times

**Symptoms**: Jobs taking much longer than expected

**Possible causes:**
- Many retries due to transient issues
- Max delay too high
- Too many retry attempts

**Solutions:**
- Reduce max delay
- Reduce max attempts
- Investigate root cause of failures

## Future Enhancements

1. **Circuit Breaker**: Temporarily stop retries if error rate too high
2. **Adaptive Backoff**: Adjust delays based on success rate
3. **Retry Budget**: Limit total retry time per job
4. **Retry Analytics**: Dashboard for retry metrics
5. **Smart Retry**: ML-based prediction of retry success
6. **Distributed Jitter**: Coordinate retry timing across workers

## References

- [AWS Architecture Blog: Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Google Cloud: Retry Strategy Best Practices](https://cloud.google.com/iot/docs/how-tos/exponential-backoff)
- [HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RFC 7231: Retry-After Header](https://tools.ietf.org/html/rfc7231#section-7.1.3)

## Changelog

### Version 1.0.0 (2025-10-22)

- Initial retry implementation
- Exponential backoff with jitter
- Retry-After header support
- FWC processor integration
- Comprehensive logging and monitoring
- Configuration via environment variables
- Unit test suite

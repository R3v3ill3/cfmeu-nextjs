# Claude API Timeout Implementation

## Overview

This document describes the timeout handling implementation for Claude API calls in the mapping-sheet-scanner worker. The implementation protects against hanging API calls that can stall the worker and provides reliable error handling with retry logic.

## Architecture

### Components

1. **Timeout Utility** (`src/utils/timeout.ts`)
   - Generic timeout wrapper functions
   - AbortController integration
   - Retry logic for timeout errors
   - Timeout incident logging

2. **Configuration** (`src/config.ts`)
   - `CLAUDE_TIMEOUT_MS`: Default 60 seconds (60000ms)
   - `CLAUDE_MAX_RETRIES`: Default 1 retry attempt
   - Both configurable via environment variables

3. **Claude Integration** (`src/ai/claude.ts`)
   - Wraps Claude API calls with timeout protection
   - Implements retry logic for timeouts
   - Enhanced error reporting
   - Timeout incident tracking

4. **Type Extensions** (`src/types.ts`)
   - `ProcessingResult.timedOut`: Boolean flag
   - `ProcessingResult.retryCount`: Number of retry attempts

## Implementation Details

### Timeout Protection

The implementation uses multiple strategies for timeout protection:

#### 1. AbortController Integration
```typescript
const { controller, cleanup } = createTimeoutController(config.claudeTimeoutMs)

const response = await client.messages.create(
  { /* ... */ },
  { signal: controller.signal as AbortSignal }
)
```

- Creates an AbortController that automatically aborts after timeout
- Properly cleans up timers to prevent memory leaks
- Signals to the SDK to cancel the request

#### 2. Promise.race Timeout Wrapper
```typescript
const message = await withTimeoutAndRetry(
  async () => { /* API call */ },
  {
    timeoutMs: config.claudeTimeoutMs,
    maxRetries: config.claudeMaxRetries,
    operationName: 'Claude API call',
    onRetry: (attempt, error) => { /* logging */ }
  }
)
```

- Wraps the API call in a Promise.race with timeout
- Ensures timeout protection even if AbortController fails
- Provides consistent timeout behavior

### Retry Logic

Timeouts trigger automatic retries with the following behavior:

- **Default retries**: 1 (configurable via `CLAUDE_MAX_RETRIES`)
- **Retry condition**: Only TimeoutError triggers retries
- **Other errors**: Fail immediately without retry
- **Logging**: Each retry attempt is logged with details

### Error Handling

#### Timeout Errors
```typescript
if (isTimeout) {
  logTimeoutIncident('Claude API extraction', config.claudeTimeoutMs, {
    selectedPages: selectedPages?.join(', ') || 'all',
    pdfSizeBytes: pdfBuffer.length,
    retryCount,
    model: config.claudeModel,
  })
}
```

Timeout errors are:
- Logged with detailed metadata for monitoring
- Marked in the ProcessingResult with `timedOut: true`
- Include retry count for analysis
- Return failed status to trigger job retry at worker level

#### Other Errors
- Fail immediately without timeout-specific handling
- Return standard error messages
- Allow worker-level retry logic to handle

### Resource Cleanup

The implementation ensures proper cleanup:
- Clears timeout timers after API calls complete
- Cleans up AbortController resources
- No memory leaks from hanging timeouts

## Configuration

### Environment Variables

```bash
# Claude API timeout in milliseconds (default: 60000 = 60 seconds)
CLAUDE_TIMEOUT_MS=60000

# Number of retry attempts for timeout errors (default: 1)
CLAUDE_MAX_RETRIES=1
```

### Timeout Values

**Default: 60 seconds**
- Claude vision processing can be slow for PDFs
- Typical processing time: 10-30 seconds
- 60 seconds provides buffer for large/complex PDFs
- Prevents indefinite hangs

**Consider increasing timeout if:**
- Processing very large PDFs (>10MB)
- High API latency in your region
- Frequent timeout errors in logs

**Consider decreasing timeout if:**
- Only processing small PDFs
- Need faster failure detection
- Want more aggressive retry behavior

## Monitoring

### Log Patterns

#### Successful Request
```
[claude] Raw response length: 1234
[claude] Parsing JSON length: 1200
[processor] Extraction successful with claude
```

#### Timeout with Retry
```
[timeout] Claude API call attempt 1/2 timed out after 60000ms, retrying...
[claude] Retry 1/1 after timeout (60000ms)
[claude] Raw response length: 1234
[processor] Extraction successful with claude
```

#### Timeout Failure
```
[timeout] Claude API call attempt 1/2 timed out after 60000ms, retrying...
[timeout] Claude API call attempt 2/2 timed out after 60000ms, retrying...
[timeout-incident] {
  timestamp: '2025-10-22T...',
  operation: 'Claude API extraction',
  timeoutMs: 60000,
  selectedPages: '1, 2, 3',
  pdfSizeBytes: 524288,
  retryCount: 1,
  model: 'claude-sonnet-4-5-20250929'
}
[claude] Extraction failed: TimeoutError: Claude API call timed out after 60000ms
[processor] Failed to process scan: Claude extraction failed: Claude API call timed out after 60000ms
```

### Metrics to Track

1. **Timeout Rate**: Count of `[timeout-incident]` logs
2. **Retry Success Rate**: Timeouts that succeed on retry
3. **Processing Time**: Average time for successful requests
4. **PDF Size Correlation**: Check if larger PDFs timeout more

### Alerting Recommendations

- Alert if timeout rate exceeds 5% of requests
- Alert if average processing time approaches timeout value
- Alert if multiple consecutive timeouts occur

## Testing

### Manual Testing

#### 1. Test Normal Operation
```bash
# Should complete within timeout
npm run dev
# Upload a normal PDF (1-3 pages)
# Check logs for successful processing
```

#### 2. Test Timeout (Simulated)
Temporarily reduce timeout to test behavior:
```bash
# In terminal
export CLAUDE_TIMEOUT_MS=5000
npm run dev
# Upload a PDF - should timeout and retry
```

#### 3. Test Retry Success
```bash
# Set short timeout with retries
export CLAUDE_TIMEOUT_MS=10000
export CLAUDE_MAX_RETRIES=2
npm run dev
# Upload PDF - may timeout initially but succeed on retry
```

### Integration Testing

1. **Timeout Recovery**: Verify worker continues after timeout
2. **Job Retry**: Confirm timeout failures trigger job-level retry
3. **Resource Cleanup**: Check no memory leaks after timeouts
4. **Error Reporting**: Verify timeout errors appear in database

## Troubleshooting

### Problem: Frequent Timeouts

**Possible Causes:**
- Timeout value too low
- API performance issues
- Network latency problems
- PDFs too large/complex

**Solutions:**
1. Increase `CLAUDE_TIMEOUT_MS`
2. Check Claude API status
3. Verify network connectivity
4. Reduce PDF page count

### Problem: No Timeouts but Slow Processing

**Check:**
- Is timeout actually being used?
- Review log timestamps
- Check actual API response times

### Problem: Timeouts Don't Trigger Retries

**Verify:**
- `CLAUDE_MAX_RETRIES` is set > 0
- Error is actually a TimeoutError
- Check error handling logs

## Code Examples

### Adjusting Timeout for Specific Cases

If you need different timeouts for different operations:

```typescript
// In claude.ts
const timeoutMs = selectedPages && selectedPages.length > 5
  ? config.claudeTimeoutMs * 1.5  // Longer timeout for many pages
  : config.claudeTimeoutMs

const message = await withTimeoutAndRetry(
  async () => { /* ... */ },
  {
    timeoutMs,
    maxRetries: config.claudeMaxRetries,
    // ...
  }
)
```

### Custom Retry Logic

To modify retry behavior:

```typescript
// In timeout.ts withTimeoutAndRetry function
// Add exponential backoff between retries:
if (error instanceof TimeoutError && attempt <= maxRetries) {
  const backoffMs = 1000 * Math.pow(2, attempt - 1)
  await new Promise(resolve => setTimeout(resolve, backoffMs))
  continue
}
```

## Future Enhancements

1. **Adaptive Timeouts**: Adjust based on PDF size/complexity
2. **Partial Results**: Return partial extraction if available
3. **Streaming Support**: Use Claude streaming API for progress
4. **Metrics API**: Export timeout metrics for monitoring
5. **Circuit Breaker**: Temporarily disable Claude if timeout rate too high

## Related Files

- `/src/utils/timeout.ts` - Timeout utilities
- `/src/config.ts` - Configuration
- `/src/ai/claude.ts` - Claude integration
- `/src/types.ts` - Type definitions
- `/src/processors/mappingSheetProcessor.ts` - Job processor

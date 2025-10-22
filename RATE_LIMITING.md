# Rate Limiting Implementation

This document describes the rate limiting implementation for the CFMEU Next.js application API endpoints.

## Overview

Rate limiting has been implemented for the main API endpoints to handle 25 concurrent users during the soft launch phase. The implementation uses an in-memory token bucket algorithm with sliding window, optimized for Vercel Edge Runtime.

## Affected Endpoints

The following API endpoints are rate-limited:

- `/api/projects` - Project listings and search
- `/api/employers` - Employer listings and search
- `/api/workers` - Worker listings and search

## Rate Limit Configuration

### Current Settings (EXPENSIVE_QUERY preset)

```typescript
{
  maxRequests: 30,      // 30 requests per minute (0.5 req/sec)
  windowSeconds: 60,    // 1 minute window
  burstAllowance: 5,    // Allow 5 extra requests for page loads
}
```

This configuration allows:
- **30 regular requests** per minute per user/IP
- **5 additional burst requests** for handling concurrent page loads
- **Total: 35 requests** before rate limiting kicks in
- **60 second window** before the limit resets

### Available Presets

The following presets are available in `src/lib/rateLimit.ts`:

1. **EXPENSIVE_QUERY** (Current)
   - 30 req/min, 5 burst
   - For database-heavy operations

2. **STANDARD**
   - 60 req/min, 10 burst
   - For typical API endpoints

3. **RELAXED**
   - 120 req/min, 20 burst
   - For lightweight endpoints

4. **AUTH**
   - 10 req/min, 0 burst
   - For authentication endpoints

## How It Works

### Request Identification

Requests are identified by:
1. **User ID** (if authenticated) - from `x-user-id` header
2. **IP Address** (fallback) - from `x-forwarded-for` or `x-real-ip` headers

### Rate Limit Response

When rate limit is exceeded, the API returns:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

**HTTP Status:** `429 Too Many Requests`

**Headers:**
- `X-RateLimit-Limit`: Maximum requests allowed (e.g., "30")
- `X-RateLimit-Remaining`: Requests remaining in current window (e.g., "5")
- `X-RateLimit-Reset`: ISO timestamp when limit resets
- `Retry-After`: Seconds until rate limit resets (e.g., "45")

### Successful Response Headers

All successful responses include rate limit headers:

```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 25
X-RateLimit-Reset: 2025-10-22T14:30:00.000Z
```

## Implementation Details

### Architecture

The implementation uses:
- **In-memory Map** for fast O(1) lookups
- **Token bucket algorithm** with sliding window
- **Automatic cleanup** every 60 seconds to prevent memory leaks
- **Safety limit** of 10,000 entries max to prevent memory bloat

### Memory Management

- Expired entries are automatically cleaned up every minute
- Maximum 10,000 concurrent rate limit entries
- For 25 concurrent users, typical memory usage: ~1-2 MB
- Each entry: ~150 bytes (identifier + metadata)

### Edge Runtime Compatibility

The implementation is fully compatible with Vercel Edge Runtime:
- No external dependencies
- No Redis or external storage required
- Works with serverless function cold starts
- Persists across warm starts in the same container

## Testing

### Running Tests

```bash
# Test with 35 requests (should all succeed)
npx tsx scripts/test-rate-limit.ts /api/projects 35

# Test with 40 requests (last 5 should be rejected)
npx tsx scripts/test-rate-limit.ts /api/projects 40

# Test different endpoints
npx tsx scripts/test-rate-limit.ts /api/employers 40
npx tsx scripts/test-rate-limit.ts /api/workers 40
```

### Expected Results

With 35 requests:
- ✓ 30 successful (within limit)
- ✓ 5 burst allowed
- ✗ 0 rejected

With 40 requests:
- ✓ 30 successful (within limit)
- ✓ 5 burst allowed
- ✗ 5 rejected (rate limited)

## Scaling Considerations

### Current Solution (In-Memory)

**Best for:**
- 25-100 concurrent users
- Single-region deployment
- Soft launch / MVP phase

**Limitations:**
- Rate limits are per-instance (Vercel may spawn multiple instances)
- No sharing of state across instances
- May allow slightly more requests in multi-instance scenarios

### Future Scaling Options

When scaling beyond 100 concurrent users, consider:

1. **Vercel KV** (Redis-based)
   - Shared state across all instances
   - Persistent rate limiting
   - Requires paid Vercel tier
   - ~$10-30/month

2. **Upstash Redis**
   - Serverless Redis
   - Global replication
   - Pay-per-request pricing
   - Easy integration

3. **External Service**
   - Cloudflare Rate Limiting
   - AWS API Gateway throttling
   - Kong API Gateway

## Customizing Rate Limits

### Changing Global Limits

Edit the preset in `src/lib/rateLimit.ts`:

```typescript
export const RATE_LIMIT_PRESETS = {
  EXPENSIVE_QUERY: {
    maxRequests: 60,      // Change from 30 to 60
    windowSeconds: 60,
    burstAllowance: 10,   // Change from 5 to 10
  },
  // ...
};
```

### Per-Endpoint Configuration

To use different limits for specific endpoints:

```typescript
// In src/app/api/projects/route.ts
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Use RELAXED preset instead
export const GET = withRateLimit(
  getProjectsHandler,
  RATE_LIMIT_PRESETS.RELAXED  // Change here
);
```

### Custom Configuration

Create a custom configuration:

```typescript
export const GET = withRateLimit(getProjectsHandler, {
  maxRequests: 100,
  windowSeconds: 60,
  burstAllowance: 20,
});
```

## Monitoring

### Rate Limiter Statistics

Get current rate limiter stats (for debugging):

```typescript
import { getRateLimiterStats } from '@/lib/rateLimit';

const stats = getRateLimiterStats();
console.log(stats);
// { entries: 15, timestamp: "2025-10-22T14:30:00.000Z" }
```

### Recommended Monitoring

Monitor these metrics in production:
1. **429 response rate** - Should be < 1% of requests
2. **X-RateLimit-Remaining** - Track how close users get to limits
3. **Memory usage** - Should stay under 10 MB for rate limiter
4. **Response times** - Rate limiter adds < 1ms overhead

## Troubleshooting

### Users Reporting 429 Errors

1. Check if legitimate usage pattern (pagination, filters, search)
2. Consider increasing burst allowance
3. Review user's request frequency
4. Consider whitelisting authenticated users

### Rate Limiter Not Working

1. Verify headers are present in responses
2. Check that `withRateLimit` wrapper is applied
3. Test with the test script
4. Check Vercel logs for errors

### Memory Issues

1. Check current entries: `getRateLimiterStats()`
2. Verify cleanup is running (check lastCleanup)
3. Consider reducing windowSeconds
4. Consider migration to external storage

## Migration Path

When ready to scale:

1. **Phase 1** (Current): In-memory rate limiting
   - Good for 25-100 users
   - Zero cost
   - Simple to maintain

2. **Phase 2** (100-1000 users): Vercel KV
   ```typescript
   import { Ratelimit } from "@upstash/ratelimit";
   import { kv } from "@vercel/kv";

   const ratelimit = new Ratelimit({
     redis: kv,
     limiter: Ratelimit.slidingWindow(30, "60 s"),
   });
   ```

3. **Phase 3** (1000+ users): CDN-level rate limiting
   - Cloudflare Workers
   - AWS CloudFront + Lambda@Edge
   - Fastly VCL

## Files Modified

- `src/lib/rateLimit.ts` - Rate limiting utility (new)
- `src/app/api/projects/route.ts` - Added rate limiting
- `src/app/api/employers/route.ts` - Added rate limiting
- `src/app/api/workers/route.ts` - Added rate limiting
- `scripts/test-rate-limit.ts` - Test script (new)

## References

- [Vercel Edge Runtime](https://vercel.com/docs/functions/edge-functions/edge-runtime)
- [Token Bucket Algorithm](https://en.wikipedia.org/wiki/Token_bucket)
- [HTTP 429 Too Many Requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/429)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)

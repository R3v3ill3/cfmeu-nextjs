import { NextRequest, NextResponse } from 'next/server';

/**
 * Simple in-memory rate limiter for Vercel Edge Runtime
 *
 * Strategy: Token bucket algorithm with sliding window
 * - Suitable for small deployments (25 concurrent users)
 * - No external dependencies required
 * - Edge runtime compatible
 *
 * For production scale (100+ users), consider:
 * - Vercel KV (Redis-based, paid tier)
 * - Upstash Redis (serverless Redis)
 * - External rate limiting service
 */

interface RateLimitConfig {
  /**
   * Maximum requests allowed in the time window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowSeconds: number;

  /**
   * Optional: Burst allowance (extra requests allowed in short bursts)
   * Default: 0 (no burst)
   */
  burstAllowance?: number;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  burstUsed: number;
}

/**
 * In-memory store with automatic cleanup
 * Uses Map for O(1) lookups
 */
class RateLimitStore {
  private store = new Map<string, RateLimitEntry>();
  private lastCleanup = Date.now();
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly MAX_ENTRIES = 10000; // Safety limit to prevent memory bloat

  get(key: string): RateLimitEntry | undefined {
    this.maybeCleanup();
    return this.store.get(key);
  }

  set(key: string, entry: RateLimitEntry): void {
    // Prevent unbounded growth
    if (this.store.size >= this.MAX_ENTRIES && !this.store.has(key)) {
      // If we're at capacity and this is a new key, trigger cleanup
      this.cleanup();

      // If still at capacity after cleanup, remove oldest entry
      if (this.store.size >= this.MAX_ENTRIES) {
        const firstKey = this.store.keys().next().value;
        if (firstKey) {
          this.store.delete(firstKey);
        }
      }
    }

    this.store.set(key, entry);
  }

  private maybeCleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup > this.CLEANUP_INTERVAL) {
      this.cleanup();
    }
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    // Use Array.from to avoid downlevelIteration requirement
    Array.from(this.store.entries()).forEach(([key, entry]) => {
      if (entry.resetTime < now) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.store.delete(key));
    this.lastCleanup = now;
  }

  size(): number {
    return this.store.size;
  }
}

// Global singleton store (persists across function invocations in same container)
const rateLimitStore = new RateLimitStore();

/**
 * Get identifier for rate limiting (IP address or user ID)
 */
function getIdentifier(request: NextRequest): string {
  // Try to get authenticated user ID from custom header (set by auth middleware)
  const userId = request.headers.get('x-user-id');
  if (userId) {
    return `user:${userId}`;
  }

  // Fall back to IP address
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  return `ip:${ip}`;
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

/**
 * Check if request is within rate limit
 */
export function checkRateLimit(
  request: NextRequest,
  config: RateLimitConfig
): RateLimitResult {
  const identifier = getIdentifier(request);
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const burstAllowance = config.burstAllowance || 0;

  const key = `${identifier}:${request.nextUrl.pathname}`;
  const entry = rateLimitStore.get(key);

  // No existing entry - first request
  if (!entry) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      burstUsed: 0,
    });

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: now + windowMs,
    };
  }

  // Window has reset
  if (now >= entry.resetTime) {
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      burstUsed: 0,
    });

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - 1,
      reset: now + windowMs,
    };
  }

  // Within window - check if under limit
  if (entry.count < config.maxRequests) {
    entry.count++;
    rateLimitStore.set(key, entry);

    return {
      success: true,
      limit: config.maxRequests,
      remaining: config.maxRequests - entry.count,
      reset: entry.resetTime,
    };
  }

  // Over limit - check burst allowance
  if (burstAllowance > 0 && entry.burstUsed < burstAllowance) {
    entry.count++;
    entry.burstUsed++;
    rateLimitStore.set(key, entry);

    return {
      success: true,
      limit: config.maxRequests,
      remaining: 0, // Over limit but within burst
      reset: entry.resetTime,
    };
  }

  // Rate limit exceeded
  const retryAfter = Math.ceil((entry.resetTime - now) / 1000);

  return {
    success: false,
    limit: config.maxRequests,
    remaining: 0,
    reset: entry.resetTime,
    retryAfter,
  };
}

/**
 * Higher-order function to wrap API route handlers with rate limiting
 */
export function withRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const result = checkRateLimit(request, config);

    // Add rate limit headers to all responses
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': new Date(result.reset).toISOString(),
    };

    if (!result.success) {
      headers['Retry-After'] = result.retryAfter!.toString();

      return NextResponse.json(
        {
          error: 'Too many requests',
          message: `Rate limit exceeded. Please try again in ${result.retryAfter} seconds.`,
          retryAfter: result.retryAfter,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Continue to handler
    const response = await handler(request);

    // Add rate limit headers to successful response
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  };
}

/**
 * Preset configurations for common use cases
 */
export const RATE_LIMIT_PRESETS = {
  /**
   * Conservative limit for expensive database queries
   * 30 requests per minute (0.5 req/sec)
   */
  EXPENSIVE_QUERY: {
    maxRequests: 30,
    windowSeconds: 60,
    burstAllowance: 5, // Allow small bursts for page loads
  } as RateLimitConfig,

  /**
   * Standard limit for typical API endpoints
   * 60 requests per minute (1 req/sec)
   */
  STANDARD: {
    maxRequests: 60,
    windowSeconds: 60,
    burstAllowance: 10,
  } as RateLimitConfig,

  /**
   * Relaxed limit for lightweight endpoints
   * 120 requests per minute (2 req/sec)
   */
  RELAXED: {
    maxRequests: 120,
    windowSeconds: 60,
    burstAllowance: 20,
  } as RateLimitConfig,

  /**
   * Rate limit for authentication endpoints
   * Increased from 10 to 20 requests per minute to handle session recovery attempts
   * Multi-agent investigation identified that session recovery requires multiple retries
   * Added burst allowance of 5 to accommodate recovery scenarios without blocking legitimate users
   */
  AUTH: {
    maxRequests: 20, // Increased from 10 for recovery attempts
    windowSeconds: 60,
    burstAllowance: 5, // Allow burst for session recovery scenarios
  } as RateLimitConfig,
};

/**
 * Utility to get rate limiter stats (for monitoring/debugging)
 */
export function getRateLimiterStats() {
  return {
    entries: rateLimitStore.size(),
    timestamp: new Date().toISOString(),
  };
}

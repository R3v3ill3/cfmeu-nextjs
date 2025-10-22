/**
 * Retry utility for handling transient failures with exponential backoff and jitter
 *
 * This module provides robust retry logic for FWC scraper operations to handle:
 * - Network timeouts
 * - Rate limiting (HTTP 429)
 * - Server errors (HTTP 5xx)
 * - Transient connection issues
 */

export interface RetryConfig {
  maxAttempts: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  jitterMaxMs: number
  retryableErrors: Set<string>
  retryableStatusCodes: Set<number>
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 5,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  backoffMultiplier: 2,
  jitterMaxMs: 1000, // Up to 1 second of random jitter
  retryableErrors: new Set([
    'ECONNRESET',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'EAI_AGAIN',
    'TimeoutError',
    'Navigation timeout',
    'net::ERR_',
  ]),
  retryableStatusCodes: new Set([
    408, // Request Timeout
    429, // Too Many Requests (Rate Limit)
    500, // Internal Server Error
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    520, // Cloudflare Unknown Error
    521, // Cloudflare Web Server Down
    522, // Cloudflare Connection Timed Out
    523, // Cloudflare Origin Unreachable
    524, // Cloudflare Timeout
  ]),
}

export interface RetryContext {
  attempt: number
  lastError?: Error
  totalDelayMs: number
}

export interface RetryResult<T> {
  success: boolean
  data?: T
  error?: Error
  attempts: number
  totalDelayMs: number
}

/**
 * Determines if an error is retryable based on configuration
 */
export function isRetryableError(error: unknown, config: RetryConfig): boolean {
  if (!error) return false

  // Check if it's an HTTP status code error
  if (typeof error === 'object' && error !== null) {
    const anyError = error as any

    // Check status code
    if (typeof anyError.statusCode === 'number' && config.retryableStatusCodes.has(anyError.statusCode)) {
      return true
    }
    if (typeof anyError.status === 'number' && config.retryableStatusCodes.has(anyError.status)) {
      return true
    }

    // Check error code (e.g., ECONNRESET)
    if (typeof anyError.code === 'string') {
      for (const retryableCode of config.retryableErrors) {
        if (anyError.code.includes(retryableCode)) {
          return true
        }
      }
    }

    // Check error message
    if (typeof anyError.message === 'string') {
      const errorMessage = anyError.message.toLowerCase()
      for (const retryablePattern of config.retryableErrors) {
        if (errorMessage.includes(retryablePattern.toLowerCase())) {
          return true
        }
      }

      // Check if it's a timeout error
      if (anyError.name === 'TimeoutError' || errorMessage.includes('timeout')) {
        return true
      }
    }
  }

  return false
}

/**
 * Calculates the delay before the next retry attempt with exponential backoff and jitter
 *
 * @param attempt - Current attempt number (0-based)
 * @param config - Retry configuration
 * @param retryAfterSeconds - Optional Retry-After header value in seconds
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig,
  retryAfterSeconds?: number
): number {
  // If server provides Retry-After header, respect it
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    const retryAfterMs = retryAfterSeconds * 1000
    // Add jitter even to Retry-After to prevent thundering herd
    const jitter = Math.random() * config.jitterMaxMs
    return Math.min(retryAfterMs + jitter, config.maxDelayMs)
  }

  // Calculate exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt)

  // Add random jitter to prevent thundering herd problem
  const jitter = Math.random() * config.jitterMaxMs

  // Cap at maxDelayMs
  const totalDelay = Math.min(exponentialDelay + jitter, config.maxDelayMs)

  return Math.floor(totalDelay)
}

/**
 * Extracts Retry-After header value from error or response
 *
 * @param error - Error that may contain retry-after information
 * @returns Retry-After value in seconds, or undefined
 */
export function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  const anyError = error as any

  // Check for Retry-After header in response
  if (anyError.response?.headers) {
    const retryAfter = anyError.response.headers['retry-after'] ||
                      anyError.response.headers['Retry-After']

    if (retryAfter) {
      // Retry-After can be in seconds or a date
      const seconds = parseInt(retryAfter, 10)
      if (!isNaN(seconds)) {
        return seconds
      }

      // Try parsing as date
      const retryDate = new Date(retryAfter)
      if (!isNaN(retryDate.getTime())) {
        const nowMs = Date.now()
        const retryMs = retryDate.getTime()
        return Math.max(0, Math.floor((retryMs - nowMs) / 1000))
      }
    }
  }

  return undefined
}

/**
 * Sleep utility for delays
 */
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Executes a function with retry logic and exponential backoff
 *
 * @param fn - Async function to retry
 * @param config - Retry configuration (uses defaults if not provided)
 * @param onRetry - Optional callback called before each retry attempt
 * @returns Promise with retry result
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {},
  onRetry?: (context: RetryContext) => void | Promise<void>
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config }

  let lastError: Error | undefined
  let totalDelayMs = 0

  for (let attempt = 0; attempt < finalConfig.maxAttempts; attempt++) {
    try {
      const data = await fn()
      return {
        success: true,
        data,
        attempts: attempt + 1,
        totalDelayMs,
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Check if we should retry
      const shouldRetry = isRetryableError(error, finalConfig)
      const isLastAttempt = attempt === finalConfig.maxAttempts - 1

      if (!shouldRetry || isLastAttempt) {
        // Don't retry for non-retryable errors or last attempt
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
          totalDelayMs,
        }
      }

      // Calculate delay before next retry
      const retryAfterSeconds = extractRetryAfter(error)
      const delayMs = calculateRetryDelay(attempt, finalConfig, retryAfterSeconds)
      totalDelayMs += delayMs

      // Call retry callback if provided
      if (onRetry) {
        await onRetry({
          attempt: attempt + 1,
          lastError,
          totalDelayMs,
        })
      }

      // Wait before retrying
      await sleep(delayMs)
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError || new Error('Unknown error in retry logic'),
    attempts: finalConfig.maxAttempts,
    totalDelayMs,
  }
}

/**
 * Creates a retry wrapper function with pre-configured settings
 *
 * @param config - Retry configuration
 * @returns Function that wraps any async function with retry logic
 */
export function createRetryWrapper(config: Partial<RetryConfig> = {}) {
  return async <T>(
    fn: () => Promise<T>,
    onRetry?: (context: RetryContext) => void | Promise<void>
  ): Promise<RetryResult<T>> => {
    return withRetry(fn, config, onRetry)
  }
}

/**
 * Utility to format retry attempt information for logging
 */
export function formatRetryLog(context: RetryContext, config: RetryConfig): string {
  const { attempt, lastError, totalDelayMs } = context
  const maxAttempts = config.maxAttempts

  const errorMsg = lastError?.message || 'Unknown error'
  const errorCode = (lastError as any)?.code || 'N/A'

  return `Retry attempt ${attempt}/${maxAttempts} after ${totalDelayMs}ms total delay. Error: ${errorMsg} (code: ${errorCode})`
}

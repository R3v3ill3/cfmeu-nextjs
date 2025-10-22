/**
 * Unit tests for retry utility
 */

import {
  withRetry,
  isRetryableError,
  calculateRetryDelay,
  extractRetryAfter,
  DEFAULT_RETRY_CONFIG,
  RetryConfig,
} from '../retry'

describe('Retry Utility', () => {
  describe('isRetryableError', () => {
    const config = DEFAULT_RETRY_CONFIG

    it('should identify retryable HTTP status codes', () => {
      expect(isRetryableError({ statusCode: 429 }, config)).toBe(true)
      expect(isRetryableError({ statusCode: 503 }, config)).toBe(true)
      expect(isRetryableError({ statusCode: 504 }, config)).toBe(true)
      expect(isRetryableError({ status: 500 }, config)).toBe(true)
    })

    it('should identify non-retryable HTTP status codes', () => {
      expect(isRetryableError({ statusCode: 404 }, config)).toBe(false)
      expect(isRetryableError({ statusCode: 401 }, config)).toBe(false)
      expect(isRetryableError({ statusCode: 400 }, config)).toBe(false)
    })

    it('should identify retryable error codes', () => {
      expect(isRetryableError({ code: 'ECONNRESET' }, config)).toBe(true)
      expect(isRetryableError({ code: 'ETIMEDOUT' }, config)).toBe(true)
      expect(isRetryableError({ code: 'ECONNREFUSED' }, config)).toBe(true)
    })

    it('should identify retryable error messages', () => {
      expect(isRetryableError({ message: 'Navigation timeout exceeded' }, config)).toBe(true)
      expect(isRetryableError({ message: 'Request timeout' }, config)).toBe(true)
      expect(isRetryableError({ message: 'net::ERR_CONNECTION_RESET' }, config)).toBe(true)
    })

    it('should identify timeout errors', () => {
      expect(isRetryableError({ name: 'TimeoutError', message: 'Timeout' }, config)).toBe(true)
    })

    it('should not retry non-retryable errors', () => {
      expect(isRetryableError({ message: 'Invalid input' }, config)).toBe(false)
      expect(isRetryableError({ code: 'INVALID_ARGUMENT' }, config)).toBe(false)
    })
  })

  describe('calculateRetryDelay', () => {
    const config = DEFAULT_RETRY_CONFIG

    it('should calculate exponential backoff correctly', () => {
      const delay0 = calculateRetryDelay(0, config)
      const delay1 = calculateRetryDelay(1, config)
      const delay2 = calculateRetryDelay(2, config)

      // Delay should increase exponentially (with jitter)
      expect(delay0).toBeGreaterThanOrEqual(config.initialDelayMs)
      expect(delay0).toBeLessThanOrEqual(config.initialDelayMs + config.jitterMaxMs)

      expect(delay1).toBeGreaterThanOrEqual(config.initialDelayMs * config.backoffMultiplier)
      expect(delay2).toBeGreaterThanOrEqual(config.initialDelayMs * config.backoffMultiplier ** 2)
    })

    it('should respect maximum delay', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        maxDelayMs: 5000,
      }

      const delay = calculateRetryDelay(10, config)
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs)
    })

    it('should respect Retry-After header', () => {
      const retryAfterSeconds = 5
      const delay = calculateRetryDelay(0, DEFAULT_RETRY_CONFIG, retryAfterSeconds)

      expect(delay).toBeGreaterThanOrEqual(retryAfterSeconds * 1000)
      expect(delay).toBeLessThanOrEqual(retryAfterSeconds * 1000 + DEFAULT_RETRY_CONFIG.jitterMaxMs)
    })

    it('should cap Retry-After at maxDelayMs', () => {
      const config: RetryConfig = {
        ...DEFAULT_RETRY_CONFIG,
        maxDelayMs: 5000,
      }

      const delay = calculateRetryDelay(0, config, 10)
      expect(delay).toBeLessThanOrEqual(config.maxDelayMs)
    })
  })

  describe('extractRetryAfter', () => {
    it('should extract numeric Retry-After header', () => {
      const error = {
        response: {
          headers: {
            'retry-after': '5',
          },
        },
      }

      expect(extractRetryAfter(error)).toBe(5)
    })

    it('should extract case-insensitive Retry-After header', () => {
      const error = {
        response: {
          headers: {
            'Retry-After': '10',
          },
        },
      }

      expect(extractRetryAfter(error)).toBe(10)
    })

    it('should parse date-based Retry-After header', () => {
      const futureDate = new Date(Date.now() + 5000)
      const error = {
        response: {
          headers: {
            'retry-after': futureDate.toISOString(),
          },
        },
      }

      const result = extractRetryAfter(error)
      expect(result).toBeGreaterThanOrEqual(4)
      expect(result).toBeLessThanOrEqual(6)
    })

    it('should return undefined for missing header', () => {
      expect(extractRetryAfter({})).toBeUndefined()
      expect(extractRetryAfter({ response: {} })).toBeUndefined()
      expect(extractRetryAfter(null)).toBeUndefined()
    })
  })

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success')

      const result = await withRetry(fn, { maxAttempts: 3 })

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on transient failure and succeed', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('success')

      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.attempts).toBe(2)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should not retry on non-retryable error', async () => {
      const fn = jest.fn().mockRejectedValue({ statusCode: 404, message: 'Not found' })

      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(1)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should exhaust retries and fail', async () => {
      const fn = jest.fn().mockRejectedValue({ code: 'ETIMEDOUT' })

      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })

      expect(result.success).toBe(false)
      expect(result.attempts).toBe(3)
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('should call onRetry callback', async () => {
      const fn = jest
        .fn()
        .mockRejectedValueOnce({ code: 'ETIMEDOUT' })
        .mockResolvedValue('success')

      const onRetry = jest.fn()

      await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 }, onRetry)

      expect(onRetry).toHaveBeenCalledTimes(1)
      expect(onRetry).toHaveBeenCalledWith(
        expect.objectContaining({
          attempt: 1,
          lastError: expect.any(Error),
        })
      )
    })

    it('should handle rate limit with Retry-After', async () => {
      const error = {
        statusCode: 429,
        response: {
          headers: {
            'retry-after': '1',
          },
        },
      }

      const fn = jest.fn().mockRejectedValueOnce(error).mockResolvedValue('success')

      const result = await withRetry(fn, { maxAttempts: 3, initialDelayMs: 10 })

      expect(result.success).toBe(true)
      expect(result.attempts).toBe(2)
    })
  })
})

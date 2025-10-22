/**
 * Timeout utilities for API calls with AbortController support
 */

export class TimeoutError extends Error {
  constructor(message: string, public timeoutMs: number) {
    super(message)
    this.name = 'TimeoutError'
  }
}

export interface TimeoutOptions {
  timeoutMs: number
  operationName?: string
}

/**
 * Wraps a promise with timeout functionality using AbortController
 * @param promise The promise to wrap
 * @param options Timeout configuration
 * @returns The result of the promise or throws TimeoutError
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, operationName = 'Operation' } = options

  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(
        new TimeoutError(
          `${operationName} timed out after ${timeoutMs}ms`,
          timeoutMs
        )
      )
    }, timeoutMs)

    promise
      .then((result) => {
        clearTimeout(timeoutId)
        resolve(result)
      })
      .catch((error) => {
        clearTimeout(timeoutId)
        reject(error)
      })
  })
}

/**
 * Creates an AbortController that automatically aborts after a timeout
 * @param timeoutMs Timeout in milliseconds
 * @returns Object with AbortController and cleanup function
 */
export function createTimeoutController(timeoutMs: number): {
  controller: AbortController
  cleanup: () => void
} {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const cleanup = () => {
    clearTimeout(timeoutId)
  }

  return { controller, cleanup }
}

/**
 * Wraps an async function with retry logic for timeout errors
 * @param fn The async function to wrap
 * @param options Configuration for timeout and retry behavior
 * @returns Result of the function or throws after retries exhausted
 */
export async function withTimeoutAndRetry<T>(
  fn: () => Promise<T>,
  options: {
    timeoutMs: number
    maxRetries: number
    operationName?: string
    onRetry?: (attempt: number, error: Error) => void
  }
): Promise<T> {
  const { timeoutMs, maxRetries, operationName = 'Operation', onRetry } = options
  let lastError: Error

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await withTimeout(fn(), { timeoutMs, operationName })
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (error instanceof TimeoutError && attempt <= maxRetries) {
        console.warn(
          `[timeout] ${operationName} attempt ${attempt}/${maxRetries + 1} timed out after ${timeoutMs}ms, retrying...`
        )
        if (onRetry) {
          onRetry(attempt, lastError)
        }
        continue
      }

      throw lastError
    }
  }

  throw lastError!
}

/**
 * Logs timeout incidents for monitoring
 */
export function logTimeoutIncident(
  operationName: string,
  timeoutMs: number,
  metadata?: Record<string, any>
) {
  console.error('[timeout-incident]', {
    timestamp: new Date().toISOString(),
    operation: operationName,
    timeoutMs,
    ...metadata,
  })
}

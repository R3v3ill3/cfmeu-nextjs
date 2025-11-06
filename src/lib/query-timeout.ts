/**
 * Utility functions for adding timeouts to database queries
 * to prevent exceeding Vercel's 25s function timeout limit
 */

export interface TimeoutOptions {
  timeoutMs?: number;
  errorMessage?: string;
}

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds (default: 12000 = 12s, leaving buffer for Vercel's 25s limit)
 * @param errorMessage - Custom error message
 * @returns Promise that rejects if timeout is exceeded
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 12000,
  errorMessage?: string
): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => {
      reject(new Error(errorMessage || `Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]);
}

/**
 * Checks if an error is a timeout error
 */
export function isTimeoutError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.message.includes('timeout') || error.message.includes('Timeout');
  }
  return false;
}

/**
 * Checks if an error is a database stack depth error
 */
export function isStackDepthError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return error.code === '54001';
  }
  return false;
}

/**
 * Checks if an error is a statement timeout error
 */
export function isStatementTimeoutError(error: unknown): boolean {
  if (error && typeof error === 'object' && 'code' in error) {
    return error.code === '57014';
  }
  return false;
}

/**
 * Checks if an error is a database timeout-related error
 */
export function isDatabaseTimeoutError(error: unknown): boolean {
  return isTimeoutError(error) || isStackDepthError(error) || isStatementTimeoutError(error);
}


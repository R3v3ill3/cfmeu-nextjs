/**
 * Query timeout presets based on query complexity
 */
export const QUERY_TIMEOUTS = {
  // Simple queries (role, profile, basic selects)
  // Increased from 5s to 10s due to database performance issues
  SIMPLE: 10000,       // 10 seconds
  // Medium queries (single table with filters, basic joins)
  MEDIUM: 15000,      // 15 seconds
  // Complex queries (multiple joins, aggregations, nested relations)
  COMPLEX: 25000,     // 25 seconds
  // Very complex queries (deeply nested, large datasets)
  VERY_COMPLEX: 35000, // 35 seconds
} as const;

/**
 * Get timeout based on query type
 */
export function getTimeoutForQueryType(type: keyof typeof QUERY_TIMEOUTS): number {
  return QUERY_TIMEOUTS[type];
}

/**
 * Execute a promise with a timeout, providing detailed logging
 */
export function withTimeout<T>(promiseLike: PromiseLike<T>, timeoutMs: number, label?: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const startTime = Date.now();
  const operationLabel = label || 'Unknown operation';

  console.log(`[withTimeout] Starting ${operationLabel}`, {
    timeoutMs,
    timestamp: new Date().toISOString(),
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const duration = Date.now() - startTime;
      const message = label
        ? `${label} timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`;
      const error = new Error(message);
      (error as any).code = "ETIMEDOUT";
      
      console.error(`[withTimeout] Timeout occurred for ${operationLabel}`, {
        timeoutMs,
        actualDuration: duration,
        label,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: (error as any).code,
        },
      });
      
      reject(error);
    }, timeoutMs);
  });

  const guardedPromise = new Promise<T>((resolve, reject) => {
    promiseLike.then(
      (value) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        console.log(`[withTimeout] ${operationLabel} completed successfully`, {
          duration,
          timeoutMs,
          timestamp: new Date().toISOString(),
        });
        resolve(value);
      },
      (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        console.error(`[withTimeout] ${operationLabel} failed`, {
          duration,
          timeoutMs,
          error: err,
          errorMessage: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
        reject(err);
      }
    );
  });

  return Promise.race([guardedPromise, timeoutPromise]) as Promise<T>;
}


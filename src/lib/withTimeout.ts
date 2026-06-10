import * as Sentry from "@sentry/nextjs";

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

type WithTimeoutOptions = {
  abortController?: AbortController;
  telemetry?: boolean;
};

const SHOULD_LOG_TIMEOUT_BREADCRUMBS =
  typeof process.env.NEXT_PUBLIC_ENABLE_TIMEOUT_BREADCRUMBS !== "undefined"
    ? process.env.NEXT_PUBLIC_ENABLE_TIMEOUT_BREADCRUMBS === "true"
    : true;

function addTimeoutBreadcrumb(
  message: string,
  data: Record<string, unknown>,
  level: "info" | "warning" | "error" = "info"
) {
  if (!SHOULD_LOG_TIMEOUT_BREADCRUMBS) return;

  try {
    Sentry.addBreadcrumb({
      category: "with-timeout",
      message,
      level,
      data,
      timestamp: Date.now() / 1000,
    });
  } catch {
    // Breadcrumbs are best-effort; ignore errors
  }
}

/**
 * Execute a promise with a timeout, providing detailed logging
 */
export function withTimeout<T>(
  promiseLike: PromiseLike<T>,
  timeoutMs: number,
  label?: string,
  options?: WithTimeoutOptions
): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const startTime = Date.now();
  const operationLabel = label || "Unknown operation";
  const telemetryEnabled = options?.telemetry ?? true;

  const startPayload = {
    timeoutMs,
    timestamp: new Date().toISOString(),
    label: operationLabel,
  };

  if (telemetryEnabled) {
    console.log(`[withTimeout] Starting ${operationLabel}`, startPayload);
    addTimeoutBreadcrumb("withTimeout:start", startPayload);
  }

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      const duration = Date.now() - startTime;
      const message = label
        ? `${label} timed out after ${timeoutMs}ms`
        : `Operation timed out after ${timeoutMs}ms`;
      const error = new Error(message);
      (error as any).code = "ETIMEDOUT";

      if (options?.abortController) {
        options.abortController.abort();
      }

      const timeoutPayload = {
        timeoutMs,
        actualDuration: duration,
        label: operationLabel,
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: (error as any).code,
        },
      };

      if (telemetryEnabled) {
        console.error(`[withTimeout] Timeout occurred for ${operationLabel}`, timeoutPayload);
        addTimeoutBreadcrumb("withTimeout:timeout", timeoutPayload, "warning");
      }

      reject(error);
    }, timeoutMs);
  });

  const guardedPromise = new Promise<T>((resolve, reject) => {
    promiseLike.then(
      (value) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        const successPayload = {
          duration,
          timeoutMs,
          timestamp: new Date().toISOString(),
          label: operationLabel,
        };
        if (telemetryEnabled) {
          console.log(`[withTimeout] ${operationLabel} completed successfully`, successPayload);
          addTimeoutBreadcrumb("withTimeout:success", successPayload);
        }
        resolve(value);
      },
      (err) => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        const duration = Date.now() - startTime;
        const failurePayload = {
          duration,
          timeoutMs,
          errorMessage: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
          label: operationLabel,
        };
        if (telemetryEnabled) {
          console.error(`[withTimeout] ${operationLabel} failed`, {
            ...failurePayload,
            error: err,
          });
          addTimeoutBreadcrumb("withTimeout:error", failurePayload, "error");
        }
        reject(err);
      }
    );
  });

  return Promise.race([guardedPromise, timeoutPromise]) as Promise<T>;
}


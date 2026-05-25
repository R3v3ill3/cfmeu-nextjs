/**
 * fetchApi — bounded fetch wrapper for client-side calls to same-origin `/api/*` routes.
 *
 * Why: bare `fetch('/api/...')` calls have no timeout. If a Vercel function
 * hangs (slow upstream, RPC stall, worker down) the UI shows an infinite
 * spinner with no recovery. This wrapper:
 *   - aborts after `timeoutMs` (default 60s; 120s for long ops)
 *   - sends an `X-Request-Id` so the request can be correlated with Vercel
 *     function logs and Sentry breadcrumbs
 *   - throws a typed `FetchApiError` so callers can distinguish abort/timeout
 *     from HTTP error / network error
 *
 * Server-side handlers should read `X-Request-Id` from incoming requests and
 * include it in their structured logs to enable end-to-end tracing.
 */

export const FETCH_API_DEFAULT_TIMEOUT_MS = 60_000
export const FETCH_API_LONG_TIMEOUT_MS = 120_000
export const FETCH_API_SSE_TIMEOUT_MS = 600_000

export type FetchApiOptions = RequestInit & {
  /** Override the default timeout (ms). Pass `0` to disable. */
  timeoutMs?: number
  /** Override the generated request id. Defaults to a fresh UUID. */
  requestId?: string
}

export class FetchApiError extends Error {
  readonly status: number
  readonly requestId: string
  readonly isTimeout: boolean
  readonly isAbort: boolean
  readonly body: unknown

  constructor(args: {
    message: string
    status: number
    requestId: string
    isTimeout?: boolean
    isAbort?: boolean
    body?: unknown
  }) {
    super(args.message)
    this.name = 'FetchApiError'
    this.status = args.status
    this.requestId = args.requestId
    this.isTimeout = args.isTimeout ?? false
    this.isAbort = args.isAbort ?? false
    this.body = args.body
  }
}

function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `req-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Bounded fetch for same-origin `/api/*` calls.
 *
 * Returns the raw `Response`. For JSON convenience use `fetchApiJson` below.
 * Throws `FetchApiError` on non-2xx, timeout, or abort.
 */
export async function fetchApi(
  input: string,
  options: FetchApiOptions = {}
): Promise<Response> {
  const { timeoutMs = FETCH_API_DEFAULT_TIMEOUT_MS, requestId, signal, headers, ...rest } = options
  const reqId = requestId ?? generateRequestId()

  // Wire abort: external signal OR our timeout, whichever fires first.
  const controller = new AbortController()
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  let timedOut = false

  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason)
    } else {
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true })
    }
  }

  if (timeoutMs > 0) {
    timeoutHandle = setTimeout(() => {
      timedOut = true
      controller.abort(new DOMException(`fetchApi timeout after ${timeoutMs}ms`, 'TimeoutError'))
    }, timeoutMs)
  }

  const mergedHeaders = new Headers(headers)
  if (!mergedHeaders.has('X-Request-Id')) {
    mergedHeaders.set('X-Request-Id', reqId)
  }

  try {
    const response = await fetch(input, {
      ...rest,
      headers: mergedHeaders,
      signal: controller.signal,
    })

    if (!response.ok) {
      let body: unknown
      try {
        const contentType = response.headers.get('content-type') ?? ''
        body = contentType.includes('application/json') ? await response.json() : await response.text()
      } catch {
        body = null
      }
      throw new FetchApiError({
        message: `${input} → ${response.status} ${response.statusText}`,
        status: response.status,
        requestId: reqId,
        body,
      })
    }

    return response
  } catch (error) {
    if (error instanceof FetchApiError) throw error

    const isAbortLike =
      error instanceof DOMException && (error.name === 'AbortError' || error.name === 'TimeoutError')

    if (isAbortLike) {
      throw new FetchApiError({
        message: timedOut
          ? `${input} timed out after ${timeoutMs}ms (request ${reqId})`
          : `${input} aborted (request ${reqId})`,
        status: 0,
        requestId: reqId,
        isTimeout: timedOut,
        isAbort: !timedOut,
      })
    }

    throw new FetchApiError({
      message: `${input} failed: ${error instanceof Error ? error.message : String(error)} (request ${reqId})`,
      status: 0,
      requestId: reqId,
    })
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}

/** Convenience: bounded fetch + JSON parse. Throws `FetchApiError` on failure. */
export async function fetchApiJson<T = unknown>(
  input: string,
  options: FetchApiOptions = {}
): Promise<T> {
  const response = await fetchApi(input, options)
  return response.json() as Promise<T>
}

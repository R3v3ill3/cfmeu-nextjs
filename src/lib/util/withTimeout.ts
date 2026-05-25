/**
 * withTimeout — bound an arbitrary promise with a timeout.
 *
 * Resolves with the promise's value if it settles within `timeoutMs`. Otherwise
 * rejects with a `TimeoutError`. The underlying promise is NOT cancelled — for
 * Supabase auth ops there is no AbortController hook, so the promise may still
 * settle in the background. Callers must therefore not assume that timeout ⇒
 * the operation did not happen.
 */
export const SUPABASE_AUTH_OP_TIMEOUT_MS = 12_000

export class TimeoutError extends Error {
  readonly isTimeout = true
  constructor(label: string, timeoutMs: number) {
    super(`${label} timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export async function withTimeout<T>(
  // `PromiseLike` rather than `Promise` so Supabase's thenable query builders
  // (`PostgrestFilterBuilder`, `PostgrestQueryBuilder`) can be passed in
  // directly without first awaiting them.
  promise: PromiseLike<T>,
  timeoutMs: number,
  label: string = 'operation'
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(label, timeoutMs)), timeoutMs)
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function isTimeoutError(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === 'object' &&
      ((error as { isTimeout?: boolean }).isTimeout === true ||
        (error as { name?: string }).name === 'TimeoutError')
  )
}

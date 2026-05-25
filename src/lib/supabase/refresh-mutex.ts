/**
 * coordinatedRefreshSession — single-flight mutex for `auth.refreshSession()`.
 *
 * Why: middleware, the visibility handler, and the recovery path can all call
 * `supabase.auth.refreshSession()` concurrently. Refresh tokens are SINGLE-USE,
 * so two concurrent refreshes will rotate the same token twice and corrupt the
 * auth state with `Invalid Refresh Token: Already Used`.
 *
 * This module deduplicates in-flight refreshes per Supabase client instance.
 * The first caller triggers the actual refresh; concurrent callers receive the
 * same Promise. The Promise is dropped once it settles so future refreshes are
 * not memoised forever.
 *
 * The mutex is keyed by the client instance, so server-side and browser
 * clients don't share a slot — appropriate, since refresh tokens are scoped to
 * a session and the browser/server clients see different sessions.
 */

import { withTimeout, isTimeoutError, SUPABASE_AUTH_OP_TIMEOUT_MS } from '@/lib/util/withTimeout'
import type { AuthError, Session } from '@supabase/supabase-js'

type RefreshResult = {
  data: { session: Session | null }
  error: AuthError | null
}

// Minimal structural shape — accepts any concrete `SupabaseClient<Database>`
// generic specialisation without forcing call sites to widen their types.
type ClientWithAuthRefresh = {
  auth: {
    refreshSession: () => Promise<RefreshResult>
  }
}

const inFlight = new WeakMap<object, Promise<RefreshResult>>()

export async function coordinatedRefreshSession(
  client: ClientWithAuthRefresh,
  options: { timeoutMs?: number; label?: string } = {}
): Promise<RefreshResult> {
  const existing = inFlight.get(client as unknown as object)
  if (existing) {
    return existing
  }

  const timeoutMs = options.timeoutMs ?? SUPABASE_AUTH_OP_TIMEOUT_MS
  const label = options.label ?? 'auth.refreshSession'

  const promise = (async (): Promise<RefreshResult> => {
    try {
      const result = await withTimeout(client.auth.refreshSession(), timeoutMs, label)
      return result as RefreshResult
    } catch (error) {
      if (isTimeoutError(error)) {
        // Surface as an auth-style error so callers can route uniformly.
        return {
          data: { session: null },
          error: {
            name: 'TimeoutError',
            message: error instanceof Error ? error.message : String(error),
            status: 0,
          } as unknown as AuthError,
        }
      }
      throw error
    } finally {
      inFlight.delete(client as unknown as object)
    }
  })()

  inFlight.set(client as unknown as object, promise)
  return promise
}

/** For diagnostics / tests: whether a refresh is currently in flight for this client. */
export function isRefreshInFlight(client: ClientWithAuthRefresh): boolean {
  return inFlight.has(client as unknown as object)
}

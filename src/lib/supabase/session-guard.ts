'use client'

/**
 * Session guard — shared helpers that keep the browser session fresh and
 * recover from data-plane auth failures.
 *
 * Two jobs:
 *
 * 1. `ensureFreshSession()` — pre-flight check used by query hooks that need
 *    an authenticated session. Refreshes (via the single-flight mutex) when
 *    the session is missing/expiring. Replaces the per-hook copies that
 *    previously called `supabase.auth.refreshSession()` DIRECTLY — those
 *    bypassed `coordinatedRefreshSession` and could rotate the single-use
 *    refresh token concurrently with middleware/visibility refreshes,
 *    corrupting auth state ("Invalid Refresh Token: Already Used").
 *
 * 2. `recoverFromAuthError()` — reactive recovery wired into the global
 *    React Query cache (src/app/providers.tsx). useAuth deliberately
 *    soft-fails refresh timeouts on the assumption that "the next 401 from
 *    the data plane" drives recovery; this module is that missing listener.
 */

import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { coordinatedRefreshSession } from '@/lib/supabase/refresh-mutex'
import * as Sentry from '@sentry/nextjs'

// Refresh proactively when the session expires within this window.
const SESSION_REFRESH_BUFFER_MS = 60 * 1000

// After a recovery attempt (success or failure), block re-entry for this long
// so a burst of failed queries can't hammer the auth endpoint.
const RECOVERY_COOLDOWN_MS = 20_000

let recoveryInFlight: Promise<boolean> | null = null
let lastRecoveryAttemptAt = 0

function getErrorMessage(error: unknown): string {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message ?? '')
  }
  return String(error)
}

function getErrorCode(error: unknown): string | null {
  if (error && typeof error === 'object' && 'code' in error) {
    return String((error as { code?: unknown }).code ?? '') || null
  }
  return null
}

function getErrorStatus(error: unknown): number | null {
  if (error && typeof error === 'object') {
    const status = (error as { status?: unknown }).status
    if (typeof status === 'number') return status
  }
  return null
}

/**
 * Does this error indicate the request was rejected because the JWT/session
 * is invalid or expired? Matches PostgREST and GoTrue error shapes.
 */
export function isAuthSessionError(error: unknown): boolean {
  if (!error) return false
  const message = getErrorMessage(error)
  const code = getErrorCode(error)
  const status = getErrorStatus(error)

  if (status === 401) return true
  // PGRST301: JWT expired / could not be validated (PostgREST)
  if (code === 'PGRST301') return true

  return (
    /jwt expired/i.test(message) ||
    /invalid jwt/i.test(message) ||
    /jwt.*(invalid|expired|malformed)/i.test(message) ||
    /auth session missing/i.test(message) ||
    /invalid refresh token/i.test(message) ||
    /refresh token not found/i.test(message) ||
    /session expired/i.test(message) ||
    /not authenticated/i.test(message)
  )
}

/**
 * Ensure the browser session is present and not about to expire, refreshing
 * through the coordinated mutex when needed.
 *
 * Returns true when a valid session exists after the call, false when there
 * is no recoverable session (caller decides whether to throw).
 */
export async function ensureFreshSession(label = 'ensureFreshSession'): Promise<boolean> {
  if (typeof window === 'undefined') return false
  const supabase = getSupabaseBrowserClient()

  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError) {
      console.warn(`[session-guard] ${label}: error getting session:`, sessionError.message)
    }

    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0
    const isExpiredOrStale = !session || expiresAt < Date.now() + SESSION_REFRESH_BUFFER_MS

    if (!isExpiredOrStale) return true

    const { data: refreshData, error: refreshError } = await coordinatedRefreshSession(supabase, {
      label: `${label} (refresh)`,
    })

    if (refreshError || !refreshData.session) {
      console.warn(`[session-guard] ${label}: refresh failed:`, refreshError?.message)
      return false
    }

    return true
  } catch (error) {
    console.error(`[session-guard] ${label}: exception:`, error)
    return false
  }
}

/**
 * Reactive recovery for data-plane auth failures (401 / JWT expired / PGRST301).
 *
 * Single-flight with a cooldown: the first failing query triggers one
 * coordinated refresh; concurrent failures share the same attempt; repeated
 * failures within the cooldown are ignored (the session is genuinely dead and
 * the auth layer / sign-in flow owns that case).
 *
 * Resolves true when the session was refreshed successfully — callers should
 * then refetch the queries that failed.
 */
export function recoverFromAuthError(source: string): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false)
  if (recoveryInFlight) return recoveryInFlight
  if (Date.now() - lastRecoveryAttemptAt < RECOVERY_COOLDOWN_MS) {
    return Promise.resolve(false)
  }

  recoveryInFlight = (async () => {
    try {
      Sentry.addBreadcrumb({
        category: 'session-guard',
        level: 'warning',
        message: 'Data-plane auth error — attempting coordinated session recovery',
        data: { source, timestamp: new Date().toISOString() },
      })

      const supabase = getSupabaseBrowserClient()
      const { data, error } = await coordinatedRefreshSession(supabase, {
        label: `session-guard recovery (${source})`,
      })

      const recovered = !error && !!data.session
      console.log('[session-guard] Recovery attempt finished', {
        source,
        recovered,
        error: error?.message ?? null,
      })

      Sentry.addBreadcrumb({
        category: 'session-guard',
        level: recovered ? 'info' : 'warning',
        message: recovered
          ? 'Session recovered after data-plane auth error'
          : 'Session recovery failed after data-plane auth error',
        data: { source, error: error?.message ?? null },
      })

      return recovered
    } catch (error) {
      console.error('[session-guard] Recovery attempt threw:', error)
      return false
    } finally {
      lastRecoveryAttemptAt = Date.now()
      recoveryInFlight = null
    }
  })()

  return recoveryInFlight
}

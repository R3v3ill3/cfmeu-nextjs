'use client'

/**
 * Per-tab cache of the current user's role.
 *
 * Kept in its own module so both useUserRole (reader/writer) and useAuth
 * (clears on sign-out) can use it without a circular import.
 *
 * IMPORTANT: this cache must only be cleared on a REAL sign-out. Clearing it
 * on transient `user === null` blips (auth refresh races, getSession
 * timeouts) makes role-gated navigation vanish mid-session, which users
 * experience as "the app logged me out / lost my permissions".
 */

const STORAGE_KEY = 'cfmeu:user-role'

export function readCachedUserRole(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeCachedUserRole(role: string | null): void {
  if (typeof window === 'undefined') return
  try {
    if (role) {
      window.sessionStorage.setItem(STORAGE_KEY, role)
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY)
    }
  } catch {
    // sessionStorage can throw in private browsing — cache is best-effort
  }
}

export function clearCachedUserRole(): void {
  writeCachedUserRole(null)
}

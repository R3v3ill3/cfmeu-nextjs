/**
 * Hard Reset Utility for Auth Recovery
 * 
 * This is the "nuclear option" for when auth state becomes detached
 * and normal logout/refresh doesn't work - especially in iOS PWA.
 * 
 * It clears:
 * - All Supabase auth tokens from localStorage
 * - All sessionStorage
 * - IndexedDB databases
 * - Auth-related cookies
 * - Then forces a hard page reload to /auth
 */

import { resetSupabaseBrowserClient } from '@/lib/supabase/client'

/**
 * Nuclear reset of all auth state - use when normal logout fails.
 * This clears localStorage, sessionStorage, IndexedDB, cookies, and forces reload.
 * 
 * @returns Promise that resolves just before redirect (or rejects on error)
 */
export async function performHardReset(): Promise<void> {
  console.log('[HardReset] Starting nuclear auth reset...')

  try {
    // 1. Clear all Supabase auth tokens from localStorage
    // Supabase stores auth tokens with keys starting with 'sb-'
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('sb-') || key.includes('supabase'))) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      console.log(`[HardReset] Removing localStorage key: ${key}`)
      localStorage.removeItem(key)
    })

    // 2. Clear other app-specific localStorage items that might cause issues
    const appKeys = [
      'user-role',
      'accessible-patches',
      'geofencing-enabled',
      'admin-patch-context',
      'eba-employers-display-mode',
      'eba-employers-analytics-mode',
    ]
    appKeys.forEach(key => {
      if (localStorage.getItem(key)) {
        console.log(`[HardReset] Removing app localStorage key: ${key}`)
        localStorage.removeItem(key)
      }
    })

    // 3. Clear entire sessionStorage
    console.log('[HardReset] Clearing sessionStorage...')
    sessionStorage.clear()

    // 4. Reset the Supabase client singleton
    console.log('[HardReset] Resetting Supabase client...')
    try {
      resetSupabaseBrowserClient()
    } catch (e) {
      console.warn('[HardReset] Failed to reset Supabase client:', e)
    }

    // 5. Clear IndexedDB databases (if any)
    console.log('[HardReset] Clearing IndexedDB...')
    try {
      if ('databases' in indexedDB) {
        const databases = await indexedDB.databases()
        for (const db of databases) {
          if (db.name) {
            console.log(`[HardReset] Deleting IndexedDB: ${db.name}`)
            indexedDB.deleteDatabase(db.name)
          }
        }
      }
    } catch (e) {
      console.warn('[HardReset] Failed to clear IndexedDB:', e)
    }

    // 6. Clear cookies by setting expiry in the past
    console.log('[HardReset] Clearing cookies...')
    try {
      document.cookie.split(';').forEach(cookie => {
        const name = cookie.trim().split('=')[0]
        if (name) {
          // Clear for current path
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`
          // Also try clearing for root path
          document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;domain=${window.location.hostname}`
        }
      })
    } catch (e) {
      console.warn('[HardReset] Failed to clear cookies:', e)
    }

    // 7. Unregister any service workers that might be caching auth state
    console.log('[HardReset] Unregistering service workers...')
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        for (const registration of registrations) {
          console.log(`[HardReset] Unregistering service worker: ${registration.scope}`)
          await registration.unregister()
        }
      }
    } catch (e) {
      console.warn('[HardReset] Failed to unregister service workers:', e)
    }

    console.log('[HardReset] Reset complete, redirecting to /auth...')

    // 8. Force hard reload to /auth (bypasses all React state)
    // Use replace so user can't go "back" to broken state
    window.location.replace('/auth?reset=1')

  } catch (error) {
    console.error('[HardReset] Error during reset:', error)
    // Even if something fails, try to redirect
    window.location.replace('/auth?reset=1')
    throw error
  }
}

/**
 * Check if we just came from a hard reset
 * Can be used to show a "App has been reset" message
 */
export function wasHardReset(): boolean {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  return params.get('reset') === '1'
}

/**
 * Clear the reset flag from URL (call after showing reset message)
 */
export function clearResetFlag(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('reset')
  window.history.replaceState({}, '', url.toString())
}


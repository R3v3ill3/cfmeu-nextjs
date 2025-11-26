'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null
const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

type SupabaseResetListener = () => void
const resetListeners: SupabaseResetListener[] = []

export function registerSupabaseResetListener(listener: SupabaseResetListener) {
  resetListeners.push(listener)
}

/**
 * Exponential backoff retry helper
 */
async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Get or create Supabase browser client (singleton pattern)
 * 
 * NOTE: Health checks have been removed to prevent contention with auth operations.
 * The Supabase client handles its own connection management internally, and
 * onAuthStateChange provides real-time session updates.
 */
export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient<Database>> {
  if (browserClient) {
    return browserClient
  }
  
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    // Dev-only fallback
    browserClient = createBrowserClient<Database>('http://localhost', 'public-anon-key')
    return browserClient
  }
  
  console.log('[SupabaseClient] Creating new browser client', {
    url: url.substring(0, 30) + '...', // Log partial URL for security
    timestamp: new Date().toISOString(),
  })
  
  browserClient = createBrowserClient<Database>(url, key)
  return browserClient
}

/**
 * Reset Supabase browser client and notify listeners
 * 
 * ⚠️ WARNING: DO NOT call this from React components!
 * Resetting the client destroys the auth state and subscription listeners,
 * causing users to be logged out unexpectedly.
 * 
 * This should only be used in extreme circumstances (e.g., manual recovery tools).
 * For query timeouts, simply let React Query retry - don't reset the client.
 */
export function resetSupabaseBrowserClient(): void {
  console.log('[SupabaseClient] Resetting browser client', {
    timestamp: new Date().toISOString(),
  })
  
  // Force recreation of the browser client on next access
  browserClient = null
  
  resetListeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('[SupabaseClient] Reset listener error:', error)
    }
  })
}

/**
 * Execute a query with automatic retry and exponential backoff
 * 
 * Use this for critical operations that should be retried on transient failures.
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation',
  maxAttempts: number = MAX_RETRY_ATTEMPTS
): Promise<T> {
  let lastError: unknown
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const startTime = Date.now()
      const result = await operation()
      const duration = Date.now() - startTime
      
      if (attempt > 1) {
        console.log(`[SupabaseClient] ${operationName} succeeded after ${attempt} attempts`, {
          duration,
          timestamp: new Date().toISOString(),
        })
      }
      
      return result
    } catch (error) {
      lastError = error
      const isTimeout = error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('ETIMEDOUT') ||
        (error as any).code === 'ETIMEDOUT'
      )
      const isNetworkError = error instanceof Error && (
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        error.message.includes('Failed to fetch')
      )
      
      if (attempt < maxAttempts && (isTimeout || isNetworkError)) {
        const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt - 1)
        console.warn(`[SupabaseClient] ${operationName} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {
          error: error instanceof Error ? error.message : String(error),
          isTimeout,
          isNetworkError,
          timestamp: new Date().toISOString(),
        })
        
        await sleep(delay)
      } else {
        console.error(`[SupabaseClient] ${operationName} failed after ${attempt} attempts`, {
          error: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        })
        throw error
      }
    }
  }
  
  throw lastError
}

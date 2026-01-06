'use client'

import { createBrowserClient } from '@supabase/ssr'
import * as Sentry from '@sentry/nextjs'
import type { Database } from '@/types/database'
import { connectionMonitor, trackConnection, releaseConnection, recordConnectionError } from '@/lib/db-connection-monitor'

let browserClient: (ReturnType<typeof createBrowserClient<Database>> & { __connectionId?: string }) | null = null
const MAX_RETRY_ATTEMPTS = 3
const INITIAL_RETRY_DELAY = 1000 // 1 second

type SupabaseResetListener = () => void
const resetListeners: SupabaseResetListener[] = []

export function registerSupabaseResetListener(listener: SupabaseResetListener) {
  resetListeners.push(listener)
}

const shouldLogVerbose = process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true' || process.env.NODE_ENV !== 'production'

function logSupabaseEvent(message: string, data?: Record<string, unknown>) {
  if (process.env.NODE_ENV !== 'test' && shouldLogVerbose) {
    console.log(`[SupabaseClient] ${message}`, {
      ...data,
      timestamp: new Date().toISOString(),
    })
  }
  if (typeof window !== 'undefined') {
    Sentry.addBreadcrumb({
      category: 'supabase-client',
      message,
      level: 'info',
      data,
    })
  }
}

function logSupabaseError(message: string, error: unknown, data?: Record<string, unknown>) {
  const normalized = error instanceof Error ? error : new Error(String(error))
  console.error(`[SupabaseClient] ${message}`, {
    ...data,
    error: normalized.message,
  })
  if (typeof window !== 'undefined') {
    Sentry.captureException(normalized, {
      tags: { component: 'supabase-browser-client' },
      extra: data,
    })
  }
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
    if (process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true') {
      logSupabaseEvent('Reusing existing browser client')
    }
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
  
  logSupabaseEvent('Creating new browser client', {
    urlPrefix: url.substring(0, 30),
  })

  browserClient = createBrowserClient<Database>(url, key)

  // Track connection for monitoring
  const connectionId = trackConnection('browser-client')

  // Add connection monitoring hooks
  browserClient.__connectionId = connectionId

  // Wrap key methods for monitoring
  const originalFrom = browserClient.from
  browserClient.from = function(...args: any[]) {
    try {
      const result = originalFrom.apply(this, args)
      // Monitor query execution
      const originalThen = result.then
      result.then = function(onFulfilled: any, onRejected: any) {
        return originalThen.call(this,
          (data: any) => {
            try {
              if (data?.error) {
                recordConnectionError('browser-client', data.error, `from(${args[0]})`)
              }
            } catch (e) {
              // Ignore monitoring errors
            }
            return onFulfilled ? onFulfilled(data) : data
          },
          (error: any) => {
            try {
              recordConnectionError('browser-client', error, `from(${args[0]})`)
            } catch (e) {
              // Ignore monitoring errors
            }
            return onRejected ? onRejected(error) : error
          }
        )
      }
      return result
    } catch (error) {
      recordConnectionError('browser-client', error as Error, `from(${args[0]})`)
      throw error
    }
  }

  // Track auth operations
  const originalAuth = browserClient.auth
  if (originalAuth && typeof originalAuth.getUser === 'function') {
    const originalGetUser = originalAuth.getUser
    originalAuth.getUser = function(...args: any[]) {
      try {
        const result = originalGetUser.apply(this, args)
        const originalThen = result.then
        result.then = function(onFulfilled: any, onRejected: any) {
          return originalThen.call(this,
            (data: any) => {
              try {
                if (data?.error) {
                  recordConnectionError('browser-client', data.error, 'auth.getUser()')
                }
              } catch (e) {
                // Ignore monitoring errors
              }
              return onFulfilled ? onFulfilled(data) : data
            },
            (error: any) => {
              try {
                recordConnectionError('browser-client', error, 'auth.getUser()')
              } catch (e) {
                // Ignore monitoring errors
              }
              return onRejected ? onRejected(error) : error
            }
          )
        }
        return result
      } catch (error) {
        recordConnectionError('browser-client', error as Error, 'auth.getUser()')
        throw error
      }
    }
  }

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
  logSupabaseEvent('Resetting browser client')

  // Release connection from monitoring
  if (browserClient && browserClient.__connectionId) {
    releaseConnection('browser-client', browserClient.__connectionId)
  }

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
        logSupabaseEvent(`${operationName} succeeded`, {
          attempts: attempt,
          duration,
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
        logSupabaseEvent(`${operationName} failed, scheduling retry`, {
          attempt,
          maxAttempts,
          delay,
          error: error instanceof Error ? error.message : String(error),
          isTimeout,
          isNetworkError,
        })
        
        await sleep(delay)
      } else {
        logSupabaseError(`${operationName} failed`, error, {
          attempt,
          maxAttempts,
        })
        throw error
      }
    }
  }
  
  throw lastError
}

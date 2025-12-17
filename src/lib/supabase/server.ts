import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions, type SupabaseClient } from '@supabase/ssr'
import type { Database } from '@/types/database'
import { trackConnection, releaseConnection, recordConnectionError } from '@/lib/db-connection-monitor'

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const shouldUseSecureCookies = process.env.NODE_ENV === 'production'

  // Track server connection
  const connectionId = trackConnection('server-client')

  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      recordConnectionError('server-client', 'Missing Supabase environment variables', 'client-creation')
      throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).')
    }
    // Development fallback only
    const client = createServerClient<Database>(
      'http://localhost',
      'public-anon-key',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options, path: '/' })
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options, path: '/' })
            } catch {}
          },
        },
      }
    )

    // Add connection ID for tracking
    ;(client as any).__connectionId = connectionId
    return client
  }

  const client = createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // iOS Safari ITP requires secure cookies and proper sameSite handling
            // Using 'lax' for first-party context which is compatible with most browsers
            // In production (HTTPS), secure cookies are required for auth.
            // In local dev (HTTP), secure cookies will not persist, breaking refresh tokens.
            cookieStore.set({
              name,
              value,
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: shouldUseSecureCookies,
            })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, path: '/' })
          } catch {}
        },
      },
    }
  )

  // Add connection ID for tracking and wrap methods for monitoring
  ;(client as any).__connectionId = connectionId

  // Wrap key methods for monitoring
  const originalFrom = client.from
  client.from = function(table: string) {
    try {
      const query = originalFrom.call(this, table)

      // Monitor query execution
      const originalThen = query.then || Promise.prototype.then
      query.then = function(onFulfilled: any, onRejected: any) {
        return originalThen.call(this,
          (data: any) => {
            try {
              if (data?.error) {
                recordConnectionError('server-client', data.error, `from(${table})`)
              }
            } catch (e) {
              // Ignore monitoring errors
            }
            return onFulfilled ? onFulfilled(data) : data
          },
          (error: any) => {
            try {
              recordConnectionError('server-client', error, `from(${table})`)
            } catch (e) {
              // Ignore monitoring errors
            }
            return onRejected ? onRejected(error) : error
          }
        )
      }
      return query
    } catch (error) {
      recordConnectionError('server-client', error as Error, `from(${table})`)
      throw error
    }
  }

  return client
}

/**
 * Helper function to clean up server connections
 */
export function releaseServerConnection(client: SupabaseClient<Database>): void {
  const connectionId = (client as any).__connectionId
  if (connectionId) {
    releaseConnection('server-client', connectionId)
  }
}


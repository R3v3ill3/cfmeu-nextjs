import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

type Database = any

let cachedServiceClient: SupabaseClient<Database> | null = null

// Import connection monitoring (will be available in production)
let connectionMonitor: any = null
try {
  connectionMonitor = require('../../../../src/lib/db-connection-monitor')
} catch (error) {
  // Connection monitor not available in worker environment
}

export function getServiceRoleClient() {
  if (!cachedServiceClient) {
    // Track connection if monitor is available
    let connectionId: string | undefined
    if (connectionMonitor) {
      connectionId = connectionMonitor.trackConnection('dashboard-worker')
    }

    cachedServiceClient = createClient<Database>(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: { persistSession: false },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'cfmeu-dashboard-worker'
          }
        }
      }
    )

    // Store connection ID for tracking
    ;(cachedServiceClient as any).__connectionId = connectionId

    // Add error tracking if monitor is available
    if (connectionMonitor) {
      const originalFrom = cachedServiceClient.from
      cachedServiceClient.from = function(table: string) {
        try {
          const query = originalFrom.call(this, table)

          // Track query errors
          const originalThen = query.then || Promise.prototype.then
          query.then = function(onFulfilled: any, onRejected: any) {
            return originalThen.call(this,
              (data: any) => {
                try {
                  if (data?.error) {
                    connectionMonitor.recordConnectionError('dashboard-worker', data.error, `from(${table})`)
                  }
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onFulfilled ? onFulfilled(data) : data
              },
              (error: any) => {
                try {
                  connectionMonitor.recordConnectionError('dashboard-worker', error, `from(${table})`)
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onRejected ? onRejected(error) : error
              }
            )
          }
          return query
        } catch (error) {
          connectionMonitor.recordConnectionError('dashboard-worker', error as Error, `from(${table})`)
          throw error
        }
      }
    }
  }
  return cachedServiceClient
}

// Add cleanup function for graceful shutdown
export function closeServiceRoleClient() {
  if (cachedServiceClient) {
    // Release connection from monitoring
    if (connectionMonitor && cachedServiceClient.__connectionId) {
      connectionMonitor.releaseConnection('dashboard-worker', cachedServiceClient.__connectionId)
    }

    // Supabase client doesn't have explicit close, but clear reference
    cachedServiceClient = null
  }
}

/**
 * Create a Supabase client for a user based on their JWT token.
 * 
 * IMPORTANT: We use the service role key with auth.persistSession=false and manually
 * validate the JWT. This is because:
 * 1. Setting JWT in global.headers doesn't work for auth.getUser()
 * 2. setSession() requires a refresh_token which we don't have in this context
 * 3. The service role client can query any data, but we validate permissions separately
 */
export function getUserClientFromToken(jwt: string) {
  // Use service role client for queries, but we'll validate the JWT separately in ensureAuthorizedUser
  const client = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  return client
}

/**
 * Verify and decode a JWT token using the service role client.
 * Returns the user data if valid, throws if invalid.
 */
export async function verifyJWT(jwt: string) {
  const serviceClient = getServiceRoleClient()
  
  // Use service role to verify the JWT by calling auth.getUser with the token
  const { data, error } = await serviceClient.auth.getUser(jwt)
  
  if (error || !data?.user) {
    throw new Error('Invalid or expired token')
  }
  
  return data.user
}

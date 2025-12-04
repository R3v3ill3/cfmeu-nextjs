import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

type Database = any

let cachedClient: SupabaseClient<Database> | null = null

// Import connection monitoring (will be available in production)
let connectionMonitor: any = null
try {
  connectionMonitor = require('../../../../src/lib/db-connection-monitor')
} catch (error) {
  // Connection monitor not available in worker environment
}

export function getAdminClient() {
  if (!cachedClient) {
    // Track connection if monitor is available
    let connectionId: string | undefined
    if (connectionMonitor) {
      connectionId = connectionMonitor.trackConnection('scraper-worker')
    }

    cachedClient = createClient<Database>(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: {
          persistSession: false,
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'cfmeu-scraper-worker'
          }
        }
      }
    )

    // Store connection ID for tracking
    ;(cachedClient as any).__connectionId = connectionId

    // Add error tracking if monitor is available
    if (connectionMonitor) {
      const originalFrom = cachedClient.from
      cachedClient.from = function(table: string) {
        try {
          const query = originalFrom.call(this, table)

          // Track query errors
          const originalThen = query.then || Promise.prototype.then
          query.then = function(onFulfilled: any, onRejected: any) {
            return originalThen.call(this,
              (data: any) => {
                try {
                  if (data?.error) {
                    connectionMonitor.recordConnectionError('scraper-worker', data.error, `from(${table})`)
                  }
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onFulfilled ? onFulfilled(data) : data
              },
              (error: any) => {
                try {
                  connectionMonitor.recordConnectionError('scraper-worker', error, `from(${table})`)
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onRejected ? onRejected(error) : error
              }
            )
          }
          return query
        } catch (error) {
          connectionMonitor.recordConnectionError('scraper-worker', error as Error, `from(${table})`)
          throw error
        }
      }
    }
  }
  return cachedClient
}

// Add cleanup function for graceful shutdown
export function closeAdminClient() {
  if (cachedClient) {
    // Release connection from monitoring
    if (connectionMonitor && cachedClient.__connectionId) {
      connectionMonitor.releaseConnection('scraper-worker', cachedClient.__connectionId)
    }

    // Supabase client doesn't have explicit close, but clear reference
    cachedClient = null
  }
}

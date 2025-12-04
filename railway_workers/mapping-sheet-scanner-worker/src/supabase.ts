import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

let adminClientInstance: SupabaseClient<any> | null = null

// Import connection monitoring (will be available in production)
let connectionMonitor: any = null
try {
  connectionMonitor = require('../../../../src/lib/db-connection-monitor')
} catch (error) {
  // Connection monitor not available in worker environment
}

export function getAdminClient(): SupabaseClient<any> {
  if (!adminClientInstance) {
    // Track connection if monitor is available
    let connectionId: string | undefined
    if (connectionMonitor) {
      connectionId = connectionMonitor.trackConnection('scanner-worker')
    }

    adminClientInstance = createClient(
      config.supabaseUrl,
      config.supabaseServiceKey,
      {
        auth: { persistSession: false },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-application-name': 'mapping-sheet-scanner-worker'
          }
        },
        // Supabase JS uses REST API (not persistent connections)
        // Connection pooling is handled by Supabase's edge functions
        // This singleton pattern ensures we reuse the HTTP client across requests
      }
    )

    // Store connection ID for tracking
    ;(adminClientInstance as any).__connectionId = connectionId

    console.log('[supabase] Admin client initialized (singleton pattern, REST API)')

    // Add error tracking if monitor is available
    if (connectionMonitor) {
      const originalFrom = adminClientInstance.from
      adminClientInstance.from = function(table: string) {
        try {
          const query = originalFrom.call(this, table)

          // Track query errors
          const originalThen = query.then || Promise.prototype.then
          query.then = function(onFulfilled: any, onRejected: any) {
            return originalThen.call(this,
              (data: any) => {
                try {
                  if (data?.error) {
                    connectionMonitor.recordConnectionError('scanner-worker', data.error, `from(${table})`)
                  }
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onFulfilled ? onFulfilled(data) : data
              },
              (error: any) => {
                try {
                  connectionMonitor.recordConnectionError('scanner-worker', error, `from(${table})`)
                } catch (e) {
                  // Ignore monitoring errors
                }
                return onRejected ? onRejected(error) : error
              }
            )
          }
          return query
        } catch (error) {
          connectionMonitor.recordConnectionError('scanner-worker', error as Error, `from(${table})`)
          throw error
        }
      }
    }
  }
  return adminClientInstance
}

// Add cleanup function for graceful shutdown
export function closeAdminClient() {
  if (adminClientInstance) {
    // Release connection from monitoring
    if (connectionMonitor && adminClientInstance.__connectionId) {
      connectionMonitor.releaseConnection('scanner-worker', adminClientInstance.__connectionId)
    }

    // Supabase client doesn't have explicit close, but clear reference
    adminClientInstance = null
  }
}

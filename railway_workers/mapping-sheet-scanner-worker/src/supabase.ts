import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

let adminClientInstance: SupabaseClient<any> | null = null

export function getAdminClient(): SupabaseClient<any> {
  if (!adminClientInstance) {
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
        }
      }
    )
  }
  return adminClientInstance
}

// Add cleanup function for graceful shutdown
export function closeAdminClient() {
  if (adminClientInstance) {
    // Supabase client doesn't have explicit close, but clear reference
    adminClientInstance = null
  }
}

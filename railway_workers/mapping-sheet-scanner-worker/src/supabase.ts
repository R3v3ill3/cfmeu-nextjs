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
        },
        // Supabase JS uses REST API (not persistent connections)
        // Connection pooling is handled by Supabase's edge functions
        // This singleton pattern ensures we reuse the HTTP client across requests
      }
    )
    console.log('[supabase] Admin client initialized (singleton pattern, REST API)')
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

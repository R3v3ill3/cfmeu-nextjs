import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

type Database = any

let cachedClient: SupabaseClient<Database> | null = null

export function getAdminClient() {
  if (!cachedClient) {
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
  }
  return cachedClient
}

// Add cleanup function for graceful shutdown
export function closeAdminClient() {
  if (cachedClient) {
    // Supabase client doesn't have explicit close, but clear reference
    cachedClient = null
  }
}

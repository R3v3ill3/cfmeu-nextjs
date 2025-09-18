import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

type Database = any

let cachedClient: SupabaseClient<Database> | null = null

export function getAdminClient() {
  if (!cachedClient) {
    cachedClient = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
      auth: {
        persistSession: false,
      },
    })
  }
  return cachedClient
}

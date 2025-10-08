import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

type Database = any

let cachedServiceClient: SupabaseClient<Database> | null = null

export function getServiceRoleClient() {
  if (!cachedServiceClient) {
    cachedServiceClient = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
      auth: { persistSession: false },
    })
  }
  return cachedServiceClient
}

export function getUserClientFromToken(jwt: string) {
  const client = createClient<Database>(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  return client
}

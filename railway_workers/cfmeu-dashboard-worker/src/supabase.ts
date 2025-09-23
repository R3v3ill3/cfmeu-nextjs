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
  // Use anon key behavior by passing no key, then attach Authorization via global header
  const client = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  return client
}

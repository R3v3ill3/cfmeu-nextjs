import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { config } from './config'

export function getAdminClient(): SupabaseClient<any> {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

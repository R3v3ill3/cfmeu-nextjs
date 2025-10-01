import { createClient } from '@supabase/supabase-js'
import { config } from './config'

export function getAdminClient() {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

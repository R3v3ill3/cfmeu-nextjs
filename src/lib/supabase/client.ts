'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

type GenericDatabase = any
let browserClient: SupabaseClient<GenericDatabase> | null = null

export function getSupabaseBrowserClient(): SupabaseClient<GenericDatabase> {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    // Defer actual network usage until runtime; create a client with empty strings to avoid build-time throws.
    browserClient = createBrowserClient('http://localhost', 'public-anon-key')
    return browserClient
  }
  browserClient = createBrowserClient(url, key)
  return browserClient
}


'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null

type SupabaseResetListener = () => void
const resetListeners: SupabaseResetListener[] = []

export function registerSupabaseResetListener(listener: SupabaseResetListener) {
  resetListeners.push(listener)
}

export function getSupabaseBrowserClient(): ReturnType<typeof createBrowserClient<Database>> {
  if (browserClient) return browserClient
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    // Dev-only fallback
    browserClient = createBrowserClient<Database>('http://localhost', 'public-anon-key')
    return browserClient
  }
  browserClient = createBrowserClient<Database>(url, key)
  return browserClient
}

export function resetSupabaseBrowserClient(): void {
  // Force recreation of the browser client on next access
  browserClient = null
  resetListeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('Supabase reset listener error', error)
    }
  })
}


'use client'

// Shim to satisfy copied imports from the source repo.
// Prefer using getSupabaseBrowserClient() from @/lib/supabase/client directly in new code.
import { getSupabaseBrowserClient, registerSupabaseResetListener } from '@/lib/supabase/client'
import type { Database } from '@/types/database'
import type { SupabaseClient } from '@supabase/supabase-js'

export let supabase: SupabaseClient<Database> = getSupabaseBrowserClient()

export function refreshSupabaseClient() {
  supabase = getSupabaseBrowserClient()
}

registerSupabaseResetListener(() => {
  supabase = getSupabaseBrowserClient()
})


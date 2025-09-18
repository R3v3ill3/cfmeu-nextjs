'use client'

// Shim to satisfy copied imports from the source repo.
// Prefer using getSupabaseBrowserClient() from @/lib/supabase/client directly in new code.
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export let supabase = getSupabaseBrowserClient()

export function refreshSupabaseClient() {
  supabase = getSupabaseBrowserClient()
}


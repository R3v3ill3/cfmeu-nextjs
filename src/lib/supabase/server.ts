import { cookies } from 'next/headers'
import { createServerClient, type CookieOptions, type SupabaseClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

export async function createServerSupabase(): Promise<SupabaseClient<Database>> {
  const cookieStore = await cookies()
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Missing Supabase environment variables. Please set SUPABASE_URL and SUPABASE_ANON_KEY (or NEXT_PUBLIC_* equivalents).')
    }
    // Development fallback only
    return createServerClient<Database>(
      'http://localhost',
      'public-anon-key',
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value, ...options, path: '/' })
            } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options, path: '/' })
            } catch {}
          },
        },
      }
    )
  }
  return createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // iOS Safari ITP requires secure cookies and proper sameSite handling
            // Using 'lax' for first-party context which is compatible with most browsers
            // Always set secure=true for auth cookies to prevent ITP issues
            cookieStore.set({ 
              name, 
              value, 
              ...options, 
              path: '/',
              sameSite: 'lax',
              secure: true, // Always secure for auth cookies (fixes iOS Safari ITP)
            })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options, path: '/' })
          } catch {}
        },
      },
    }
  )
}


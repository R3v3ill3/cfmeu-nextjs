'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { AppRole } from '@/constants/roles'

export interface UserProfile {
  id: string
  role: AppRole | null
  full_name?: string | null
  email?: string | null
}

interface UseUserProfileResult {
  profile: UserProfile | null
  loading: boolean
  error: Error | null
}

export function useUserProfile(): UseUserProfileResult {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      try {
        setLoading(true)
        const supabase = getSupabaseBrowserClient()
        const {
          data: { user },
          error: authError
        } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) {
          if (!cancelled) setProfile(null)
          return
        }

        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('id, role, full_name, email')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) throw profileError

        if (!cancelled) {
          setProfile(
            data
              ? {
                  id: data.id,
                  role: (data.role as AppRole) ?? null,
                  full_name: data.full_name,
                  email: data.email
                }
              : null
          )
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProfile()

    return () => {
      cancelled = true
    }
  }, [])

  return { profile, loading, error }
}

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { supabase } from "@/integrations/supabase/client"

interface UseUserRoleResult {
  role: string | null
  isLoading: boolean
  isFetching: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

const STORAGE_KEY = "cfmeu:user-role"

/**
 * Centralized hook for fetching and caching user role.
 * Uses React Query to ensure consistent role data across all components
 * and eliminate race conditions in navigation rendering.
 */
export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth()
  const [cachedRole, setCachedRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return null
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    return stored ? stored : null
  })

  useEffect(() => {
    if (!user?.id) {
      setCachedRole(null)
      if (typeof window !== "undefined") {
        window.sessionStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [user?.id])

  const query = useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes - role changes are rare
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 1,
    queryFn: async () => {
      if (!user?.id) return null

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single()

      if (error) {
        console.error("Error fetching user role:", error)
        throw error
      }

      return (profile?.role as string | null) || null
    },
    onSuccess: (role) => {
      const normalized = role ?? null
      setCachedRole(normalized)
      if (typeof window !== "undefined") {
        if (normalized) {
          window.sessionStorage.setItem(STORAGE_KEY, normalized)
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY)
        }
      }
    },
  })

  const role = query.data ?? cachedRole ?? null
  const isLoading = query.isLoading && !cachedRole

  return useMemo(() => ({
    role,
    isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }), [role, isLoading, query.isFetching, query.error, query.refetch])
}

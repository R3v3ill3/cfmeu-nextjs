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
    retry: (failureCount, error) => {
      // Retry up to 3 times for network/timeout errors
      if (failureCount >= 3) return false;
      
      const isRetryable = error instanceof Error && (
        error.message.includes('timeout') ||
        error.message.includes('network') ||
        error.message.includes('fetch') ||
        (error as any).code === 'ETIMEDOUT' ||
        (error as any).code === 'PGRST116' // PostgREST connection error
      );
      
      if (isRetryable) {
        console.log(`[useUserRole] Retrying role fetch (attempt ${failureCount + 1}/3)`, {
          userId: user?.id,
          error: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
      
      return false;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 1s, 2s, 4s
      return Math.min(1000 * Math.pow(2, attemptIndex), 4000);
    },
    queryFn: async () => {
      if (!user?.id) {
        console.log('[useUserRole] No user ID, returning null');
        return null;
      }

      const startTime = Date.now();
      console.log('[useUserRole] Fetching role for user', { userId: user.id });
      
      try {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()

        const duration = Date.now() - startTime;

        if (error) {
          console.error("[useUserRole] Error fetching user role:", {
            error,
            errorCode: error.code,
            errorMessage: error.message,
            userId: user.id,
            duration,
            timestamp: new Date().toISOString(),
          });
          throw error;
        }

        const role = (profile?.role as string | null) || null;
        console.log('[useUserRole] Role fetched successfully', {
          userId: user.id,
          role,
          duration,
          cached: !!cachedRole,
        });

        return role;
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error('[useUserRole] Exception in queryFn:', {
          error,
          userId: user.id,
          duration,
          errorMessage: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        });
        throw error;
      }
    },
    onSuccess: (role) => {
      const normalized = role ?? null;
      const previousRole = cachedRole;
      setCachedRole(normalized);
      
      if (typeof window !== "undefined") {
        if (normalized) {
          window.sessionStorage.setItem(STORAGE_KEY, normalized);
        } else {
          window.sessionStorage.removeItem(STORAGE_KEY);
        }
      }
      
      if (previousRole !== normalized) {
        console.log('[useUserRole] Role updated', {
          previousRole,
          newRole: normalized,
          timestamp: new Date().toISOString(),
        });
      }
    },
    onError: (error) => {
      console.error('[useUserRole] Query error:', {
        error,
        userId: user?.id,
        cachedRole,
        errorMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      });
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

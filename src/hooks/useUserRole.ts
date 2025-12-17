import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { useHelpContext } from "@/context/HelpContext"
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
 * 
 * Respects server-provided role from HelpContext initially to prevent
 * race conditions on initial page load.
 */
export function useUserRole(): UseUserRoleResult {
  const { user } = useAuth()
  const { scope } = useHelpContext()
  const serverProvidedRole = scope.role
  
  const [cachedRole, setCachedRole] = useState<string | null>(() => {
    if (typeof window === "undefined") return serverProvidedRole ?? null
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    // Prefer server-provided role over cached if available
    return serverProvidedRole ?? (stored ? stored : null)
  })

  // Update cached role when server-provided role changes
  useEffect(() => {
    if (serverProvidedRole && serverProvidedRole !== cachedRole) {
      console.log('[useUserRole] Updating from server-provided role:', {
        previousRole: cachedRole,
        newRole: serverProvidedRole,
        timestamp: new Date().toISOString(),
      });
      setCachedRole(serverProvidedRole);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(STORAGE_KEY, serverProvidedRole);
      }
    }
  }, [serverProvidedRole, cachedRole]);

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
    // Use server-provided role as initial data to prevent flash of wrong role
    initialData: serverProvidedRole ?? undefined,
    retry: (failureCount, error) => {
      // Retry up to 5 times for RLS/auth errors that might be transient
      if (failureCount >= 5) return false;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      
      const isRetryable = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('row-level security') ||
        errorMessage.includes('RLS') ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'PGRST116' || // PostgREST connection error
        errorCode === 'PGRST301' || // PostgREST not found (might be RLS)
        errorCode === '42501'; // PostgreSQL permission denied
      
      if (isRetryable) {
        console.log(`[useUserRole] Retrying role fetch (attempt ${failureCount + 1}/5)`, {
          userId: user?.id,
          error: errorMessage,
          errorCode,
        });
        return true;
      }
      
      return false;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 500ms, 1s, 2s, 4s, 8s
      // Faster initial retries for transient RLS issues
      return Math.min(500 * Math.pow(2, attemptIndex), 8000);
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
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'B',location:'src/hooks/useUserRole.ts:onError',message:'useUserRole query error',data:{userIdSuffix:(user?.id??'').slice(-6),cachedRole,errorMessage:error instanceof Error?error.message:String(error),errorCode:(error as any)?.code??null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    },
  })

  // Prefer query data, then cached role, then server-provided role
  const role = query.data ?? cachedRole ?? serverProvidedRole ?? null
  // Don't show loading if we have a cached or server-provided role
  const isLoading = query.isLoading && !cachedRole && !serverProvidedRole

  return useMemo(() => ({
    role,
    isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  }), [role, isLoading, query.isFetching, query.error, query.refetch])
}

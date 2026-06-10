import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useAuth } from "@/hooks/useAuth"
import { useHelpContext } from "@/context/HelpContext"
import { supabase } from "@/integrations/supabase/client"
import { readCachedUserRole, writeCachedUserRole } from "@/lib/auth/role-cache"
import * as Sentry from "@sentry/nextjs"

interface UseUserRoleResult {
  role: string | null
  isLoading: boolean
  isFetching: boolean
  error: unknown
  refetch: () => Promise<unknown>
}

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
  
  const lastUserIdRef = useRef<string | null>(null)
  const [cachedRole, setCachedRole] = useState<string | null>(() => {
    // Prefer server-provided role over cached if available
    return serverProvidedRole ?? readCachedUserRole()
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
      writeCachedUserRole(serverProvidedRole);
    }
  }, [serverProvidedRole, cachedRole]);

  // NOTE: we deliberately do NOT clear the cached role when `user` becomes
  // transiently null — auth refresh races and getSession timeouts briefly
  // null the user, and clearing here made role-gated navigation vanish
  // mid-session. The cache is cleared on real sign-out by useAuth
  // (signOut() / SIGNED_OUT event) via clearCachedUserRole().
  useEffect(() => {
    lastUserIdRef.current = user?.id ?? null
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
  })

  // Persist the fetched role to the per-tab cache.
  // (React Query v5 removed per-query onSuccess/onError callbacks — the
  // previous implementation passed them as options and they were silently
  // ignored, so the sessionStorage cache was never actually written.)
  useEffect(() => {
    if (query.data === undefined) return
    const normalized = (query.data as string | null) ?? null
    setCachedRole((previousRole) => {
      if (previousRole !== normalized) {
        console.log('[useUserRole] Role updated', {
          previousRole,
          newRole: normalized,
          timestamp: new Date().toISOString(),
        })
      }
      return normalized
    })
    writeCachedUserRole(normalized)
  }, [query.data])

  // Capture a low-volume, high-signal event in production for session/permission loss.
  // Avoid capturing every transient network error.
  useEffect(() => {
    const error = query.error
    if (!error) return

    console.error('[useUserRole] Query error:', {
      error,
      userId: user?.id,
      cachedRole,
      errorMessage: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    });
    try {
      const errorMessage = error instanceof Error ? error.message : String(error)
      const errorCode = (error as any)?.code ?? null
      const shouldCapture =
        errorCode === 'PGRST116' ||
        errorCode === 'PGRST301' ||
        errorCode === '42501' ||
        (typeof errorMessage === 'string' &&
          (errorMessage.includes('Auth session missing') ||
            errorMessage.includes('JWT') ||
            errorMessage.includes('row-level security') ||
            errorMessage.includes('permission denied')))

      if (shouldCapture) {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'useUserRole')
          if (errorCode) scope.setTag('supabase_code', String(errorCode))
          scope.setExtra('path', typeof window !== 'undefined' ? window.location?.pathname : null)
          scope.setExtra('userIdSuffix', user?.id ? user.id.slice(-6) : null)
          scope.setExtra('cachedRole', cachedRole)
          scope.setExtra('serverProvidedRole', serverProvidedRole ?? null)
          scope.setExtra('errorMessage', errorMessage)
          Sentry.captureMessage('[Auth] useUserRole query error')
        })
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.error])

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

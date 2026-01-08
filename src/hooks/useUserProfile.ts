'use client';
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { QUERY_TIMEOUTS, withTimeout } from "@/lib/withTimeout";
import { useAuth } from "./useAuth";

export interface UserProfileRecord {
  id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
  apple_email: string | null;
  phone: string | null;
}

export const CURRENT_USER_PROFILE_QUERY_KEY = ["current-user-profile"] as const;

// How far in advance to refresh the session (1 minute before expiry)
const SESSION_REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Helper to ensure the session is valid before making an authenticated query.
 * If the session is expired or about to expire, it proactively refreshes it.
 * Returns true if session is valid and query can proceed, false if session recovery failed.
 */
async function ensureValidSession(): Promise<boolean> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('[useUserProfile] Error getting session:', sessionError.message);
    }
    
    // Check if session is missing or expired/about to expire
    const now = Date.now();
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const isExpiredOrStale = !session || expiresAt < now + SESSION_REFRESH_BUFFER_MS;
    
    if (isExpiredOrStale) {
      console.log('[useUserProfile] Session expired or stale, attempting refresh', {
        hasSession: !!session,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
        now: new Date(now).toISOString(),
      });
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('[useUserProfile] Session refresh failed:', refreshError.message);
        return false;
      }
      
      if (!refreshData.session) {
        console.error('[useUserProfile] Session refresh returned no session');
        return false;
      }
      
      console.log('[useUserProfile] Session refreshed successfully', {
        userId: refreshData.session.user?.id?.slice(-6),
        newExpiresAt: refreshData.session.expires_at 
          ? new Date(refreshData.session.expires_at * 1000).toISOString() 
          : null,
      });
    }
    
    return true;
  } catch (error) {
    console.error('[useUserProfile] Exception in ensureValidSession:', error);
    return false;
  }
}

export function useUserProfile(staleTime = 5 * 60 * 1000) {
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const userId = session?.user?.id;

  const query = useQuery<UserProfileRecord | null>({
    queryKey: [...CURRENT_USER_PROFILE_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime,
    refetchOnWindowFocus: false,
    // Retry on auth/RLS errors - session might be refreshing
    retry: (failureCount, error) => {
      if (failureCount >= 3) return false;
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode = (error as any)?.code;
      
      const isRetryable = 
        errorMessage.includes('timeout') ||
        errorMessage.includes('network') ||
        errorMessage.includes('fetch') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('row-level security') ||
        errorMessage.includes('JWT') ||
        errorMessage.includes('Auth session missing') ||
        errorCode === 'ETIMEDOUT' ||
        errorCode === 'PGRST116' ||
        errorCode === '42501';
      
      if (isRetryable) {
        console.log(`[useUserProfile] Retrying profile fetch (attempt ${failureCount + 1}/3)`, {
          userId: userId?.slice(-6),
          error: errorMessage,
        });
        return true;
      }
      
      return false;
    },
    retryDelay: (attemptIndex) => {
      // Exponential backoff: 500ms, 1s, 2s
      return Math.min(500 * Math.pow(2, attemptIndex), 4000);
    },
    queryFn: async () => {
      if (!userId) return null;

      const userIdSuffix = userId.slice(-6);
      
      // Ensure session is valid before querying - this prevents timeout errors
      // when the session has expired while the tab was backgrounded
      const sessionValid = await ensureValidSession();
      if (!sessionValid) {
        throw new Error('Session expired - please sign in again');
      }
      
      const abortController = typeof AbortController !== "undefined" ? new AbortController() : undefined;

      try {
        const builder = supabase
          .from("profiles")
          .select("id, full_name, email, apple_email, phone, role")
          .eq("id", userId)
          .maybeSingle();

        if (abortController && typeof (builder as any).abortSignal === "function") {
          (builder as any).abortSignal(abortController.signal);
        }

        const response = await withTimeout(
          builder,
          QUERY_TIMEOUTS.SIMPLE,
          "fetch current user profile",
          abortController ? { abortController } : undefined
        );

        if ("error" in response && response.error) {
          throw response.error;
        }

        return (response as { data: UserProfileRecord | null }).data ?? null;
      } catch (error) {
        throw error;
      }
    },
  });

  return {
    profile: query.data ?? null,
    role: query.data?.role ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

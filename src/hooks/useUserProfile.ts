'use client';
import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureFreshSession } from "@/lib/supabase/session-guard";
import { QUERY_TIMEOUTS, withTimeout } from "@/lib/withTimeout";
import { useAuth } from "./useAuth";
import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef } from "react";

export interface UserProfileRecord {
  id: string;
  role: string | null;
  full_name: string | null;
  email: string | null;
  apple_email: string | null;
  phone: string | null;
}

export const CURRENT_USER_PROFILE_QUERY_KEY = ["current-user-profile"] as const;

export function useUserProfile(staleTime = 5 * 60 * 1000) {
  const { session, loading } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const userId = session?.user?.id;
  
  // Track if we previously had a userId to detect session loss
  const hadUserIdRef = useRef<string | null>(null);
  const sessionLossReportedRef = useRef(false);
  
  // Detect when userId becomes undefined after being defined (session loss)
  useEffect(() => {
    if (userId) {
      // We have a user - track it
      hadUserIdRef.current = userId;
      sessionLossReportedRef.current = false;
    } else if (hadUserIdRef.current && !loading && !sessionLossReportedRef.current) {
      // We HAD a user but now we don't, and we're not loading - potential session loss
      sessionLossReportedRef.current = true;
      const lossData = {
        previousUserId: hadUserIdRef.current?.slice(-6),
        pathname: typeof window !== 'undefined' ? window.location?.pathname : null,
        timestamp: Date.now(),
        loading,
        hasSession: !!session,
      };
      
      console.warn('[useUserProfile] SESSION LOSS DETECTED - userId became undefined', lossData);
      
      if (typeof window !== 'undefined') {
        Sentry.addBreadcrumb({
          category: 'auth-session-loss',
          level: 'warning',
          message: 'useUserProfile detected session loss - userId became undefined',
          data: lossData,
        });
        
        Sentry.captureMessage('[Auth] Session loss detected in useUserProfile', {
          level: 'warning',
          tags: { component: 'useUserProfile', type: 'session-loss' },
          extra: lossData,
        });
      }
    }
  }, [userId, loading, session]);

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
      // when the session has expired while the tab was backgrounded.
      // Routed through the coordinated refresh mutex (session-guard) so this
      // can't race middleware/visibility refreshes and double-rotate the token.
      const sessionValid = await ensureFreshSession('useUserProfile');
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

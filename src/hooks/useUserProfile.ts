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

export function useUserProfile(staleTime = 5 * 60 * 1000) {
  const { session } = useAuth();
  const supabase = getSupabaseBrowserClient();
  const userId = session?.user?.id;

  const query = useQuery<UserProfileRecord | null>({
    queryKey: [...CURRENT_USER_PROFILE_QUERY_KEY, userId],
    enabled: !!userId,
    staleTime,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!userId) return null;

      const abortController = typeof AbortController !== "undefined" ? new AbortController() : undefined;
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

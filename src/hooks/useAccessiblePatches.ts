"use client"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/useAuth"

export type AccessiblePatch = {
  id: string
  name: string
}

export interface AccessiblePatchesResult {
  role: string | null
  patches: AccessiblePatch[]
  isLoading: boolean
  error: Error | null
}

// How far in advance to refresh the session (1 minute before expiry)
const SESSION_REFRESH_BUFFER_MS = 60 * 1000;

/**
 * Helper to ensure the session is valid before making an authenticated query.
 * If the session is expired or about to expire, it proactively refreshes it.
 * Returns the supabase client to use for queries.
 */
async function ensureValidSessionForPatches(): Promise<ReturnType<typeof getSupabaseBrowserClient> | null> {
  const supabase = getSupabaseBrowserClient();
  
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.warn('[useAccessiblePatches] Error getting session:', sessionError.message);
    }
    
    // Check if session is missing or expired/about to expire
    const now = Date.now();
    const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
    const isExpiredOrStale = !session || expiresAt < now + SESSION_REFRESH_BUFFER_MS;
    
    if (isExpiredOrStale) {
      console.log('[useAccessiblePatches] Session expired or stale, attempting refresh', {
        hasSession: !!session,
        expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
      });
      
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      
      if (refreshError || !refreshData.session) {
        console.error('[useAccessiblePatches] Session refresh failed:', refreshError?.message);
        return null;
      }
      
      console.log('[useAccessiblePatches] Session refreshed successfully');
    }
    
    return supabase;
  } catch (error) {
    console.error('[useAccessiblePatches] Exception in ensureValidSession:', error);
    return null;
  }
}

/**
 * Resolve the set of patches the current viewer can access based on role.
 *
 * - organisers: patches directly assigned to them *and* patches assigned to other organisers
 *   under the same lead organiser (including draft/pending organisers)
 * - lead organisers: patches directly assigned *and* patches assigned to their organisers
 * - admins: all active geo/fallback patches
 */
export function useAccessiblePatches(): AccessiblePatchesResult {
  const { user } = useAuth()

  const query = useQuery({
    queryKey: ["accessible-patches", user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
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
        console.log(`[useAccessiblePatches] Retrying (attempt ${failureCount + 1}/3)`, {
          userId: user?.id?.slice(-6),
          error: errorMessage,
        });
        return true;
      }
      
      return false;
    },
    retryDelay: (attemptIndex) => {
      return Math.min(500 * Math.pow(2, attemptIndex), 4000);
    },
    queryFn: async () => {
      if (!user?.id) {
        return { role: null, patches: [] }
      }

      // Ensure session is valid before querying
      const supabase = await ensureValidSessionForPatches();
      if (!supabase) {
        throw new Error('Session expired - please sign in again');
      }

      const userId = user.id
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single()

      if (profileError) {
        throw profileError
      }

      const role = (profile?.role as string | null) || null

      if (role === "admin") {
        const { data: patchRows, error: patchError } = await supabase
          .from("patches")
          .select("id, name")
          .in("type", ["geo", "fallback"])
          .eq("status", "active")
          .order("name")

        if (patchError) throw patchError

        return {
          role,
          patches: (patchRows || []).map((row: any) => ({
            id: String(row.id),
            name: row.name || String(row.id)
          }))
        }
      }

      if (role === "organiser") {
        const patchMap = new Map<string, string>()

        // 1. Get organiser's own patches
        const { data: ownAssignments, error: ownError } = await (supabase as any)
          .from("organiser_patch_assignments")
          .select("patches:patch_id(id,name)")
          .eq("organiser_id", userId)
          .is("effective_to", null)

        if (ownError) {
          console.error("Error fetching organiser's own patches:", ownError)
          // Return empty patches rather than throwing to prevent page crash
          return { role, patches: [] }
        }

        const pushPatch = (patch: any) => {
          if (!patch) return
          const id = String(patch.id)
          if (!patchMap.has(id)) {
            patchMap.set(id, patch.name || id)
          }
        }

        // Add organiser's own patches
        ((ownAssignments as any[]) || []).forEach((row: any) => pushPatch(row.patches))

        // 2. Find lead organiser(s) indirectly via lead_organiser_patch_assignments
        // Get patches assigned to this organiser, then find which lead organisers manage those patches
        const organiserPatchIds = ((ownAssignments as any[]) || [])
          .map((row: any) => row.patches?.id)
          .filter(Boolean)
          .map((id: any) => String(id))

        let leadOrganiserIds: string[] = []

        if (organiserPatchIds.length > 0) {
          // Find lead organisers who manage these patches
          const { data: leadPatchAssignments, error: leadPatchError } = await (supabase as any)
            .from("lead_organiser_patch_assignments")
            .select("lead_organiser_id")
            .in("patch_id", organiserPatchIds)
            .is("effective_to", null)

          if (leadPatchError) {
            // Don't throw - might not have access or no lead organisers assigned
            console.warn("Could not fetch lead organiser patch assignments:", leadPatchError)
          } else {
            leadOrganiserIds = ((leadPatchAssignments as any[]) || [])
              .map((row: any) => row.lead_organiser_id)
              .filter(Boolean)
              .map((id: any) => String(id))
            leadOrganiserIds = [...new Set(leadOrganiserIds)] // Remove duplicates
          }
        }

        if (leadOrganiserIds.length > 0) {
          // 3. Get all patches managed by these lead organisers (includes team patches)
          const { data: leadPatches, error: leadPatchesError } = await (supabase as any)
            .from("lead_organiser_patch_assignments")
            .select("patches:patch_id(id,name)")
            .in("lead_organiser_id", leadOrganiserIds)
            .is("effective_to", null)

          if (leadPatchesError) {
            console.warn("Could not fetch lead organiser patches:", leadPatchesError)
          } else {
            // Add all patches managed by the lead organisers (this includes team patches)
            ((leadPatches as any[]) || []).forEach((row: any) => pushPatch(row.patches))
          }

          // 4. Also try to get draft/pending organisers' patches via lead_draft_organiser_links
          // Note: This might fail due to RLS, but we'll handle it gracefully
          try {
            const { data: draftLinks, error: draftLinksError } = await (supabase as any)
              .from("lead_draft_organiser_links")
              .select("pending_user_id")
              .in("lead_user_id", leadOrganiserIds)
              .eq("is_active", true)

            if (!draftLinksError && draftLinks) {
              const draftOrganiserIds = ((draftLinks as any[]) || [])
                .map((row: any) => row.pending_user_id)
                .filter(Boolean)
                .map((id: any) => String(id))

              if (draftOrganiserIds.length > 0) {
                // Get patches from pending_users assigned_patch_ids
                const { data: pendingUsers, error: pendingUsersError } = await (supabase as any)
                  .from("pending_users")
                  .select("assigned_patch_ids")
                  .in("id", draftOrganiserIds)
                  .in("status", ["draft", "invited"])

                if (!pendingUsersError && pendingUsers) {
                  const pendingPatchIds = ((pendingUsers as any[]) || [])
                    .flatMap((user: any) => {
                      const assigned = Array.isArray(user.assigned_patch_ids) ? user.assigned_patch_ids : []
                      return assigned.map(String).filter(Boolean)
                    })

                  if (pendingPatchIds.length > 0) {
                    const { data: pendingPatches, error: pendingPatchesError } = await (supabase as any)
                      .from("patches")
                      .select("id, name")
                      .in("id", pendingPatchIds)

                    if (!pendingPatchesError && pendingPatches) {
                      ((pendingPatches as any[]) || []).forEach((patch: any) => pushPatch(patch))
                    }
                  }
                }
              }
            }
          } catch (error) {
            // Silently fail - draft links might not be accessible due to RLS
            console.warn("Could not fetch draft organiser links:", error)
          }
        }

        // Get organiser's own patch IDs to prioritize them
        const ownPatchIds = new Set(
          (Array.isArray(ownAssignments) ? ownAssignments : [])
            .map((row: any) => row?.patches?.id)
            .filter(Boolean)
            .map((id: any) => String(id))
        )

        // Sort patches: own patches first, then team patches, both alphabetically
        const patches = Array.from(patchMap.entries())
          .map(([id, name]) => ({ id, name, isOwn: ownPatchIds.has(id) }))
          .sort((a, b) => {
            // Own patches first
            if (a.isOwn && !b.isOwn) return -1
            if (!a.isOwn && b.isOwn) return 1
            // Then alphabetically
            return a.name.localeCompare(b.name)
          })
          .map(({ id, name }) => ({ id, name }))

        return { role, patches }
      }

      if (role === "lead_organiser") {
        const patchMap = new Map<string, string>()

        const [direct, hierarchy] = await Promise.all([
          (supabase as any)
            .from("lead_organiser_patch_assignments")
            .select("patches:patch_id(id,name)")
            .eq("lead_organiser_id", userId)
            .is("effective_to", null),
          (supabase as any)
            .from("role_hierarchy")
            .select("child_user_id")
            .eq("parent_user_id", userId)
            .is("end_date", null)
        ])

        const pushPatch = (patch: any) => {
          if (!patch) return
          const id = String(patch.id)
          if (!patchMap.has(id)) {
            patchMap.set(id, patch.name || id)
          }
        }

        (((direct as any)?.data as any[]) || []).forEach((row: any) => pushPatch(row.patches))

        const organiserIds = ((((hierarchy as any)?.data as any[]) || [])
          .map((row: any) => row.child_user_id)
          .filter(Boolean)
          .map((id: any) => String(id)))

        if (organiserIds.length > 0) {
          const { data: teamAssignments, error } = await (supabase as any)
            .from("organiser_patch_assignments")
            .select("patches:patch_id(id,name)")
            .in("organiser_id", organiserIds)
            .is("effective_to", null)

          if (error) throw error

          (teamAssignments as any[] | undefined)?.forEach((row: any) => pushPatch(row.patches))
        }

        const patches = Array.from(patchMap.entries())
          .map(([id, name]) => ({ id, name }))
          .sort((a, b) => a.name.localeCompare(b.name))

        return { role, patches }
      }

      return { role, patches: [] }
    }
  })

  const result = useMemo<AccessiblePatchesResult>(() => ({
    role: (query.data as any)?.role ?? null,
    patches: (query.data as any)?.patches ?? [],
    isLoading: query.isLoading,
    error: (query.error as Error) ?? null
  }), [query.data, query.error, query.isLoading])

  return result
}


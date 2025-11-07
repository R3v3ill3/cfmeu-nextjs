"use client"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from "@/utils/organiserDisplay"
import { useAuth } from "@/hooks/useAuth"

export interface PatchInfo {
  id: string
  name: string
  status: string | null
  type: string | null
  organiserNames: string[]
}

export function usePatchInfo(patchId?: string) {
  const { user } = useAuth()

  return useQuery<PatchInfo | null>({
    queryKey: ["patch-info", patchId, user?.id],
    enabled: !!patchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!patchId) return null

      // Get current user's role to determine permissions
      let userRole: string | null = null
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single()
        userRole = profile?.role as string | null
      }

      const { data: patch, error: patchError } = await supabase
        .from("patches")
        .select("id, name, status, type")
        .eq("id", patchId)
        .single()

      if (patchError) throw patchError

      const { data: organiserAssignments, error: organiserError } = await supabase
        .from("organiser_patch_assignments")
        .select("profiles:organiser_id(full_name, email)")
        .eq("patch_id", patchId)
        .is("effective_to", null)

      if (organiserError) throw organiserError

      // For organisers, filter pending_users by assigned_patch_ids that match the current patch
      // For admin/lead_organiser, query all pending users (they have broader access)
      let pendingOrganisers: any[] = []
      let pendingError: any = null

      if (userRole === "organiser") {
        // For organisers, skip pending_users query entirely to avoid RLS stack depth issues
        // Organisers don't need to see pending users in patch info - this is mainly for admin/lead_organiser
        pendingOrganisers = []
      } else {
        // For admin/lead_organiser, query all pending users (they have broader access)
        const { data, error } = await supabase
          .from("pending_users")
          .select("full_name, email, role, status, assigned_patch_ids")
          .in("status", Array.from(PENDING_USER_DASHBOARD_STATUSES))

        if (error) {
          // For admin/lead_organiser, this might be a real error, but don't fail completely
          console.warn("Could not fetch pending users:", error)
          pendingError = error
        } else {
          pendingOrganisers = data || []
        }
      }

      const liveOrganiserNames = (organiserAssignments || []).map((row: any) =>
        row?.profiles?.full_name || row?.profiles?.email || "Unknown organiser"
      )

      // Filter pending organisers to only those assigned to this patch
      const pendingForPatch = (pendingOrganisers || []).filter((pending: any) => {
        const assigned = Array.isArray(pending.assigned_patch_ids) ? pending.assigned_patch_ids : []
        return assigned.map(String).includes(String(patchId))
      })

      const organiserNames = mergeOrganiserNameLists(liveOrganiserNames, pendingForPatch)

      return {
        id: String(patch.id),
        name: patch.name || String(patch.id),
        status: patch.status || null,
        type: patch.type || null,
        organiserNames
      }
    }
  })
}


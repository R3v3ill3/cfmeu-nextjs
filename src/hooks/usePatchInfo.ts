"use client"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from "@/utils/organiserDisplay"

export interface PatchInfo {
  id: string
  name: string
  status: string | null
  type: string | null
  organiserNames: string[]
}

export function usePatchInfo(patchId?: string) {
  return useQuery<PatchInfo | null>({
    queryKey: ["patch-info", patchId],
    enabled: !!patchId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!patchId) return null

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

      const { data: pendingOrganisers, error: pendingError } = await supabase
        .from("pending_users")
        .select("full_name, email, role, status, assigned_patch_ids")
        .in("status", Array.from(PENDING_USER_DASHBOARD_STATUSES))

      if (pendingError) throw pendingError

      const liveOrganiserNames = (organiserAssignments || []).map((row: any) =>
        row?.profiles?.full_name || row?.profiles?.email || "Unknown organiser"
      )

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


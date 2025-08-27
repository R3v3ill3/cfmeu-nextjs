"use client"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export type PatchOrganiserLabelsResult = {
  byPatchId: Record<string, string[]>
  mergedList: string[]
}

export function usePatchOrganiserLabels(patchIds: string[]): PatchOrganiserLabelsResult {
  const stablePatchIds = useMemo(() => Array.from(new Set((patchIds || []).filter(Boolean))), [patchIds])

  const { data: liveRows } = useQuery({
    queryKey: ["patch-organisers-live", stablePatchIds],
    enabled: stablePatchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("patch_id, organiser_id, effective_to, profiles:organiser_id(full_name)")
        .is("effective_to", null)
        .in("patch_id", stablePatchIds)
      return (data as any[]) || []
    }
  })

  const { data: draftRows } = useQuery({
    queryKey: ["patch-organisers-draft", stablePatchIds],
    enabled: stablePatchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Load pending users in draft/invited that reference any of the patch ids
      const { data } = await (supabase as any)
        .from("pending_users")
        .select("full_name, role, assigned_patch_ids")
        .in("status", ["draft", "invited"]) 
      return (data as any[]) || []
    }
  })

  const byPatchId: Record<string, string[]> = useMemo(() => {
    const map = new Map<string, { live: string[]; draft: string[] }>()
    stablePatchIds.forEach(id => map.set(id, { live: [], draft: [] }))

    ;(liveRows || []).forEach((r: any) => {
      const pid = String(r.patch_id)
      if (!map.has(pid)) map.set(pid, { live: [], draft: [] })
      const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
      const n = (prof?.full_name as string | undefined) || undefined
      if (n) map.get(pid)!.live.push(n)
    })

    // Build a fast lookup of patches we care about
    const wanted = new Set(stablePatchIds)
    ;(draftRows || []).forEach((pu: any) => {
      const fullName: string | undefined = (pu.full_name as string | undefined) || undefined
      const role: string | undefined = pu.role as string | undefined
      const suffix = role === "lead_organiser" ? " (lead)" : ""
      const display = fullName ? `${fullName}${suffix}` : undefined
      const patchList: string[] = Array.isArray(pu.assigned_patch_ids) ? pu.assigned_patch_ids : []
      if (!display) return
      for (const pidRaw of patchList) {
        const pid = String(pidRaw)
        if (!wanted.has(pid)) continue
        if (!map.has(pid)) map.set(pid, { live: [], draft: [] })
        map.get(pid)!.draft.push(display)
      }
    })

    const result: Record<string, string[]> = {}
    Array.from(map.entries()).forEach(([pid, lists]) => {
      const seen = new Set<string>()
      const merged: string[] = []
      lists.live.forEach(n => { if (!seen.has(n)) { seen.add(n); merged.push(n) } })
      lists.draft.forEach(n => { if (!seen.has(n)) { seen.add(n); merged.push(n) } })
      result[pid] = merged
    })
    return result
  }, [stablePatchIds, liveRows, draftRows])

  const mergedList: string[] = useMemo(() => {
    const seen = new Set<string>()
    const list: string[] = []
    for (const pid of Object.keys(byPatchId)) {
      for (const name of byPatchId[pid] || []) {
        if (!seen.has(name)) { seen.add(name); list.push(name) }
      }
    }
    return list
  }, [byPatchId])

  return { byPatchId, mergedList }
}


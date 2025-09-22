"use client"
import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
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

/**
 * Resolve the set of patches the current viewer can access based on role.
 *
 * - organisers: patches directly assigned to them
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
    queryFn: async () => {
      if (!user?.id) {
        return { role: null, patches: [] }
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
        const { data: assignments, error } = await (supabase as any)
          .from("organiser_patch_assignments")
          .select("patches:patch_id(id,name)")
          .eq("organiser_id", userId)
          .is("effective_to", null)

        if (error) throw error

        const patches = ((assignments as any[]) || [])
          .map((row: any) => row.patches)
          .filter(Boolean)
          .map((patch: any) => ({
            id: String(patch.id),
            name: patch.name || String(patch.id)
          }))

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


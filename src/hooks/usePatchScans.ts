"use client"

import { useQuery } from "@tanstack/react-query"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"

export interface PatchScan {
  id: string
  file_name: string
  file_url: string
  status: string
  upload_mode: string | null
  project_id: string | null
  created_project_id: string | null
  page_count: number | null
  confidence_scores: any
  error_message: string | null
  created_at: string
  updated_at: string
}

export function usePatchScans(patchId: string | null) {
  const supabase = getSupabaseBrowserClient()

  return useQuery<PatchScan[]>({
    queryKey: ["patch-scans", patchId],
    enabled: !!patchId,
    staleTime: 30_000, // 30 seconds
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!patchId) return []

      // First, get all project IDs for this patch using the materialized view
      const { data: patchProjects, error: patchError } = await supabase
        .from("patch_project_mapping_view")
        .select("project_id")
        .eq("patch_id", patchId)

      if (patchError) {
        console.error("Error fetching patch projects:", patchError)
        throw patchError
      }

      // Extract unique project IDs
      const projectIds = Array.from(
        new Set(
          (patchProjects || [])
            .map((p) => p.project_id)
            .filter((id): id is string => id !== null)
        )
      )

      if (projectIds.length === 0) {
        // No projects in patch, return empty array
        return []
      }

      // Fetch scans where project_id or created_project_id matches any project in the patch
      // Query for scans with project_id in patch projects
      const { data: scansByProjectId, error: scansByProjectIdError } = await supabase
        .from("mapping_sheet_scans")
        .select("*")
        .in("project_id", projectIds)
        .order("created_at", { ascending: false })

      if (scansByProjectIdError) {
        console.error("Error fetching scans by project_id:", scansByProjectIdError)
        throw scansByProjectIdError
      }

      // Query for scans with created_project_id in patch projects
      const { data: scansByCreatedProjectId, error: scansByCreatedProjectIdError } = await supabase
        .from("mapping_sheet_scans")
        .select("*")
        .in("created_project_id", projectIds)
        .order("created_at", { ascending: false })

      if (scansByCreatedProjectIdError) {
        console.error("Error fetching scans by created_project_id:", scansByCreatedProjectIdError)
        throw scansByCreatedProjectIdError
      }

      // Combine and deduplicate scans (a scan might match both conditions)
      const allScans = [...(scansByProjectId || []), ...(scansByCreatedProjectId || [])]
      const uniqueScans = Array.from(
        new Map(allScans.map((scan) => [scan.id, scan])).values()
      )

      // Sort by created_at descending
      uniqueScans.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime()
        const dateB = new Date(b.created_at).getTime()
        return dateB - dateA
      })

      return uniqueScans as PatchScan[]
    }
  })
}


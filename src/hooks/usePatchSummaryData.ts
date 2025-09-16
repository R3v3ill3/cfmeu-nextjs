import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { OrganizingUniverseMetrics, useOrganizingUniverseMetrics } from "./useOrganizingUniverseMetrics"

export interface PatchSummaryData {
  patchId: string
  patchName: string
  organiserNames: string[]
  projectCount: number
  organizingMetrics: OrganizingUniverseMetrics
  lastUpdated: string
}

/**
 * Hook to fetch summary data for a specific patch
 * Used by organiser dashboard to show their patch summaries
 */
export function usePatchSummaryData(patchId: string) {
  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  // Get organizing universe metrics for this patch
  const { data: metrics, isLoading: metricsLoading } = useOrganizingUniverseMetrics({
    patchIds: [patchId]
  })

  // Get patch details and organiser information
  const { data: patchData, isLoading: patchLoading } = useQuery({
    queryKey: ["patch-summary", patchId],
    enabled: !!patchId && !USE_SERVER_SIDE, // Only run when server-side is disabled
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get patch basic info
      const { data: patch, error: patchError } = await supabase
        .from("patches")
        .select("id, name")
        .eq("id", patchId)
        .single()

      if (patchError) throw patchError

      // Get organiser assignments for this patch
      const { data: organiserAssignments, error: orgError } = await supabase
        .from("organiser_patch_assignments")
        .select(`
          organiser_id,
          profiles:organiser_id(full_name, email)
        `)
        .eq("patch_id", patchId)
        .is("effective_to", null)

      if (orgError) throw orgError

      // Get project count for this patch
      const { data: patchSites, error: sitesError } = await supabase
        .from("patch_job_sites")
        .select("job_site_id")
        .eq("patch_id", patchId)
        .is("effective_to", null)

      if (sitesError) throw sitesError

      const siteIds = patchSites?.map(ps => ps.job_site_id) || []
      let projectCount = 0

      if (siteIds.length > 0) {
        const { data: projects, error: projectsError } = await supabase
          .from("projects")
          .select("id")
          .in("main_job_site_id", siteIds)
          .eq("organising_universe", "active")

        if (projectsError) throw projectsError
        projectCount = projects?.length || 0
      }

      return {
        patch,
        organiserAssignments: organiserAssignments || [],
        projectCount
      }
    }
  })

  const isLoading = patchLoading || metricsLoading

  if (isLoading || !patchData || !metrics) {
    return { data: null, isLoading }
  }

  const summaryData: PatchSummaryData = {
    patchId,
    patchName: patchData.patch.name,
    organiserNames: patchData.organiserAssignments.map((oa: any) => 
      oa.profiles?.full_name || oa.profiles?.email || 'Unknown'
    ),
    projectCount: patchData.projectCount,
    organizingMetrics: metrics,
    lastUpdated: new Date().toISOString()
  }

  return { data: summaryData, isLoading: false }
}

/**
 * Hook to get patch summaries for multiple patches
 * Used by lead organiser dashboard
 */
export function usePatchSummariesData(patchIds: string[]) {
  const queries = patchIds.map(patchId => ({
    queryKey: ["patch-summary", patchId],
    queryFn: () => fetchPatchSummary(patchId)
  }))

  return useQuery({
    queryKey: ["patch-summaries", ...patchIds],
    enabled: patchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const summaries = await Promise.all(
        patchIds.map(patchId => fetchPatchSummary(patchId))
      )
      return summaries.filter(Boolean) as PatchSummaryData[]
    }
  })
}

/**
 * Fetch summary data for a single patch
 * Utility function used by batch queries
 */
async function fetchPatchSummary(patchId: string): Promise<PatchSummaryData | null> {
  try {
    // Get patch basic info
    const { data: patch, error: patchError } = await supabase
      .from("patches")
      .select("id, name")
      .eq("id", patchId)
      .single()

    if (patchError) throw patchError

    // Get organiser assignments for this patch
    const { data: organiserAssignments, error: orgError } = await supabase
      .from("organiser_patch_assignments")
      .select(`
        organiser_id,
        profiles:organiser_id(full_name, email)
      `)
      .eq("patch_id", patchId)
      .is("effective_to", null)

    if (orgError) throw orgError

    // Get project count for this patch
    const { data: patchSites, error: sitesError } = await supabase
      .from("patch_job_sites")
      .select("job_site_id")
      .eq("patch_id", patchId)
      .is("effective_to", null)

    if (sitesError) throw sitesError

    const siteIds = patchSites?.map(ps => ps.job_site_id) || []
    let projectCount = 0

    if (siteIds.length > 0) {
      const { data: projects, error: projectsError } = await supabase
        .from("projects")
        .select("id")
        .in("main_job_site_id", siteIds)
        .eq("organising_universe", "active")

      if (projectsError) throw projectsError
      projectCount = projects?.length || 0
    }

    return {
      patchId,
      patchName: patch.name,
      organiserNames: organiserAssignments?.map((oa: any) => 
        oa.profiles?.full_name || oa.profiles?.email || 'Unknown'
      ) || [],
      projectCount,
      organizingMetrics: {
        ebaProjectsPercentage: 0,
        ebaProjectsCount: 0,
        totalActiveProjects: 0,
        knownBuilderPercentage: 0,
        knownBuilderCount: 0,
        keyContractorCoveragePercentage: 0,
        mappedKeyContractors: 0,
        totalKeyContractorSlots: 0,
        keyContractorEbaBuilderPercentage: 0,
        keyContractorsOnEbaBuilderProjects: 0,
        totalKeyContractorsOnEbaBuilderProjects: 0,
        keyContractorEbaPercentage: 0,
        keyContractorsWithEba: 0,
        totalMappedKeyContractors: 0
      }, // Metrics will be fetched separately to avoid circular dependencies
      lastUpdated: new Date().toISOString()
    }
  } catch (error) {
    console.error(`Error fetching patch summary for ${patchId}:`, error)
    return null
  }
}

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { PatchSummaryData } from "./usePatchSummaryData"
import { OrganizingUniverseMetrics, useOrganizingUniverseMetrics } from "./useOrganizingUniverseMetrics"

export interface LeadOrganizerSummary {
  leadOrganizerId: string
  leadOrganizerName: string
  email: string
  patchCount: number
  totalProjects: number
  patches: PatchSummaryData[]
  aggregatedMetrics: OrganizingUniverseMetrics
  lastUpdated: string
}

/**
 * Hook to get summary data for a specific lead organizer
 * Shows all patches assigned to the lead organizer with aggregated metrics
 */
export function useLeadOrganizerSummary(leadOrganizerId: string) {
  // Get patches assigned to this lead organizer
  const { data: patchData, isLoading: patchLoading } = useQuery({
    queryKey: ["lead-organizer-patches", leadOrganizerId],
    enabled: !!leadOrganizerId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get lead organizer profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", leadOrganizerId)
        .single()

      if (profileError) throw profileError

      // Get patches assigned to this lead organizer
      const { data: patchAssignments, error: assignmentError } = await supabase
        .from("lead_organiser_patch_assignments")
        .select(`
          patch_id,
          patches:patch_id(id, name)
        `)
        .eq("lead_organiser_id", leadOrganizerId)
        .is("effective_to", null)

      if (assignmentError) throw assignmentError

      return {
        profile,
        patchAssignments: patchAssignments || []
      }
    }
  })

  // Get organizing metrics for all patches assigned to this lead
  const patchIds = patchData?.patchAssignments?.map((pa: any) => pa.patch_id) || []
  const { data: aggregatedMetrics, isLoading: metricsLoading } = useOrganizingUniverseMetrics({
    patchIds
  })

  // Get detailed patch summaries
  const { data: patchSummaries, isLoading: summariesLoading } = useQuery({
    queryKey: ["lead-patch-summaries", leadOrganizerId, patchIds],
    enabled: patchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const summaries = await Promise.all(
        patchIds.map(async (patchId: string) => {
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
              }, // Individual patch metrics will be calculated separately
              lastUpdated: new Date().toISOString()
            } as PatchSummaryData
          } catch (error) {
            console.error(`Error fetching patch summary for ${patchId}:`, error)
            return null
          }
        })
      )

      return summaries.filter(Boolean) as PatchSummaryData[]
    }
  })

  const isLoading = patchLoading || metricsLoading || summariesLoading

  if (isLoading || !patchData || !aggregatedMetrics) {
    return { data: null, isLoading }
  }

  const totalProjects = patchSummaries?.reduce((sum, patch) => sum + patch.projectCount, 0) || 0

  const summaryData: LeadOrganizerSummary = {
    leadOrganizerId,
    leadOrganizerName: patchData.profile.full_name || patchData.profile.email || 'Unknown',
    email: patchData.profile.email || '',
    patchCount: patchIds.length,
    totalProjects,
    patches: patchSummaries || [],
    aggregatedMetrics,
    lastUpdated: new Date().toISOString()
  }

  return { data: summaryData, isLoading: false }
}

/**
 * Hook to get summaries for all lead organizers
 * Used by admin dashboard to show overview of all leads
 */
export function useAllLeadOrganizerSummaries() {
  return useQuery({
    queryKey: ["all-lead-organizer-summaries"],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Get all profiles with lead_organiser role
      const { data: leads, error: leadsError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "lead_organiser")
        .eq("is_active", true)

      if (leadsError) throw leadsError

      // For each lead, get their summary data
      const summaries = await Promise.all(
        (leads || []).map(async (lead: any) => {
          try {
            // Get patches assigned to this lead organizer
            const { data: patchAssignments, error: assignmentError } = await supabase
              .from("lead_organiser_patch_assignments")
              .select("patch_id")
              .eq("lead_organiser_id", lead.id)
              .is("effective_to", null)

            if (assignmentError) throw assignmentError

            const patchIds = patchAssignments?.map((pa: any) => pa.patch_id) || []

            // Get basic patch info
            let totalProjects = 0
            if (patchIds.length > 0) {
              const { data: patchSites } = await supabase
                .from("patch_job_sites")
                .select("job_site_id")
                .in("patch_id", patchIds)
                .is("effective_to", null)

              const siteIds = patchSites?.map(ps => ps.job_site_id) || []

              if (siteIds.length > 0) {
                const { data: projects } = await supabase
                  .from("projects")
                  .select("id")
                  .in("main_job_site_id", siteIds)
                  .eq("organising_universe", "active")

                totalProjects = projects?.length || 0
              }
            }

            return {
              leadOrganizerId: lead.id,
              leadOrganizerName: lead.full_name || lead.email || 'Unknown',
              email: lead.email || '',
              patchCount: patchIds.length,
              totalProjects,
              patches: [], // Will be loaded on-demand when expanded
              aggregatedMetrics: {
                ebaProjectsPercentage: 0,
                ebaProjectsCount: 0,
                totalActiveProjects: totalProjects,
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
              }, // Detailed metrics calculated on-demand
              lastUpdated: new Date().toISOString()
            } as LeadOrganizerSummary
          } catch (error) {
            console.error(`Error fetching lead summary for ${lead.id}:`, error)
            return null
          }
        })
      )

      return summaries.filter(Boolean) as LeadOrganizerSummary[]
    }
  })
}

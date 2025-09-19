import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { PatchSummaryData, fetchPatchSummary } from "./usePatchSummaryData"
import { OrganizingUniverseMetrics, useOrganizingUniverseMetrics, fetchOrganizingUniverseMetrics } from "./useOrganizingUniverseMetrics"
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from "@/utils/organiserDisplay"

export interface LeadOrganizerSummary {
  leadOrganizerId: string
  leadOrganizerName: string
  email: string
  patchCount: number
  totalProjects: number
  patches: PatchSummaryData[]
  aggregatedMetrics: OrganizingUniverseMetrics
  lastUpdated: string
  pendingOrganisers: string[]
  isPending?: boolean
  status?: string | null
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

      const { data: pendingOrganiserLinks, error: pendingLinkError } = await supabase
        .from("lead_draft_organiser_links")
        .select("pending:pending_user_id(full_name, email, role, status)")
        .eq("lead_user_id", leadOrganizerId)
        .eq("is_active", true)

      if (pendingLinkError) throw pendingLinkError

      return {
        profile,
        patchAssignments: patchAssignments || [],
        pendingOrganisers: pendingOrganiserLinks || []
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

  const pendingOrganiserNames = mergeOrganiserNameLists(
    [],
    ((patchData as any)?.pendingOrganisers || [])
      .map((link: any) => link?.pending)
      .filter((pending: any) => pending && (!pending.status || PENDING_USER_DASHBOARD_STATUSES.includes(pending.status)))
  )

  const summaryData: LeadOrganizerSummary = {
    leadOrganizerId,
    leadOrganizerName: patchData.profile.full_name || patchData.profile.email || 'Unknown',
    email: patchData.profile.email || '',
    patchCount: patchIds.length,
    totalProjects,
    patches: patchSummaries || [],
    aggregatedMetrics,
    lastUpdated: new Date().toISOString(),
    pendingOrganisers: pendingOrganiserNames,
    status: 'active'
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
      const pendingStatuses = Array.from(PENDING_USER_DASHBOARD_STATUSES)

      const { data: leads, error: leadsError } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("role", "lead_organiser")
        .eq("is_active", true)

      if (leadsError) throw leadsError

      const leadIds = (leads || []).map((lead: any) => lead.id).filter(Boolean)
      const pendingByLead = new Map<string, any[]>()

      if (leadIds.length > 0) {
        const { data: pendingLinks, error: pendingLinksError } = await supabase
          .from("lead_draft_organiser_links")
          .select("lead_user_id, pending:pending_user_id(full_name, email, role, status)")
          .in("lead_user_id", leadIds)
          .eq("is_active", true)

        if (pendingLinksError) {
          console.error('Failed to fetch pending organisers for live leads:', pendingLinksError)
        } else {
          (pendingLinks || []).forEach((link: any) => {
            const lid = String(link.lead_user_id)
            if (!pendingByLead.has(lid)) pendingByLead.set(lid, [])
            pendingByLead.get(lid)!.push(link.pending)
          })
        }
      }

      const liveSummaries = await Promise.all(
        (leads || []).map(async (lead: any) => {
          try {
            const { data: patchAssignments, error: assignmentError } = await supabase
              .from("lead_organiser_patch_assignments")
              .select("patch_id")
              .eq("lead_organiser_id", lead.id)
              .is("effective_to", null)

            if (assignmentError) throw assignmentError

            const patchIds = patchAssignments?.map((pa: any) => pa.patch_id) || []
            const [aggregatedMetrics, patches] = await Promise.all([
              fetchOrganizingUniverseMetrics({ patchIds }),
              patchIds.length > 0
                ? Promise.all(patchIds.map((pid: string) => fetchPatchSummary(pid))).then((results) =>
                    (results.filter(Boolean) as PatchSummaryData[])
                  )
                : Promise.resolve([] as PatchSummaryData[])
            ])

            const totalProjects = aggregatedMetrics.totalActiveProjects > 0
              ? aggregatedMetrics.totalActiveProjects
              : patches.reduce((sum, patch) => sum + patch.projectCount, 0)

            const pendingOrganiserRows = (pendingByLead.get(String(lead.id)) || [])
              .filter((row: any) => row && (!row.status || pendingStatuses.includes(row.status)))
            const pendingOrganiserNames = mergeOrganiserNameLists([], pendingOrganiserRows as any[])

            return {
              leadOrganizerId: lead.id,
              leadOrganizerName: lead.full_name || lead.email || 'Unknown',
              email: lead.email || '',
              patchCount: patchIds.length,
              totalProjects,
              patches,
              aggregatedMetrics,
              lastUpdated: new Date().toISOString(),
              pendingOrganisers: pendingOrganiserNames,
              status: 'active'
            } as LeadOrganizerSummary
          } catch (error) {
            console.error(`Error fetching lead summary for ${lead?.id}:`, error)
            return null
          }
        })
      )

      const { data: pendingLeads, error: pendingLeadsError } = await supabase
        .from('pending_users')
        .select('id, full_name, email, status, assigned_patch_ids')
        .eq('role', 'lead_organiser')
        .in('status', pendingStatuses)

      if (pendingLeadsError) {
        console.error('Failed to fetch pending lead organisers:', pendingLeadsError)
      }

      let pendingSummaries: LeadOrganizerSummary[] = []

      if (pendingLeads && pendingLeads.length > 0) {
        pendingSummaries = (await Promise.all(
          pendingLeads.map(async (lead: any) => {
            try {
              const patchIds = (Array.isArray(lead.assigned_patch_ids) ? lead.assigned_patch_ids : []).map((id: any) => String(id))
              const [aggregatedMetrics, patches] = await Promise.all([
                fetchOrganizingUniverseMetrics({ patchIds }),
                patchIds.length > 0
                  ? Promise.all(patchIds.map((pid: string) => fetchPatchSummary(pid))).then((results) =>
                      (results.filter(Boolean) as PatchSummaryData[])
                    )
                  : Promise.resolve([] as PatchSummaryData[])
              ])

              const totalProjects = aggregatedMetrics.totalActiveProjects > 0
                ? aggregatedMetrics.totalActiveProjects
                : patches.reduce((sum, patch) => sum + patch.projectCount, 0)

              return {
                leadOrganizerId: `pending:${lead.id}`,
                leadOrganizerName: lead.full_name || lead.email || 'Pending co-ordinator',
                email: lead.email || '',
                patchCount: patchIds.length,
                totalProjects,
                patches,
                aggregatedMetrics,
                lastUpdated: new Date().toISOString(),
                pendingOrganisers: [],
                isPending: true,
                status: lead.status || 'pending'
              } as LeadOrganizerSummary
            } catch (error) {
              console.error(`Error building pending lead summary for ${lead?.id}:`, error)
              return null
            }
          })
        )).filter(Boolean) as LeadOrganizerSummary[]
      }

      return [
        ...liveSummaries.filter(Boolean) as LeadOrganizerSummary[],
        ...pendingSummaries
      ]
    }
  })
}

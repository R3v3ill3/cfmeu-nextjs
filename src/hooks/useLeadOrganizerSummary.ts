import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { PatchSummaryData, fetchPatchSummary } from "./usePatchSummaryData"
import { OrganizingUniverseMetrics, useOrganizingUniverseMetrics, fetchOrganizingUniverseMetrics } from "./useOrganizingUniverseMetrics"
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from "@/utils/organiserDisplay"
import { useAuth } from "@/hooks/useAuth"
import { PatchSummaryDataServerSide } from "./usePatchSummaryDataServerSide"

const getDashboardApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    return ''
  }
  if (process.env.NEXT_PUBLIC_VERCEL_URL) {
    return `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL
  }
  // Production fallback - should never reach here in production
  console.warn('NEXT_PUBLIC_APP_URL not configured, using default')
  return process.env.NODE_ENV === 'production'
    ? 'https://app.cfmeu.org'
    : 'http://localhost:3000'
}

const mapServerPatchToSummary = (summary: PatchSummaryDataServerSide): PatchSummaryData => ({
  patchId: summary.patchId,
  patchName: summary.patchName,
  organiserNames: summary.organiserNames,
  projectCount: summary.projectCount,
  organizingMetrics: {
    ebaProjectsPercentage: summary.ebaProjectsPercentage,
    ebaProjectsCount: summary.ebaProjectsCount,
    totalActiveProjects: summary.projectCount,
    knownBuilderPercentage: summary.knownBuilderPercentage,
    knownBuilderCount: summary.knownBuilderCount,
    keyContractorCoveragePercentage: summary.keyContractorCoverage,
    mappedKeyContractors: 0,
    totalKeyContractorSlots: 0,
    keyContractorEbaBuilderPercentage: 0,
    keyContractorsOnEbaBuilderProjects: 0,
    totalKeyContractorsOnEbaBuilderProjects: 0,
    keyContractorEbaPercentage: summary.keyContractorEbaPercentage,
    keyContractorsWithEba: 0,
    totalMappedKeyContractors: 0
  },
  lastUpdated: summary.lastUpdated
})

async function fetchServerPatchSummaries({
  viewerId,
  viewerRole,
  leadOrganizerId
}: {
  viewerId: string
  viewerRole: string
  leadOrganizerId: string
}): Promise<PatchSummaryDataServerSide[]> {
  const baseUrl = getDashboardApiBaseUrl()
  const searchParams = new URLSearchParams()
  searchParams.set('userId', viewerId)
  searchParams.set('userRole', viewerRole)
  searchParams.set('leadOrganizerId', leadOrganizerId)

  const response = await fetch(`${baseUrl}/api/dashboard/patch-summaries?${searchParams.toString()}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include'
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Failed to fetch patch summaries for lead ${leadOrganizerId}: ${response.status} ${errorText}`)
  }

  const data = await response.json()
  return (data?.summaries || []) as PatchSummaryDataServerSide[]
}

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
  const { user } = useAuth()

  const { data: basics, isLoading: basicsLoading } = useQuery({
    queryKey: ["lead-organizer-basics", leadOrganizerId, user?.id],
    enabled: !!leadOrganizerId && !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) throw new Error('User must be authenticated')

      const [leadProfileResult, viewerProfileResult, pendingLinksResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", leadOrganizerId)
          .single(),
        supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single(),
        supabase
          .from("lead_draft_organiser_links")
          .select("pending:pending_user_id(full_name, email, role, status)")
          .eq("lead_user_id", leadOrganizerId)
          .eq("is_active", true)
      ])

      const { data: profile, error: profileError } = leadProfileResult
      if (profileError) throw profileError

      const { data: viewerProfile, error: viewerError } = viewerProfileResult
      if (viewerError) throw viewerError

      const { data: pendingOrganiserLinks, error: pendingLinkError } = pendingLinksResult
      if (pendingLinkError) throw pendingLinkError

      return {
        profile,
        viewerRole: viewerProfile?.role || 'lead_organiser',
        pendingOrganisers: pendingOrganiserLinks || []
      }
    }
  })

  const viewerRole = basics?.viewerRole || 'lead_organiser'

  const { data: serverSummaries, isLoading: summariesLoading } = useQuery({
    queryKey: ["lead-patch-summaries-server", leadOrganizerId, viewerRole, user?.id],
    enabled: !!leadOrganizerId && !!user?.id && !!viewerRole,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) throw new Error('User must be authenticated')
      return await fetchServerPatchSummaries({
        viewerId: user.id,
        viewerRole,
        leadOrganizerId
      })
    }
  })

  const patchSummaries = (serverSummaries || []).map(mapServerPatchToSummary)
  const patchIds = patchSummaries.map(summary => summary.patchId)

  const { data: aggregatedMetrics, isLoading: metricsLoading } = useOrganizingUniverseMetrics({
    patchIds,
    userId: leadOrganizerId,  // Use the specific lead organizer's ID, not the current user's ID
    userRole: viewerRole
  })

  const isLoading = basicsLoading || summariesLoading || metricsLoading

  if (isLoading || !basics || !aggregatedMetrics) {
    return { data: null, isLoading: true }
  }

  const totalProjects = patchSummaries.reduce((sum, patch) => sum + patch.projectCount, 0)

  const pendingOrganiserNames = mergeOrganiserNameLists(
    [],
    (basics.pendingOrganisers as any[] | undefined)?.map((link: any) => link?.pending)
      .filter((pending: any) => pending && (!pending.status || PENDING_USER_DASHBOARD_STATUSES.includes(pending.status))) || []
  )

  const summaryData: LeadOrganizerSummary = {
    leadOrganizerId,
    leadOrganizerName: basics.profile.full_name || basics.profile.email || 'Unknown',
    email: basics.profile.email || '',
    patchCount: patchSummaries.length,
    totalProjects,
    patches: patchSummaries,
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
  const { user } = useAuth()

  return useQuery({
    queryKey: ["all-lead-organizer-summaries", user?.id],
    enabled: !!user?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!user?.id) {
        throw new Error('User must be authenticated to load lead summaries')
      }

      const pendingStatuses = Array.from(PENDING_USER_DASHBOARD_STATUSES)

      const { data: viewerProfile, error: viewerError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (viewerError) throw viewerError

      const viewerRole = viewerProfile?.role || 'admin'

      // Only admin and lead_organiser can view all lead organizer summaries
      // Organisers don't have permission to query all lead organisers
      if (viewerRole !== 'admin' && viewerRole !== 'lead_organiser') {
        return []
      }

      // Get both confirmed and draft lead organizers
      const [confirmedLeadsResult, draftLeadsResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("role", "lead_organiser")
          .eq("is_active", true),
        supabase
          .from("pending_users")
          .select("id, full_name, email, status")
          .eq("role", "lead_organiser")
          .in("status", ["draft", "invited"])
      ])

      if (confirmedLeadsResult.error) {
        console.error('Error fetching confirmed leads:', confirmedLeadsResult.error)
        throw confirmedLeadsResult.error
      }
      if (draftLeadsResult.error) {
        console.error('Error fetching draft leads:', draftLeadsResult.error)
        throw draftLeadsResult.error
      }

      const confirmedLeads = confirmedLeadsResult.data || []
      const draftLeads = draftLeadsResult.data || []

      // Combine confirmed and draft lead organizers
      const leads = [
        ...confirmedLeads.map(lead => ({ ...lead, isDraft: false })),
        ...draftLeads.map(lead => ({ ...lead, isDraft: true }))
      ]

      const leadIds = leads.map((lead: any) => lead.id).filter(Boolean)
      const pendingByLead = new Map<string, any[]>()

      // If no leads found, return empty array early
      if (leadIds.length === 0) {
        return []
      }

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
        leads.map(async (lead: any) => {
          try {
        const serverSummaries = await fetchServerPatchSummaries({
              viewerId: user.id,
              viewerRole,
              leadOrganizerId: lead.id
            })
            const patchIds = serverSummaries.map(summary => summary.patchId)

            const aggregatedMetrics = await fetchOrganizingUniverseMetrics({
              patchIds,
              userId: lead.id,  // Use the coordinator's ID, not the admin's ID
              userRole: viewerRole
            })

            const patches = serverSummaries.map(mapServerPatchToSummary)
            const totalProjects = aggregatedMetrics.totalActiveProjects > 0
              ? aggregatedMetrics.totalActiveProjects
              : serverSummaries.reduce((sum, summary) => sum + (summary.projectCount || 0), 0)

            const pendingOrganiserRows = (pendingByLead.get(String(lead.id)) || [])
              .filter((row: any) => row && (!row.status || pendingStatuses.includes(row.status)))
            const pendingOrganiserNames = mergeOrganiserNameLists([], pendingOrganiserRows as any[])

            return {
              leadOrganizerId: lead.id,
              leadOrganizerName: lead.full_name || lead.email || 'Unknown',
              email: lead.email || '',
              patchCount: serverSummaries.length,
              totalProjects,
              patches,
              aggregatedMetrics,
              lastUpdated: new Date().toISOString(),
              pendingOrganisers: pendingOrganiserNames,
              isPending: lead.isDraft || false,
              status: lead.isDraft ? (lead.status || 'draft') : 'active'
            } as LeadOrganizerSummary
          } catch (error) {
            console.error(`Error fetching lead summary for ${lead?.id}:`, error)
            return null
          }
        })
      )

      return liveSummaries.filter(Boolean) as LeadOrganizerSummary[]
    }
  })
}

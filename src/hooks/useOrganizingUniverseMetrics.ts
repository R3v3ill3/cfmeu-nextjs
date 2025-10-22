import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export interface OrganizingUniverseMetrics {
  // % of organizing universe = active projects that are EBA projects (Builder/main contractor EBA status = active)
  ebaProjectsPercentage: number
  ebaProjectsCount: number
  totalActiveProjects: number

  // % of organizing universe = active projects where Builder/main contractor is known
  knownBuilderPercentage: number
  knownBuilderCount: number

  // % of known key contractors on projects where organizing universe = active
  keyContractorCoveragePercentage: number
  mappedKeyContractors: number
  totalKeyContractorSlots: number

  // % of known key contractors on projects where builder/main contractor has EBA = active
  keyContractorEbaBuilderPercentage: number
  keyContractorsOnEbaBuilderProjects: number
  totalKeyContractorsOnEbaBuilderProjects: number

  // % of key contractors on projects where organizing universe = active that are EBA = active employers
  keyContractorEbaPercentage: number
  keyContractorsWithEba: number
  totalMappedKeyContractors: number
}

export interface OrganizingUniverseFilters {
  patchIds?: string[]
  tier?: string
  stage?: string
  universe?: string
  eba?: string
  userId?: string // For role-based filtering
  userRole?: string
}

/**
 * Hook to calculate organizing universe metrics with optional filtering
 * All operations are read-only to ensure data protection
 */
export function useOrganizingUniverseMetrics(filters: OrganizingUniverseFilters = {}) {
  return useQuery({
    queryKey: ["organizing-universe-metrics", filters],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: () => fetchOrganizingUniverseMetrics(filters)
  })
}

/**
 * Standalone fetcher so non-hook code paths can reuse the same logic
 */
export async function fetchOrganizingUniverseMetrics(filters: OrganizingUniverseFilters = {}): Promise<OrganizingUniverseMetrics> {
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'

  if (Array.isArray(filters.patchIds) && filters.patchIds.length === 0) {
    return getEmptyMetrics()
  }

  try {

    if (USE_SERVER_SIDE) {
      const searchParams = new URLSearchParams()

      if (filters.patchIds && filters.patchIds.length > 0) {
        searchParams.set('patchIds', filters.patchIds.join(','))
      }
      if (filters.tier && filters.tier !== 'all') {
        searchParams.set('tier', filters.tier)
      }
      if (filters.stage && filters.stage !== 'all') {
        searchParams.set('stage', filters.stage)
      }
      if (filters.universe && filters.universe !== 'all') {
        searchParams.set('universe', filters.universe)
      }
      if (filters.eba && filters.eba !== 'all') {
        searchParams.set('eba', filters.eba)
      }
      if (filters.userId) {
        searchParams.set('userId', filters.userId)
      }
      if (filters.userRole) {
        searchParams.set('userRole', filters.userRole)
      }

      const url = `/api/dashboard/organizing-metrics?${searchParams.toString()}`
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error('Failed to fetch server-side organizing metrics:', response.status, errorText)
          return getEmptyMetrics()
        }

        const data = await response.json()
        return data?.metrics || getEmptyMetrics()
      } catch (error) {
        console.error('Error fetching server-side organizing metrics:', error)
        return getEmptyMetrics()
      }
    }

    // Get active projects (organizing universe = active)
    let activeProjectsQuery = supabase
      .from("projects")
      .select(`
        id,
        name,
        organising_universe,
        stage_class,
        tier,
        project_assignments!left(
          assignment_type,
          is_primary_for_role,
          employers!left(
            id,
            name,
            company_eba_records!left(id, fwc_certified_date)
          ),
          contractor_role_types!left(code),
          trade_types!left(code)
        ),
        job_sites!left(
          id,
          site_contractor_trades!left(
            employer_id,
            trade_type,
            employers!left(
              id,
              name,
              company_eba_records!left(id, fwc_certified_date)
            )
          )
        )
      `)
      .eq("organising_universe", "active")

    // Apply patch filtering if specified
    if (filters.patchIds && filters.patchIds.length > 0) {
      
      const { data: patchSites, error: patchSitesError } = await supabase
        .from("patch_job_sites")
        .select("job_site_id")
        .in("patch_id", filters.patchIds)
        .is("effective_to", null)

      if (patchSitesError) {
        console.error('Patch sites query error:', patchSitesError)
      }

      const siteIds = patchSites?.map(ps => ps.job_site_id) || []
      
      if (siteIds.length > 0) {
        activeProjectsQuery = activeProjectsQuery
          .in("main_job_site_id", siteIds)
      } else {
        // No sites in patches, return empty metrics
        console.warn('No sites found for patches:', filters.patchIds)
        return getEmptyMetrics()
      }
    }

    // Apply additional filters
    if (filters.tier && filters.tier !== "all") {
      activeProjectsQuery = activeProjectsQuery.eq("tier", filters.tier)
    }
    if (filters.stage && filters.stage !== "all") {
      activeProjectsQuery = activeProjectsQuery.eq("stage_class", filters.stage)
    }

    const { data: activeProjects, error } = await activeProjectsQuery

    if (error) {
      console.error("Error fetching active projects:", error)
      throw error
    }

    
    // Fetch key contractor trades from database (replaces hard-coded list)
    const { data: keyTradesData, error: keyTradesError } = await (supabase as any)
      .from('key_contractor_trades')
      .select('trade_type')
      .eq('is_active', true)
    
    if (keyTradesError) {
      console.error('Failed to fetch key trades, using fallback:', keyTradesError)
    }
    
    // Use database trades if available, otherwise fallback to ensure metrics don't fail
    // Fallback includes all 10 trades (fixes previous 7-trade bug)
    const keyTrades = new Set<string>(
      keyTradesData && keyTradesData.length > 0
        ? keyTradesData.map((t: any) => t.trade_type as string)
        : ['demolition', 'piling', 'concrete', 'scaffolding', 'form_work', 'tower_crane', 'mobile_crane', 'labour_hire', 'earthworks', 'traffic_control']
    )
    
    const metrics = calculateMetrics(activeProjects || [], keyTrades)

    return metrics
  } catch (error) {
    console.error("Error calculating organizing universe metrics:", error)
    return getEmptyMetrics()
  }
}

/**
 * Calculate organizing universe metrics from project data
 * Pure function for safe metric calculations
 */
function calculateMetrics(projects: any[], keyContractorTrades: Set<string>): OrganizingUniverseMetrics {
  const totalActiveProjects = projects.length
  
  
  const KEY_CONTRACTOR_TRADES = keyContractorTrades

  // Key contractor roles we track  
  const KEY_CONTRACTOR_ROLES = new Set([
    'head_contractor', 'builder'
  ])

  let ebaProjectsCount = 0
  let knownBuilderCount = 0
  let mappedKeyContractors = 0
  let totalKeyContractorSlots = 0
  let keyContractorsWithEba = 0
  let keyContractorsOnEbaBuilderProjects = 0
  let totalKeyContractorsOnEbaBuilderProjects = 0

  projects.forEach(project => {
    // Find builder/main contractor - updated to use correct schema
    const builderAssignments = project.project_assignments?.filter((pa: any) => 
      pa.assignment_type === 'contractor_role' && 
      pa.is_primary_for_role === true
    ) || []

    const builder = builderAssignments[0]?.employers
    const builderHasEba = builder?.company_eba_records?.some((eba: any) => eba.fwc_certified_date)
    

    // 1. EBA Projects (builder has active EBA)
    if (builderHasEba) {
      ebaProjectsCount++
    }

    // 2. Known builder projects
    if (builder) {
      knownBuilderCount++
    }

    // 3-5. Key contractor analysis
    const projectKeyContractors = new Set()
    const projectKeyContractorsWithEba = new Set()

    // Count total key contractor slots for this project
    totalKeyContractorSlots += KEY_CONTRACTOR_TRADES.size + KEY_CONTRACTOR_ROLES.size

    // Check contractor roles - updated to use correct schema
    project.project_assignments?.forEach((pa: any) => {
      if (pa.assignment_type === 'contractor_role' && 
          pa.contractor_role_types?.code && 
          KEY_CONTRACTOR_ROLES.has(pa.contractor_role_types.code)) {
        
        projectKeyContractors.add(pa.contractor_role_types.code)
        
        const hasEba = pa.employers?.company_eba_records?.some((eba: any) => eba.fwc_certified_date)
        if (hasEba) {
          projectKeyContractorsWithEba.add(pa.contractor_role_types.code)
        }

        // For projects where builder has EBA
        if (builderHasEba) {
          totalKeyContractorsOnEbaBuilderProjects++
          if (hasEba) {
            keyContractorsOnEbaBuilderProjects++
          }
        }
      }
    })

    // Check trade contractors - using direct enum field
    project.job_sites?.forEach((site: any) => {
      site.site_contractor_trades?.forEach((sct: any) => {
        const tradeCode = sct.trade_type // Direct enum string
        
        if (tradeCode && KEY_CONTRACTOR_TRADES.has(tradeCode)) {
          projectKeyContractors.add(tradeCode)
          
          const hasEba = sct.employers?.company_eba_records?.some((eba: any) => eba.fwc_certified_date)
          if (hasEba) {
            projectKeyContractorsWithEba.add(tradeCode)
          }

          // For projects where builder has EBA
          if (builderHasEba) {
            totalKeyContractorsOnEbaBuilderProjects++
            if (hasEba) {
              keyContractorsOnEbaBuilderProjects++
            }
          }
        }
      })
    })

    // Add to totals
    mappedKeyContractors += projectKeyContractors.size
    keyContractorsWithEba += projectKeyContractorsWithEba.size
  })

  // Calculate percentages
  const ebaProjectsPercentage = totalActiveProjects > 0 
    ? Math.round((ebaProjectsCount / totalActiveProjects) * 100) 
    : 0

  const knownBuilderPercentage = totalActiveProjects > 0 
    ? Math.round((knownBuilderCount / totalActiveProjects) * 100) 
    : 0

  const keyContractorCoveragePercentage = totalKeyContractorSlots > 0 
    ? Math.round((mappedKeyContractors / totalKeyContractorSlots) * 100) 
    : 0

  const keyContractorEbaBuilderPercentage = totalKeyContractorsOnEbaBuilderProjects > 0 
    ? Math.round((keyContractorsOnEbaBuilderProjects / totalKeyContractorsOnEbaBuilderProjects) * 100) 
    : 0

  const keyContractorEbaPercentage = mappedKeyContractors > 0
    ? Math.round((keyContractorsWithEba / mappedKeyContractors) * 100)
    : 0

  return {
    ebaProjectsPercentage,
    ebaProjectsCount,
    totalActiveProjects,
    knownBuilderPercentage,
    knownBuilderCount,
    keyContractorCoveragePercentage,
    mappedKeyContractors,
    totalKeyContractorSlots,
    keyContractorEbaBuilderPercentage,
    keyContractorsOnEbaBuilderProjects,
    totalKeyContractorsOnEbaBuilderProjects,
    keyContractorEbaPercentage,
    keyContractorsWithEba,
    totalMappedKeyContractors: mappedKeyContractors
  }
}

/**
 * Return empty metrics for error states or when no data is available
 */
function getEmptyMetrics(): OrganizingUniverseMetrics {
  return {
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
  }
}

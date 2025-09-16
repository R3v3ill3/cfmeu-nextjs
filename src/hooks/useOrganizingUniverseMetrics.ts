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
  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_DASHBOARD === 'true'
  
  return useQuery({
    queryKey: ["organizing-universe-metrics", filters],
    enabled: !USE_SERVER_SIDE, // Only run when server-side is disabled
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OrganizingUniverseMetrics> => {
      try {
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
          console.log('🔍 Applying patch filter:', filters.patchIds)
          
          const { data: patchSites, error: patchSitesError } = await supabase
            .from("patch_job_sites")
            .select("job_site_id")
            .in("patch_id", filters.patchIds)
            .is("effective_to", null)

          if (patchSitesError) {
            console.error('Patch sites query error:', patchSitesError)
          }

          const siteIds = patchSites?.map(ps => ps.job_site_id) || []
          console.log('🔍 Found patch sites:', siteIds.length)
          
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

        console.log(`📊 Loaded ${activeProjects?.length || 0} active projects for organizing universe metrics`)
        
        const metrics = calculateMetrics(activeProjects || [])
        console.log('📊 Calculated organizing universe metrics:', metrics)
        
        return metrics
      } catch (error) {
        console.error("Error calculating organizing universe metrics:", error)
        return getEmptyMetrics()
      }
    }
  })
}

/**
 * Calculate organizing universe metrics from project data
 * Pure function for safe metric calculations
 */
function calculateMetrics(projects: any[]): OrganizingUniverseMetrics {
  const totalActiveProjects = projects.length
  
  console.log(`🔢 Calculating metrics for ${totalActiveProjects} projects`)
  
  // Define key contractor trades that we track (matching database enum values)
  const KEY_CONTRACTOR_TRADES = new Set([
    'demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 'tower_crane', 'mobile_crane'
  ])

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
    
    console.log(`📋 Project ${project.name}: builder=${builder?.name}, hasEba=${builderHasEba}`)

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
        console.log(`🔧 Checking trade: ${tradeCode} against key trades:`, KEY_CONTRACTOR_TRADES)
        
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

  console.log('🔢 Final percentages calculated:', {
    ebaProjectsPercentage,
    knownBuilderPercentage,
    keyContractorCoveragePercentage,
    keyContractorEbaBuilderPercentage,
    keyContractorEbaPercentage
  })

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

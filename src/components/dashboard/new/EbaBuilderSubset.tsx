"use client"

import { useMemo, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, ResponsiveContainer } from "recharts"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Shield } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

interface EbaBuilderSubsetProps {
  patchIds?: string[]
}

interface EmployerMetricsData {
  tier: string
  ebaBuilderSites: {
    totalKnown: number
    ebaCount: number
    percentage: number
  }
  nonEbaBuilderSites: {
    totalKnown: number
    ebaCount: number
    percentage: number
  }
  totalKnownBuilderSites: {
    totalKnown: number
    ebaCount: number
    percentage: number
  }
}

export function EbaBuilderSubset({ patchIds = [] }: EbaBuilderSubsetProps) {
  const sp = useSearchParams()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined
  const { hasActiveFilters, activeFilters } = useActiveFilters()

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Fetch employer metrics by tier and builder EBA status
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ['eba-employer-metrics', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async (): Promise<EmployerMetricsData[]> => {
      // Initialize Maps and ensure cleanup
      const projectBuilderEbaMap = new Map<string, boolean>()
      const projectHasBuilderMap = new Map<string, boolean>()
      const projectEmployersMap = new Map<string, { known: Set<string>, eba: Set<string> }>()

      try {
        // First, get project IDs (with patch filtering if needed)
      let projectIds: string[] | null = null
      
      if (patchIds.length > 0) {
        const { data: jobSites } = await supabase
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)

        if (jobSites && jobSites.length > 0) {
          projectIds = [...new Set(jobSites.map(js => js.project_id))]
        } else {
          return []
        }
      }

      // Get projects with their tier
      let projectsQuery = supabase
        .from('projects')
        .select('id, tier')
        .eq('organising_universe', normalizedUniverse)
        .eq('stage_class', normalizedStage)

      if (projectIds) {
        projectsQuery = projectsQuery.in('id', projectIds)
      }

      const { data: projects, error: projectsError } = await projectsQuery

      if (projectsError) {
        console.error('Error fetching projects:', projectsError)
        throw projectsError
      }

      if (!projects || projects.length === 0) {
        return []
      }

      const projectIdsList = projects.map(p => p.id)

      // Get all project assignments with employer and EBA info
      const { data: assignments, error: assignmentsError } = await supabase
        .from('project_assignments')
        .select(`
          project_id,
          employer_id,
          assignment_type,
          contractor_role_type_id,
          contractor_role_types!left(code),
          employers!inner(
            id,
            company_eba_records!left(
              id,
              fwc_certified_date
            )
          )
        `)
        .in('project_id', projectIdsList)

      if (assignmentsError) {
        console.error('Error fetching assignments:', assignmentsError)
        throw assignmentsError
      }

      // Build map of project -> builder has EBA (Maps already initialized above)

      // Process assignments to identify builders with EBA
      const builderRoleCodes = new Set(['builder', 'head_contractor'])
      
      assignments?.forEach((pa: any) => {
        if (pa.assignment_type === 'contractor_role' && pa.contractor_role_types?.code) {
          const isBuilder = builderRoleCodes.has(pa.contractor_role_types.code)
          if (isBuilder) {
            projectHasBuilderMap.set(pa.project_id, true)
            
            // Check if this builder has EBA
            const ebaRecords = pa.employers?.company_eba_records || []
            const hasEba = ebaRecords.some((eba: any) => eba.fwc_certified_date)
            
            if (hasEba) {
              projectBuilderEbaMap.set(pa.project_id, true)
            } else if (!projectBuilderEbaMap.has(pa.project_id)) {
              // Only set to false if we haven't found an EBA builder yet
              projectBuilderEbaMap.set(pa.project_id, false)
            }
          }
        }
      })

      // Aggregate by tier
      const metricsByTier: Record<string, {
        ebaBuilderSites: { known: Set<string>, eba: Set<string> }
        nonEbaBuilderSites: { known: Set<string>, eba: Set<string> }
        totalKnownBuilderSites: { known: Set<string>, eba: Set<string> }
      }> = {
        total: {
          ebaBuilderSites: { known: new Set(), eba: new Set() },
          nonEbaBuilderSites: { known: new Set(), eba: new Set() },
          totalKnownBuilderSites: { known: new Set(), eba: new Set() }
        },
        tier_1: {
          ebaBuilderSites: { known: new Set(), eba: new Set() },
          nonEbaBuilderSites: { known: new Set(), eba: new Set() },
          totalKnownBuilderSites: { known: new Set(), eba: new Set() }
        },
        tier_2: {
          ebaBuilderSites: { known: new Set(), eba: new Set() },
          nonEbaBuilderSites: { known: new Set(), eba: new Set() },
          totalKnownBuilderSites: { known: new Set(), eba: new Set() }
        },
        tier_3: {
          ebaBuilderSites: { known: new Set(), eba: new Set() },
          nonEbaBuilderSites: { known: new Set(), eba: new Set() },
          totalKnownBuilderSites: { known: new Set(), eba: new Set() }
        }
      }

      // Process each project - only count projects with known builders (Map already initialized above)

      // Aggregate employers by project
      assignments?.forEach((pa: any) => {
        const projectId = pa.project_id
        const employerId = pa.employer_id
        
        if (!projectId || !employerId) return

        if (!projectEmployersMap.has(projectId)) {
          projectEmployersMap.set(projectId, { known: new Set(), eba: new Set() })
        }

        const projectData = projectEmployersMap.get(projectId)!
        projectData.known.add(employerId)

        // Check if employer has EBA
        const ebaRecords = pa.employers?.company_eba_records || []
        const hasEba = ebaRecords.some((eba: any) => eba.fwc_certified_date)
        if (hasEba) {
          projectData.eba.add(employerId)
        }
      })

      // Aggregate by tier
      for (const project of projects) {
        const projectId = project.id
        const projectTier = project.tier || 'tier_3'
        
        // Only process projects with known builders
        if (!projectHasBuilderMap.get(projectId)) {
          continue
        }

        const hasEbaBuilder = projectBuilderEbaMap.get(projectId) || false
        const projectData = projectEmployersMap.get(projectId)
        
        if (!projectData) continue

        // Add to appropriate buckets
        const tiersToUpdate = ['total', projectTier]
        
        for (const tier of tiersToUpdate) {
          if (hasEbaBuilder) {
            // EBA builder site
            projectData.known.forEach(id => metricsByTier[tier].ebaBuilderSites.known.add(id))
            projectData.eba.forEach(id => metricsByTier[tier].ebaBuilderSites.eba.add(id))
          } else {
            // Non-EBA builder site
            projectData.known.forEach(id => metricsByTier[tier].nonEbaBuilderSites.known.add(id))
            projectData.eba.forEach(id => metricsByTier[tier].nonEbaBuilderSites.eba.add(id))
          }
          
          // Total known builder sites (all sites with known builders)
          projectData.known.forEach(id => metricsByTier[tier].totalKnownBuilderSites.known.add(id))
          projectData.eba.forEach(id => metricsByTier[tier].totalKnownBuilderSites.eba.add(id))
        }
      }

      // Convert to percentage format
      const result: EmployerMetricsData[] = []
      
      for (const [tier, data] of Object.entries(metricsByTier)) {
        result.push({
          tier: tier === 'total' ? 'Total' : tier.replace('tier_', 'Tier '),
          ebaBuilderSites: {
            totalKnown: data.ebaBuilderSites.known.size,
            ebaCount: data.ebaBuilderSites.eba.size,
            percentage: data.ebaBuilderSites.known.size > 0
              ? Math.round((data.ebaBuilderSites.eba.size / data.ebaBuilderSites.known.size) * 100)
              : 0
          },
          nonEbaBuilderSites: {
            totalKnown: data.nonEbaBuilderSites.known.size,
            ebaCount: data.nonEbaBuilderSites.eba.size,
            percentage: data.nonEbaBuilderSites.known.size > 0
              ? Math.round((data.nonEbaBuilderSites.eba.size / data.nonEbaBuilderSites.known.size) * 100)
              : 0
          },
          totalKnownBuilderSites: {
            totalKnown: data.totalKnownBuilderSites.known.size,
            ebaCount: data.totalKnownBuilderSites.eba.size,
            percentage: data.totalKnownBuilderSites.known.size > 0
              ? Math.round((data.totalKnownBuilderSites.eba.size / data.totalKnownBuilderSites.known.size) * 100)
              : 0
          }
        })
      }

      // Sort: Total first, then Tier 1, 2, 3
      const tierOrder = ['Total', 'Tier 1', 'Tier 2', 'Tier 3']
      return result.sort((a, b) => tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier))

      } catch (error) {
        console.error('Error in EBA employer metrics query:', error)
        throw error
      } finally {
        // Clean up Maps to prevent memory leaks
        projectBuilderEbaMap.clear()
        projectHasBuilderMap.clear()
        projectEmployersMap.clear()
      }
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  })

  // Format data for chart
  const chartData = useMemo(() => {
    if (!metricsData) return []
    
    return metricsData.map(tierData => ({
      tier: tierData.tier,
      'EBA Builder Sites': tierData.ebaBuilderSites.percentage,
      'Non-EBA Builder Sites': tierData.nonEbaBuilderSites.percentage,
      'Total Known Builder Sites': tierData.totalKnownBuilderSites.percentage,
    }))
  }, [metricsData])

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            EBA Employer Rates by Builder Status
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading employer metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!metricsData || metricsData.length === 0) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            EBA Employer Rates by Builder Status
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded flex items-center justify-center">
            <p className="text-sm text-gray-500">No employer data found for the selected filters</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            EBA Employer Rates by Builder Status
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Percentage of known employers with EBA, grouped by builder EBA status and project tier
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            'EBA Builder Sites': { label: 'EBA Builder Sites', color: 'hsl(142 71% 45%)' },
            'Non-EBA Builder Sites': { label: 'Non-EBA Builder Sites', color: 'hsl(221 83% 53%)' },
            'Total Known Builder Sites': { label: 'Total Known Builder Sites', color: 'hsl(168 85% 47%)' },
          }}
          className="w-full h-[400px]"
        >
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="tier" 
              tick={{ fontSize: 12 }}
            />
            <YAxis 
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              label={{ value: 'EBA Employers (%)', angle: -90, position: 'insideLeft' }}
            />
            <ChartTooltip 
              content={({ active, payload }) => {
                if (!active || !payload || payload.length === 0) return null
                
                const tierData = metricsData?.find(d => d.tier === payload[0].payload.tier)
                if (!tierData) return null

                const dataKey = payload[0].dataKey as string
                let data = tierData.totalKnownBuilderSites
                if (dataKey === 'EBA Builder Sites') {
                  data = tierData.ebaBuilderSites
                } else if (dataKey === 'Non-EBA Builder Sites') {
                  data = tierData.nonEbaBuilderSites
                }

                return (
                  <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
                    <p className="font-medium text-sm mb-2">{payload[0].payload.tier}</p>
                    <p className="text-xs font-medium mb-1">{payload[0].name}</p>
                    <p className="text-xs text-gray-600">
                      {data.ebaCount} / {data.totalKnown} employers ({payload[0].value}%)
                    </p>
                  </div>
                )
              }}
            />
            <Legend />
            <Bar 
              dataKey="EBA Builder Sites" 
              fill="hsl(142 71% 45%)" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="Non-EBA Builder Sites" 
              fill="hsl(221 83% 53%)" 
              radius={[4, 4, 0, 0]}
            />
            <Bar 
              dataKey="Total Known Builder Sites" 
              fill="hsl(168 85% 47%)" 
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

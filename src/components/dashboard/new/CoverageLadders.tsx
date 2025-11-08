"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
import { useCoverageLadders } from "@/hooks/useCoverageLadders"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Building, Users } from "lucide-react"

interface CoverageLaddersProps {
  patchIds?: string[]
}

export function CoverageLadders({ patchIds = [] }: CoverageLaddersProps) {
  const sp = useSearchParams()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined
  const { hasActiveFilters, activeFilters } = useActiveFilters()

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Use the SAME data source as the top KPI boxes to ensure consistency
  // The worker endpoint has different calculation logic that produces incorrect results
  // So we use the metrics API which matches the top KPIs exactly
  const { data: serverMetrics, isLoading: serverMetricsLoading } = useOrganizingUniverseMetricsServerSideCompatible({
    universe: normalizedUniverse,
    stage: normalizedStage,
    patchIds
  })
  const { data: clientMetrics, isLoading: clientMetricsLoading } = useOrganizingUniverseMetrics({
    universe: normalizedUniverse,
    stage: normalizedStage
  })
  
  // Use server metrics first (same as top KPIs), fallback to client metrics
  const metrics = serverMetrics || clientMetrics

  // Calculate Projects Ladder data - use metrics data (same source as top KPIs)
  const projectsLadderData = useMemo(() => {
    if (!metrics) {
      // Still loading
      if (serverMetricsLoading || clientMetricsLoading) {
        return null
      }
      console.warn('⚠️ Coverage Ladders: No metrics data available')
      return null
    }

    // Use metrics data (same calculation as top KPIs)
    const metricsTotal = metrics.totalActiveProjects || 0
    const metricsKnownBuilders = metrics.knownBuilderCount || 0
    const metricsEbaBuilders = metrics.ebaProjectsCount || 0
    const unknownBuilders = metricsTotal - metricsKnownBuilders
    const knownNonEbaBuilders = metricsKnownBuilders - metricsEbaBuilders

    if (process.env.NODE_ENV === 'development') {
      console.debug('✅ Coverage Ladders: Using metrics data (same source as top KPIs)', {
        total: metricsTotal,
        knownBuilders: metricsKnownBuilders,
        ebaBuilders: metricsEbaBuilders,
        source: serverMetrics ? 'server-metrics' : 'client-metrics'
      })
    }

    return {
      total: metricsTotal,
      segments: [
        {
          name: "EBA builder",
          value: metricsEbaBuilders,
          percentage: metricsTotal > 0 ? Math.round((metricsEbaBuilders / metricsTotal) * 100) : 0,
          color: "hsl(142 71% 45%)",
        },
        {
          name: "Known, non-EBA builder",
          value: knownNonEbaBuilders,
          percentage: metricsTotal > 0 ? Math.round((knownNonEbaBuilders / metricsTotal) * 100) : 0,
          color: "hsl(221 83% 53%)",
        },
        {
          name: "Unknown builder",
          value: unknownBuilders,
          percentage: metricsTotal > 0 ? Math.round((unknownBuilders / metricsTotal) * 100) : 0,
          color: "#d1d5db",
        },
      ],
      knownBuilders: metricsKnownBuilders,
      ebaBuilders: metricsEbaBuilders,
      knownBuilderPercentage: metricsKnownBuilders > 0 && metricsTotal > 0
        ? Math.round((metricsKnownBuilders / metricsTotal) * 100)
        : 0,
      ebaOfKnownPercentage: metricsKnownBuilders > 0
        ? Math.round((metricsEbaBuilders / metricsKnownBuilders) * 100)
        : 0,
    }
  }, [metrics, serverMetrics, serverMetricsLoading, clientMetricsLoading])

  // Calculate Contractor Ladder data - use metrics data (same source as top KPIs)
  const contractorLadderData = useMemo(() => {
    if (!metrics) {
      // Still loading
      if (serverMetricsLoading || clientMetricsLoading) {
        return null
      }
      return null
    }

    const totalSlots = metrics.totalKeyContractorSlots || 0
    const identified = metrics.mappedKeyContractors || 0
    const eba = metrics.keyContractorsWithEba || 0
    const unidentified = totalSlots - identified
    const identifiedNonEba = identified - eba

    return {
      total: totalSlots,
      segments: [
        {
          name: "Identified contractor, EBA",
          value: eba,
          percentage: totalSlots > 0 ? Math.round((eba / totalSlots) * 100) : 0,
          color: "hsl(142 71% 45%)",
        },
        {
          name: "Identified contractor, non-EBA",
          value: identifiedNonEba,
          percentage: totalSlots > 0 ? Math.round((identifiedNonEba / totalSlots) * 100) : 0,
          color: "hsl(221 83% 53%)",
        },
        {
          name: "Unidentified slot",
          value: unidentified,
          percentage: totalSlots > 0 ? Math.round((unidentified / totalSlots) * 100) : 0,
          color: "#d1d5db",
        },
      ],
      identified,
      eba,
      identifiedPercentage: totalSlots > 0
        ? Math.round((identified / totalSlots) * 100)
        : 0,
      ebaOfIdentifiedPercentage: identified > 0
        ? Math.round((eba / identified) * 100)
        : 0,
    }
  }, [metrics, serverMetricsLoading, clientMetricsLoading])

  // Format data for stacked bar chart - use ladder data
  const projectsChartData = projectsLadderData ? [{
    name: "Projects",
    "EBA builder": projectsLadderData.segments[0].value,
    "Known, non-EBA builder": projectsLadderData.segments[1].value,
    "Unknown builder": projectsLadderData.segments[2].value,
  }] : []

  const contractorChartData = contractorLadderData ? [{
    name: "Contractors",
    "Identified contractor, EBA": contractorLadderData.segments[0].value,
    "Identified contractor, non-EBA": contractorLadderData.segments[1].value,
    "Unidentified slot": contractorLadderData.segments[2].value,
  }] : []

  // Simplified height classes to fix mobile rendering issues
  const ladderHeightClasses = "w-full h-[120px]"

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    try {
      const data = payload[0]?.payload
      if (!data) return null

      const total = Object.values(data).reduce((sum: number, val: any) => {
        if (typeof val === 'number' && val !== data.name && isFinite(val)) return sum + val
        return sum
      }, 0) as number

      if (total === 0 || !isFinite(total)) return null

      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm mb-2">{data.name || 'Unknown'}</p>
          {payload.map((entry: any, index: number) => {
            if (!entry || entry.dataKey === 'name') return null
            const value = entry.value as number
            if (!isFinite(value)) return null
            const percentage = total > 0 ? Math.round((value / total) * 100) : 0
            return (
              <div key={index} className="flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: entry.color || '#ccc' }}
                  />
                  <span>{entry.name || 'Unknown'}:</span>
                </div>
                <span className="font-medium tabular-nums">
                  {value} / {total} ({percentage}%)
                </span>
              </div>
            )
          })}
        </div>
      )
    } catch (error) {
      console.error('Error in CoverageLadders CustomTooltip:', error)
      return null
    }
  }

  if (!metrics) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Coverage Ladders
            <FilterIndicatorBadge
              hasActiveFilters={hasActiveFilters}
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>
            Loading coverage metrics{patchIds.length > 0 ? ` for ${patchIds.length} patch${patchIds.length > 1 ? 'es' : ''}` : ''}...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
          <div className="text-center text-xs text-gray-500 mt-2">
            Fetching project and contractor coverage data
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Coverage Ladders
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Know → Align: Coverage progress from unknown to identified to EBA
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Projects Ladder */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
            <Building className="h-4 w-4" />
            Projects Ladder (denom = all active projects)
          </h4>
          {projectsLadderData && (
            <>
              <div className="space-y-1 mb-2">
                <div className="text-xs text-gray-600">
                  Known builders: {projectsLadderData.knownBuilders} / {projectsLadderData.total} ({projectsLadderData.knownBuilderPercentage}%)
                </div>
                <div className="text-xs text-gray-600">
                  EBA builders (of all projects): {projectsLadderData.ebaBuilders} / {projectsLadderData.total} ({projectsLadderData.segments[0].percentage}%)
                </div>
                <div className="text-xs text-gray-500 italic">
                  of known: {projectsLadderData.ebaBuilders} / {projectsLadderData.knownBuilders} ({projectsLadderData.ebaOfKnownPercentage}%)
                </div>
              </div>
              <ChartContainer
                config={{
                  "EBA builder": { label: "EBA builder", color: "hsl(142 71% 45%)" },
                  "Known, non-EBA builder": { label: "Known, non-EBA builder", color: "hsl(221 83% 53%)" },
                  "Unknown builder": { label: "Unknown builder", color: "#d1d5db" },
                }}
                className={ladderHeightClasses}
              >
                <BarChart
                  data={projectsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, projectsLadderData.total]} hide />
                  <YAxis type="category" dataKey="name" width={0} tick={false} axisLine={false} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="EBA builder" stackId="a" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="Known, non-EBA builder" stackId="a" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="Unknown builder" stackId="a" fill="#d1d5db" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
              <div className="flex justify-between text-xs text-gray-600 mt-2 pl-0">
                <span>0</span>
                <span className="font-medium">{projectsLadderData.total} projects</span>
              </div>
            </>
          )}
        </div>

        {/* Contractor Ladder */}
        <div className="space-y-4">
          <h4 className="font-medium text-gray-900 text-sm mb-2 flex items-center gap-2">
            <Users className="h-4 w-4" />
            Key-contractor Ladder (denom = total contractor slots across all projects)
          </h4>
          {contractorLadderData && (
            <>
              <div className="space-y-1 mb-2">
                <div className="text-xs text-gray-600">
                  Identified: {contractorLadderData.identified} / {contractorLadderData.total} ({contractorLadderData.identifiedPercentage}%)
                </div>
                <div className="text-xs text-gray-600">
                  EBA of identified: {contractorLadderData.eba} / {contractorLadderData.identified} ({contractorLadderData.ebaOfIdentifiedPercentage}%)
                </div>
                <div className="text-xs text-gray-600">
                  EBA of total: {contractorLadderData.eba} / {contractorLadderData.total} ({contractorLadderData.segments[0].percentage}%)
                </div>
              </div>
              <ChartContainer
                config={{
                  "Identified contractor, EBA": { label: "Identified contractor, EBA", color: "hsl(142 71% 45%)" },
                  "Identified contractor, non-EBA": { label: "Identified contractor, non-EBA", color: "hsl(221 83% 53%)" },
                  "Unidentified slot": { label: "Unidentified slot", color: "#d1d5db" },
                }}
                className={ladderHeightClasses}
              >
                <BarChart
                  data={contractorChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, contractorLadderData.total]} hide />
                  <YAxis type="category" dataKey="name" width={0} tick={false} axisLine={false} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Identified contractor, EBA" stackId="b" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
                  <Bar dataKey="Identified contractor, non-EBA" stackId="b" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="Unidentified slot" stackId="b" fill="#d1d5db" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
              <div className="flex justify-between text-xs text-gray-600 mt-2 pl-0">
                <span>0</span>
                <span className="font-medium">{contractorLadderData.total} slots</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}


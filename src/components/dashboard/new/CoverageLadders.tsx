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

  // Try to get data from worker first, then fallback to server-side or client-side
  const { data: workerData, error: workerError } = useCoverageLadders({
    patchIds,
    universe: universe,
    stage: stage,
    tier: undefined // Add tier support if needed later
  })

  const { data: clientMetrics } = useOrganizingUniverseMetrics({
    universe: normalizedUniverse,
    stage: normalizedStage
  })
  const { data: serverMetrics } = useOrganizingUniverseMetricsServerSideCompatible({
    universe: normalizedUniverse,
    stage: normalizedStage,
    patchIds
  })
  const metrics = workerData ? null : (serverMetrics || clientMetrics)

  // Calculate Projects Ladder data - use worker data if available
  const projectsLadderData = useMemo(() => {
    try {
      if (workerData && workerData.projects) {
        // Validate worker data structure and values
        const total = isFinite(workerData.projects.total) ? workerData.projects.total : 0
        const unknownBuilders = isFinite(workerData.projects.unknownBuilders) ? workerData.projects.unknownBuilders : 0
        const knownNonEbaBuilders = isFinite(workerData.projects.knownNonEbaBuilders) ? workerData.projects.knownNonEbaBuilders : 0
        const ebaBuilders = isFinite(workerData.projects.ebaBuilders) ? workerData.projects.ebaBuilders : 0
        const knownBuilders = isFinite(workerData.projects.knownBuilders) ? workerData.projects.knownBuilders : 0
        const knownBuilderPercentage = isFinite(workerData.projects.knownBuilderPercentage) ? workerData.projects.knownBuilderPercentage : 0
        const ebaOfKnownPercentage = isFinite(workerData.projects.ebaOfKnownPercentage) ? workerData.projects.ebaOfKnownPercentage : 0

        // Validate worker data against metrics if available
        const fallbackMetrics = serverMetrics || clientMetrics
        if (fallbackMetrics && total > 0) {
          const metricsKnownBuilders = fallbackMetrics.knownBuilderCount || 0
          const metricsEbaBuilders = fallbackMetrics.ebaProjectsCount || 0
          const metricsTotal = fallbackMetrics.totalActiveProjects || 0

          // Check for significant mismatches (more than 10% difference or absolute difference > 5)
          const knownBuildersDiff = Math.abs(knownBuilders - metricsKnownBuilders)
          const ebaBuildersDiff = Math.abs(ebaBuilders - metricsEbaBuilders)
          const totalDiff = Math.abs(total - metricsTotal)

          // If worker shows 0 but metrics show significant numbers, or if there's a large discrepancy
          const isKnownBuildersMismatch = (knownBuilders === 0 && metricsKnownBuilders > 5) || 
            (knownBuilders > 0 && knownBuildersDiff > Math.max(5, metricsKnownBuilders * 0.1))
          const isEbaBuildersMismatch = (ebaBuilders === 0 && metricsEbaBuilders > 5) || 
            (ebaBuilders > 0 && ebaBuildersDiff > Math.max(5, metricsEbaBuilders * 0.1))
          const isTotalMismatch = totalDiff > Math.max(5, metricsTotal * 0.1)

          if (isKnownBuildersMismatch || isEbaBuildersMismatch || isTotalMismatch) {
            console.warn('⚠️ Coverage Ladders: Worker data mismatch detected, falling back to metrics', {
              worker: { total, knownBuilders, ebaBuilders },
              metrics: { total: metricsTotal, knownBuilders: metricsKnownBuilders, ebaBuilders: metricsEbaBuilders },
              differences: { total: totalDiff, knownBuilders: knownBuildersDiff, ebaBuilders: ebaBuildersDiff }
            })
            // Fall through to use metrics data instead
          } else {
            // Worker data looks valid, use it
            if (process.env.NODE_ENV === 'development') {
              console.debug('✅ Coverage Ladders: Using worker data', {
                total,
                knownBuilders,
                ebaBuilders,
                source: 'worker'
              })
            }
            // Use data from Railway worker with validation
            return {
          total,
          segments: [
            {
              name: "Unknown builder",
              value: unknownBuilders,
              percentage: total > 0 ? Math.round((unknownBuilders / total) * 100) : 0,
              color: "#d1d5db", // medium grey for better contrast
            },
            {
              name: "Known, non-EBA builder",
              value: knownNonEbaBuilders,
              percentage: total > 0 ? Math.round((knownNonEbaBuilders / total) * 100) : 0,
              color: "hsl(221 83% 53%)", // blue
            },
            {
              name: "EBA builder",
              value: ebaBuilders,
              percentage: total > 0 ? Math.round((ebaBuilders / total) * 100) : 0,
              color: "hsl(142 71% 45%)", // green
            },
          ],
          knownBuilders,
          ebaBuilders,
          knownBuilderPercentage,
          ebaOfKnownPercentage,
        }
          }
        } else {
          // No metrics to validate against, use worker data
          if (process.env.NODE_ENV === 'development') {
            console.debug('✅ Coverage Ladders: Using worker data (no metrics for validation)', {
              total,
              knownBuilders,
              ebaBuilders,
              source: 'worker'
            })
          }
          // Use data from Railway worker with validation
          return {
            total,
            segments: [
              {
                name: "Unknown builder",
                value: unknownBuilders,
                percentage: total > 0 ? Math.round((unknownBuilders / total) * 100) : 0,
                color: "#d1d5db", // medium grey for better contrast
              },
              {
                name: "Known, non-EBA builder",
                value: knownNonEbaBuilders,
                percentage: total > 0 ? Math.round((knownNonEbaBuilders / total) * 100) : 0,
                color: "hsl(221 83% 53%)", // blue
              },
              {
                name: "EBA builder",
                value: ebaBuilders,
                percentage: total > 0 ? Math.round((ebaBuilders / total) * 100) : 0,
                color: "hsl(142 71% 45%)", // green
              },
            ],
            knownBuilders,
            ebaBuilders,
            knownBuilderPercentage,
            ebaOfKnownPercentage,
          }
        }
      }
    } catch (error) {
      console.error('Error processing worker data for projects ladder:', error)
    }

    // Fallback to metrics data
    const metrics = serverMetrics || clientMetrics
    if (!metrics) {
      if (process.env.NODE_ENV === 'development') {
        console.debug('⚠️ Coverage Ladders: No data available (worker failed, no metrics fallback)')
      }
      return null
    }

    if (process.env.NODE_ENV === 'development') {
      console.debug('✅ Coverage Ladders: Using metrics fallback data', {
        total: metrics.totalActiveProjects,
        knownBuilders: metrics.knownBuilderCount,
        ebaBuilders: metrics.ebaProjectsCount,
        source: serverMetrics ? 'server-metrics' : 'client-metrics'
      })
    }

    // Fallback to original logic using metrics data
    const totalProjects = metrics.totalActiveProjects || 0
    const knownBuilders = metrics.knownBuilderCount || 0
    const ebaBuilders = metrics.ebaProjectsCount || 0
    const unknownBuilders = totalProjects - knownBuilders
    const knownNonEbaBuilders = knownBuilders - ebaBuilders

    return {
      total: totalProjects,
      segments: [
        {
          name: "Unknown builder",
          value: unknownBuilders,
          percentage: totalProjects > 0 ? Math.round((unknownBuilders / totalProjects) * 100) : 0,
          color: "#d1d5db", // medium grey for better contrast
        },
        {
          name: "Known, non-EBA builder",
          value: knownNonEbaBuilders,
          percentage: totalProjects > 0 ? Math.round((knownNonEbaBuilders / totalProjects) * 100) : 0,
          color: "hsl(221 83% 53%)", // blue
        },
        {
          name: "EBA builder",
          value: ebaBuilders,
          percentage: totalProjects > 0 ? Math.round((ebaBuilders / totalProjects) * 100) : 0,
          color: "hsl(142 71% 45%)", // green
        },
      ],
      knownBuilders,
      ebaBuilders,
      knownBuilderPercentage: knownBuilders > 0 && totalProjects > 0
        ? Math.round((knownBuilders / totalProjects) * 100)
        : 0,
      ebaOfKnownPercentage: knownBuilders > 0
        ? Math.round((ebaBuilders / knownBuilders) * 100)
        : 0,
    }
  }, [workerData, serverMetrics, clientMetrics])

  // Calculate Contractor Ladder data - use worker data if available
  const contractorLadderData = useMemo(() => {
    try {
      if (workerData && workerData.contractors) {
        // Validate worker contractor data structure and values
        const total = isFinite(workerData.contractors.total) ? workerData.contractors.total : 0
        const unidentified = isFinite(workerData.contractors.unidentified) ? workerData.contractors.unidentified : 0
        const identifiedNonEba = isFinite(workerData.contractors.identifiedNonEba) ? workerData.contractors.identifiedNonEba : 0
        const eba = isFinite(workerData.contractors.eba) ? workerData.contractors.eba : 0
        const identified = isFinite(workerData.contractors.identified) ? workerData.contractors.identified : 0
        const identifiedPercentage = isFinite(workerData.contractors.identifiedPercentage) ? workerData.contractors.identifiedPercentage : 0
        const ebaOfIdentifiedPercentage = isFinite(workerData.contractors.ebaOfIdentifiedPercentage) ? workerData.contractors.ebaOfIdentifiedPercentage : 0

        // Use data from Railway worker with validation
        return {
          total,
          segments: [
            {
              name: "Unidentified slot",
              value: unidentified,
              percentage: total > 0 ? Math.round((unidentified / total) * 100) : 0,
              color: "#d1d5db", // medium grey for better contrast
            },
            {
              name: "Identified contractor, non-EBA",
              value: identifiedNonEba,
              percentage: total > 0 ? Math.round((identifiedNonEba / total) * 100) : 0,
              color: "hsl(221 83% 53%)", // blue
            },
            {
              name: "Identified contractor, EBA",
              value: eba,
              percentage: total > 0 ? Math.round((eba / total) * 100) : 0,
              color: "hsl(142 71% 45%)", // green
            },
          ],
          identified,
          eba,
          identifiedPercentage,
          ebaOfIdentifiedPercentage,
        }
      }
    } catch (error) {
      console.error('Error processing worker data for contractor ladder:', error)
    }

    if (!metrics) return null

    // Fallback to original logic using metrics data
    const totalSlots = metrics.totalKeyContractorSlots || 0
    const identified = metrics.mappedKeyContractors || 0
    const eba = metrics.keyContractorsWithEba || 0
    const unidentified = totalSlots - identified
    const identifiedNonEba = identified - eba

    return {
      total: totalSlots,
      segments: [
        {
          name: "Unidentified slot",
          value: unidentified,
          percentage: totalSlots > 0 ? Math.round((unidentified / totalSlots) * 100) : 0,
          color: "#d1d5db", // medium grey for better contrast
        },
        {
          name: "Identified contractor, non-EBA",
          value: identifiedNonEba,
          percentage: totalSlots > 0 ? Math.round((identifiedNonEba / totalSlots) * 100) : 0,
          color: "hsl(221 83% 53%)", // blue
        },
        {
          name: "Identified contractor, EBA",
          value: eba,
          percentage: totalSlots > 0 ? Math.round((eba / totalSlots) * 100) : 0,
          color: "hsl(142 71% 45%)", // green
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
  }, [workerData, serverMetrics, clientMetrics])

  // Format data for stacked bar chart - use worker chart data if available
  const projectsChartData = workerData
    ? workerData.projects.chartData
    : (projectsLadderData ? [{
        name: "Projects",
        "Unknown builder": projectsLadderData.segments[0].value,
        "Known, non-EBA builder": projectsLadderData.segments[1].value,
        "EBA builder": projectsLadderData.segments[2].value,
      }] : [])

  const contractorChartData = workerData
    ? workerData.contractors.chartData
    : (contractorLadderData ? [{
        name: "Contractors",
        "Unidentified slot": contractorLadderData.segments[0].value,
        "Identified contractor, non-EBA": contractorLadderData.segments[1].value,
        "Identified contractor, EBA": contractorLadderData.segments[2].value,
      }] : [])

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

  if (!metrics && !workerData) {
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
                  EBA builders (of all projects): {projectsLadderData.ebaBuilders} / {projectsLadderData.total} ({projectsLadderData.segments[2].percentage}%)
                </div>
                <div className="text-xs text-gray-500 italic">
                  of known: {projectsLadderData.ebaBuilders} / {projectsLadderData.knownBuilders} ({projectsLadderData.ebaOfKnownPercentage}%)
                </div>
              </div>
              <ChartContainer
                config={{
                  "Unknown builder": { label: "Unknown builder", color: "#d1d5db" },
                  "Known, non-EBA builder": { label: "Known, non-EBA builder", color: "hsl(221 83% 53%)" },
                  "EBA builder": { label: "EBA builder", color: "hsl(142 71% 45%)" },
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
                  <Bar dataKey="Unknown builder" stackId="a" fill="#d1d5db" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Known, non-EBA builder" stackId="a" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="EBA builder" stackId="a" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
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
                  EBA of total: {contractorLadderData.eba} / {contractorLadderData.total} ({contractorLadderData.segments[2].percentage}%)
                </div>
              </div>
              <ChartContainer
                config={{
                  "Unidentified slot": { label: "Unidentified slot", color: "#d1d5db" },
                  "Identified contractor, non-EBA": { label: "Identified contractor, non-EBA", color: "hsl(221 83% 53%)" },
                  "Identified contractor, EBA": { label: "Identified contractor, EBA", color: "hsl(142 71% 45%)" },
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
                  <Bar dataKey="Unidentified slot" stackId="b" fill="#d1d5db" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Identified contractor, non-EBA" stackId="b" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="Identified contractor, EBA" stackId="b" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
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


"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell } from "recharts"
import { useOrganizingUniverseMetrics } from "@/hooks/useOrganizingUniverseMetrics"
import { useOrganizingUniverseMetricsServerSideCompatible } from "@/hooks/useOrganizingUniverseMetricsServerSide"
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

  // Get metrics from server-side or client-side
  const { data: clientMetrics } = useOrganizingUniverseMetrics({ 
    universe: normalizedUniverse, 
    stage: normalizedStage 
  })
  const { data: serverMetrics } = useOrganizingUniverseMetricsServerSideCompatible({ 
    universe: normalizedUniverse, 
    stage: normalizedStage, 
    patchIds 
  })
  const metrics = serverMetrics || clientMetrics

  // Calculate Projects Ladder data
  const projectsLadderData = useMemo(() => {
    if (!metrics) return null

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
          color: "#e5e7eb", // light grey
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
  }, [metrics])

  // Calculate Contractor Ladder data
  const contractorLadderData = useMemo(() => {
    if (!metrics) return null

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
          color: "#e5e7eb", // light grey
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
  }, [metrics])

  // Format data for stacked bar chart
  const projectsChartData = projectsLadderData ? [{
    name: "Projects",
    "Unknown builder": projectsLadderData.segments[0].value,
    "Known, non-EBA builder": projectsLadderData.segments[1].value,
    "EBA builder": projectsLadderData.segments[2].value,
  }] : []

  const contractorChartData = contractorLadderData ? [{
    name: "Contractors",
    "Unidentified slot": contractorLadderData.segments[0].value,
    "Identified contractor, non-EBA": contractorLadderData.segments[1].value,
    "Identified contractor, EBA": contractorLadderData.segments[2].value,
  }] : []

  const ladderHeightClasses = "w-full h-[112px] sm:h-[128px] lg:h-[120px]"

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    const data = payload[0].payload
    const total = Object.values(data).reduce((sum: number, val: any) => {
      if (typeof val === 'number' && val !== data.name) return sum + val
      return sum
    }, 0) as number

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
        <p className="font-medium text-sm mb-2">{data.name}</p>
        {payload.map((entry: any, index: number) => {
          if (entry.dataKey === 'name') return null
          const value = entry.value as number
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0
          return (
            <div key={index} className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-sm" 
                  style={{ backgroundColor: entry.color }}
                />
                <span>{entry.name}:</span>
              </div>
              <span className="font-medium tabular-nums">
                {value} / {total} ({percentage}%)
              </span>
            </div>
          )
        })}
      </div>
    )
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
          <CardDescription>Loading coverage metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
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
                  "Unknown builder": { label: "Unknown builder", color: "#e5e7eb" },
                  "Known, non-EBA builder": { label: "Known, non-EBA builder", color: "hsl(221 83% 53%)" },
                  "EBA builder": { label: "EBA builder", color: "hsl(142 71% 45%)" },
                }}
                className={ladderHeightClasses}
              >
                <BarChart
                  data={projectsChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, projectsLadderData.total]} hide />
                  <YAxis type="category" dataKey="name" width={80} tick={false} axisLine={false} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Unknown builder" stackId="a" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Known, non-EBA builder" stackId="a" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="EBA builder" stackId="a" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ChartContainer>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
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
                  "Unidentified slot": { label: "Unidentified slot", color: "#e5e7eb" },
                  "Identified contractor, non-EBA": { label: "Identified contractor, non-EBA", color: "hsl(221 83% 53%)" },
                  "Identified contractor, EBA": { label: "Identified contractor, EBA", color: "hsl(142 71% 45%)" },
                }}
                className={ladderHeightClasses}
              >
                <BarChart
                  data={contractorChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" domain={[0, contractorLadderData.total]} hide />
                  <YAxis type="category" dataKey="name" width={80} tick={false} axisLine={false} />
                  <ChartTooltip content={<CustomTooltip />} />
                  <Bar dataKey="Unidentified slot" stackId="b" fill="#e5e7eb" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="Identified contractor, non-EBA" stackId="b" fill="hsl(221 83% 53%)" />
                  <Bar dataKey="Identified contractor, EBA" stackId="b" fill="hsl(142 71% 45%)" radius={[4, 0, 0, 4]} />
                </BarChart>
              </ChartContainer>
              <div className="flex justify-between text-xs text-gray-600 mt-2">
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


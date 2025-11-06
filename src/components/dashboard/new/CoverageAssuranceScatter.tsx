"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, Legend } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Target, TrendingUp } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

interface CoverageAssuranceScatterProps {
  patchIds?: string[]
}

interface ScatterPoint {
  project_id: string
  project_name: string
  coverage_percentage: number
  audit_completion_percentage: number
  rating: 'red' | 'amber' | 'yellow' | 'green' | 'unknown'
  project_scale: number
  has_eba_builder: boolean
}

const COLORS = {
  red: '#ef4444',
  amber: '#f59e0b',
  yellow: '#eab308',
  green: '#22c55e',
  unknown: '#9ca3af',
}

export function CoverageAssuranceScatter({ patchIds = [] }: CoverageAssuranceScatterProps) {
  const sp = useSearchParams()
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined
  const [ebaFilter, setEbaFilter] = useState<string>('all')

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Fetch scatter data
  const { data: scatterData, isLoading } = useQuery<ScatterPoint[]>({
    queryKey: ['coverage-assurance-scatter', patchIds, normalizedStage, normalizedUniverse, ebaFilter],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (patchIds.length > 0) {
        searchParams.set('patchIds', patchIds.join(','))
      }
      searchParams.set('universe', normalizedUniverse)
      searchParams.set('stage', normalizedStage)
      if (ebaFilter !== 'all') {
        searchParams.set('ebaFilter', ebaFilter)
      }

      const response = await fetch(`/api/dashboard/coverage-assurance-scatter?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch scatter data')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Format data for chart
  const chartData = useMemo(() => {
    if (!scatterData) return []
    return scatterData.map(point => ({
      x: point.coverage_percentage,
      y: point.audit_completion_percentage,
      size: Math.max(10, Math.min(30, point.project_scale * 2)), // Scale between 10-30
      rating: point.rating,
      project_name: point.project_name,
      project_id: point.project_id,
      project_scale: point.project_scale,
    }))
  }, [scatterData])

  // Quadrant labels
  const quadrantLabels = [
    { x: 25, y: 25, label: 'Low Coverage\nLow Assurance', color: 'text-red-600' },
    { x: 75, y: 25, label: 'High Coverage\nLow Assurance', color: 'text-yellow-600' },
    { x: 25, y: 75, label: 'Low Coverage\nHigh Assurance', color: 'text-orange-600' },
    { x: 75, y: 75, label: 'High Coverage\nHigh Assurance', color: 'text-green-600' },
  ]

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Coverage vs Assurance
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading scatter plot data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!scatterData || scatterData.length === 0) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg flex items-center gap-2">
              Coverage vs Assurance
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Project-level contractor identification coverage vs audit completion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No project data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Coverage vs Assurance Scatter Plot
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          X-axis: Contractor identification coverage. Y-axis: Audit completion. Color: Traffic-light rating. Size: Project scale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Filter by EBA Builder:</label>
          <Select value={ebaFilter} onValueChange={setEbaFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              <SelectItem value="eba">EBA Builder Only</SelectItem>
              <SelectItem value="non_eba">Non-EBA Builder</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Chart */}
        <ChartContainer
          config={{
            coverage: { label: 'Coverage %', color: '#3b82f6' },
            assurance: { label: 'Audit Completion %', color: '#10b981' },
          }}
          className="w-full h-[300px] sm:h-[400px] md:h-[500px] lg:h-[500px]"
        >
            <ScatterChart
              margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
              data={chartData}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                dataKey="x"
                domain={[0, 100]}
                label={{ value: 'Contractor Identification Coverage (%)', position: 'insideBottom', offset: -10 }}
                tick={{ fontSize: 12 }}
              />
              <YAxis 
                type="number"
                dataKey="y"
                domain={[0, 100]}
                label={{ value: 'Audit Completion (%)', angle: -90, position: 'insideLeft' }}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null
                  const data = payload[0].payload
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-xl p-4 min-w-[200px]">
                      <p className="font-medium text-sm mb-3 text-gray-900">{data.project_name}</p>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-600">Coverage:</span>
                          <span className="font-medium text-gray-900">{data.x}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-600">Audit Completion:</span>
                          <span className="font-medium text-gray-900">{data.y}%</span>
                        </div>
                        <div className="flex justify-between gap-4 items-center">
                          <span className="text-gray-600">Rating:</span>
                          <Badge
                            variant="outline"
                            className="capitalize text-xs font-medium"
                            style={{
                              borderColor: COLORS[data.rating as keyof typeof COLORS],
                              backgroundColor: `${COLORS[data.rating as keyof typeof COLORS]}10`
                            }}
                          >
                            {data.rating}
                          </Badge>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-gray-600">Project Scale:</span>
                          <span className="font-medium text-gray-900">{data.project_scale} slots</span>
                        </div>
                      </div>
                    </div>
                  )
                }}
                cursor={{ strokeDasharray: '3 3', strokeWidth: 2 }}
                wrapperStyle={{
                  pointerEvents: 'auto',
                  zIndex: 1000
                }}
              />
              <Scatter
                dataKey="y"
                fill="#8884d8"
                strokeWidth={2}
                stroke="#fff"
                shape={(props: any) => {
                  const { cx, cy, payload } = props
                  const radius = Math.max(8, Math.min(20, payload.project_scale * 1.5)) // Larger touch targets for mobile
                  return (
                    <circle
                      cx={cx}
                      cy={cy}
                      r={radius}
                      fill={COLORS[payload.rating as keyof typeof COLORS]}
                      stroke="#fff"
                      strokeWidth={2}
                      style={{
                        filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                        cursor: 'pointer'
                      }}
                    />
                  )
                }}
              />
            </ScatterChart>
          </ChartContainer>

        {/* Quadrant Labels */}
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="border border-red-200 bg-red-50 rounded p-3">
            <div className="font-medium text-red-900 mb-1">Low Coverage, Low Assurance</div>
            <div className="text-red-700">Focus: Increase identification and audit coverage</div>
          </div>
          <div className="border border-yellow-200 bg-yellow-50 rounded p-3">
            <div className="font-medium text-yellow-900 mb-1">High Coverage, Low Assurance</div>
            <div className="text-yellow-700">Focus: Complete audits for identified contractors</div>
          </div>
          <div className="border border-orange-200 bg-orange-50 rounded p-3">
            <div className="font-medium text-orange-900 mb-1">Low Coverage, High Assurance</div>
            <div className="text-orange-700">Focus: Identify more contractors on audited projects</div>
          </div>
          <div className="border border-green-200 bg-green-50 rounded p-3">
            <div className="font-medium text-green-900 mb-1">High Coverage, High Assurance</div>
            <div className="text-green-700">Target state: Well-mapped and fully audited</div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs border-t pt-4">
          <div className="font-medium text-gray-700">Rating Colors:</div>
          {Object.entries(COLORS).map(([rating, color]) => (
            <div key={rating} className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: color }}
              />
              <span className="capitalize">{rating}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}


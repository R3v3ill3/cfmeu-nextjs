"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { TrendingDown, TrendingUp, Clock } from "lucide-react"

interface ProgressOverTimeProps {
  patchIds?: string[]
}

interface SnapshotData {
  snapshot_date: string
  unknown_builders: number
  unidentified_slots: number
  eba_builders: number
  eba_contractors: number
}

export function ProgressOverTime({ patchIds = [] }: ProgressOverTimeProps) {
  const { hasActiveFilters, activeFilters } = useActiveFilters()

  // Fetch snapshot data
  const { data: snapshotData, isLoading } = useQuery<SnapshotData[]>({
    queryKey: ['dashboard-snapshots', 'weekly'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/snapshots?type=weekly&limit=52') // Last 52 weeks
      if (!response.ok) {
        throw new Error('Failed to fetch snapshot data')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Format data for charts
  const burnDownData = useMemo(() => {
    if (!snapshotData || snapshotData.length === 0) return []
    
    return snapshotData
      .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
      .map(snapshot => ({
        date: new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        unknown_builders: snapshot.unknown_builders,
        unidentified_slots: snapshot.unidentified_slots,
      }))
  }, [snapshotData])

  const burnUpData = useMemo(() => {
    if (!snapshotData || snapshotData.length === 0) return []
    
    return snapshotData
      .sort((a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime())
      .map(snapshot => ({
        date: new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        eba_builders: snapshot.eba_builders,
        eba_contractors: snapshot.eba_contractors,
      }))
  }, [snapshotData])

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Progress Over Time
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading historical progress data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-96 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!snapshotData || snapshotData.length === 0) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg flex items-center gap-2">
              Progress Over Time
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Historical burn-down and burn-up charts showing organizing progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8 space-y-2">
            <p className="font-medium">No historical snapshot data available</p>
            <p className="text-sm">
              Weekly snapshots will appear here once they are created by the background job.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Progress Over Time
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Burn-down (decreasing unknowns) and burn-up (increasing EBA coverage) trends over time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Small Multiples - 4 charts in a grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Burn-down: Unknown Builders */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h4 className="font-medium text-sm">Unknown Builders (Burn-down)</h4>
            </div>
            <ChartContainer
              config={{
                unknown_builders: { label: "Unknown Builders", color: "#e5e7eb" },
              }}
              className="w-full h-[200px]"
            >
                <AreaChart data={burnDownData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip />
                  <Area 
                    type="monotone" 
                    dataKey="unknown_builders" 
                    stroke="#e5e7eb" 
                    fill="#e5e7eb" 
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ChartContainer>
          </div>

          {/* Burn-down: Unidentified Slots */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h4 className="font-medium text-sm">Unidentified Contractor Slots (Burn-down)</h4>
            </div>
            <ChartContainer
              config={{
                unidentified_slots: { label: "Unidentified Slots", color: "#9ca3af" },
              }}
              className="w-full h-[200px]"
            >
              <AreaChart data={burnDownData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip />
                <Area 
                  type="monotone" 
                  dataKey="unidentified_slots" 
                  stroke="#9ca3af" 
                  fill="#9ca3af" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Burn-up: EBA Builders */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-sm">EBA Builders (Burn-up)</h4>
            </div>
            <ChartContainer
              config={{
                eba_builders: { label: "EBA Builders", color: "hsl(142 71% 45%)" },
              }}
              className="w-full h-[200px]"
            >
              <AreaChart data={burnUpData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip />
                <Area 
                  type="monotone" 
                  dataKey="eba_builders" 
                  stroke="hsl(142 71% 45%)" 
                  fill="hsl(142 71% 45%)" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </div>

          {/* Burn-up: EBA Contractors */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h4 className="font-medium text-sm">EBA Contractors (Burn-up)</h4>
            </div>
            <ChartContainer
              config={{
                eba_contractors: { label: "EBA Contractors", color: "hsl(142 71% 45%)" },
              }}
              className="w-full h-[200px]"
            >
              <AreaChart data={burnUpData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 10 }} />
                <ChartTooltip />
                <Area 
                  type="monotone" 
                  dataKey="eba_contractors" 
                  stroke="hsl(142 71% 45%)" 
                  fill="hsl(142 71% 45%)" 
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        {/* Summary */}
        <div className="text-xs text-gray-600 pt-2 border-t">
          <p>
            Showing {snapshotData.length} weekly snapshots. 
            Burn-down charts show decreasing unknowns (good trend). 
            Burn-up charts show increasing EBA coverage (good trend).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}


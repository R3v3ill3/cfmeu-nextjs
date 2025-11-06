"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Grid, TrendingUp } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface ContractorTypeHeatmapProps {
  patchIds?: string[]
}

interface ContractorTypeHeatmapData {
  trade_type: string
  identified_count: number
  identified_percentage: number
  eba_count: number
  eba_percentage: number
  gap: number
}

export function ContractorTypeHeatmap({ patchIds = [] }: ContractorTypeHeatmapProps) {
  const sp = useSearchParams()
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Fetch heatmap data
  const { data: heatmapData, isLoading } = useQuery<ContractorTypeHeatmapData[]>({
    queryKey: ['contractor-type-heatmap', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (patchIds.length > 0) {
        searchParams.set('patchIds', patchIds.join(','))
      }
      searchParams.set('universe', normalizedUniverse)
      searchParams.set('stage', normalizedStage)

      const response = await fetch(`/api/dashboard/contractor-type-heatmap?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch heatmap data')
      }
      const result = await response.json()
      return result.data || []
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Format trade type for display
  const formatTradeType = (tradeType: string): string => {
    return tradeType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Get color intensity for heatmap
  const getColorIntensity = (percentage: number): string => {
    if (percentage >= 80) return 'bg-green-600'
    if (percentage >= 60) return 'bg-green-500'
    if (percentage >= 40) return 'bg-yellow-500'
    if (percentage >= 20) return 'bg-orange-500'
    return 'bg-red-500'
  }

  // Get gap color
  const getGapColor = (gap: number): string => {
    if (gap >= 30) return 'text-red-600'
    if (gap >= 20) return 'text-orange-600'
    if (gap >= 10) return 'text-yellow-600'
    return 'text-green-600'
  }

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Contractor-Type Heatmap
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading contractor type metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  if (!heatmapData || heatmapData.length === 0) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Grid className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg flex items-center gap-2">
              Contractor-Type Heatmap
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Identification and EBA coverage by contractor trade type
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No contractor type data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Grid className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Contractor-Type Heatmap
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Identification and EBA coverage by contractor trade type. Sorted by gap (identified % - EBA %) to highlight conversion opportunities.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-600 rounded" />
              <span>Identified %</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-600 rounded" />
              <span>EBA %</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span>Gap = Identified % - EBA %</span>
            </div>
          </div>

          {/* Heatmap Table */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-700">Trade Type</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Identified %</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">EBA %</th>
                  <th className="text-center py-2 px-3 text-sm font-medium text-gray-700">Gap</th>
                </tr>
              </thead>
              <tbody>
                {heatmapData.map((row) => (
                  <tr 
                    key={row.trade_type} 
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="font-medium text-sm text-gray-900">
                        {formatTradeType(row.trade_type)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {row.identified_count} identified, {row.eba_count} with EBA
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div 
                          className={`w-16 h-8 rounded ${getColorIntensity(row.identified_percentage)} flex items-center justify-center text-white text-xs font-medium`}
                        >
                          {row.identified_percentage}%
                        </div>
                        <span className="text-xs text-gray-600">
                          ({row.identified_count})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div 
                          className={`w-16 h-8 rounded ${getColorIntensity(row.eba_percentage)} flex items-center justify-center text-white text-xs font-medium`}
                        >
                          {row.eba_percentage}%
                        </div>
                        <span className="text-xs text-gray-600">
                          ({row.eba_count})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <Badge 
                        variant="outline" 
                        className={`${getGapColor(row.gap)} border-current`}
                      >
                        {row.gap > 0 ? '+' : ''}{row.gap}pp
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary */}
          <div className="text-xs text-gray-600 pt-2 border-t">
            <p>
              Showing {heatmapData.length} key contractor trades. 
              Gap indicates opportunity: higher gap = more identified contractors without EBA.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


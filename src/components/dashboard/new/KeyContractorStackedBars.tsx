"use client"

import { useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Building2 } from "lucide-react"

interface KeyContractorStackedBarsProps {
  patchIds?: string[]
}

interface KeyContractorCategoryData {
  category_code: string
  category_name: string
  category_type: 'trade' | 'contractor_role'
  total: number
  identified: number
  eba: number
  unknown: number
  known_non_eba: number
}

export function KeyContractorStackedBars({ patchIds = [] }: KeyContractorStackedBarsProps) {
  const sp = useSearchParams()
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Fetch key contractor category data
  const { data: categoryData, isLoading, error } = useQuery<KeyContractorCategoryData[]>({
    queryKey: ['key-contractor-categories', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async () => {
      try {
        const searchParams = new URLSearchParams()
        if (patchIds.length > 0) {
          searchParams.set('patchIds', patchIds.join(','))
        }
        searchParams.set('universe', normalizedUniverse)
        searchParams.set('stage', normalizedStage)

        const response = await fetch(`/api/dashboard/key-contractor-categories?${searchParams.toString()}`)
        if (!response.ok) {
          throw new Error(`Failed to fetch category data: ${response.status} ${response.statusText}`)
        }
        const result = await response.json()

        if (!result || !Array.isArray(result.data)) {
          console.error('Invalid category data structure:', result)
          return []
        }

        return result.data
      } catch (err) {
        console.error('Error fetching key contractor categories:', err)
        throw err
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Format category name for display
  const formatCategoryName = (name: string): string => {
    if (!name) return 'Unknown'
    try {
      return name
        .split('_')
        .filter(word => word && word.trim().length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')
    } catch (error) {
      console.warn('Error formatting category name:', name, error)
      return name
    }
  }

  // Format data for stacked bar chart
  const chartData = useMemo(() => {
    if (!categoryData || categoryData.length === 0) return []

    return categoryData.map(category => ({
      name: formatCategoryName(category.category_name),
      category_code: category.category_code,
      category_type: category.category_type,
      "Known EBA": category.eba,
      "Known non-EBA": category.known_non_eba,
      "Unknown": category.unknown,
      total: category.total,
    }))
  }, [categoryData])

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || payload.length === 0) return null

    try {
      const data = payload[0]?.payload
      if (!data) return null

      const total = data.total || 0
      if (total === 0 || !isFinite(total)) return null

      const eba = data["Known EBA"] || 0
      const knownNonEba = data["Known non-EBA"] || 0
      const unknown = data["Unknown"] || 0

      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm mb-2">{data.name || 'Unknown'}</p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                <span>Known EBA:</span>
              </div>
              <span className="font-medium tabular-nums">
                {eba} ({total > 0 ? Math.round((eba / total) * 100) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "hsl(221 83% 53%)" }} />
                <span>Known non-EBA:</span>
              </div>
              <span className="font-medium tabular-nums">
                {knownNonEba} ({total > 0 ? Math.round((knownNonEba / total) * 100) : 0}%)
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
                <span>Unknown:</span>
              </div>
              <span className="font-medium tabular-nums">
                {unknown} ({total > 0 ? Math.round((unknown / total) * 100) : 0}%)
              </span>
            </div>
            <div className="pt-1 mt-1 border-t border-gray-200 text-xs text-gray-600">
              Total: {total} slots
            </div>
          </div>
        </div>
      )
    } catch (error) {
      console.error('Error in KeyContractorStackedBars CustomTooltip:', error)
      return null
    }
  }

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Key Contractor Categories
            <FilterIndicatorBadge
              hasActiveFilters={hasActiveFilters}
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>
            Loading key contractor category metrics{patchIds.length > 0 ? ` for ${patchIds.length} patch${patchIds.length > 1 ? 'es' : ''}` : ''}...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
          <div className="text-center text-xs text-gray-500 mt-2">
            Fetching key contractor category data
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    console.error('KeyContractorStackedBars error:', error)
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Key Contractor Categories
            <FilterIndicatorBadge
              hasActiveFilters={hasActiveFilters}
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription className="text-red-600">
            Error loading category data: {error instanceof Error ? error.message : 'Unknown error'}
          </CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    )
  }

  if (!categoryData || categoryData.length === 0) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg flex items-center gap-2">
              Key Contractor Categories
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Coverage breakdown by key contractor category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-gray-500 py-8">
            No key contractor category data available
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calculate max value for Y-axis domain
  const maxValue = Math.max(...chartData.map(d => d.total || 0), 0)

  return (
    <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Key Contractor Categories
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Coverage breakdown by key contractor category. Each bar shows: green (known EBA) bottom, blue (known non-EBA) middle, grey (unknown) top.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
              <span>Known EBA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "hsl(221 83% 53%)" }} />
              <span>Known non-EBA</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-sm" style={{ backgroundColor: "#d1d5db" }} />
              <span>Unknown</span>
            </div>
          </div>

          {/* Chart */}
          <ChartContainer
            config={{
              "Known EBA": { label: "Known EBA", color: "hsl(142 71% 45%)" },
              "Known non-EBA": { label: "Known non-EBA", color: "hsl(221 83% 53%)" },
              "Unknown": { label: "Unknown", color: "#d1d5db" },
            }}
            className="w-full h-[400px]"
          >
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 5, bottom: 60 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                type="category" 
                dataKey="name" 
                angle={-45}
                textAnchor="end"
                height={80}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <YAxis 
                type="number" 
                domain={[0, maxValue > 0 ? maxValue : 'auto']}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="Known EBA" 
                stackId="a" 
                fill="hsl(142 71% 45%)" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="Known non-EBA" 
                stackId="a" 
                fill="hsl(221 83% 53%)" 
                radius={[0, 0, 0, 0]}
              />
              <Bar 
                dataKey="Unknown" 
                stackId="a" 
                fill="#d1d5db" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ChartContainer>

          {/* Summary */}
          <div className="text-xs text-gray-600 pt-2 border-t">
            <p>
              Showing {categoryData.length} key contractor categor{categoryData.length === 1 ? 'y' : 'ies'}. 
              Each bar represents total slots (projects × 1 slot per category) with breakdown by identification and EBA status.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


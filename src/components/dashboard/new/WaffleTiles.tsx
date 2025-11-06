"use client"

import { useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { FilterIndicatorBadge } from "@/components/dashboard/FilterIndicatorBadge"
import { useActiveFilters } from "@/hooks/useActiveFilters"
import { Grid3x3 } from "lucide-react"

interface WaffleTilesProps {
  patchIds?: string[]
}

interface WaffleTileData {
  total_projects: number
  fully_mapped: number
  eba_builder: number
  fully_assured: number
  unmapped: number
}

export function WaffleTiles({ patchIds = [] }: WaffleTilesProps) {
  const sp = useSearchParams()
  const { hasActiveFilters, activeFilters } = useActiveFilters()
  const stage = sp.get('stage') || undefined
  const universe = sp.get('universe') || undefined

  const normalizedStage = stage && stage !== 'all' ? stage : 'construction'
  const normalizedUniverse = universe && universe !== 'all' ? universe : 'active'

  // Fetch waffle data for each tier
  const { data: tier1Data, isLoading: tier1Loading } = useQuery<WaffleTileData>({
    queryKey: ['waffle-tiles', 'tier_1', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (patchIds.length > 0) {
        searchParams.set('patchIds', patchIds.join(','))
      }
      searchParams.set('universe', normalizedUniverse)
      searchParams.set('stage', normalizedStage)
      searchParams.set('tier', 'tier_1')

      const response = await fetch(`/api/dashboard/waffle-tiles?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch waffle data')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: tier2Data, isLoading: tier2Loading } = useQuery<WaffleTileData>({
    queryKey: ['waffle-tiles', 'tier_2', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (patchIds.length > 0) {
        searchParams.set('patchIds', patchIds.join(','))
      }
      searchParams.set('universe', normalizedUniverse)
      searchParams.set('stage', normalizedStage)
      searchParams.set('tier', 'tier_2')

      const response = await fetch(`/api/dashboard/waffle-tiles?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch waffle data')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const { data: tier3Data, isLoading: tier3Loading } = useQuery<WaffleTileData>({
    queryKey: ['waffle-tiles', 'tier_3', patchIds, normalizedStage, normalizedUniverse],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (patchIds.length > 0) {
        searchParams.set('patchIds', patchIds.join(','))
      }
      searchParams.set('universe', normalizedUniverse)
      searchParams.set('stage', normalizedStage)
      searchParams.set('tier', 'tier_3')

      const response = await fetch(`/api/dashboard/waffle-tiles?${searchParams.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch waffle data')
      }
      const result = await response.json()
      return result.data
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  const isLoading = tier1Loading || tier2Loading || tier3Loading

  // Helper function to generate waffle grid for a given data set - memoized for performance
  const generateWaffleGrid = useCallback((data: WaffleTileData | undefined) => {
    if (!data) return null

    const total = data.total_projects
    if (total === 0) return null

    const gridSize = 10
    const tilesPerGrid = gridSize * gridSize // 100 tiles
    const numGrids = Math.ceil(total / tilesPerGrid)

    // Pre-calculate thresholds for better performance
    const assuredThreshold = data.fully_assured
    const mappedThreshold = assuredThreshold + data.fully_mapped
    const ebaThreshold = mappedThreshold + data.eba_builder

    const grids: Array<Array<{ type: 'fully_mapped' | 'eba_builder' | 'fully_assured' | 'unmapped' | 'empty' }>> = []
    let currentIndex = 0

    for (let gridIndex = 0; gridIndex < numGrids; gridIndex++) {
      const grid: Array<{ type: 'fully_mapped' | 'eba_builder' | 'fully_assured' | 'unmapped' | 'empty' }> = []

      for (let i = 0; i < tilesPerGrid; i++) {
        if (currentIndex >= total) {
          grid.push({ type: 'empty' })
          continue
        }

        let tileType: 'fully_mapped' | 'eba_builder' | 'fully_assured' | 'unmapped' | 'empty' = 'unmapped'

        // Prioritize: fully_assured > fully_mapped > eba_builder > unmapped
        if (currentIndex < assuredThreshold) {
          tileType = 'fully_assured'
        } else if (currentIndex < mappedThreshold) {
          tileType = 'fully_mapped'
        } else if (currentIndex < ebaThreshold) {
          tileType = 'eba_builder'
        }

        grid.push({ type: tileType })
        currentIndex++
      }

      grids.push(grid)
    }

    return grids
  }, [])

  // Generate grids for each tier - properly memoized with dependencies
  const tier1Grid = useMemo(() => generateWaffleGrid(tier1Data), [tier1Data, generateWaffleGrid])
  const tier2Grid = useMemo(() => generateWaffleGrid(tier2Data), [tier2Data, generateWaffleGrid])
  const tier3Grid = useMemo(() => generateWaffleGrid(tier3Data), [tier3Data, generateWaffleGrid])

  // Calculate total stats across all tiers
  const totalStats = useMemo(() => {
    const total = (tier1Data?.total_projects || 0) + (tier2Data?.total_projects || 0) + (tier3Data?.total_projects || 0)
    const fullyMapped = (tier1Data?.fully_mapped || 0) + (tier2Data?.fully_mapped || 0) + (tier3Data?.fully_mapped || 0)
    const ebaBuilder = (tier1Data?.eba_builder || 0) + (tier2Data?.eba_builder || 0) + (tier3Data?.eba_builder || 0)
    const fullyAssured = (tier1Data?.fully_assured || 0) + (tier2Data?.fully_assured || 0) + (tier3Data?.fully_assured || 0)
    const unmapped = (tier1Data?.unmapped || 0) + (tier2Data?.unmapped || 0) + (tier3Data?.unmapped || 0)

    return { total, fullyMapped, ebaBuilder, fullyAssured, unmapped }
  }, [tier1Data, tier2Data, tier3Data])

  const getTileColor = (type: string): string => {
    switch (type) {
      case 'fully_assured':
        return 'bg-green-700' // Dark green for fully assured
      case 'fully_mapped':
        return 'bg-blue-600' // Blue for mapped
      case 'eba_builder':
        return 'bg-green-500' // Green for EBA builder
      case 'unmapped':
        return 'bg-gray-300' // Grey for unmapped
      default:
        return 'bg-transparent border border-gray-200' // Empty tile
    }
  }

  if (isLoading) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            Waffle Tiles
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
          <CardDescription>Loading project mapping data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-gray-50 border border-gray-200 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const hasData = (tier1Data?.total_projects || 0) > 0 || (tier2Data?.total_projects || 0) > 0 || (tier3Data?.total_projects || 0) > 0

  if (!isLoading && !hasData) {
    return (
      <Card className="lg:bg-white lg:border-gray-300 lg:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Grid3x3 className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg flex items-center gap-2">
              Project Mapping Status
              <FilterIndicatorBadge 
                hasActiveFilters={hasActiveFilters} 
                activeFilters={activeFilters}
                variant="small"
              />
            </CardTitle>
          </div>
          <CardDescription className="text-sm">
            Project mapping completeness visualization
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
          <Grid3x3 className="h-5 w-5 text-blue-600" />
          <CardTitle className="text-lg flex items-center gap-2">
            Project Mapping Status
            <FilterIndicatorBadge 
              hasActiveFilters={hasActiveFilters} 
              activeFilters={activeFilters}
              variant="small"
            />
          </CardTitle>
        </div>
        <CardDescription className="text-sm">
          Each square represents a project. Colors indicate mapping and compliance status.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Waffle Grids by Tier */}
        <div className="space-y-8">
          {/* Tier 1 Grid */}
          {tier1Grid && tier1Grid.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">TIER 1</span>
                <span className="text-gray-600">
                  {tier1Data?.total_projects || 0} projects
                </span>
              </div>
              {tier1Grid.map((grid, gridIndex) => (
                <div key={gridIndex} className="space-y-2">
                  {gridIndex > 0 && (
                    <div className="text-xs text-gray-500 text-center">
                      Grid {gridIndex + 1}
                    </div>
                  )}
                  <div className="grid grid-cols-10 gap-[3px] w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] mx-auto">
                    {grid.map((tile, tileIndex) => (
                      <div
                        key={tileIndex}
                        className={`aspect-square ${getTileColor(tile.type)} rounded-[3px] transition-opacity hover:opacity-80`}
                        title={
                          tile.type === 'fully_assured' ? 'Fully assured (audit complete + green/amber)'
                          : tile.type === 'fully_mapped' ? 'Fully mapped (builder known + ≥80% contractor ID)'
                          : tile.type === 'eba_builder' ? 'EBA builder'
                          : tile.type === 'unmapped' ? 'Unmapped'
                          : 'Empty'
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier 2 Grid */}
          {tier2Grid && tier2Grid.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-bold">TIER 2</span>
                <span className="text-gray-600">
                  {tier2Data?.total_projects || 0} projects
                </span>
              </div>
              {tier2Grid.map((grid, gridIndex) => (
                <div key={gridIndex} className="space-y-2">
                  {gridIndex > 0 && (
                    <div className="text-xs text-gray-500 text-center">
                      Grid {gridIndex + 1}
                    </div>
                  )}
                  <div className="grid grid-cols-10 gap-[3px] w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] mx-auto">
                    {grid.map((tile, tileIndex) => (
                      <div
                        key={tileIndex}
                        className={`aspect-square ${getTileColor(tile.type)} rounded-[3px] transition-opacity hover:opacity-80`}
                        title={
                          tile.type === 'fully_assured' ? 'Fully assured (audit complete + green/amber)'
                          : tile.type === 'fully_mapped' ? 'Fully mapped (builder known + ≥80% contractor ID)'
                          : tile.type === 'eba_builder' ? 'EBA builder'
                          : tile.type === 'unmapped' ? 'Unmapped'
                          : 'Empty'
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tier 3 Grid */}
          {tier3Grid && tier3Grid.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-bold">TIER 3</span>
                <span className="text-gray-600">
                  {tier3Data?.total_projects || 0} projects
                </span>
              </div>
              {tier3Grid.map((grid, gridIndex) => (
                <div key={gridIndex} className="space-y-2">
                  {gridIndex > 0 && (
                    <div className="text-xs text-gray-500 text-center">
                      Grid {gridIndex + 1}
                    </div>
                  )}
                  <div className="grid grid-cols-10 gap-[3px] w-full max-w-[260px] sm:max-w-[320px] lg:max-w-[360px] mx-auto">
                    {grid.map((tile, tileIndex) => (
                      <div
                        key={tileIndex}
                        className={`aspect-square ${getTileColor(tile.type)} rounded-[3px] transition-opacity hover:opacity-80`}
                        title={
                          tile.type === 'fully_assured' ? 'Fully assured (audit complete + green/amber)'
                          : tile.type === 'fully_mapped' ? 'Fully mapped (builder known + ≥80% contractor ID)'
                          : tile.type === 'eba_builder' ? 'EBA builder'
                          : tile.type === 'unmapped' ? 'Unmapped'
                          : 'Empty'
                        }
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="space-y-3 border-t pt-4">
          <div className="text-sm font-medium text-gray-900 mb-2">Legend</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gray-300 rounded-sm" />
              <div className="text-sm">
                <div className="font-medium">Unmapped</div>
                <div className="text-xs text-gray-600">
                  {totalStats.unmapped} projects
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-sm" />
              <div className="text-sm">
                <div className="font-medium">Fully Mapped</div>
                <div className="text-xs text-gray-600">
                  Builder known + ≥80% ID
                </div>
                <div className="text-xs text-gray-500">
                  {totalStats.fullyMapped} projects
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-500 rounded-sm" />
              <div className="text-sm">
                <div className="font-medium">EBA Builder</div>
                <div className="text-xs text-gray-600">
                  Projects with EBA builder
                </div>
                <div className="text-xs text-gray-500">
                  {totalStats.ebaBuilder} projects
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-green-700 rounded-sm" />
              <div className="text-sm">
                <div className="font-medium">Fully Assured</div>
                <div className="text-xs text-gray-600">
                  Audit complete + green/amber
                </div>
                <div className="text-xs text-gray-500">
                  {totalStats.fullyAssured} projects
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats - Total across all tiers */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t">
          <div className="text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {totalStats.total}
            </div>
            <div className="text-xs text-gray-600 mt-1">Total Projects</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-blue-600">
              {totalStats.fullyMapped}
            </div>
            <div className="text-xs text-gray-600 mt-1">Fully Mapped</div>
            <div className="text-xs text-gray-500">
              {totalStats.total > 0 
                ? Math.round((totalStats.fullyMapped / totalStats.total) * 100) 
                : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-500">
              {totalStats.ebaBuilder}
            </div>
            <div className="text-xs text-gray-600 mt-1">EBA Builder</div>
            <div className="text-xs text-gray-500">
              {totalStats.total > 0 
                ? Math.round((totalStats.ebaBuilder / totalStats.total) * 100) 
                : 0}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-semibold text-green-700">
              {totalStats.fullyAssured}
            </div>
            <div className="text-xs text-gray-600 mt-1">Fully Assured</div>
            <div className="text-xs text-gray-500">
              {totalStats.total > 0 
                ? Math.round((totalStats.fullyAssured / totalStats.total) * 100) 
                : 0}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}


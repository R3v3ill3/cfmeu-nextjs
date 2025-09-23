import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

interface ActiveFiltersResult {
  hasActiveFilters: boolean
  activeFilters: string[]
  filterCount: number
  filters: {
    tier?: string
    stage?: string 
    universe?: string
    eba?: string
    search?: string
    patch?: string
  }
}

/**
 * Hook to detect active dashboard filters from URL search parameters
 * Returns filter state information for displaying filter indicators
 */
export function useActiveFilters(): ActiveFiltersResult {
  const searchParams = useSearchParams()

  return useMemo(() => {
    const tier = searchParams.get('tier')
    const stage = searchParams.get('stage') 
    const universe = searchParams.get('universe')
    const eba = searchParams.get('eba')
    const search = searchParams.get('q')
    const patch = searchParams.get('patch')

    const filters = {
      tier: tier && tier !== 'all' ? tier : undefined,
      stage: stage && stage !== 'all' ? stage : undefined,
      universe: universe && universe !== 'all' ? universe : undefined,
      eba: eba && eba !== 'all' ? eba : undefined,
      search: search || undefined,
      patch: patch || undefined
    }

    const activeFilters: string[] = []
    
    if (filters.tier) activeFilters.push(`Tier: ${filters.tier}`)
    if (filters.stage) activeFilters.push(`Stage: ${filters.stage}`)
    if (filters.universe) activeFilters.push(`Universe: ${filters.universe}`)
    if (filters.eba) activeFilters.push(`EBA: ${filters.eba}`)
    if (filters.search) activeFilters.push(`Search: "${filters.search}"`)
    if (filters.patch) activeFilters.push(`Patch: ${filters.patch}`)

    const hasActiveFilters = activeFilters.length > 0
    
    return {
      hasActiveFilters,
      activeFilters,
      filterCount: activeFilters.length,
      filters
    }
  }, [searchParams])
}

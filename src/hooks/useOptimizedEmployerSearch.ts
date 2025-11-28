import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHybridPagination, useSearchPagination, usePaginationPerformance } from './useHybridPagination'
import { useDebouncedSearch } from './useDebounce'
import { useIsMobile } from '@/hooks/use-mobile'

// Types matching the API interfaces
export interface OptimizedEmployerSearchParams {
  q?: string
  page?: number
  pageSize?: number
  sort?: 'name' | 'estimated' | 'eba_recency' | 'project_count'
  dir?: 'asc' | 'desc'
  engaged?: boolean
  eba?: 'all' | 'active' | 'lodged' | 'pending' | 'no'
  type?: 'all' | 'builder' | 'principal_contractor' | 'large_contractor' | 'small_contractor' | 'individual'
  categoryType?: 'contractor_role' | 'trade' | 'all'
  categoryCode?: string
  projectTier?: 'all' | 'tier_1' | 'tier_2' | 'tier_3'
  patch?: string // Comma-separated patch IDs
  enhanced?: boolean
  includeAliases?: boolean
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical'
}

export interface OptimizedEmployerRecord {
  id: string
  name: string
  abn: string | null
  employer_type: string
  website: string | null
  email: string | null
  phone: string | null
  estimated_worker_count: number | null
  incolink_id: string | null
  bci_company_id: string | null
  enterprise_agreement_status: boolean | null
  eba_status_source: string | null
  eba_status_updated_at: string | null
  eba_status_notes: string | null
  incolink_last_matched?: string | null

  // Enhanced data for performance
  is_engaged?: boolean
  eba_category?: string | null
  eba_recency_score?: number
  project_count?: number
  actual_worker_count?: number
  most_recent_eba_date?: string | null

  // Alias information
  aliases?: Array<{
    id: string
    alias: string
    alias_normalized: string
    is_authoritative: boolean
    source_system: string | null
    source_identifier: string | null
    collected_at: string | null
  }>
  match_type?: 'canonical_name' | 'alias' | 'external_id' | 'abn'
  match_details?: {
    canonical_name: string
    matched_alias: string | null
    query: string
    external_id_match: 'bci' | 'incolink' | null
  }
  search_score?: number

  // Related records (when enhanced=true)
  company_eba_records?: any[]
  worker_placements?: { id: string }[]
  project_assignments?: { id: string }[]
  projects?: Array<{
    id: string
    name: string
    tier?: string | null
    roles?: string[]
    trades?: string[]
  }>
  organisers?: Array<{
    id: string
    name: string
    patch_name?: string
  }>
  roles?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>
  trades?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>
}

export interface OptimizedEmployerResponse {
  employers: OptimizedEmployerRecord[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
  }
  debug?: {
    queryTime: number
    cacheHit: boolean
    via: 'rpc' | 'materialized_view' | 'worker_fallback' | 'app_api'
    appliedFilters: Record<string, any>
  }
}

export interface UseOptimizedEmployerSearchOptions {
  // Performance options
  enableCache?: boolean // Default: true
  enablePerformanceLogging?: boolean // Default: false
  enableRequestDeduplication?: boolean // Default: true

  // Search options
  minLength?: number // Default: 2
  immediateClear?: boolean // Default: true

  // Pagination options
  mobilePageSize?: number // Default: 20
  desktopPageSize?: number // Default: 50

  // Enhanced data options
  includeEnhanced?: boolean // Default: false
  includeAliases?: boolean // Default: true

  // Alias search options
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical' // Default: 'any'
}

/**
 * Optimized employer search hook with advanced caching, debouncing, and hybrid pagination
 *
 * Features:
 * - Smart caching with 30-second SWR
 * - Request deduplication to prevent duplicate API calls
 * - Hybrid pagination (infinite scroll on mobile, traditional on desktop)
 * - Performance monitoring and optimization
 * - Adaptive debouncing based on typing patterns
 * - Prefetching for smooth user experience
 */
export function useOptimizedEmployerSearch(
  initialParams: OptimizedEmployerSearchParams = {},
  options: UseOptimizedEmployerSearchOptions = {}
) {
  const {
    enableCache = true,
    enablePerformanceLogging = false,
    enableRequestDeduplication = true,
    minLength = 2,
    immediateClear = true,
    mobilePageSize = 20,
    desktopPageSize = 50,
    includeEnhanced = false,
    includeAliases = true,
    aliasMatchMode = 'any'
  } = options

  const isMobile = useIsMobile()
  const queryClient = useQueryClient()
  const { recordMetric } = usePaginationPerformance()

  // State for search input
  const {
    value: searchValue,
    debouncedValue: searchQuery,
    setValue: setSearchValue,
    clear: clearSearch,
    canSearch,
    isDebouncing: searchIsDebouncing
  } = useDebouncedSearch(initialParams.q || '', {
    delay: 300,
    immediateClear,
    minLength
  })

  // State for other filters
  const [filters, setFilters] = useState<Omit<OptimizedEmployerSearchParams, 'q' | 'page' | 'pageSize'>>(() => {
    const { q, page, pageSize, ...otherFilters } = initialParams
    return otherFilters
  })

  // Fetch function for the API
  const fetchEmployers = async (params: any): Promise<OptimizedEmployerResponse> => {
    const startTime = Date.now()

    // Determine which endpoint to use
    const useAliasEndpoint = includeAliases && searchQuery
    const baseUrl = '/api/employers'
    const endpoint = useAliasEndpoint ? `${baseUrl}/with-aliases/search` : `${baseUrl}`

    // Build query parameters
    const searchParams = new URLSearchParams()

    // Always include search query if present
    if (searchQuery) {
      searchParams.set('q', searchQuery)
    }

    // Add pagination parameters
    searchParams.set('page', params.page.toString())
    searchParams.set('pageSize', params.pageSize.toString())

    if (params.sort) searchParams.set('sort', params.sort)
    if (params.dir) searchParams.set('dir', params.dir)

    // Add filter parameters
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '' && key !== 'q') {
        if (typeof value === 'boolean') {
          searchParams.set(key, value ? '1' : '0')
        } else {
          searchParams.set(key, String(value))
        }
      }
    })

    // Add enhanced/alias parameters
    if (includeEnhanced) searchParams.set('enhanced', 'true')
    if (includeAliases && !useAliasEndpoint) {
      searchParams.set('includeAliases', 'true')
      searchParams.set('aliasMatchMode', aliasMatchMode)
    }

    const url = `${endpoint}?${searchParams.toString()}`

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Add cache-busting for development
          ...(process.env.NODE_ENV === 'development' && { 'Cache-Control': 'no-cache' })
        }
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Search failed: ${response.status} ${errorText}`)
      }

      const data: OptimizedEmployerResponse = await response.json()

      // Record performance metrics
      if (enablePerformanceLogging) {
        const queryTime = Date.now() - startTime
        recordMetric(data.debug)
        console.log(`[OptimizedEmployerSearch] Query completed:`, {
          queryTime,
          resultCount: data.employers.length,
          cacheHit: data.debug?.cacheHit,
          via: data.debug?.via,
          params: { q: searchQuery, ...filters }
        })
      }

      return data
    } catch (error) {
      console.error('[OptimizedEmployerSearch] API error:', error)
      throw error
    }
  }

  // Use hybrid pagination for optimal mobile/desktop experience
  const paginationResult = useHybridPagination<OptimizedEmployerRecord>({
    fetchFn: fetchEmployers,
    queryKey: ['optimized-employer-search'],
    initialParams: {
      page: 1,
      pageSize: isMobile ? mobilePageSize : desktopPageSize,
      sort: 'name',
      dir: 'asc',
      q: searchQuery,
      ...filters
    },
    mobile: {
      pageSize: mobilePageSize,
      prefetchNextPage: true
    },
    desktop: {
      pageSize: desktopPageSize
    },
    debounce: {
      delay: 0, // We handle debouncing at the search level
      enabled: false
    },
    queryOptions: {
      staleTime: enableCache ? 30 * 1000 : 0, // 30 seconds when cache enabled
      gcTime: enableCache ? 5 * 60 * 1000 : 60 * 1000, // 5 minutes when cache enabled
      refetchOnWindowFocus: !isMobile,
      retry: 2
    },
    enablePerformanceLogging
  })

  // Additional computed values
  const hasResults = paginationResult.items.length > 0
  const isEmpty = !paginationResult.isLoading && !hasResults && canSearch
  const isLoading = paginationResult.isLoading || (searchIsDebouncing && searchQuery.length >= minLength)

  // Actions
  const updateSearchQuery = useCallback((newQuery: string) => {
    setSearchValue(newQuery)
    paginationResult.reset()
  }, [setSearchValue, paginationResult])

  const updateFilters = useCallback((newFilters: Partial<Omit<OptimizedEmployerSearchParams, 'q' | 'page' | 'pageSize'>>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    paginationResult.reset()
  }, [paginationResult])

  const clearAllFilters = useCallback(() => {
    setSearchValue('')
    setFilters({})
    paginationResult.reset()
  }, [setSearchValue, paginationResult])

  // Prefetch related data for better UX
  const prefetchEmployerDetails = useCallback((employerId: string) => {
    if (!enableCache) return

    queryClient.prefetchQuery({
      queryKey: ['employer-details', employerId],
      queryFn: async () => {
        const response = await fetch(`/api/employers/${employerId}?enhanced=true`)
        if (!response.ok) throw new Error('Failed to fetch employer details')
        return response.json()
      },
      staleTime: 60 * 1000 // 1 minute for detailed data
    })
  }, [queryClient, enableCache])

  // Invalidate cache when needed
  const invalidateCache = useCallback(() => {
    if (enableCache) {
      queryClient.invalidateQueries({ queryKey: ['optimized-employer-search'] })
    }
  }, [queryClient, enableCache])

  // Request deduplication for concurrent searches
  const searchWithDeduplication = useCallback(async (query: string) => {
    if (!enableRequestDeduplication) return

    const queryKey = ['search-dedup', query]
    const existingQuery = queryClient.getQueryCache().find({ queryKey })

    if (existingQuery?.state.status === 'fetching') {
      // Return existing promise if request is already in flight
      return existingQuery.promise
    }

    // Create new deduplicated query
    return queryClient.fetchQuery({
      queryKey,
      queryFn: () => fetchEmployers({ q: query, page: 1, pageSize: 10 }),
      staleTime: 5 * 1000 // Short cache for deduplication
    })
  }, [queryClient, fetchEmployers, enableRequestDeduplication])

  return {
    // Data
    employers: paginationResult.items,
    pagination: paginationResult.pagination,

    // Loading states
    isLoading,
    isDebouncing: searchIsDebouncing,
    isError: paginationResult.isError,
    error: paginationResult.error,

    // Search state
    searchValue,
    searchQuery,
    canSearch,
    hasResults,
    isEmpty,

    // Actions
    updateSearchQuery,
    updateFilters,
    clearSearch: clearAllFilters,
    clearSearchInput: clearSearch,

    // Pagination actions
    nextPage: paginationResult.nextPage,
    prevPage: paginationResult.prevPage,
    goToPage: paginationResult.goToPage,
    reset: paginationResult.reset,
    refetch: paginationResult.refetch,

    // Mobile-specific
    loadMoreRef: paginationResult.loadMoreRef,
    isLoadingMore: paginationResult.isLoadingMore,
    hasReachedEnd: paginationResult.hasReachedEnd,

    // Advanced features
    prefetchEmployerDetails,
    invalidateCache,
    searchWithDeduplication,

    // Debug info
    debug: paginationResult.debug,
    filters,
    currentParams: paginationResult.currentParams
  }
}

/**
 * Simplified hook for quick employer search (autocomplete/typeahead)
 */
export function useQuickEmployerSearch(
  options: {
    minLength?: number
    debounceDelay?: number
    maxResults?: number
    includeAliases?: boolean
  } = {}
) {
  const {
    minLength = 2,
    debounceDelay = 200,
    maxResults = 10,
    includeAliases = true
  } = options

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounce(query, debounceDelay)

  return useQuery({
    queryKey: ['quick-employer-search', debouncedQuery],
    queryFn: async () => {
      if (debouncedQuery.length < minLength) return []

      const endpoint = includeAliases
        ? '/api/employers/with-aliases/search'
        : '/api/employers'

      const params = new URLSearchParams({
        q: debouncedQuery,
        pageSize: maxResults.toString(),
        page: '1'
      })

      const response = await fetch(`${endpoint}?${params}`)
      if (!response.ok) throw new Error('Quick search failed')

      const data = await response.json()
      return data.employers || []
    },
    enabled: debouncedQuery.length >= minLength,
    staleTime: 60 * 1000, // 1 minute cache for quick search
    gcTime: 5 * 60 * 1000
  })
}
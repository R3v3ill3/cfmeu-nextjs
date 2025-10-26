"use client"

import { useQuery, useMutation, useQueryClient, UseQueryOptions } from "@tanstack/react-query"
import {
  EmployerRatingData,
  RatingComparison,
  RatingCalculationResult,
  RatingFilters,
  RatingSearch,
  TrafficLightRating,
  ApiResponse
} from "@/types/rating"

// API base URL for rating system
const RATING_API_BASE = "/api/ratings"

// Generic fetcher function
async function fetchApi<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `Request failed: ${response.statusText}`)
  }

  return response.json()
}

// Hook to fetch employer ratings
export function useEmployerRatings(
  employerId?: string,
  options?: Partial<UseQueryOptions<EmployerRatingData>>
) {
  return useQuery({
    queryKey: ["employer-ratings", employerId],
    queryFn: () => fetchApi<EmployerRatingData>(`${RATING_API_BASE}/employers/${employerId}`),
    enabled: !!employerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    ...options,
  })
}

// Hook to fetch multiple employer ratings (for lists)
export function useMultipleEmployerRatings(
  employerIds: string[],
  options?: Partial<UseQueryOptions<Record<string, EmployerRatingData>>>
) {
  return useQuery({
    queryKey: ["multiple-employer-ratings", employerIds],
    queryFn: async () => {
      if (employerIds.length === 0) return {}

      const params = new URLSearchParams()
      params.set("employer_ids", employerIds.join(","))

      const response = await fetchApi<ApiResponse<Record<string, EmployerRatingData>>>(
        `${RATING_API_BASE}/employers/bulk?${params.toString()}`
      )
      return response.data
    },
    enabled: employerIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options,
  })
}

// Hook to search and filter ratings
export function useRatingSearch(search: RatingSearch, options?: Partial<UseQueryOptions<{
  employers: EmployerRatingData[]
  total: number
  page: number
  limit: number
}>>) {
  const params = new URLSearchParams()

  if (search.query) params.set("query", search.query)
  if (search.filters) {
    Object.entries(search.filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          params.set(key, value.join(","))
        } else {
          params.set(key, String(value))
        }
      }
    })
  }
  if (search.sort_by) params.set("sort_by", search.sort_by)
  if (search.sort_order) params.set("sort_order", search.sort_order)
  if (search.page) params.set("page", String(search.page))
  if (search.limit) params.set("limit", String(search.limit))

  return useQuery({
    queryKey: ["rating-search", search],
    queryFn: () => fetchApi<{
      employers: EmployerRatingData[]
      total: number
      page: number
      limit: number
    }>(`${RATING_API_BASE}/search?${params.toString()}`),
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
    gcTime: 5 * 60 * 1000,
    ...options,
  })
}

// Hook to get rating comparison
export function useRatingComparison(
  employerId: string,
  roleContext?: string,
  options?: Partial<UseQueryOptions<RatingComparison>>
) {
  const params = new URLSearchParams()
  if (roleContext) params.set("role_context", roleContext)

  return useQuery({
    queryKey: ["rating-comparison", employerId, roleContext],
    queryFn: () => fetchApi<RatingComparison>(
      `${RATING_API_BASE}/employers/${employerId}/comparison?${params.toString()}`
    ),
    enabled: !!employerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    ...options,
  })
}

// Hook to get rating statistics
export function useRatingStats(options?: Partial<UseQueryOptions<{
  total_employers: number
  rating_distribution: Record<TrafficLightRating, number>
  confidence_distribution: Record<string, number>
  recent_updates: number
  discrepancies_count: number
}>>) {
  return useQuery({
    queryKey: ["rating-stats"],
    queryFn: () => fetchApi<{
      total_employers: number
      rating_distribution: Record<TrafficLightRating, number>
      confidence_distribution: Record<string, number>
      recent_updates: number
      discrepancies_count: number
    }>(`${RATING_API_BASE}/stats`),
    staleTime: 10 * 60 * 1000, // 10 minutes for stats
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
    ...options,
  })
}

// Hook to get rating alerts
export function useRatingAlerts(options?: Partial<UseQueryOptions<Array<{
  id: string
  type: "info" | "warning" | "error"
  title: string
  message: string
  employer_id: string
  employer_name: string
  timestamp: string
  acknowledged: boolean
}>>>) {
  return useQuery({
    queryKey: ["rating-alerts"],
    queryFn: () => fetchApi<Array<{
      id: string
      type: "info" | "warning" | "error"
      title: string
      message: string
      employer_id: string
      employer_name: string
      timestamp: string
      acknowledged: boolean
    }>>(`${RATING_API_BASE}/alerts`),
    staleTime: 1 * 60 * 1000, // 1 minute for alerts
    gcTime: 5 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000, // Auto-refresh every 2 minutes
    ...options,
  })
}

// Mutation to acknowledge an alert
export function useAcknowledgeAlert() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ alertId }: { alertId: string }) => {
      return fetchApi(`${RATING_API_BASE}/alerts/${alertId}/acknowledge`, {
        method: "POST",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rating-alerts"] })
    },
  })
}

// Mutation to calculate a new rating
export function useCalculateRating() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      employerId,
      track,
      roleContext,
      projectId,
      organiserId,
    }: {
      employerId: string
      track: string
      roleContext: string
      projectId?: string
      organiserId?: string
    }) => {
      const body = {
        employer_id: employerId,
        track,
        role_context: roleContext,
        project_id: projectId,
        organiser_id: organiserId,
      }

      return fetchApi<RatingCalculationResult>(`${RATING_API_BASE}/calculate`, {
        method: "POST",
        body: JSON.stringify(body),
      })
    },
    onSuccess: (data, variables) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["employer-ratings", variables.employerId] })
      queryClient.invalidateQueries({ queryKey: ["multiple-employer-ratings"] })
      queryClient.invalidateQueries({ queryKey: ["rating-search"] })
      queryClient.invalidateQueries({ queryKey: ["rating-stats"] })
    },
  })
}

// Mutation to update rating weights
export function useUpdateRatingWeights() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      templateId,
      weights,
    }: {
      templateId: string
      weights: Record<string, number>
    }) => {
      return fetchApi(`${RATING_API_BASE}/weightings/${templateId}`, {
        method: "PUT",
        body: JSON.stringify({ weights }),
      })
    },
    onSuccess: () => {
      // Invalidate rating-related queries since weights affect calculations
      queryClient.invalidateQueries({ queryKey: ["employer-ratings"] })
      queryClient.invalidateQueries({ queryKey: ["multiple-employer-ratings"] })
      queryClient.invalidateQueries({ queryKey: ["rating-search"] })
    },
  })
}

// Utility hook to get rating color for UI
export function useRatingColors() {
  return {
    green: "bg-green-500 text-white border-green-600",
    amber: "bg-amber-500 text-white border-amber-600",
    yellow: "bg-yellow-500 text-black border-yellow-600",
    red: "bg-red-500 text-white border-red-600",
  }
}

// Utility hook to get rating confidence colors
export function useConfidenceColors() {
  return {
    very_high: "text-green-600 bg-green-50 border-green-200",
    high: "text-blue-600 bg-blue-50 border-blue-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    low: "text-red-600 bg-red-50 border-red-200",
  }
}

// Hook to prefetch rating data for better performance
export function usePrefetchEmployerRatings() {
  const queryClient = useQueryClient()

  return {
    prefetchEmployer: (employerId: string) => {
      queryClient.prefetchQuery({
        queryKey: ["employer-ratings", employerId],
        queryFn: () => fetchApi<EmployerRatingData>(`${RATING_API_BASE}/employers/${employerId}`),
        staleTime: 5 * 60 * 1000,
      })
    },
    prefetchMultiple: (employerIds: string[]) => {
      queryClient.prefetchQuery({
        queryKey: ["multiple-employer-ratings", employerIds],
        queryFn: async () => {
          if (employerIds.length === 0) return {}

          const params = new URLSearchParams()
          params.set("employer_ids", employerIds.join(","))

          const response = await fetchApi<ApiResponse<Record<string, EmployerRatingData>>>(
            `${RATING_API_BASE}/employers/bulk?${params.toString()}`
          )
          return response.data
        },
        staleTime: 5 * 60 * 1000,
      })
    },
  }
}
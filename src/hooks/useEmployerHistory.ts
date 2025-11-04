'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/hooks/use-toast'

interface EmployerChange {
  id: string
  employer_id: string
  change_type: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_at: string
  from_version: number | null
  to_version: number
  changed_fields: Record<string, boolean>
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  change_context: Record<string, any>
  conflict_with_change_id: string | null
  conflict_resolution_type: string | null
  resolved_at: string | null
  resolved_by: string | null
  bulk_operation_id: string | null
  changed_by_name: string
  changed_by_email: string
}

interface ChangeHistoryFilters {
  changeType?: 'INSERT' | 'UPDATE' | 'DELETE' | 'all'
  userId?: string
  startDate?: string
  endDate?: string
  includeConflicts?: boolean
  searchTerm?: string
  limit?: number
  offset?: number
}

interface ChangeHistoryResponse {
  changes: EmployerChange[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_more: boolean
  }
}

interface UseEmployerHistoryOptions {
  autoFetch?: boolean
  defaultPageSize?: number
}

interface UseEmployerHistoryReturn {
  changes: EmployerChange[]
  isLoading: boolean
  error: string | null
  totalCount: number
  currentPage: number
  pageSize: number

  // Actions
  fetchHistory: (filters?: ChangeHistoryFilters) => Promise<void>
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  searchChanges: (term: string) => Promise<void>

  // State helpers
  hasMore: boolean
  isEmpty: boolean
  filteredChanges: EmployerChange[]
  changeCount: number
  conflictCount: number
  uniqueUserCount: number
}

export function useEmployerHistory(
  employerId: string,
  options: UseEmployerHistoryOptions = {}
): UseEmployerHistoryReturn {
  const {
    autoFetch = true,
    defaultPageSize = 20
  } = options

  const [changes, setChanges] = useState<EmployerChange[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(defaultPageSize)
  const [currentFilters, setCurrentFilters] = useState<ChangeHistoryFilters>({})

  const { toast } = useToast()

  // Fetch change history
  const fetchHistory = useCallback(async (filters: ChangeHistoryFilters = {}) => {
    if (!employerId) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()

      // Apply pagination
      params.append('limit', (filters.limit || pageSize).toString())
      params.append('offset', (filters.offset || 0).toString())

      // Apply filters
      if (filters.changeType && filters.changeType !== 'all') {
        params.append('change_type', filters.changeType)
      }

      if (filters.userId) {
        params.append('user_id', filters.userId)
      }

      if (filters.startDate) {
        params.append('start_date', filters.startDate)
      }

      if (filters.endDate) {
        params.append('end_date', filters.endDate)
      }

      if (filters.includeConflicts) {
        params.append('include_conflicts', 'true')
      }

      const response = await fetch(`/api/employers/${employerId}/changes?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch change history')
      }

      const data: ChangeHistoryResponse = await response.json()

      // If this is a new search (offset 0), replace changes
      // otherwise, append to existing changes
      if (filters.offset === 0) {
        setChanges(data.changes || [])
      } else {
        setChanges(prev => [...prev, ...(data.changes || [])])
      }

      setTotalCount(data.pagination?.total || 0)

      // Update current page based on offset
      if (filters.offset !== undefined) {
        setCurrentPage(Math.floor(filters.offset / pageSize) + 1)
      }

      setCurrentFilters(filters)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: 'Failed to load change history',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [employerId, pageSize, toast])

  // Load more changes
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return

    await fetchHistory({
      ...currentFilters,
      offset: changes.length
    })
  }, [hasMore, isLoading, changes.length, currentFilters, fetchHistory])

  // Refresh current data
  const refresh = useCallback(async () => {
    await fetchHistory({
      ...currentFilters,
      offset: 0
    })
  }, [currentFilters, fetchHistory])

  // Search changes
  const searchChanges = useCallback(async (term: string) => {
    await fetchHistory({
      ...currentFilters,
      searchTerm: term,
      offset: 0
    })
  }, [currentFilters, fetchHistory])

  // Filter changes by search term (client-side for immediate feedback)
  const filteredChanges = changes.filter(change => {
    if (!currentFilters.searchTerm) return true

    const searchLower = currentFilters.searchTerm.toLowerCase()
    return (
      change.changed_by_name?.toLowerCase().includes(searchLower) ||
      change.changed_by_email?.toLowerCase().includes(searchLower) ||
      change.change_type.toLowerCase().includes(searchLower) ||
      Object.keys(change.changed_fields).some(field => field.toLowerCase().includes(searchLower))
    )
  })

  // Computed values
  const hasMore = totalCount > changes.length
  const isEmpty = changes.length === 0 && !isLoading
  const changeCount = changes.length
  const conflictCount = changes.filter(change => change.conflict_with_change_id !== null).length
  const uniqueUserCount = new Set(changes.map(change => change.changed_by)).size

  // Initial fetch
  useEffect(() => {
    if (autoFetch && employerId) {
      fetchHistory()
    }
  }, [autoFetch, employerId, fetchHistory])

  return {
    changes,
    isLoading,
    error,
    totalCount,
    currentPage,
    pageSize,

    // Actions
    fetchHistory,
    loadMore,
    refresh,
    searchChanges,

    // State helpers
    hasMore,
    isEmpty,
    filteredChanges,
    changeCount,
    conflictCount,
    uniqueUserCount
  }
}
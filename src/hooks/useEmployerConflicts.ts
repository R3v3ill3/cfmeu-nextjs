'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'

interface ConflictingField {
  field: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  auto_resolvable: boolean
  value_1: string
  value_2: string
}

interface ConflictDetails {
  id: string
  employer_id: string
  conflicting_change_id_1: string
  conflicting_change_id_2: string
  conflict_detected_at: string
  conflicting_fields: ConflictingField[]
  conflict_severity: 'low' | 'medium' | 'high' | 'critical'
  resolution_status: 'pending' | 'resolved' | 'deferred' | 'escalated'
  resolved_by: string | null
  resolved_at: string | null
  resolution_method: string | null
  resolution_notes: string | null
  resolved_values: Record<string, any> | null
  created_at: string
  updated_at: string
}

interface ConflictStatistics {
  total_conflicts: number
  by_severity: {
    low: number
    medium: number
    high: number
    critical: number
  }
  by_status: {
    pending: number
    resolved: number
    deferred: number
    escalated: number
  }
}

interface UseEmployerConflictsOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  includeResolved?: boolean
}

interface UseEmployerConflictsReturn {
  conflicts: ConflictDetails[]
  statistics: ConflictStatistics
  isLoading: boolean
  error: string | null

  // Actions
  fetchConflicts: () => Promise<void>
  detectNewConflicts: () => Promise<ConflictDetails[]>
  autoResolveConflict: (conflictId: string, strategy: 'prefer_latest' | 'prefer_first' | 'merge_safe') => Promise<AutoResolveResult>
  manualResolveConflict: (conflictId: string, resolvedData: Record<string, any>, notes?: string) => Promise<boolean>

  // State helpers
  hasActiveConflicts: boolean
  pendingConflictsCount: number
  resolvedConflictsCount: number
  highSeverityConflictsCount: number
  autoResolvableConflictsCount: number
}

interface AutoResolveResult {
  success: boolean
  resolved_employer_data?: Record<string, any>
  unresolved_fields?: ConflictingField[]
  resolution_log?: Array<{
    step: string
    status: string
    message?: string
    action?: string
    value?: string
    timestamp?: string
  }>
}

export function useEmployerConflicts(
  employerId: string,
  options: UseEmployerConflictsOptions = {}
): UseEmployerConflictsReturn {
  const {
    autoRefresh = false,
    refreshInterval = 120000, // 2 minutes
    includeResolved = false
  } = options

  const [conflicts, setConflicts] = useState<ConflictDetails[]>([])
  const [statistics, setStatistics] = useState<ConflictStatistics>({
    total_conflicts: 0,
    by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
    by_status: { pending: 0, resolved: 0, deferred: 0, escalated: 0 }
  })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch conflicts
  const fetchConflicts = useCallback(async () => {
    if (!employerId) return

    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (includeResolved) {
        params.append('include_resolved', 'true')
      }

      const response = await fetch(`/api/employers/${employerId}/conflicts?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch conflicts')
      }

      const data = await response.json()
      setConflicts(data.conflicts || [])
      setStatistics(data.statistics || {
        total_conflicts: 0,
        by_severity: { low: 0, medium: 0, high: 0, critical: 0 },
        by_status: { pending: 0, resolved: 0, deferred: 0, escalated: 0 }
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching conflicts:', err)
    } finally {
      setIsLoading(false)
    }
  }, [employerId, includeResolved])

  // Detect new conflicts
  const detectNewConflicts = useCallback(async (): Promise<ConflictDetails[]> => {
    if (!employerId) return []

    try {
      const response = await fetch(`/api/employers/${employerId}/conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'detect_new'
        })
      })

      if (!response.ok) {
        throw new Error('Failed to detect conflicts')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Conflict Detection Complete',
          description: `Found ${result.new_conflicts_count} new conflicts.`,
        })

        // Refresh conflicts list
        await fetchConflicts()
        return result.detected_conflicts || []
      }

      return []
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: 'Failed to detect conflicts',
        variant: 'destructive'
      })
      console.error('Error detecting conflicts:', err)
      return []
    }
  }, [employerId, fetchConflicts, toast])

  // Auto-resolve conflict
  const autoResolveConflict = useCallback(async (
    conflictId: string,
    strategy: 'prefer_latest' | 'prefer_first' | 'merge_safe' = 'merge_safe'
  ): Promise<AutoResolveResult> => {
    try {
      const response = await fetch(`/api/employers/${employerId}/conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'auto_resolve',
          conflict_id: conflictId,
          resolution_strategy: strategy
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to auto-resolve conflict')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Conflict Auto-Resolved',
          description: 'The conflict has been automatically resolved.',
        })
      } else {
        toast({
          title: 'Partial Resolution',
          description: `${result.unresolved_fields?.length || 0} fields require manual resolution.`,
        })
      }

      // Refresh conflicts list
      await fetchConflicts()

      return {
        success: result.success,
        resolved_employer_data: result.resolved_employer_data,
        unresolved_fields: result.unresolved_fields || [],
        resolution_log: result.resolution_log || []
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: 'Failed to auto-resolve conflict',
        variant: 'destructive'
      })
      console.error('Error auto-resolving conflict:', err)
      return {
        success: false
      }
    }
  }, [employerId, fetchConflicts, toast])

  // Manual resolve conflict
  const manualResolveConflict = useCallback(async (
    conflictId: string,
    resolvedData: Record<string, any>,
    notes?: string
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/employers/${employerId}/conflicts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'manual_resolve',
          conflict_id: conflictId,
          resolved_data: resolvedData,
          resolution_notes: notes
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to resolve conflict')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Conflict Resolved',
          description: 'The conflict has been manually resolved.',
        })

        // Refresh conflicts list
        await fetchConflicts()
        return true
      }

      return false
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: 'Failed to resolve conflict',
        variant: 'destructive'
      })
      console.error('Error resolving conflict:', err)
      return false
    }
  }, [employerId, fetchConflicts, toast])

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && refreshInterval) {
      const interval = setInterval(fetchConflicts, refreshInterval)
      return () => clearInterval(interval)
    }
  }, [autoRefresh, refreshInterval, fetchConflicts])

  // Initial fetch
  useEffect(() => {
    if (employerId) {
      fetchConflicts()
    }
  }, [employerId, fetchConflicts])

  // Computed values
  const hasActiveConflicts = statistics.by_status.pending > 0
  const pendingConflictsCount = statistics.by_status.pending
  const resolvedConflictsCount = statistics.by_status.resolved
  const highSeverityConflictsCount = statistics.by_severity.high + statistics.by_severity.critical
  const autoResolvableConflictsCount = conflicts.reduce((count, conflict) => {
    return count + conflict.conflicting_fields.filter(field => field.auto_resolvable).length
  }, 0)

  return {
    conflicts,
    statistics,
    isLoading,
    error,

    // Actions
    fetchConflicts,
    detectNewConflicts,
    autoResolveConflict,
    manualResolveConflict,

    // State helpers
    hasActiveConflicts,
    pendingConflictsCount,
    resolvedConflictsCount,
    highSeverityConflictsCount,
    autoResolvableConflictsCount
  }
}
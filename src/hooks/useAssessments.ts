"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AssessmentType, FourPointRating } from '@/types/assessments'

interface Assessment {
  id: string
  assessment_type: AssessmentType
  employer_id: string
  assessor_id: string
  assessment_date: string
  status: 'draft' | 'submitted' | 'reviewed' | 'approved'
  score?: FourPointRating
  confidence?: number
  created_at: string
  updated_at: string
}

interface UseAssessmentsOptions {
  employerId?: string
  assessmentType?: AssessmentType
  limit?: number
  enabled?: boolean
  realTime?: boolean
  pollingInterval?: number
}

interface CreateAssessmentData {
  employer_id: string
  assessment_type: AssessmentType
  assessment_data: any
  client_timestamp?: string
  offline_id?: string
  device_info?: any
}

interface UpdateAssessmentData {
  assessment_id: string
  assessment_type: AssessmentType
  updates: any
  client_timestamp?: string
  conflict_resolution?: 'server_wins' | 'client_wins' | 'merge'
}

// Hook for fetching assessments with mobile optimization
export function useAssessments(options: UseAssessmentsOptions = {}) {
  const {
    employerId,
    assessmentType,
    limit = 20,
    enabled = true,
    realTime = false,
    pollingInterval = 30000, // 30 seconds default
  } = options

  const queryClient = useQueryClient()
  const lastSyncRef = useRef<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Fetch assessments with progressive loading
  const {
    data: assessmentsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['assessments', employerId, assessmentType, limit],
    queryFn: async () => {
      if (!employerId) return null

      const params = new URLSearchParams({
        limit: String(limit),
        lightweight: 'true', // Use lightweight mode by default for mobile
      })

      if (assessmentType) {
        params.append('assessment_type', assessmentType)
      }

      if (lastSyncRef.current) {
        params.append('last_sync', lastSyncRef.current)
      }

      const response = await fetch(`/api/mobile/assessments?${params}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch assessments')
      }

      const result = await response.json()

      // Update last sync timestamp
      if (result.data?.sync_info?.current_sync) {
        lastSyncRef.current = result.data.sync_info.current_sync
      }

      return result.data
    },
    enabled: enabled && !!employerId && isOnline,
    refetchInterval: realTime && isOnline ? pollingInterval : false,
    staleTime: 60000, // 1 minute
  })

  // Real-time updates subscription
  useEffect(() => {
    if (!realTime || !employerId || !isOnline) return

    const pollForUpdates = async () => {
      try {
        const params = new URLSearchParams({
          employer_ids: employerId,
          type: 'assessment_changes',
          last_check: lastSyncRef.current || new Date(Date.now() - 60000).toISOString(),
        })

        const response = await fetch(`/api/realtime/ratings-updates?${params}`)
        if (response.ok) {
          const result = await response.json()

          if (result.data?.updates?.length > 0) {
            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries(['assessments', employerId])
            queryClient.invalidateQueries(['employer', employerId])
          }
        }
      } catch (error) {
        console.error('Error polling for real-time updates:', error)
      }
    }

    const interval = setInterval(pollForUpdates, pollingInterval)

    return () => clearInterval(interval)
  }, [realTime, employerId, isOnline, pollingInterval, queryClient])

  // Create assessment mutation
  const createAssessmentMutation = useMutation({
    mutationFn: async (data: CreateAssessmentData) => {
      const response = await fetch('/api/mobile/assessments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          client_timestamp: data.client_timestamp || new Date().toISOString(),
          device_info: data.device_info || {
            user_agent: navigator.userAgent,
            platform: navigator.platform,
            timestamp: new Date().toISOString(),
          },
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to create assessment')
      }

      return response.json()
    },
    onSuccess: (result) => {
      // Invalidate related queries
      queryClient.invalidateQueries(['assessments', result.data?.assessment?.employer_id])
      queryClient.invalidateQueries(['employer', result.data?.assessment?.employer_id])
    },
  })

  // Update assessment mutation
  const updateAssessmentMutation = useMutation({
    mutationFn: async (data: UpdateAssessmentData) => {
      const response = await fetch('/api/mobile/assessments', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          client_timestamp: data.client_timestamp || new Date().toISOString(),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to update assessment')
      }

      return response.json()
    },
    onSuccess: (result) => {
      // Invalidate related queries
      queryClient.invalidateQueries(['assessments'])
      queryClient.invalidateQueries(['assessment', data.assessment_id])
    },
  })

  // Delete assessment mutation
  const deleteAssessmentMutation = useMutation({
    mutationFn: async ({ assessmentId, assessmentType }: { assessmentId: string, assessmentType: AssessmentType }) => {
      const response = await fetch(`/api/assessments/${assessmentType}/${assessmentId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to delete assessment')
      }

      return response.json()
    },
    onSuccess: () => {
      // Invalidate related queries
      queryClient.invalidateQueries(['assessments', employerId])
    },
  })

  // Refresh assessments
  const refreshAssessments = useCallback(() => {
    if (isOnline) {
      refetch()
    }
  }, [refetch, isOnline])

  // Force sync (clear cache and refetch)
  const forceSync = useCallback(() => {
    lastSyncRef.current = null
    queryClient.invalidateQueries(['assessments', employerId])
    refreshAssessments()
  }, [queryClient, employerId, refreshAssessments])

  return {
    assessments: assessmentsData?.assessments || [],
    employerRating: assessmentsData?.employer_rating,
    pagination: assessmentsData?.pagination,
    isLoading,
    error,
    isOnline,
    lastSync: lastSyncRef.current,
    refreshAssessments,
    forceSync,

    // Mutations
    createAssessment: createAssessmentMutation.mutateAsync,
    updateAssessment: updateAssessmentMutation.mutateAsync,
    deleteAssessment: deleteAssessmentMutation.mutateAsync,

    // Mutation states
    isCreating: createAssessmentMutation.isPending,
    isUpdating: updateAssessmentMutation.isPending,
    isDeleting: deleteAssessmentMutation.isPending,

    // Mutation errors
    createError: createAssessmentMutation.error,
    updateError: updateAssessmentMutation.error,
    deleteError: deleteAssessmentMutation.error,
  }
}

// Hook for offline assessment management
export function useOfflineAssessments() {
  const [offlineAssessments, setOfflineAssessments] = useState<any[]>([])
  const [syncQueue, setSyncQueue] = useState<any[]>([])
  const queryClient = useQueryClient()

  // Load offline assessments from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('offline_assessments')
      if (stored) {
        setOfflineAssessments(JSON.parse(stored))
      }

      const storedQueue = localStorage.getItem('assessment_sync_queue')
      if (storedQueue) {
        setSyncQueue(JSON.parse(storedQueue))
      }
    } catch (error) {
      console.error('Error loading offline assessments:', error)
    }
  }, [])

  // Save offline assessments to localStorage
  const saveOfflineAssessments = useCallback((assessments: any[]) => {
    try {
      localStorage.setItem('offline_assessments', JSON.stringify(assessments))
      setOfflineAssessments(assessments)
    } catch (error) {
      console.error('Error saving offline assessments:', error)
    }
  }, [])

  // Save sync queue to localStorage
  const saveSyncQueue = useCallback((queue: any[]) => {
    try {
      localStorage.setItem('assessment_sync_queue', JSON.stringify(queue))
      setSyncQueue(queue)
    } catch (error) {
      console.error('Error saving sync queue:', error)
    }
  }, [])

  // Create offline assessment
  const createOfflineAssessment = useCallback((data: any) => {
    const offlineAssessment = {
      ...data,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'offline',
    }

    const updatedAssessments = [...offlineAssessments, offlineAssessment]
    saveOfflineAssessments(updatedAssessments)

    return offlineAssessment
  }, [offlineAssessments, saveOfflineAssessments])

  // Add assessment to sync queue
  const queueForSync = useCallback((assessment: any, action: 'create' | 'update' | 'delete') => {
    const syncItem = {
      assessment,
      action,
      timestamp: new Date().toISOString(),
      retry_count: 0,
    }

    const updatedQueue = [...syncQueue, syncItem]
    saveSyncQueue(updatedQueue)
  }, [syncQueue, saveSyncQueue])

  // Process sync queue
  const processSyncQueue = useCallback(async () => {
    if (!navigator.onLine || syncQueue.length === 0) return

    const processedItems: any[] = []
    const failedItems: any[] = []

    for (const item of syncQueue) {
      try {
        switch (item.action) {
          case 'create':
            await fetch('/api/mobile/assessments', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...item.assessment,
                offline_id: item.assessment.id,
              }),
            })
            break

          case 'update':
            await fetch('/api/mobile/assessments', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                assessment_id: item.assessment.online_id,
                assessment_type: item.assessment.assessment_type,
                updates: item.assessment.updates,
              }),
            })
            break

          case 'delete':
            if (item.assessment.online_id) {
              await fetch(`/api/assessments/${item.assessment.assessment_type}/${item.assessment.online_id}`, {
                method: 'DELETE',
              })
            }
            break
        }

        processedItems.push(item)
      } catch (error) {
        console.error('Error syncing assessment:', error)

        // Retry logic
        if (item.retry_count < 3) {
          failedItems.push({
            ...item,
            retry_count: item.retry_count + 1,
          })
        }
      }
    }

    // Update sync queue
    const newQueue = failedItems
    saveSyncQueue(newQueue)

    // Remove synced offline assessments
    if (processedItems.length > 0) {
      const syncedIds = processedItems.map(item => item.assessment.id)
      const remainingAssessments = offlineAssessments.filter(
        assessment => !syncedIds.includes(assessment.id)
      )
      saveOfflineAssessments(remainingAssessments)

      // Refresh queries
      queryClient.invalidateQueries(['assessments'])
    }

    return {
      processed: processedItems.length,
      failed: failedItems.length,
      remaining: newQueue.length,
    }
  }, [syncQueue, offlineAssessments, saveSyncQueue, saveOfflineAssessments, queryClient])

  // Clear offline assessments
  const clearOfflineAssessments = useCallback(() => {
    localStorage.removeItem('offline_assessments')
    setOfflineAssessments([])
  }, [])

  return {
    offlineAssessments,
    syncQueue,
    createOfflineAssessment,
    queueForSync,
    processSyncQueue,
    clearOfflineAssessments,
    hasOfflineData: offlineAssessments.length > 0 || syncQueue.length > 0,
  }
}

// Hook for assessment statistics
export function useAssessmentStats(employerId?: string) {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['assessment_stats', employerId],
    queryFn: async () => {
      if (!employerId) return null

      const response = await fetch(`/api/assessments/stats?employer_id=${employerId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch assessment stats')
      }

      return response.json()
    },
    enabled: !!employerId,
    staleTime: 300000, // 5 minutes
  })

  return {
    stats: stats?.data,
    isLoading,
    error,
  }
}
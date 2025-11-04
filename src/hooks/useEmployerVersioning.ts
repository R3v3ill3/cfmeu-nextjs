'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'

interface EmployerVersionInfo {
  id: string
  version: number
  last_known_version: number | null
  is_being_edited: boolean
  current_editor_id: string | null
  can_edit: boolean
  conflict_risk: 'low' | 'medium' | 'high'
  active_editors: Array<{
    user_id: string
    session_started: string
    last_heartbeat: string
    client_session_id: string
  }>
  recent_changes: Array<{
    changed_by: string
    changed_at: string
    change_type: string
    changed_fields: Record<string, boolean>
  }>
  recommendations: Array<{
    type: string
    message: string
    action: string
  }>
}

interface UseEmployerVersioningOptions {
  autoRefresh?: boolean
  refreshInterval?: number
  heartbeatInterval?: number
}

interface UseEmployerVersioningReturn {
  versionInfo: EmployerVersionInfo | null
  isLoading: boolean
  error: string | null
  sessionId: string | null
  isEditing: boolean

  // Actions
  startEditing: () => Promise<boolean>
  stopEditing: () => Promise<boolean>
  updateEmployer: (data: Record<string, any>, options?: UpdateOptions) => Promise<UpdateResult>
  refreshVersionInfo: () => Promise<void>
  heartbeat: () => Promise<boolean>

  // State helpers
  canEdit: boolean
  hasActiveEditors: boolean
  conflictRisk: 'low' | 'medium' | 'high'
  activeEditorsCount: number
}

interface UpdateOptions {
  changeContext?: Record<string, any>
  expectedVersion?: number
}

interface UpdateResult {
  success: boolean
  newVersion?: number
  conflictDetected?: boolean
  conflictDetails?: Record<string, any>
  employer?: Record<string, any>
  error?: string
}

export function useEmployerVersioning(
  employerId: string,
  options: UseEmployerVersioningOptions = {}
): UseEmployerVersioningReturn {
  const {
    autoRefresh = true,
    refreshInterval = 60000, // 1 minute
    heartbeatInterval = 30000, // 30 seconds
  } = options

  const [versionInfo, setVersionInfo] = useState<EmployerVersionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Generate client session ID
  const generateClientSessionId = useCallback(() => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }, [])

  // Fetch version info
  const fetchVersionInfo = useCallback(async () => {
    if (!employerId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/employers/${employerId}/version`)

      if (!response.ok) {
        throw new Error('Failed to fetch version info')
      }

      const data = await response.json()
      setVersionInfo(data)

      // Update editing state based on whether we have an active session
      if (sessionId && data.active_editors.some((editor: any) => editor.client_session_id === sessionId)) {
        setIsEditing(true)
      } else if (!data.active_editors.some((editor: any) => editor.user_id === supabase.auth.getUser().then(({ data: { user } }) => user?.id))) {
        setIsEditing(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error fetching version info:', err)
    } finally {
      setIsLoading(false)
    }
  }, [employerId, sessionId, supabase])

  // Start editing session
  const startEditing = useCallback(async (): Promise<boolean> => {
    if (!employerId || isEditing) return true

    try {
      const clientSessionId = generateClientSessionId()

      const response = await fetch(`/api/employers/${employerId}/version`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          client_session_id: clientSessionId
        })
      })

      if (!response.ok) {
        const error = await response.json()

        if (error.requires_refresh) {
          toast({
            title: 'Version Conflict',
            description: 'The employer has been updated. Please refresh the page.',
            variant: 'destructive'
          })
          return false
        }

        if (error.requires_wait) {
          toast({
            title: 'Currently Being Edited',
            description: 'Another user is currently editing this employer.',
            variant: 'destructive'
          })
          return false
        }

        throw new Error(error.error || 'Failed to start editing')
      }

      const data = await response.json()
      setSessionId(data.session_id)
      setIsEditing(true)

      toast({
        title: 'Editing Started',
        description: 'You are now editing this employer.',
      })

      await fetchVersionInfo()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      return false
    }
  }, [employerId, isEditing, generateClientSessionId, fetchVersionInfo, toast])

  // Stop editing session
  const stopEditing = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !employerId) return true

    try {
      const response = await fetch(`/api/employers/${employerId}/version?session_id=${sessionId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to stop editing')
      }

      setSessionId(null)
      setIsEditing(false)

      toast({
        title: 'Editing Stopped',
        description: 'You are no longer editing this employer.',
      })

      await fetchVersionInfo()
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })
      return false
    }
  }, [sessionId, employerId, fetchVersionInfo, toast])

  // Update employer with version checking
  const updateEmployer = useCallback(async (
    data: Record<string, any>,
    options: UpdateOptions = {}
  ): Promise<UpdateResult> => {
    if (!employerId) {
      return { success: false, error: 'No employer ID provided' }
    }

    if (!isEditing) {
      const editingStarted = await startEditing()
      if (!editingStarted) {
        return { success: false, error: 'Failed to start editing session' }
      }
    }

    try {
      const response = await fetch(`/api/employers/${employerId}/changes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          expected_version: options.expectedVersion || versionInfo?.version,
          employer_data: data,
          change_context: {
            ...options.changeContext,
            client_session_id: sessionId,
            update_time: new Date().toISOString()
          }
        })
      })

      if (!response.ok) {
        const error = await response.json()

        if (error.conflicts) {
          return {
            success: false,
            conflictDetected: true,
            conflictDetails: error.conflicts,
            error: error.error
          }
        }

        throw new Error(error.error || 'Failed to update employer')
      }

      const result = await response.json()

      if (result.conflict_detected) {
        toast({
          title: 'Conflict Detected',
          description: 'Your changes conflict with another user\'s changes. Please review and resolve.',
          variant: 'destructive'
        })

        return {
          success: false,
          conflictDetected: true,
          conflictDetails: result.conflict_details,
          employer: result.employer,
          newVersion: result.new_version
        }
      }

      toast({
        title: 'Changes Saved',
        description: 'Employer data has been updated successfully.',
      })

      await fetchVersionInfo()

      return {
        success: true,
        employer: result.employer,
        newVersion: result.new_version,
        conflictDetected: false
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive'
      })

      return {
        success: false,
        error: errorMessage
      }
    }
  }, [employerId, isEditing, versionInfo?.version, sessionId, startEditing, fetchVersionInfo, toast])

  // Heartbeat for active session
  const heartbeat = useCallback(async (): Promise<boolean> => {
    if (!sessionId || !employerId) return false

    try {
      const response = await fetch(`/api/employers/${employerId}/version?session_id=${sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        // Session may have expired
        setSessionId(null)
        setIsEditing(false)
        await fetchVersionInfo()
        return false
      }

      return true
    } catch (err) {
      console.error('Heartbeat error:', err)
      setSessionId(null)
      setIsEditing(false)
      return false
    }
  }, [sessionId, employerId, fetchVersionInfo])

  // Auto-cleanup editing session on unmount
  useEffect(() => {
    return () => {
      if (sessionId) {
        stopEditing().catch(console.error)
      }
    }
  }, [sessionId, stopEditing])

  // Setup heartbeat interval
  useEffect(() => {
    if (isEditing && heartbeatInterval) {
      heartbeatIntervalRef.current = setInterval(heartbeat, heartbeatInterval)
    } else {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
    }
  }, [isEditing, heartbeat, heartbeatInterval])

  // Setup auto-refresh interval
  useEffect(() => {
    if (autoRefresh && refreshInterval) {
      refreshIntervalRef.current = setInterval(fetchVersionInfo, refreshInterval)
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
        refreshIntervalRef.current = null
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval, fetchVersionInfo])

  // Initial fetch
  useEffect(() => {
    if (employerId) {
      fetchVersionInfo()
    }
  }, [employerId, fetchVersionInfo])

  // Computed values
  const canEdit = versionInfo?.can_edit ?? false
  const hasActiveEditors = (versionInfo?.active_editors?.length ?? 0) > 0
  const conflictRisk = versionInfo?.conflict_risk ?? 'low'
  const activeEditorsCount = versionInfo?.active_editors?.length ?? 0

  return {
    versionInfo,
    isLoading,
    error,
    sessionId,
    isEditing,

    // Actions
    startEditing,
    stopEditing,
    updateEmployer,
    refreshVersionInfo: fetchVersionInfo,
    heartbeat,

    // State helpers
    canEdit,
    hasActiveEditors,
    conflictRisk,
    activeEditorsCount
  }
}
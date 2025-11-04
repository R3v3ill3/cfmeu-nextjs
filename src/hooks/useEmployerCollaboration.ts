'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useToast } from '@/hooks/use-toast'
import { useEmployerVersioning } from './useEmployerVersioning'
import { useEmployerConflicts } from './useEmployerConflicts'
import { useEmployerHistory } from './useEmployerHistory'

interface ActiveEditor {
  user_id: string
  user_name?: string
  user_email?: string
  session_started: string
  last_heartbeat: string
  client_session_id: string
}

interface CollaborationEvent {
  id: string
  type: 'user_joined' | 'user_left' | 'conflict_detected' | 'conflict_resolved' | 'change_made'
  timestamp: string
  user_id?: string
  user_name?: string
  details: Record<string, any>
}

interface UseEmployerCollaborationOptions {
  enableRealtime?: boolean
  autoStartEditing?: boolean
  conflictAutoDetection?: boolean
  historyAutoLoad?: boolean
}

interface UseEmployerCollaborationReturn {
  // Versioning
  versioning: ReturnType<typeof useEmployerVersioning>

  // Conflicts
  conflicts: ReturnType<typeof useEmployerConflicts>

  // History
  history: ReturnType<typeof useEmployerHistory>

  // Real-time collaboration
  activeEditors: ActiveEditor[]
  collaborationEvents: CollaborationEvent[]
  isRealtimeEnabled: boolean

  // Actions
  startCollaboration: () => Promise<boolean>
  stopCollaboration: () => Promise<void>
  broadcastChange: (field: string, value: any) => Promise<void>
  notifyUser: (userId: string, message: string) => Promise<void>

  // State helpers
  hasActiveCollaborators: boolean
  activeCollaboratorsCount: number
  recentActivity: CollaborationEvent[]
  needsAttention: boolean
}

export function useEmployerCollaboration(
  employerId: string,
  options: UseEmployerCollaborationOptions = {}
): UseEmployerCollaborationReturn {
  const {
    enableRealtime = true,
    autoStartEditing = false,
    conflictAutoDetection = true,
    historyAutoLoad = true
  } = options

  const [activeEditors, setActiveEditors] = useState<ActiveEditor[]>([])
  const [collaborationEvents, setCollaborationEvents] = useState<CollaborationEvent[]>([])
  const [isRealtimeEnabled, setIsRealtimeEnabled] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  const versioning = useEmployerVersioning(employerId, {
    autoRefresh: enableRealtime,
    refreshInterval: 30000,
    heartbeatInterval: 15000
  })

  const conflicts = useEmployerConflicts(employerId, {
    autoRefresh: enableRealtime,
    refreshInterval: 60000
  })

  const history = useEmployerHistory(employerId, {
    autoFetch: historyAutoLoad,
    defaultPageSize: 50
  })

  const collaborationChannelRef = useRef<any>(null)

  // Setup real-time subscription
  const setupRealtimeSubscription = useCallback(async () => {
    if (!enableRealtime || !employerId) return

    try {
      // Subscribe to employer changes
      const channel = supabase
        .channel(`employer_${employerId}_collaboration`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'employer_editing_sessions',
            filter: `employer_id=eq.${employerId}`
          },
          (payload) => {
            handleCollaborationEvent('session_change', payload)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'employer_change_conflicts',
            filter: `employer_id=eq.${employerId}`
          },
          (payload) => {
            handleCollaborationEvent('conflict_detected', payload)
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'employer_change_conflicts',
            filter: `employer_id=eq.${employerId}`
          },
          (payload) => {
            if (payload.new.resolution_status === 'resolved') {
              handleCollaborationEvent('conflict_resolved', payload)
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsRealtimeEnabled(true)
            console.log('Real-time collaboration enabled')
          }
        })

      collaborationChannelRef.current = channel
    } catch (error) {
      console.error('Error setting up real-time subscription:', error)
      setIsRealtimeEnabled(false)
    }
  }, [enableRealtime, employerId, supabase])

  // Handle collaboration events
  const handleCollaborationEvent = useCallback((
    eventType: string,
    payload: any
  ) => {
    const event: CollaborationEvent = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: eventType as CollaborationEvent['type'],
      timestamp: new Date().toISOString(),
      details: payload
    }

    switch (eventType) {
      case 'session_change':
        if (payload.eventType === 'INSERT') {
          event.type = 'user_joined'
          event.user_id = payload.new.user_id
          addCollaborationEvent(event)

          toast({
            title: 'User Joined',
            description: `${payload.new.user_name || 'Another user'} started editing this employer.`,
            duration: 3000
          })
        } else if (payload.eventType === 'DELETE') {
          event.type = 'user_left'
          event.user_id = payload.old.user_id
          addCollaborationEvent(event)

          toast({
            title: 'User Left',
            description: `${payload.old.user_name || 'Another user'} stopped editing this employer.`,
            duration: 3000
          })
        } else if (payload.eventType === 'UPDATE') {
          // User heartbeat or session update
          updateActiveEditors()
        }
        break

      case 'conflict_detected':
        event.type = 'conflict_detected'
        addCollaborationEvent(event)

        toast({
          title: 'Conflict Detected',
          description: 'A conflict has been detected. Please review the conflict resolution panel.',
          variant: 'destructive',
          duration: 5000
        })
        break

      case 'conflict_resolved':
        event.type = 'conflict_resolved'
        event.user_id = payload.new.resolved_by
        addCollaborationEvent(event)

        toast({
          title: 'Conflict Resolved',
          description: 'A conflict has been resolved successfully.',
          duration: 3000
        })
        break

      default:
        addCollaborationEvent(event)
    }
  }, [toast])

  // Add collaboration event
  const addCollaborationEvent = useCallback((event: CollaborationEvent) => {
    setCollaborationEvents(prev => {
      const newEvents = [event, ...prev].slice(0, 50) // Keep last 50 events
      return newEvents
    })
  }, [])

  // Update active editors from versioning data
  const updateActiveEditors = useCallback(() => {
    if (versioning.versionInfo?.active_editors) {
      setActiveEditors(versioning.versionInfo.active_editors)
    }
  }, [versioning.versionInfo])

  // Start collaboration session
  const startCollaboration = useCallback(async (): Promise<boolean> => {
    if (!employerId) return false

    // Start editing session
    const editingStarted = await versioning.startEditing()
    if (!editingStarted) return false

    // Setup real-time subscription
    if (enableRealtime && !isRealtimeEnabled) {
      await setupRealtimeSubscription()
    }

    // Add join event
    addCollaborationEvent({
      id: `join_${Date.now()}`,
      type: 'user_joined',
      timestamp: new Date().toISOString(),
      details: { action: 'started_collaboration' }
    })

    // Auto-detect conflicts if enabled
    if (conflictAutoDetection) {
      await conflicts.detectNewConflicts()
    }

    return true
  }, [employerId, versioning, enableRealtime, isRealtimeEnabled, setupRealtimeSubscription, conflictAutoDetection, conflicts, addCollaborationEvent])

  // Stop collaboration session
  const stopCollaboration = useCallback(async () => {
    // Stop editing session
    await versioning.stopEditing()

    // Unsubscribe from real-time
    if (collaborationChannelRef.current) {
      supabase.removeChannel(collaborationChannelRef.current)
      collaborationChannelRef.current = null
      setIsRealtimeEnabled(false)
    }

    // Add leave event
    addCollaborationEvent({
      id: `leave_${Date.now()}`,
      type: 'user_left',
      timestamp: new Date().toISOString(),
      details: { action: 'stopped_collaboration' }
    })
  }, [versioning, supabase, addCollaborationEvent])

  // Broadcast change to other users
  const broadcastChange = useCallback(async (field: string, value: any) => {
    if (!versioning.sessionId) return

    try {
      // Update pending changes in the editing session
      await fetch(`/api/employers/${employerId}/version?session_id=${versioning.sessionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          pending_changes: {
            [field]: value,
            updated_at: new Date().toISOString()
          }
        })
      })

      // Add change event
      addCollaborationEvent({
        id: `change_${Date.now()}`,
        type: 'change_made',
        timestamp: new Date().toISOString(),
        details: { field, value }
      })
    } catch (error) {
      console.error('Error broadcasting change:', error)
    }
  }, [employerId, versioning.sessionId, addCollaborationEvent])

  // Notify specific user
  const notifyUser = useCallback(async (userId: string, message: string) => {
    // This would require implementing a notification system
    // For now, we'll just add it to the collaboration events
    addCollaborationEvent({
      id: `notify_${Date.now()}`,
      type: 'user_joined', // Using existing type for now
      timestamp: new Date().toISOString(),
      user_id: userId,
      details: { notification: message }
    })

    toast({
      title: 'Notification Sent',
      description: message,
      duration: 3000
    })
  }, [addCollaborationEvent, toast])

  // Setup real-time on mount
  useEffect(() => {
    if (enableRealtime && employerId) {
      setupRealtimeSubscription()
    }

    return () => {
      if (collaborationChannelRef.current) {
        supabase.removeChannel(collaborationChannelRef.current)
      }
    }
  }, [enableRealtime, employerId, setupRealtimeSubscription, supabase])

  // Auto-start editing if enabled
  useEffect(() => {
    if (autoStartEditing && employerId && versioning.canEdit && !versioning.isEditing) {
      startCollaboration()
    }
  }, [autoStartEditing, employerId, versioning.canEdit, versioning.isEditing, startCollaboration])

  // Update active editors when versioning info changes
  useEffect(() => {
    updateActiveEditors()
  }, [updateActiveEditors])

  // Update active editors when conflicts are detected
  useEffect(() => {
    if (conflicts.hasActiveConflicts && conflictAutoDetection) {
      // Conflict detected, ensure user is aware
      toast({
        title: 'Attention Required',
        description: `${conflicts.pendingConflictsCount} conflict${conflicts.pendingConflictsCount > 1 ? 's' : ''} need${conflicts.pendingConflictsCount === 1 ? 's' : ''} your attention.`,
        variant: 'destructive',
        duration: 5000
      })
    }
  }, [conflicts.hasActiveConflicts, conflicts.pendingConflictsCount, conflictAutoDetection, toast])

  // Computed values
  const hasActiveCollaborators = activeEditors.length > 0
  const activeCollaboratorsCount = activeEditors.length
  const recentActivity = collaborationEvents.slice(0, 10)
  const needsAttention = conflicts.hasActiveConflicts || versioning.conflictRisk === 'high'

  return {
    // Versioning
    versioning,

    // Conflicts
    conflicts,

    // History
    history,

    // Real-time collaboration
    activeEditors,
    collaborationEvents,
    isRealtimeEnabled,

    // Actions
    startCollaboration,
    stopCollaboration,
    broadcastChange,
    notifyUser,

    // State helpers
    hasActiveCollaborators,
    activeCollaboratorsCount,
    recentActivity,
    needsAttention
  }
}
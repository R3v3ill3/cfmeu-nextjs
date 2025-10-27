"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react"
import { toast } from "sonner"
import {
  Assessment,
  AssessmentStatus,
  FourPointRating,
  AssessmentType
} from "@/types/assessments"

// WebSocket event types
interface RealtimeEvent {
  type: 'assessment_created' | 'assessment_updated' | 'assessment_completed' | 'assessment_deleted' | 'rating_updated'
  data: any
  timestamp: string
  userId: string
  employerId?: string
  projectId?: string
}

interface AssessmentUpdate {
  assessmentId: string
  field: string
  value: any
  previousValue: any
  updatedBy: string
  timestamp: string
}

interface CollaborationSession {
  id: string
  assessmentId: string
  userId: string
  userName: string
  joinedAt: string
  isActive: boolean
  currentField?: string
}

interface RealtimeAssessmentContextType {
  isConnected: boolean
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error'
  activeCollaborators: CollaborationSession[]
  pendingUpdates: AssessmentUpdate[]
  subscribeToAssessment: (assessmentId: string) => void
  unsubscribeFromAssessment: (assessmentId: string) => void
  sendUpdate: (assessmentId: string, field: string, value: any) => void
  subscribeToProject: (projectId: string) => void
  unsubscribeFromProject: (projectId: string) => void
  subscribeToEmployer: (employerId: string) => void
  unsubscribeFromEmployer: (employerId: string) => void
  clearPendingUpdates: () => void
  resolveConflict: (updateId: string, resolution: 'accept' | 'reject') => void
}

const RealtimeAssessmentContext = createContext<RealtimeAssessmentContextType | null>(null)

interface RealtimeAssessmentProviderProps {
  children: ReactNode
  userId: string
  projectId?: string
  websocketUrl?: string
}

export function RealtimeAssessmentProvider({
  children,
  userId,
  projectId,
  websocketUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'
}: RealtimeAssessmentProviderProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [activeCollaborators, setActiveCollaborators] = useState<CollaborationSession[]>([])
  const [pendingUpdates, setPendingUpdates] = useState<AssessmentUpdate[]>([])
  const [subscribedAssessments, setSubscribedAssessments] = useState<Set<string>>(new Set())
  const [subscribedProjects, setSubscribedProjects] = useState<Set<string>>(new Set())
  const [subscribedEmployers, setSubscribedEmployers] = useState<Set<string>>(new Set())
  const [reconnectAttempts, setReconnectAttempts] = useState(0)
  const [lastHeartbeat, setLastHeartbeat] = useState(Date.now())

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionStatus('connecting')

    try {
      const ws = new WebSocket(`${websocketUrl}?userId=${userId}&projectId=${projectId || ''}`)

      ws.onopen = () => {
        setIsConnected(true)
        setConnectionStatus('connected')
        setReconnectAttempts(0)
        setLastHeartbeat(Date.now())

        // Send initial subscriptions
        if (projectId) {
          ws.send(JSON.stringify({
            type: 'subscribe_project',
            projectId
          }))
        }

        subscribedAssessments.forEach(assessmentId => {
          ws.send(JSON.stringify({
            type: 'subscribe_assessment',
            assessmentId
          }))
        })

        subscribedEmployers.forEach(employerId => {
          ws.send(JSON.stringify({
            type: 'subscribe_employer',
            employerId
          }))
        })
      }

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleRealtimeEvent(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        setConnectionStatus('disconnected')

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts < 5) {
          const delay = Math.pow(2, reconnectAttempts) * 1000
          setTimeout(() => {
            setReconnectAttempts(prev => prev + 1)
            connect()
          }, delay)
        }
      }

      ws.onerror = () => {
        setConnectionStatus('error')
      }

      setSocket(ws)
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error)
      setConnectionStatus('error')
    }
  }, [userId, projectId, websocketUrl, socket, subscribedAssessments, subscribedEmployers, reconnectAttempts])

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (socket) {
      socket.close()
      setSocket(null)
    }
    setIsConnected(false)
    setConnectionStatus('disconnected')
    setActiveCollaborators([])
  }, [socket])

  // Handle incoming realtime events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    setLastHeartbeat(Date.now())

    switch (event.type) {
      case 'assessment_created':
        toast.success(`New assessment created by ${event.data.createdBy}`)
        break

      case 'assessment_updated':
        if (event.data.updatedBy !== userId) {
          // Handle field update
          const update: AssessmentUpdate = {
            assessmentId: event.data.assessmentId,
            field: event.data.field,
            value: event.data.value,
            previousValue: event.data.previousValue,
            updatedBy: event.data.updatedBy,
            timestamp: event.timestamp
          }

          // Check for conflicts
          const existingUpdate = pendingUpdates.find(u =>
            u.assessmentId === update.assessmentId && u.field === update.field
          )

          if (existingUpdate) {
            // Conflict detected
            toast.warning(`Conflict detected: ${event.data.field} was also modified by you`, {
              action: {
                label: 'Review',
                onClick: () => setPendingUpdates(prev => [...prev, update])
              }
            })
          } else {
            // No conflict, apply update
            setPendingUpdates(prev => [...prev, update])
          }
        }
        break

      case 'assessment_completed':
        toast.success(`Assessment completed by ${event.data.completedBy}`)
        break

      case 'collaborator_joined':
        setActiveCollaborators(prev => [
          ...prev.filter(c => c.userId !== event.data.userId),
          {
            id: event.data.sessionId,
            assessmentId: event.data.assessmentId,
            userId: event.data.userId,
            userName: event.data.userName,
            joinedAt: event.timestamp,
            isActive: true,
            currentField: event.data.currentField
          }
        ])
        toast.info(`${event.data.userName} joined the assessment`)
        break

      case 'collaborator_left':
        setActiveCollaborators(prev =>
          prev.map(c =>
            c.userId === event.data.userId
              ? { ...c, isActive: false }
              : c
          )
        )
        toast.info(`${event.data.userName} left the assessment`)
        break

      case 'collaborator_typing':
        setActiveCollaborators(prev =>
          prev.map(c =>
            c.userId === event.data.userId
              ? { ...c, currentField: event.data.field, lastActivity: event.timestamp }
              : c
          )
        )
        break

      case 'rating_updated':
        toast.info(`Rating updated to ${event.data.newRating}/4 for ${event.data.employerName}`)
        break

      case 'heartbeat':
        // Respond to server heartbeat
        if (socket) {
          socket.send(JSON.stringify({ type: 'heartbeat_response', timestamp: Date.now() }))
        }
        break
    }
  }, [userId, pendingUpdates, socket])

  // Subscribe to assessment updates
  const subscribeToAssessment = useCallback((assessmentId: string) => {
    setSubscribedAssessments(prev => new Set([...prev, assessmentId]))

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'subscribe_assessment',
        assessmentId
      }))
    }
  }, [socket])

  // Unsubscribe from assessment updates
  const unsubscribeFromAssessment = useCallback((assessmentId: string) => {
    setSubscribedAssessments(prev => {
      const newSet = new Set(prev)
      newSet.delete(assessmentId)
      return newSet
    })

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'unsubscribe_assessment',
        assessmentId
      }))
    }
  }, [socket])

  // Subscribe to project updates
  const subscribeToProject = useCallback((projectId: string) => {
    setSubscribedProjects(prev => new Set([...prev, projectId]))

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'subscribe_project',
        projectId
      }))
    }
  }, [socket])

  // Unsubscribe from project updates
  const unsubscribeFromProject = useCallback((projectId: string) => {
    setSubscribedProjects(prev => {
      const newSet = new Set(prev)
      newSet.delete(projectId)
      return newSet
    })

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'unsubscribe_project',
        projectId
      }))
    }
  }, [socket])

  // Subscribe to employer updates
  const subscribeToEmployer = useCallback((employerId: string) => {
    setSubscribedEmployers(prev => new Set([...prev, employerId]))

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'subscribe_employer',
        employerId
      }))
    }
  }, [socket])

  // Unsubscribe from employer updates
  const unsubscribeFromEmployer = useCallback((employerId: string) => {
    setSubscribedEmployers(prev => {
      const newSet = new Set(prev)
      newSet.delete(employerId)
      return newSet
    })

    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'unsubscribe_employer',
        employerId
      }))
    }
  }, [socket])

  // Send field update
  const sendUpdate = useCallback((assessmentId: string, field: string, value: any) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'assessment_update',
        assessmentId,
        field,
        value,
        timestamp: Date.now()
      }))
    }
  }, [socket])

  // Clear pending updates
  const clearPendingUpdates = useCallback(() => {
    setPendingUpdates([])
  }, [])

  // Resolve conflict
  const resolveConflict = useCallback((updateId: string, resolution: 'accept' | 'reject') => {
    if (resolution === 'accept') {
      // Apply the conflicting update
      const update = pendingUpdates.find(u => `${u.assessmentId}-${u.field}` === updateId)
      if (update) {
        // This would typically trigger a re-render or state update
        toast.success('Conflict resolved: Update accepted')
      }
    } else {
      // Reject the conflicting update
      toast.info('Conflict resolved: Update rejected')
    }

    setPendingUpdates(prev => prev.filter(u => `${u.assessmentId}-${u.field}` !== updateId))
  }, [pendingUpdates])

  // Initialize connection on mount
  useEffect(() => {
    connect()

    return () => {
      disconnect()
    }
  }, [connect, disconnect])

  // Heartbeat monitoring
  useEffect(() => {
    const interval = setInterval(() => {
      if (Date.now() - lastHeartbeat > 30000) { // 30 seconds
        setConnectionStatus('error')
        connect()
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [lastHeartbeat, connect])

  const contextValue: RealtimeAssessmentContextType = {
    isConnected,
    connectionStatus,
    activeCollaborators,
    pendingUpdates,
    subscribeToAssessment,
    unsubscribeFromAssessment,
    sendUpdate,
    subscribeToProject,
    unsubscribeFromProject,
    subscribeToEmployer,
    unsubscribeFromEmployer,
    clearPendingUpdates,
    resolveConflict
  }

  return (
    <RealtimeAssessmentContext.Provider value={contextValue}>
      {children}
    </RealtimeAssessmentContext.Provider>
  )
}

// Hook to use realtime assessment context
export function useRealtimeAssessment() {
  const context = useContext(RealtimeAssessmentContext)
  if (!context) {
    throw new Error('useRealtimeAssessment must be used within a RealtimeAssessmentProvider')
  }
  return context
}

// Component to display collaboration status
export function CollaborationStatus() {
  const { isConnected, connectionStatus, activeCollaborators } = useRealtimeAssessment()

  if (!isConnected && connectionStatus !== 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        Disconnected
      </div>
    )
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm">
        <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
        Connecting...
      </div>
    )
  }

  const activeCollaboratorCount = activeCollaborators.filter(c => c.isActive).length

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm">
        <div className="w-2 h-2 bg-green-500 rounded-full" />
        Connected
      </div>

      {activeCollaboratorCount > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
          <div className="flex -space-x-1">
            {activeCollaborators.slice(0, 3).map((collaborator) => (
              <div
                key={collaborator.userId}
                className="w-5 h-5 bg-blue-500 rounded-full border-2 border-white flex items-center justify-center"
                title={collaborator.userName}
              >
                <span className="text-xs text-white">
                  {collaborator.userName.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {activeCollaboratorCount > 3 && (
              <div className="w-5 h-5 bg-gray-400 rounded-full border-2 border-white flex items-center justify-center">
                <span className="text-xs text-white">+{activeCollaboratorCount - 3}</span>
              </div>
            )}
          </div>
          <span>{activeCollaboratorCount} active</span>
        </div>
      )}
    </div>
  )
}

// Component to show active collaborators
export function ActiveCollaborators() {
  const { activeCollaborators } = useRealtimeAssessment()
  const active = activeCollaborators.filter(c => c.isActive)

  if (active.length === 0) return null

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-medium text-sm text-blue-900 mb-2">Active Collaborators</h4>
      <div className="space-y-1">
        {active.map((collaborator) => (
          <div key={collaborator.userId} className="flex items-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span>{collaborator.userName}</span>
            {collaborator.currentField && (
              <span className="text-xs text-blue-600">
                editing {collaborator.currentField.replace('_', ' ')}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Component to resolve pending conflicts
export function ConflictResolution() {
  const { pendingUpdates, resolveConflict } = useRealtimeAssessment()

  if (pendingUpdates.length === 0) return null

  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
      <h4 className="font-medium text-amber-900 mb-3">Pending Conflicts</h4>
      <div className="space-y-3">
        {pendingUpdates.map((update, index) => (
          <div key={index} className="flex items-center justify-between p-3 bg-white border border-amber-300 rounded">
            <div className="text-sm">
              <div className="font-medium">
                {update.field.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </div>
              <div className="text-xs text-muted-foreground">
                Modified by {update.updatedBy} at {new Date(update.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveConflict(`${update.assessmentId}-${update.field}`, 'accept')}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => resolveConflict(`${update.assessmentId}-${update.field}`, 'reject')}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
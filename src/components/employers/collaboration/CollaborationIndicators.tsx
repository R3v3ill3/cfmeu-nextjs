'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { Users, AlertTriangle, Clock, CheckCircle, XCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

interface ActiveEditor {
  user_id: string
  user_name?: string
  user_email?: string
  session_started: string
  last_heartbeat: string
  client_session_id: string
}

interface ConflictRisk {
  can_edit: boolean
  conflict_risk: 'low' | 'medium' | 'high'
  active_editors: ActiveEditor[]
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

interface CollaborationIndicatorsProps {
  employerId: string
  className?: string
  compact?: boolean
  showDetails?: boolean
}

export function CollaborationIndicators({
  employerId,
  className,
  compact = false,
  showDetails = false
}: CollaborationIndicatorsProps) {
  const [conflictRisk, setConflictRisk] = useState<ConflictRisk | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [editingSession, setEditingSession] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Fetch conflict risk data
  const fetchConflictRisk = useCallback(async () => {
    try {
      const response = await fetch(`/api/employers/${employerId}/version?auto_detect=true`)

      if (!response.ok) {
        throw new Error('Failed to fetch collaboration status')
      }

      const data = await response.json()
      setConflictRisk(data)
      setLastRefresh(new Date())
    } catch (error) {
      console.error('Error fetching conflict risk:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch collaboration status',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [employerId, toast])

  // Start editing session
  const startEditing = useCallback(async () => {
    try {
      const clientSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

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
          return
        }

        if (error.requires_wait) {
          toast({
            title: 'Currently Being Edited',
            description: 'Another user is currently editing this employer.',
            variant: 'destructive'
          })
          return
        }

        throw new Error(error.error || 'Failed to start editing')
      }

      const data = await response.json()
      setEditingSession(data.session_id)

      toast({
        title: 'Editing Started',
        description: 'You are now editing this employer.',
      })

      // Refresh conflict risk data
      await fetchConflictRisk()
    } catch (error) {
      console.error('Error starting editing:', error)
      toast({
        title: 'Error',
        description: 'Failed to start editing session',
        variant: 'destructive'
      })
    }
  }, [employerId, fetchConflictRisk, toast])

  // End editing session
  const stopEditing = useCallback(async () => {
    if (!editingSession) return

    try {
      const response = await fetch(`/api/employers/${employerId}/version?session_id=${editingSession}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to stop editing')
      }

      setEditingSession(null)

      toast({
        title: 'Editing Stopped',
        description: 'You are no longer editing this employer.',
      })

      // Refresh conflict risk data
      await fetchConflictRisk()
    } catch (error) {
      console.error('Error stopping editing:', error)
      toast({
        title: 'Error',
        description: 'Failed to stop editing session',
        variant: 'destructive'
      })
    }
  }, [employerId, editingSession, fetchConflictRisk, toast])

  // Heartbeat for active session
  const heartbeat = useCallback(async () => {
    if (!editingSession) return

    try {
      const response = await fetch(`/api/employers/${employerId}/version?session_id=${editingSession}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })

      if (!response.ok) {
        // Session may have expired
        setEditingSession(null)
        await fetchConflictRisk()
      }
    } catch (error) {
      console.error('Heartbeat error:', error)
      setEditingSession(null)
    }
  }, [employerId, editingSession, fetchConflictRisk])

  // Initial data fetch
  useEffect(() => {
    fetchConflictRisk()
  }, [fetchConflictRisk])

  // Set up heartbeat for active sessions
  useEffect(() => {
    if (!editingSession) return

    const interval = setInterval(heartbeat, 30000) // 30 seconds
    return () => clearInterval(interval)
  }, [editingSession, heartbeat])

  // Set up periodic refresh of conflict risk data
  useEffect(() => {
    const interval = setInterval(fetchConflictRisk, 60000) // 1 minute
    return () => clearInterval(interval)
  }, [fetchConflictRisk])

  // Determine status colors and icons
  const getStatusInfo = () => {
    if (isLoading) {
      return {
        color: 'gray',
        icon: RefreshCw,
        text: 'Loading...',
        className: 'text-gray-500'
      }
    }

    if (!conflictRisk?.can_edit) {
      return {
        color: 'red',
        icon: XCircle,
        text: 'Cannot Edit',
        className: 'text-red-500'
      }
    }

    if (conflictRisk.active_editors.length > 0) {
      return {
        color: 'yellow',
        icon: Users,
        text: `${conflictRisk.active_editors.length} Active Editor${conflictRisk.active_editors.length > 1 ? 's' : ''}`,
        className: 'text-yellow-600'
      }
    }

    if (conflictRisk.conflict_risk === 'high') {
      return {
        color: 'orange',
        icon: AlertTriangle,
        text: 'High Conflict Risk',
        className: 'text-orange-500'
      }
    }

    if (conflictRisk.conflict_risk === 'medium') {
      return {
        color: 'yellow',
        icon: Clock,
        text: 'Medium Conflict Risk',
        className: 'text-yellow-600'
      }
    }

    return {
      color: 'green',
      icon: CheckCircle,
      text: 'Safe to Edit',
      className: 'text-green-600'
    }
  }

  const statusInfo = getStatusInfo()
  const StatusIcon = statusInfo.icon

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <StatusIcon className={cn('h-4 w-4', statusInfo.className)} />
        <span className={cn('text-sm font-medium', statusInfo.className)}>
          {statusInfo.text}
        </span>
        {!editingSession && conflictRisk?.can_edit && (
          <Button
            size="sm"
            variant="outline"
            onClick={startEditing}
            className="ml-auto"
          >
            Start Editing
          </Button>
        )}
        {editingSession && (
          <Button
            size="sm"
            variant="outline"
            onClick={stopEditing}
            className="ml-auto"
          >
            Stop Editing
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', statusInfo.className)} />
            Collaboration Status
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.color === 'green' ? 'default' : 'secondary'}>
              {conflictRisk?.conflict_risk?.toUpperCase() || 'UNKNOWN'}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={fetchConflictRisk}
              disabled={isLoading}
            >
              <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            {/* Current Editor Status */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="font-medium">Your Status</p>
                <p className="text-sm text-gray-600">
                  {editingSession ? 'Currently editing' : 'Not editing'}
                </p>
              </div>
              {!editingSession && conflictRisk?.can_edit ? (
                <Button onClick={startEditing} size="sm">
                  Start Editing
                </Button>
              ) : editingSession ? (
                <Button onClick={stopEditing} size="sm" variant="outline">
                  Stop Editing
                </Button>
              ) : (
                <Badge variant="destructive">Cannot Edit</Badge>
              )}
            </div>

            {/* Active Editors */}
            {conflictRisk?.active_editors && conflictRisk.active_editors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Active Editors ({conflictRisk.active_editors.length})
                </h4>
                <div className="space-y-2">
                  {conflictRisk.active_editors.map((editor, index) => (
                    <div key={editor.client_session_id} className="flex items-center justify-between p-2 bg-yellow-50 rounded">
                      <div>
                        <p className="font-medium text-sm">
                          {editor.user_name || `User ${editor.user_id.slice(0, 8)}`}
                        </p>
                        <p className="text-xs text-gray-600">
                          Started: {new Date(editor.session_started).toLocaleTimeString()}
                        </p>
                      </div>
                      <Badge variant="outline">Active</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Changes */}
            {showDetails && conflictRisk?.recent_changes && conflictRisk.recent_changes.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Recent Changes ({conflictRisk.recent_changes.length})
                </h4>
                <div className="space-y-2">
                  {conflictRisk.recent_changes.slice(0, 3).map((change, index) => (
                    <div key={index} className="p-2 bg-blue-50 rounded text-sm">
                      <p className="font-medium">
                        {change.change_type} by {change.changed_by.slice(0, 8)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {new Date(change.changed_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {conflictRisk?.recommendations && conflictRisk.recommendations.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Recommendations
                </h4>
                <div className="space-y-2">
                  {conflictRisk.recommendations.map((rec, index) => (
                    <div key={index} className="p-2 bg-orange-50 rounded text-sm">
                      <p className="font-medium">{rec.message}</p>
                      <p className="text-xs text-gray-600">Suggested action: {rec.action}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Last Refresh */}
            <div className="text-xs text-gray-500 text-center">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
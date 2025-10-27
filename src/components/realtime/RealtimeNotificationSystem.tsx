"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  Bell,
  CheckCircle,
  AlertTriangle,
  Info,
  X,
  Clock,
  Users,
  Shield,
  TrendingUp,
  Settings,
  Volume2,
  VolumeX
} from "lucide-react"
import { toast } from "sonner"
import { useRealtimeAssessment } from "./RealtimeAssessmentProvider"
import { format, formatDistanceToNow } from "date-fns"

interface Notification {
  id: string
  type: 'info' | 'success' | 'warning' | 'error' | 'collaboration' | 'rating_update' | 'assessment_due'
  title: string
  message: string
  timestamp: string
  read: boolean
  actionUrl?: string
  actionLabel?: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  metadata?: {
    assessmentId?: string
    employerId?: string
    userId?: string
    assessmentType?: string
    rating?: number
    previousRating?: number
  }
}

interface RealtimeNotificationSystemProps {
  userId: string
  maxNotifications?: number
  enableSound?: boolean
  className?: string
}

export function RealtimeNotificationSystem({
  userId,
  maxNotifications = 50,
  enableSound = true,
  className
}: RealtimeNotificationSystemProps) {
  const { isConnected, subscribeToEmployer, subscribeToProject } = useRealtimeAssessment()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isExpanded, setIsExpanded] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(enableSound)
  const [unreadCount, setUnreadCount] = useState(0)

  // Generate notification sound
  const playNotificationSound = useCallback((type: Notification['type']) => {
    if (!soundEnabled) return

    try {
      const audio = new Audio()
      switch (type) {
        case 'success':
          audio.src = '/sounds/success.mp3'
          break
        case 'warning':
        case 'error':
          audio.src = '/sounds/alert.mp3'
          break
        case 'collaboration':
          audio.src = '/sounds/collaboration.mp3'
          break
        default:
          audio.src = '/sounds/notification.mp3'
      }
      audio.volume = 0.3
      audio.play().catch(() => {
        // Ignore errors from autoplay policies
      })
    } catch (error) {
      // Ignore sound errors
    }
  }, [soundEnabled])

  // Add new notification
  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    priority: Notification['priority'] = 'medium',
    metadata?: Notification['metadata']
  ) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      priority,
      metadata
    }

    setNotifications(prev => {
      const updated = [notification, ...prev].slice(0, maxNotifications)
      return updated
    })

    setUnreadCount(prev => prev + 1)
    playNotificationSound(type)

    // Also show toast for important notifications
    if (priority === 'high' || priority === 'urgent') {
      toast(title, {
        description: message,
        action: metadata?.actionUrl ? {
          label: 'View',
          onClick: () => {
            // Navigate to action URL
            window.location.href = metadata.actionUrl
          }
        } : undefined
      })
    }
  }, [maxNotifications, playNotificationSound])

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, read: true } : n
      )
    )
    setUnreadCount(prev => Math.max(0, prev - 1))
  }, [])

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }, [])

  // Delete notification
  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId))
    if (notifications.find(n => n.id === notificationId)?.read === false) {
      setUnreadCount(prev => Math.max(0, prev - 1))
    }
  }, [notifications])

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([])
    setUnreadCount(0)
  }, [])

  // Setup real-time notification listeners
  useEffect(() => {
    // Listen for assessment updates
    const handleAssessmentUpdate = (event: any) => {
      if (event.userId !== userId) {
        addNotification(
          'collaboration',
          `${event.userName} updated assessment`,
          `${event.field.replace('_', ' ')} was modified for ${event.employerName}`,
          'medium',
          {
            assessmentId: event.assessmentId,
            employerId: event.employerId,
            userId: event.userId
          }
        )
      }
    }

    // Listen for rating updates
    const handleRatingUpdate = (event: any) => {
      const trend = event.previousRating && event.newRating > event.previousRating ? 'increased' : 'decreased'
      addNotification(
        'rating_update',
        `Rating ${trend} for ${event.employerName}`,
        `Overall rating changed from ${event.previousRating || 'N/A'}/4 to ${event.newRating}/4`,
        'high',
        {
          employerId: event.employerId,
          rating: event.newRating,
          previousRating: event.previousRating,
          actionUrl: `/employers/${event.employerId}/ratings`
        }
      )
    }

    // Listen for assessment completions
    const handleAssessmentCompleted = (event: any) => {
      addNotification(
        'success',
        `Assessment completed`,
        `${event.completedBy} completed ${event.assessmentType.replace('_', ' ')} assessment for ${event.employerName}`,
        'high',
        {
          assessmentId: event.assessmentId,
          employerId: event.employerId
        }
      )
    }

    // Listen for collaboration events
    const handleCollaboration = (event: any) => {
      addNotification(
        'info',
        `${event.userName} joined assessment`,
        `${event.userName} is now collaborating on ${event.assessmentType.replace('_', ' ')} for ${event.employerName}`,
        'low',
        {
          assessmentId: event.assessmentId,
          userId: event.userId
        }
      )
    }

    // Register event listeners
    // This would typically be done through the WebSocket connection
    // For now, we'll simulate some notifications

    return () => {
      // Cleanup event listeners
    }
  }, [userId, addNotification])

  // Simulate some initial notifications
  useEffect(() => {
    if (isConnected && notifications.length === 0) {
      // Add a welcome notification
      setTimeout(() => {
        addNotification(
          'success',
          'Real-time updates enabled',
          'You will receive live notifications for assessment changes and collaborations',
          'low'
        )
      }, 1000)
    }
  }, [isConnected, notifications.length, addNotification])

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return CheckCircle
      case 'warning':
      case 'error':
        return AlertTriangle
      case 'collaboration':
        return Users
      case 'rating_update':
        return TrendingUp
      case 'assessment_due':
        return Clock
      default:
        return Info
    }
  }

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'error':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'collaboration':
        return 'text-blue-600 bg-blue-50 border-blue-200'
      case 'rating_update':
        return 'text-purple-600 bg-purple-50 border-purple-200'
      case 'assessment_due':
        return 'text-orange-600 bg-orange-50 border-orange-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const unreadNotifications = notifications.filter(n => !n.read)

  return (
    <div className={className}>
      {/* Notification Bell */}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="relative"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 text-xs"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>

        {!isConnected && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>

      {/* Notification Panel */}
      {isExpanded && (
        <Card className="absolute right-0 top-12 w-96 max-h-[32rem] overflow-hidden shadow-lg z-50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Notifications</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSoundEnabled(!soundEnabled)}
                >
                  {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                </Button>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                    Mark all read
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setIsExpanded(false)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </span>
              <ConnectionStatus />
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => {
                    const Icon = getNotificationIcon(notification.type)
                    const colorClass = getNotificationColor(notification.type)

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-3 border-b cursor-pointer transition-colors hover:bg-muted/50",
                          !notification.read && "bg-muted/30",
                          colorClass
                        )}
                        onClick={() => markAsRead(notification.id)}
                      >
                        <div className="flex items-start gap-3">
                          <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <h4 className="font-medium text-sm truncate">
                                {notification.title}
                              </h4>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {!notification.read && (
                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteNotification(notification.id)
                                  }}
                                  className="h-6 w-6 p-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(notification.timestamp), { addSuffix: true })}
                              </span>
                              {notification.actionLabel && notification.metadata?.actionUrl && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    window.location.href = notification.metadata!.actionUrl!
                                  }}
                                >
                                  {notification.actionLabel}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllNotifications}
                  className="w-full"
                >
                  Clear all notifications
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Connection status component
function ConnectionStatus() {
  const { isConnected, connectionStatus } = useRealtimeAssessment()

  if (!isConnected) {
    return (
      <div className="flex items-center gap-1 text-xs text-red-600">
        <div className="w-2 h-2 bg-red-500 rounded-full" />
        Offline
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 text-xs text-green-600">
      <div className="w-2 h-2 bg-green-500 rounded-full" />
      Live
    </div>
  )
}

// Higher-order component to add real-time notifications to components
export function withRealtimeNotifications<P extends object>(
  Component: React.ComponentType<P>
) {
  return function WithRealtimeNotifications(props: P) {
    const [notifications, setNotifications] = useState<Notification[]>([])
    const { isConnected } = useRealtimeAssessment()

    // Component can now access notifications through props
    return <Component {...(props as P)} notifications={notifications} />
  }
}

// Hook for components to access notifications
export function useNotifications() {
  const { isConnected } = useRealtimeAssessment()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  const addNotification = useCallback((
    type: Notification['type'],
    title: string,
    message: string,
    priority: Notification['priority'] = 'medium'
  ) => {
    const notification: Notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      priority
    }

    setNotifications(prev => [notification, ...prev])
    setUnreadCount(prev => prev + 1)

    // Show toast
    toast(title, { description: message })
  }, [])

  return {
    notifications,
    unreadCount,
    isConnected,
    addNotification
  }
}
"use client"

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

interface FeedbackMessage {
  id: string
  type: 'success' | 'error' | 'warning' | 'info'
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
  duration?: number
  persistent?: boolean
  category?: 'alias' | 'eba' | 'match' | 'validation' | 'general'
}

interface FeedbackOptions {
  enableToasts?: boolean
  enableInAppNotifications?: boolean
  enableProgressIndicators?: boolean
  enableScreenReaderAnnouncements?: boolean
  enableUndoActions?: boolean
  maxMessages?: number
}

interface ProgressOperation {
  id: string
  title: string
  current: number
  total: number
  status: 'running' | 'completed' | 'error' | 'cancelled'
  startTime: number
  endTime?: number
  error?: string
}

interface UndoAction {
  id: string
  type: string
  description: string
  execute: () => void | Promise<void>
  timestamp: number
  timeout?: number // Auto-expire after this many ms
}

export function useSubcontractorReviewFeedback(options: FeedbackOptions = {}) {
  const {
    enableToasts = true,
    enableInAppNotifications = true,
    enableProgressIndicators = true,
    enableScreenReaderAnnouncements = true,
    enableUndoActions = true,
    maxMessages = 10
  } = options

  const [messages, setMessages] = useState<FeedbackMessage[]>([])
  const [progressOperations, setProgressOperations] = useState<Map<string, ProgressOperation>>(new Map())
  const [undoActions, setUndoActions] = useState<Map<string, UndoAction>>(new Map())
  const messagesRef = useRef(messages)
  const undoActionsRef = useRef(undoActions)

  // Update refs when state changes
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    undoActionsRef.current = undoActions
  }, [undoActions])

  // Clean up expired undo actions
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const expiredActions: string[] = []

      undoActionsRef.current.forEach((action, id) => {
        if (action.timeout && (now - action.timestamp) > action.timeout) {
          expiredActions.push(id)
        }
      })

      if (expiredActions.length > 0) {
        setUndoActions(prev => {
          const updated = new Map(prev)
          expiredActions.forEach(id => updated.delete(id))
          return updated
        })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Announce to screen readers
  const announceToScreenReader = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    if (!enableScreenReaderAnnouncements) return

    const liveRegion = document.createElement('div')
    liveRegion.setAttribute('aria-live', priority)
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    liveRegion.textContent = message

    document.body.appendChild(liveRegion)

    // Remove after announcement
    setTimeout(() => {
      if (document.body.contains(liveRegion)) {
        document.body.removeChild(liveRegion)
      }
    }, 1000)
  }, [enableScreenReaderAnnouncements])

  // Add a feedback message
  const addMessage = useCallback((message: Omit<FeedbackMessage, 'id'>) => {
    const id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const fullMessage: FeedbackMessage = { id, ...message }

    // Add to state
    setMessages(prev => {
      const updated = [...prev, fullMessage]
      // Keep only the most recent messages
      return updated.slice(-maxMessages)
    })

    // Show toast if enabled
    if (enableToasts && !message.persistent) {
      if (message.type === 'success') {
        toast.success(message.title, {
          description: message.description,
          action: message.action,
          duration: message.duration || 4000
        })
      } else if (message.type === 'error') {
        toast.error(message.title, {
          description: message.description,
          action: message.action,
          duration: message.duration || 6000
        })
      } else if (message.type === 'warning') {
        toast.warning(message.title, {
          description: message.description,
          action: message.action,
          duration: message.duration || 5000
        })
      } else {
        toast.info(message.title, {
          description: message.description,
          action: message.action,
          duration: message.duration || 4000
        })
      }
    }

    // Announce to screen readers
    const announcement = `${message.type}: ${message.title}${message.description ? `. ${message.description}` : ''}`
    announceToScreenReader(announcement, message.type === 'error' ? 'assertive' : 'polite')

    return id
  }, [enableToasts, maxMessages, announceToScreenReader])

  // Success message helper
  const success = useCallback((title: string, description?: string, options?: Partial<FeedbackMessage>) => {
    return addMessage({
      type: 'success',
      title,
      description,
      ...options
    })
  }, [addMessage])

  // Error message helper
  const error = useCallback((title: string, description?: string, options?: Partial<FeedbackMessage>) => {
    return addMessage({
      type: 'error',
      title,
      description,
      persistent: true,
      ...options
    })
  }, [addMessage])

  // Warning message helper
  const warning = useCallback((title: string, description?: string, options?: Partial<FeedbackMessage>) => {
    return addMessage({
      type: 'warning',
      title,
      description,
      ...options
    })
  }, [addMessage])

  // Info message helper
  const info = useCallback((title: string, description?: string, options?: Partial<FeedbackMessage>) => {
    return addMessage({
      type: 'info',
      title,
      description,
      ...options
    })
  }, [addMessage])

  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  // Remove a specific message
  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id))
  }, [])

  // Start a progress operation
  const startProgress = useCallback((title: string, total: number, options?: { category?: string }) => {
    const id = `progress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const operation: ProgressOperation = {
      id,
      title,
      current: 0,
      total,
      status: 'running',
      startTime: Date.now()
    }

    setProgressOperations(prev => new Map(prev).set(id, operation))

    if (enableProgressIndicators) {
      announceToScreenReader(`Started: ${title}`, 'polite')
    }

    return id
  }, [enableProgressIndicators, announceToScreenReader])

  // Update progress
  const updateProgress = useCallback((id: string, current: number) => {
    setProgressOperations(prev => {
      const updated = new Map(prev)
      const operation = updated.get(id)
      if (operation) {
        updated.set(id, { ...operation, current })
      }
      return updated
    })
  }, [])

  // Complete a progress operation
  const completeProgress = useCallback((id: string, successMessage?: string) => {
    setProgressOperations(prev => {
      const updated = new Map(prev)
      const operation = updated.get(id)
      if (operation) {
        const completed = { ...operation, status: 'completed' as const, endTime: Date.now() }
        updated.set(id, completed)

        if (successMessage) {
          const duration = completed.endTime - completed.startTime
          success(successMessage, undefined, {
            category: 'general',
            duration: 3000
          })
        }

        // Auto-remove completed operations after 2 seconds
        setTimeout(() => {
          setProgressOperations(prev => {
            const current = new Map(prev)
            current.delete(id)
            return current
          })
        }, 2000)
      }
      return updated
    })
  }, [success])

  // Error a progress operation
  const errorProgress = useCallback((id: string, errorMessage: string) => {
    setProgressOperations(prev => {
      const updated = new Map(prev)
      const operation = updated.get(id)
      if (operation) {
        updated.set(id, {
          ...operation,
          status: 'error',
          endTime: Date.now(),
          error: errorMessage
        })
      }
      return updated
    })

    error('Operation Failed', errorMessage)
  }, [error])

  // Cancel a progress operation
  const cancelProgress = useCallback((id: string) => {
    setProgressOperations(prev => {
      const updated = new Map(prev)
      const operation = updated.get(id)
      if (operation) {
        updated.set(id, {
          ...operation,
          status: 'cancelled',
          endTime: Date.now()
        })
      }
      return updated
    })
  }, [])

  // Get progress percentage
  const getProgressPercentage = useCallback((id: string): number => {
    const operation = progressOperations.get(id)
    if (!operation || operation.total === 0) return 0
    return Math.round((operation.current / operation.total) * 100)
  }, [progressOperations])

  // Add undo action
  const addUndoAction = useCallback((
    type: string,
    description: string,
    execute: () => void | Promise<void>,
    options?: { timeout?: number }
  ) => {
    if (!enableUndoActions) return null

    const id = `undo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const action: UndoAction = {
      id,
      type,
      description,
      execute,
      timestamp: Date.now(),
      timeout: options?.timeout || 30000 // Default 30 seconds
    }

    setUndoActions(prev => new Map(prev).set(id, action))

    // Show toast with undo option
    toast.success('Action completed', {
      description: `${description}`,
      action: {
        label: 'Undo',
        onClick: () => executeUndoAction(id)
      },
      duration: action.timeout
    })

    return id
  }, [enableUndoActions])

  // Execute undo action
  const executeUndoAction = useCallback(async (id: string) => {
    const action = undoActionsRef.current.get(id)
    if (!action) return

    try {
      await action.execute()

      // Remove the action after successful undo
      setUndoActions(prev => {
        const updated = new Map(prev)
        updated.delete(id)
        return updated
      })

      success('Action undone', `${action.description}`)
    } catch (error) {
      error('Failed to undo action', error instanceof Error ? error.message : 'Unknown error')
    }
  }, [success, error])

  // Get all active feedback
  const getActiveFeedback = useCallback(() => {
    return {
      messages: messagesRef.current,
      progress: Array.from(progressOperations.values()),
      undoActions: Array.from(undoActionsRef.current.values())
    }
  }, [progressOperations])

  // Specific feedback helpers for common operations
  const aliasCreationFeedback = {
    start: (count: number) => startProgress('Creating aliases', count, { category: 'alias' }),
    update: (id: string, current: number) => updateProgress(id, current),
    success: (id: string, count: number) => {
      completeProgress(id, `Successfully created ${count} alias${count > 1 ? 'es' : ''}`)
      addUndoAction(
        'alias-creation',
        `Created ${count} alias${count > 1 ? 'es' : ''}`,
        () => {
          // This would be implemented to actually undo the alias creation
          info('Undo functionality would be implemented here')
        }
      )
    },
    error: (id: string, error: string) => errorProgress(id, error),
    partial: (id: string, successCount: number, failCount: number) => {
      completeProgress(id, `Created ${successCount} alias${successCount > 1 ? 'es' : ''}`)
      if (failCount > 0) {
        warning(`${failCount} alias${failCount > 1 ? 'es' : ''} failed to create`, 'Check the error details for more information')
      }
    }
  }

  const ebaSearchFeedback = {
    start: (employerName: string) => {
      info(`Searching for EBA: ${employerName}`, undefined, { category: 'eba' })
      return startProgress(`EBA Search: ${employerName}`, 1, { category: 'eba' })
    },
    success: (id: string, employerName: string, ebaFound: boolean) => {
      completeProgress(id, ebaFound ? `Found EBA for ${employerName}` : `No EBA found for ${employerName}`)
    },
    error: (id: string, employerName: string, error: string) => {
      errorProgress(id, `Failed to search EBA for ${employerName}: ${error}`)
    }
  }

  const employerMatchingFeedback = {
    start: (companyName: string) => info(`Matching employer: ${companyName}`, undefined, { category: 'match' }),
    success: (companyName: string, matchedEmployer: string) => {
      success(`Match found: ${companyName} → ${matchedEmployer}`, undefined, { category: 'match' })
    },
    noMatch: (companyName: string) => {
      warning(`No match found for: ${companyName}`, 'You can manually search for this employer', { category: 'match' })
    },
    error: (companyName: string, error: string) => {
      error(`Failed to match employer: ${companyName}`, error, { category: 'match' })
    }
  }

  const validationFeedback = {
    error: (field: string, message: string) => {
      error(`Validation Error: ${field}`, message, { category: 'validation' })
    },
    warning: (field: string, message: string) => {
      warning(`Validation Warning: ${field}`, message, { category: 'validation' })
    },
    success: (field: string, message: string) => {
      success(`Validation Success: ${field}`, message, { category: 'validation' })
    }
  }

  return {
    // Core feedback methods
    success,
    error,
    warning,
    info,
    addMessage,
    removeMessage,
    clearMessages,

    // Progress tracking
    startProgress,
    updateProgress,
    completeProgress,
    errorProgress,
    cancelProgress,
    getProgressPercentage,
    getActiveOperations: () => Array.from(progressOperations.values()),

    // Undo functionality
    addUndoAction,
    executeUndoAction,
    getUndoActions: () => Array.from(undoActionsRef.current.values()),

    // State access
    messages,
    progressOperations: Array.from(progressOperations.values()),
    undoActions: Array.from(undoActions.values()),

    // Specialized feedback helpers
    aliasCreation: aliasCreationFeedback,
    ebaSearch: ebaSearchFeedback,
    employerMatching: employerMatchingFeedback,
    validation: validationFeedback,

    // Utility methods
    getActiveFeedback
  }
}

// Component for displaying in-app notifications
interface FeedbackNotificationsProps {
  messages: FeedbackMessage[]
  onDismiss?: (id: string) => void
}

export function FeedbackNotifications({ messages, onDismiss }: FeedbackNotificationsProps) {
  if (messages.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {messages.map(message => (
        <div
          key={message.id}
          className={`
            p-4 rounded-lg shadow-lg border-l-4 animate-in slide-in-from-right
            ${message.type === 'success' ? 'bg-green-50 border-green-500 text-green-900' : ''}
            ${message.type === 'error' ? 'bg-red-50 border-red-500 text-red-900' : ''}
            ${message.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-900' : ''}
            ${message.type === 'info' ? 'bg-blue-50 border-blue-500 text-blue-900' : ''}
          `}
          role="alert"
          aria-live={message.type === 'error' ? 'assertive' : 'polite'}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h4 className="font-semibold text-sm">{message.title}</h4>
              {message.description && (
                <p className="text-sm mt-1 opacity-90">{message.description}</p>
              )}
              {message.action && (
                <button
                  onClick={message.action.onClick}
                  className="text-sm font-medium mt-2 underline hover:no-underline"
                >
                  {message.action.label}
                </button>
              )}
            </div>
            <button
              onClick={() => onDismiss?.(message.id)}
              className="ml-3 text-gray-400 hover:text-gray-600"
              aria-label="Dismiss notification"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Component for displaying progress operations
interface ProgressIndicatorProps {
  operations: ProgressOperation[]
}

export function ProgressIndicator({ operations }: ProgressIndicatorProps) {
  if (operations.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-sm">
      {operations.map(operation => (
        <div key={operation.id} className="bg-white rounded-lg shadow-lg border p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{operation.title}</span>
            <span className="text-xs text-gray-500">
              {operation.current} / {operation.total}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`
                h-2 rounded-full transition-all duration-300
                ${operation.status === 'running' ? 'bg-blue-500' : ''}
                ${operation.status === 'completed' ? 'bg-green-500' : ''}
                ${operation.status === 'error' ? 'bg-red-500' : ''}
                ${operation.status === 'cancelled' ? 'bg-gray-500' : ''}
              `}
              style={{ width: `${(operation.current / operation.total) * 100}%` }}
            />
          </div>
          {operation.error && (
            <p className="text-xs text-red-600 mt-1">{operation.error}</p>
          )}
        </div>
      ))}
    </div>
  )
}
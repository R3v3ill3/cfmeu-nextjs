'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'

interface ErrorHandlerOptions {
  maxRetries?: number
  retryDelay?: number
  showToast?: boolean
  logToConsole?: boolean
  cleanupOnUnmount?: boolean
}

interface ErrorState {
  error: Error | null
  hasError: boolean
  isRetrying: boolean
  retryCount: number
}

interface UseErrorHandlerReturn extends ErrorState {
  handleError: (error: Error | string, context?: string) => void
  clearError: () => void
  retry: () => Promise<void>
  executeWithErrorHandling: <T>(
    operation: () => Promise<T>,
    context?: string
  ) => Promise<T | null>
  setCleanupFunction: (cleanupFn: () => void) => void
  forceCleanup: () => void
}

export function useErrorHandler(options: ErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showToast = true,
    logToConsole = true,
    cleanupOnUnmount = true,
  } = options

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    hasError: false,
    isRetrying: false,
    retryCount: 0,
  })

  const retryOperationRef = useRef<(() => Promise<void>) | null>(null)
  const timeoutRefs = useRef<NodeJS.Timeout[]>([])
  const isMountedRef = useRef(true)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Cleanup function for timeouts and resources
  const cleanup = useCallback(() => {
    // Clear all pending timeouts
    timeoutRefs.current.forEach(timeoutId => {
      clearTimeout(timeoutId)
    })
    timeoutRefs.current = []

    // Clear retry operation
    retryOperationRef.current = null

    // Mark as unmounted
    isMountedRef.current = false

    // Call custom cleanup if provided
    if (cleanupRef.current) {
      cleanupRef.current()
      cleanupRef.current = null
    }
  }, [])

  const handleError = useCallback((error: Error | string, context?: string) => {
    // Don't handle errors if component is unmounted
    if (!isMountedRef.current) return

    const errorObj = typeof error === 'string' ? new Error(error) : error

    if (logToConsole) {
      console.error(`Error${context ? ` in ${context}` : ''}:`, errorObj)
    }

    setErrorState(prev => ({
      error: errorObj,
      hasError: true,
      isRetrying: false,
      retryCount: prev.retryCount,
    }))

    if (showToast) {
      toast.error(`Error${context ? ` in ${context}` : ''}: ${errorObj.message}`)
    }
  }, [showToast, logToConsole])

  const clearError = useCallback(() => {
    if (!isMountedRef.current) return

    setErrorState({
      error: null,
      hasError: false,
      isRetrying: false,
      retryCount: 0,
    })
    retryOperationRef.current = null
  }, [])

  const retry = useCallback(async () => {
    if (!retryOperationRef.current || errorState.retryCount >= maxRetries || !isMountedRef.current) {
      return
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }))

    try {
      // Add exponential backoff delay with proper timeout management
      const delay = retryDelay * Math.pow(2, errorState.retryCount)
      await new Promise<void>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          // Remove from tracking when resolved
          timeoutRefs.current = timeoutRefs.current.filter(id => id !== timeoutId)
          if (isMountedRef.current) {
            resolve()
          } else {
            reject(new Error('Component unmounted during retry delay'))
          }
        }, delay)

        // Track timeout for cleanup
        timeoutRefs.current.push(timeoutId)
      })

      // Check if still mounted before executing retry
      if (!isMountedRef.current) {
        return
      }

      await retryOperationRef.current()
      clearError()

      if (showToast && isMountedRef.current) {
        toast.success('Operation completed successfully after retry')
      }
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error as Error, 'retry attempt')
      }
    } finally {
      if (isMountedRef.current) {
        setErrorState(prev => ({
          ...prev,
          isRetrying: false,
        }))
      }
    }
  }, [errorState.retryCount, maxRetries, retryDelay, showToast, handleError, clearError])

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    if (!isMountedRef.current) return null

    retryOperationRef.current = async () => {
      if (!isMountedRef.current) throw new Error('Component unmounted')
      return await operation()
    }

    try {
      const result = await operation()
      if (isMountedRef.current) {
        clearError()
      }
      return result
    } catch (error) {
      if (isMountedRef.current) {
        handleError(error as Error, context)
      }
      return null
    }
  }, [handleError, clearError])

  // Add cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupOnUnmount) {
        cleanup()
      }
    }
  }, [cleanup, cleanupOnUnmount])

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    executeWithErrorHandling,
    setCleanupFunction: (cleanupFn: () => void) => {
      cleanupRef.current = cleanupFn
    },
    forceCleanup: cleanup,
  }
}

// Utility functions for specific error types
export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unexpected error occurred'
}

export const isNetworkError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.name === 'NetworkError' ||
      error.message.includes('fetch') ||
      error.message.includes('network') ||
      error.message.includes('Failed to fetch')
    )
  }
  return false
}

export const isTimeoutError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.name === 'TimeoutError' ||
      error.message.includes('timeout') ||
      error.message.includes('timed out')
    )
  }
  return false
}

export const isValidationError = (error: unknown): boolean => {
  if (error instanceof Error) {
    return (
      error.name === 'ValidationError' ||
      error.message.includes('validation') ||
      error.message.includes('invalid')
    )
  }
  return false
}
'use client'

import { useState, useCallback, useRef } from 'react'
import { toast } from 'sonner'

interface ErrorHandlerOptions {
  maxRetries?: number
  retryDelay?: number
  showToast?: boolean
  logToConsole?: boolean
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
}

export function useErrorHandler(options: ErrorHandlerOptions = {}): UseErrorHandlerReturn {
  const {
    maxRetries = 3,
    retryDelay = 1000,
    showToast = true,
    logToConsole = true,
  } = options

  const [errorState, setErrorState] = useState<ErrorState>({
    error: null,
    hasError: false,
    isRetrying: false,
    retryCount: 0,
  })

  const retryOperationRef = useRef<(() => Promise<void>) | null>(null)

  const handleError = useCallback((error: Error | string, context?: string) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error

    if (logToConsole) {
      console.error(`Error${context ? ` in ${context}` : ''}:`, errorObj)
    }

    setErrorState({
      error: errorObj,
      hasError: true,
      isRetrying: false,
      retryCount: errorState.retryCount,
    })

    if (showToast) {
      toast.error(`Error${context ? ` in ${context}` : ''}: ${errorObj.message}`)
    }
  }, [errorState.retryCount, showToast, logToConsole])

  const clearError = useCallback(() => {
    setErrorState({
      error: null,
      hasError: false,
      isRetrying: false,
      retryCount: 0,
    })
    retryOperationRef.current = null
  }, [])

  const retry = useCallback(async () => {
    if (!retryOperationRef.current || errorState.retryCount >= maxRetries) {
      return
    }

    setErrorState(prev => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }))

    try {
      // Add exponential backoff delay
      await new Promise(resolve =>
        setTimeout(resolve, retryDelay * Math.pow(2, errorState.retryCount))
      )

      await retryOperationRef.current()
      clearError()

      if (showToast) {
        toast.success('Operation completed successfully after retry')
      }
    } catch (error) {
      handleError(error as Error, 'retry attempt')
    } finally {
      setErrorState(prev => ({
        ...prev,
        isRetrying: false,
      }))
    }
  }, [errorState.retryCount, maxRetries, retryDelay, showToast, handleError, clearError])

  const executeWithErrorHandling = useCallback(async <T>(
    operation: () => Promise<T>,
    context?: string
  ): Promise<T | null> => {
    retryOperationRef.current = async () => await operation()

    try {
      const result = await operation()
      clearError()
      return result
    } catch (error) {
      handleError(error as Error, context)
      return null
    }
  }, [handleError, clearError])

  return {
    ...errorState,
    handleError,
    clearError,
    retry,
    executeWithErrorHandling,
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
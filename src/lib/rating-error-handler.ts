/**
 * Centralized error handling utilities for the rating system
 * This helps prevent React crashes and provides consistent error reporting
 */

export interface RatingErrorContext {
  component?: string
  action?: string
  userId?: string
  employerId?: string
  additionalData?: Record<string, any>
}

export class RatingError extends Error {
  public readonly context: RatingErrorContext
  public readonly originalError?: Error
  public readonly timestamp: Date

  constructor(
    message: string,
    context: RatingErrorContext = {},
    originalError?: Error
  ) {
    super(message)
    this.name = 'RatingError'
    this.context = context
    this.originalError = originalError
    this.timestamp = new Date()

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RatingError)
    }
  }
}

/**
 * Main error handler class for rating system
 */
export class RatingErrorHandler {
  private static instance: RatingErrorHandler
  private errorQueue: RatingError[] = []
  private maxQueueSize = 50
  private isReporting = false

  static getInstance(): RatingErrorHandler {
    if (!RatingErrorHandler.instance) {
      RatingErrorHandler.instance = new RatingErrorHandler()
    }
    return RatingErrorHandler.instance
  }

  /**
   * Handle an error in the rating system
   */
  handleError(error: Error | RatingError, context?: RatingErrorContext): void {
    const ratingError = error instanceof RatingError
      ? error
      : new RatingError(error.message, context, error)

    // Add to queue for reporting
    this.addToQueue(ratingError)

    // Log to console with context
    console.error('Rating System Error:', {
      message: ratingError.message,
      context: ratingError.context,
      timestamp: ratingError.timestamp,
      stack: ratingError.stack,
      originalError: ratingError.originalError
    })

    // Try to report error (non-blocking)
    this.reportError(ratingError).catch(reportError => {
      console.error('Failed to report rating error:', reportError)
    })
  }

  /**
   * Handle async errors with proper context
   */
  async handleAsyncError<T>(
    operation: () => Promise<T>,
    context?: RatingErrorContext
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      this.handleError(error as Error, context)
      throw error
    }
  }

  /**
   * Create a safe wrapper for React components
   */
  createSafeComponent<P extends object>(
    Component: React.ComponentType<P>,
    componentName: string
  ): React.ComponentType<P> {
    return (props: P) => {
      try {
        return <Component {...props} />
      } catch (error) {
        this.handleError(error as Error, { component: componentName })

        // Return error fallback UI
        return (
          <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
            <div className="flex items-center gap-2 text-red-800">
              <span className="font-medium">Component Error</span>
              <span className="text-sm">{componentName}</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {error instanceof Error ? error.message : 'Unknown error occurred'}
            </p>
          </div>
        )
      }
    }
  }

  /**
   * Get error statistics for monitoring
   */
  getErrorStats(): {
    totalErrors: number
    recentErrors: RatingError[]
    errorsByComponent: Record<string, number>
  } {
    const errorsByComponent: Record<string, number> = {}

    this.errorQueue.forEach(error => {
      const component = error.context.component || 'Unknown'
      errorsByComponent[component] = (errorsByComponent[component] || 0) + 1
    })

    return {
      totalErrors: this.errorQueue.length,
      recentErrors: this.errorQueue.slice(-10),
      errorsByComponent
    }
  }

  /**
   * Clear error queue
   */
  clearErrors(): void {
    this.errorQueue = []
  }

  private addToQueue(error: RatingError): void {
    this.errorQueue.push(error)

    // Maintain queue size
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue = this.errorQueue.slice(-this.maxQueueSize)
    }
  }

  private async reportError(error: RatingError): Promise<void> {
    // Prevent concurrent reporting
    if (this.isReporting) {
      return
    }

    this.isReporting = true

    try {
      // In development, just log to console
      if (process.env.NODE_ENV === 'development') {
        console.group('🚨 Rating Error Report')
        console.error('Error:', error.message)
        console.log('Context:', error.context)
        console.log('Timestamp:', error.timestamp)
        if (error.originalError) {
          console.log('Original Error:', error.originalError)
        }
        console.groupEnd()
        return
      }

      // In production, send to error reporting service
      const payload = {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        },
        context: error.context,
        timestamp: error.timestamp.toISOString(),
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR',
        url: typeof window !== 'undefined' ? window.location.href : 'SSR'
      }

      await fetch('/api/errors/rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }).catch(() => {
        // Silently fail error reporting
      })

    } catch (reportError) {
      console.error('Failed to report error:', reportError)
    } finally {
      this.isReporting = false
    }
  }
}

// Singleton instance
export const ratingErrorHandler = RatingErrorHandler.getInstance()

/**
 * Hook for React components to handle errors safely
 */
export function useRatingErrorHandler() {
  const handleError = (error: Error | string, context?: RatingErrorContext) => {
    const errorObj = typeof error === 'string' ? new Error(error) : error
    ratingErrorHandler.handleError(errorObj, context)
  }

  const handleAsyncError = async <T>(
    operation: () => Promise<T>,
    context?: RatingErrorContext
  ): Promise<T> => {
    return ratingErrorHandler.handleAsyncError(operation, context)
  }

  const createSafeCallback = <T extends any[], R>(
    callback: (...args: T) => R,
    context?: RatingErrorContext
  ) => {
    return (...args: T): R => {
      try {
        return callback(...args)
      } catch (error) {
        handleError(error as Error, context)
        throw error
      }
    }
  }

  return {
    handleError,
    handleAsyncError,
    createSafeCallback,
    getErrorStats: () => ratingErrorHandler.getErrorStats(),
    clearErrors: () => ratingErrorHandler.clearErrors()
  }
}

/**
 * Higher-order component for error-safe components
 */
export function withRatingErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  componentName?: string
) {
  const WrappedComponent = ratingErrorHandler.createSafeComponent(
    Component,
    componentName || Component.displayName || Component.name || 'Unknown'
  )

  WrappedComponent.displayName = `withRatingErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

/**
 * Utility functions for common error scenarios
 */
export const RatingErrorUtils = {
  /**
   * Handle API errors consistently
   */
  handleApiError: (error: any, endpoint?: string) => {
    const message = error?.message || 'Unknown API error'
    ratingErrorHandler.handleError(
      new Error(message),
      {
        component: 'API',
        action: 'fetch',
        additionalData: { endpoint, originalError: error }
      }
    )
  },

  /**
   * Handle validation errors
   */
  handleValidationError: (field: string, value: any, validation: string) => {
    ratingErrorHandler.handleError(
      new Error(`Validation failed for ${field}: ${validation}`),
      {
        component: 'Form',
        action: 'validation',
        additionalData: { field, value, validation }
      }
    )
  },

  /**
   * Handle rating calculation errors
   */
  handleCalculationError: (employerId: string, calculationType: string, error: any) => {
    ratingErrorHandler.handleError(
      new Error(`Rating calculation failed: ${error?.message || 'Unknown error'}`),
      {
        component: 'RatingCalculator',
        action: 'calculate',
        employerId,
        additionalData: { calculationType, originalError: error }
      }
    )
  }
}
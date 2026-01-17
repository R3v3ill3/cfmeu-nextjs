"use client"

import React, { Component, ErrorInfo, ReactNode, ComponentType } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertTriangle, RefreshCw, Bug } from "lucide-react"

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  retryCount: number
}

export class RatingErrorBoundary extends Component<Props, State> {
  private maxRetries = 3

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      retryCount: 0
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      retryCount: 0
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Rating Error Boundary caught an error:", error, errorInfo)

    this.setState({
      error,
      errorInfo
    })

    // Call onError prop if provided
    this.props.onError?.(error, errorInfo)

    // Log to external service in production
    if (process.env.NODE_ENV === "production") {
      // Here you could integrate with a service like Sentry, LogRocket, etc.
      this.logErrorToService(error, errorInfo)
    }
  }

  private logErrorToService = (error: Error, errorInfo: ErrorInfo) => {
    // Example: Send error to logging service
    try {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: error.name || "RatingErrorBoundary",
          message: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silent fail for error logging
      })
    } catch {
      // Silent fail if logging fails
    }
  }

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1
      }))
    }
  }

  private handleRefresh = () => {
    window.location.reload()
  }

  private handleReportBug = () => {
    const errorDetails = {
      error: this.state.error?.message,
      stack: this.state.error?.stack,
      componentStack: this.state.errorInfo?.componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }

    // Create mailto link with error details
    const subject = encodeURIComponent("Rating System Error Report")
    const body = encodeURIComponent(
      `Error Details:\n${JSON.stringify(errorDetails, null, 2)}`
    )

    window.open(`mailto:support@cfmeu.org?subject=${subject}&body=${body}`)
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      const canRetry = this.state.retryCount < this.maxRetries

      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-5 w-5" />
              Rating System Error
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-red-700">
              {this.state.error?.message || "An unexpected error occurred in the rating system."}
            </p>

            {/* Retry information */}
            {this.state.retryCount > 0 && (
              <div className="text-xs text-red-600 bg-red-100 p-2 rounded">
                Retry attempt {this.state.retryCount} of {this.maxRetries}
                {!canRetry && " - Maximum retries reached. Please refresh the page."}
              </div>
            )}

            {/* Error details (development only) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <details className="text-xs">
                <summary className="cursor-pointer font-mono mb-2">Error Details</summary>
                <pre className="bg-red-100 p-2 rounded overflow-auto max-h-32">
                  {this.state.error.stack}
                </pre>
              </details>
            )}

            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {canRetry && (
                <Button onClick={this.handleRetry} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              )}

              <Button onClick={this.handleRefresh} variant="outline" size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh Page
              </Button>

              <Button onClick={this.handleReportBug} variant="outline" size="sm">
                <Bug className="h-4 w-4 mr-2" />
                Report Bug
              </Button>
            </div>

            {/* Additional help text */}
            <p className="text-xs text-red-600">
              If this problem persists, please contact support with details about what you were doing when this error occurred.
            </p>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

// Simplified functional wrapper for easier usage
export function withRatingErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) {
  const WrappedComponent = (props: P) => (
    <RatingErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </RatingErrorBoundary>
  )

  WrappedComponent.displayName = `withRatingErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

// Hook for handling rating-specific errors
export function useRatingErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`Rating Error${context ? ` in ${context}` : ""}:`, error)

    // Log to external service in production
    if (process.env.NODE_ENV === "production") {
      fetch("/api/errors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: context || "RatingError",
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        })
      }).catch(() => {
        // Silent fail for error logging
      })
    }
  }

  const handleAsyncError = async (
    asyncOperation: () => Promise<any>,
    context?: string
  ): Promise<any> => {
    try {
      return await asyncOperation()
    } catch (error) {
      handleError(error as Error, context)
      throw error
    }
  }

  return {
    handleError,
    handleAsyncError
  }
}

// Default error message component
export function DefaultRatingError() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          <p className="font-medium">Rating data temporarily unavailable</p>
        </div>
        <p className="text-sm text-amber-700 mt-1">
          We're having trouble loading rating information. Please try again in a moment.
        </p>
      </CardContent>
    </Card>
  )
}
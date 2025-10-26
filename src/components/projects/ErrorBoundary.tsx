'use client'

import {  Component, ErrorInfo, ReactNode  } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Log to monitoring service (in production)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      // Example: Send to error tracking service
      // Sentry.captureException(error, { extra: errorInfo })
      console.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
      })
    }
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  handleGoHome = () => {
    window.location.href = '/projects'
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Dialog open={true}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Something went wrong
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  An unexpected error occurred while processing your bulk upload.
                  Don't worry, your progress has been saved.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4 p-3 bg-muted rounded text-xs">
                    <summary className="cursor-pointer font-medium">Error Details</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-left">
                      {this.state.error.toString()}
                      {this.state.errorInfo?.componentStack}
                    </pre>
                  </details>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-2 mt-4">
              <Button onClick={this.handleRetry} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>

              <Button variant="outline" onClick={this.handleGoHome} className="w-full">
                <Home className="h-4 w-4 mr-2" />
                Back to Projects
              </Button>
            </div>

            <div className="text-xs text-muted-foreground mt-4">
              <p>If this problem persists, please:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Check your internet connection</li>
                <li>Try a smaller PDF file</li>
                <li>Contact support if needed</li>
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
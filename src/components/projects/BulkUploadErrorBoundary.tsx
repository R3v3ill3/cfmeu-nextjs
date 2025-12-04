'use client'

import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RefreshCw, Upload, Brain, FileText, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { performHardReset } from '@/lib/auth/hardReset'

interface Props {
  children: ReactNode
  operation: 'file-upload' | 'ai-analysis' | 'pdf-splitting' | 'batch-processing' | 'general'
  fallback?: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo, operation: string) => void
  onRetry?: () => void
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  isRetrying: boolean
}

// Operation-specific configurations
const operationConfigs = {
  'file-upload': {
    title: 'File Upload Error',
    description: 'An error occurred while processing your PDF file.',
    icon: Upload,
    retryLabel: 'Try Different File',
    suggestions: [
      'Check if the file is a valid PDF',
      'Try a smaller file (under 100MB)',
      'Ensure the file is not password protected',
      'Try uploading a different PDF file'
    ]
  },
  'ai-analysis': {
    title: 'AI Analysis Error',
    description: 'An error occurred during AI analysis of your PDF.',
    icon: Brain,
    retryLabel: 'Retry AI Analysis',
    suggestions: [
      'Try using manual mode instead',
      'Check your internet connection',
      'Try with a simpler PDF file',
      'Contact support if the issue persists'
    ]
  },
  'pdf-splitting': {
    title: 'PDF Processing Error',
    description: 'An error occurred while splitting your PDF into individual projects.',
    icon: FileText,
    retryLabel: 'Retry Processing',
    suggestions: [
      'Check if the PDF has valid page structure',
      'Try reducing the number of projects',
      'Ensure page ranges are correct',
      'Try with a different PDF file'
    ]
  },
  'batch-processing': {
    title: 'Batch Processing Error',
    description: 'An error occurred during the batch upload process.',
    icon: Loader2,
    retryLabel: 'Retry Batch Upload',
    suggestions: [
      'Check your internet connection',
      'Some scans may have completed successfully',
      'You can check batch status later',
      'Try with a smaller batch'
    ]
  },
  'general': {
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred during the bulk upload process.',
    icon: AlertTriangle,
    retryLabel: 'Try Again',
    suggestions: [
      'Refresh the page and try again',
      'Check your internet connection',
      'Try with a different file',
      'Contact support if the issue persists'
    ]
  }
}

class BulkUploadErrorBoundary extends Component<Props, State> {
  private retryTimeoutRef: NodeJS.Timeout | null = null

  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRetrying: false,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[BulkUploadErrorBoundary-${this.props.operation}] Caught error:`, error, errorInfo)

    this.setState({
      error,
      errorInfo,
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo, this.props.operation)
    }

    // Log to monitoring service (in production)
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      console.error(`[BulkUploadErrorBoundary-${this.props.operation}] Production error:`, {
        operation: this.props.operation,
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      })

      // Here you would send to your error tracking service
      // Example: Sentry.captureException(error, {
      //   extra: { errorInfo, operation: this.props.operation }
      // })
    }

    // Show toast notification
    const config = operationConfigs[this.props.operation]
    toast.error(`${config.title}: ${error.message}`)
  }

  componentWillUnmount() {
    if (this.retryTimeoutRef) {
      clearTimeout(this.retryTimeoutRef)
      this.retryTimeoutRef = null
    }
  }

  handleRetry = async () => {
    this.setState({ isRetrying: true })

    try {
      // Add a small delay to ensure clean state
      await new Promise(resolve => {
        this.retryTimeoutRef = setTimeout(resolve, 100)
      })

      // Call custom retry handler if provided
      if (this.props.onRetry) {
        await this.props.onRetry()
      }

      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        isRetrying: false,
      })

      toast.success('Retrying operation...')
    } catch (retryError) {
      console.error('Retry failed:', retryError)
      this.setState({ isRetrying: false })
      toast.error('Retry failed. Please try a different approach.')
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isRetrying: false,
    })

    // Navigate back to projects page with a full page reload
    // NOTE: Using window.location.href intentionally in error boundary because:
    // 1. The React tree may be in a broken state after an error
    // 2. A full page reload provides a clean recovery
    // 3. Class components cannot use hooks like useRouter()
    if (typeof window !== 'undefined') {
      window.location.href = '/projects'
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback
      }

      const config = operationConfigs[this.props.operation]
      const Icon = config.icon

      return (
        <Dialog open={true}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Icon className="h-5 w-5" />
                {config.title}
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>{config.description}</p>
                <p className="text-sm text-muted-foreground">
                  Don't worry, your progress has been saved and you can try again.
                </p>

                {process.env.NODE_ENV === 'development' && this.state.error && (
                  <details className="mt-4 p-3 bg-muted rounded text-xs">
                    <summary className="cursor-pointer font-medium">Error Details (Development)</summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <strong>Operation:</strong> {this.props.operation}
                      </div>
                      <div>
                        <strong>Error:</strong> {this.state.error.toString()}
                      </div>
                      {this.state.errorInfo?.componentStack && (
                        <div>
                          <strong>Component Stack:</strong>
                          <pre className="mt-1 whitespace-pre-wrap text-left">
                            {this.state.errorInfo.componentStack}
                          </pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-3 mt-4">
              {this.props.onRetry && (
                <Button
                  onClick={this.handleRetry}
                  className="w-full"
                  disabled={this.state.isRetrying}
                >
                  {this.state.isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {config.retryLabel}
                    </>
                  )}
                </Button>
              )}

              <Button variant="outline" onClick={this.handleReset} className="w-full">
                Start Over
              </Button>
            </div>

            <div className="text-xs text-muted-foreground mt-4">
              <p className="font-medium mb-2">Suggestions:</p>
              <ul className="list-disc list-inside space-y-1">
                {config.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>

            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-muted-foreground mb-2">
                If you're stuck and can't navigate away:
              </p>
              <Button 
                variant="ghost" 
                onClick={() => performHardReset()} 
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Force Logout & Reset App
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )
    }

    return this.props.children
  }
}

// Hook-based error boundary wrapper for functional components
interface BulkUploadErrorBoundaryWrapperProps {
  operation: Props['operation']
  children: ReactNode
  fallback?: ReactNode
  onError?: Props['onError']
  onRetry?: Props['onRetry']
}

export function BulkUploadErrorBoundaryWrapper({
  operation,
  children,
  fallback,
  onError,
  onRetry,
}: BulkUploadErrorBoundaryWrapperProps) {
  return (
    <BulkUploadErrorBoundary
      operation={operation}
      fallback={fallback}
      onError={onError}
      onRetry={onRetry}
    >
      {children}
    </BulkUploadErrorBoundary>
  )
}

export default BulkUploadErrorBoundary
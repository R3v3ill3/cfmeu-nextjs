"use client"

import { ReactNode, Suspense } from 'react'
import { RatingProvider } from '@/context/RatingContext'
import { RatingErrorBoundary, DefaultRatingError } from './RatingErrorBoundary'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

// Loading fallback for rating components
function RatingLoadingFallback() {
  return (
    <div className="min-h-[200px] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading rating system...</p>
        </CardContent>
      </Card>
    </div>
  )
}

// Error fallback for rating provider
function RatingProviderError() {
  return (
    <div className="min-h-[200px] p-4">
      <DefaultRatingError />
    </div>
  )
}

interface SafeRatingProviderProps {
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
}

export function SafeRatingProvider({
  children,
  fallback = <RatingProviderError />,
  loadingFallback = <RatingLoadingFallback />
}: SafeRatingProviderProps) {
  return (
    <RatingErrorBoundary fallback={fallback}>
      <Suspense fallback={loadingFallback}>
        <RatingProvider>
          {children}
        </RatingProvider>
      </Suspense>
    </RatingErrorBoundary>
  )
}

// Individual component wrapper for rating components
interface SafeRatingComponentProps {
  children: ReactNode
  fallback?: ReactNode
  loadingFallback?: ReactNode
  componentName?: string
}

export function SafeRatingComponent({
  children,
  fallback = <DefaultRatingError />,
  loadingFallback = <RatingLoadingFallback />,
  componentName = "Rating Component"
}: SafeRatingComponentProps) {
  return (
    <RatingErrorBoundary
      fallback={fallback}
      onError={(error, errorInfo) => {
        console.error(`Error in ${componentName}:`, error, errorInfo)
      }}
    >
      <Suspense fallback={loadingFallback}>
        {children}
      </Suspense>
    </RatingErrorBoundary>
  )
}

// HOC for wrapping rating components
export function withSafeRating<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode
    loadingFallback?: ReactNode
    componentName?: string
  }
) {
  const WrappedComponent = (props: P) => (
    <SafeRatingComponent
      fallback={options?.fallback}
      loadingFallback={options?.loadingFallback}
      componentName={options?.componentName || Component.displayName || Component.name}
    >
      <Component {...props} />
    </SafeRatingComponent>
  )

  WrappedComponent.displayName = `withSafeRating(${Component.displayName || Component.name})`

  return WrappedComponent
}
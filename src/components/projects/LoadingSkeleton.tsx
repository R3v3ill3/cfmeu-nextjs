'use client'

import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  children?: ReactNode
}

export function LoadingSkeleton({ className, children }: LoadingSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted rounded',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ProjectCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="space-y-1 flex-1">
          <LoadingSkeleton className="h-5 w-32" />
          <LoadingSkeleton className="h-4 w-48" />
        </div>
        <LoadingSkeleton className="h-8 w-8 rounded" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <LoadingSkeleton className="h-4 w-20 mb-2" />
          <LoadingSkeleton className="h-10 w-full" />
        </div>
        <div>
          <LoadingSkeleton className="h-4 w-20 mb-2" />
          <LoadingSkeleton className="h-10 w-full" />
        </div>
      </div>

      <div className="space-y-3">
        <LoadingSkeleton className="h-4 w-24" />
        <div className="space-y-2">
          <LoadingSkeleton className="h-4 w-full" />
          <LoadingSkeleton className="h-4 w-full" />
          <LoadingSkeleton className="h-4 w-32" />
        </div>
      </div>
    </div>
  )
}

export function AnalysisLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>

      <div className="text-center space-y-4">
        <div className="space-y-2">
          <LoadingSkeleton className="h-6 w-48 mx-auto" />
          <LoadingSkeleton className="h-4 w-64 mx-auto" />
        </div>

        <div className="space-y-2">
          <LoadingSkeleton className="h-4 w-32 mx-auto" />
          <LoadingSkeleton className="h-2 w-64 mx-auto rounded-full" />
        </div>
      </div>

      <div className="space-y-3">
        <LoadingSkeleton className="h-4 w-24" />
        <div className="space-y-2">
          <LoadingSkeleton className="h-16 w-full" />
          <LoadingSkeleton className="h-16 w-full" />
          <LoadingSkeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  )
}

export function ProcessingLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-center py-8">
        <div className="relative">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <div className="absolute inset-0 h-12 w-12 animate-ping bg-primary/20 rounded-full" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <LoadingSkeleton className="h-4 w-32" />
          <LoadingSkeleton className="h-4 w-8" />
        </div>
        <LoadingSkeleton className="h-2 w-full rounded-full" />
      </div>

      <div className="text-center space-y-2">
        <LoadingSkeleton className="h-4 w-48 mx-auto" />
        <LoadingSkeleton className="h-3 w-64 mx-auto" />
      </div>

      <div className="space-y-2">
        <LoadingSkeleton className="h-4 w-24" />
        <div className="space-y-2">
          <LoadingSkeleton className="h-3 w-full" />
          <LoadingSkeleton className="h-3 w-3/4" />
          <LoadingSkeleton className="h-3 w-1/2" />
        </div>
      </div>
    </div>
  )
}

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="p-3 border rounded-lg space-y-2">
          <div className="flex items-center gap-2">
            <LoadingSkeleton className="h-4 w-4" />
            <LoadingSkeleton className="h-4 w-48" />
          </div>
          <div className="flex items-center gap-1 ml-6">
            <LoadingSkeleton className="h-3 w-3" />
            <LoadingSkeleton className="h-3 w-64" />
          </div>
          <div className="ml-6">
            <LoadingSkeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function UploadProgressSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
        <LoadingSkeleton className="h-8 w-8 rounded" />
        <div className="flex-1">
          <LoadingSkeleton className="h-4 w-32 mb-2" />
          <LoadingSkeleton className="h-3 w-48" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <LoadingSkeleton className="h-4 w-24" />
          <LoadingSkeleton className="h-4 w-8" />
        </div>
        <LoadingSkeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  )
}
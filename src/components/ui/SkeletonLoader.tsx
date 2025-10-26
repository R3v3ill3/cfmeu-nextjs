"use client"

import { type FC, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { mobileTokens } from '@/styles/mobile-design-tokens'

export interface SkeletonLoaderProps {
  lines?: number
  height?: number | string
  width?: number | string
  className?: string
  animated?: boolean
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded'
  showAvatar?: boolean
  showTitle?: boolean
  subtitle?: boolean
}

export const SkeletonLoader: FC<SkeletonLoaderProps> = ({
  lines = 3,
  height = '1rem',
  width = '100%',
  className,
  animated = true,
  variant = 'text',
  showAvatar = false,
  showTitle = false,
  subtitle = false,
}) => {
  const baseClasses = cn(
    'bg-gray-200',
    animated && 'animate-pulse',
    className
  )

  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-lg',
  }

  return (
    <div className="space-y-3">
      {/* Avatar skeleton */}
      {showAvatar && (
        <div
          className={cn(
            baseClasses,
            variantClasses.circular,
            'w-12 h-12'
          )}
        />
      )}

      {/* Title skeleton */}
      {showTitle && (
        <div
          className={cn(
            baseClasses,
            variantClasses.text,
            'w-3/4 h-6 mb-2'
          )}
        />
      )}

      {/* Main content skeleton */}
      {variant === 'text' ? (
        <>
          {Array.from({ length: lines }, (_, index) => (
            <div
              key={index}
              className={cn(
                baseClasses,
                variantClasses.text,
                index === lines - 1 && lines > 1 ? 'w-4/5' : 'w-full'
              )}
              style={{
                height,
                width: typeof width === 'string' && index === lines - 1 && lines > 1 ? '80%' : width,
              }}
            />
          ))}
        </>
      ) : (
        <div
          className={cn(
            baseClasses,
            variantClasses[variant]
          )}
          style={{
            height,
            width,
          }}
        />
      )}

      {/* Subtitle skeleton */}
      {subtitle && (
        <div
          className={cn(
            baseClasses,
            variantClasses.text,
            'w-2/3 h-3'
          )}
        />
      )}
    </div>
  )
}

// Card-specific skeleton components
export interface SkeletonCardProps {
  showAvatar?: boolean
  showActions?: boolean
  lines?: number
  className?: string
}

export const SkeletonCard: FC<SkeletonCardProps> = ({
  showAvatar = false,
  showActions = false,
  lines = 3,
  className,
}) => {
  return (
    <div className={cn('p-4 border border-gray-200 rounded-xl', className)}>
      {/* Header with avatar and title */}
      <div className="flex items-start gap-3 mb-3">
        {showAvatar && (
          <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse" />
        )}
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>

      {/* Content lines */}
      <div className="space-y-2">
        {Array.from({ length: lines }, (_, index) => (
          <div
            key={index}
            className={cn(
              'h-4 bg-gray-200 rounded animate-pulse',
              index === lines - 1 ? 'w-4/5' : 'w-full'
            )}
          />
        ))}
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="flex gap-2 mt-4">
          <div className="h-9 bg-gray-200 rounded-lg w-20 animate-pulse" />
          <div className="h-9 bg-gray-200 rounded-lg w-16 animate-pulse" />
        </div>
      )}
    </div>
  )
}

export interface SkeletonListProps {
  items?: number
  className?: string
}

export const SkeletonList: FC<SkeletonListProps> = ({
  items = 5,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: items }, (_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  )
}

export interface SkeletonTableProps {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}

export const SkeletonTable: FC<SkeletonTableProps> = ({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
}) => {
  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', className)}>
      {/* Header */}
      {showHeader && (
        <div className="border-b border-gray-200 p-4 bg-gray-50">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }, (_, index) => (
              <div key={`header-${index}`} className="h-4 bg-gray-300 rounded animate-pulse" />
            ))}
          </div>
        </div>
      )}

      {/* Rows */}
      <div className="divide-y divide-gray-200">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="p-4">
            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }, (_, colIndex) => (
                <div
                  key={`cell-${rowIndex}-${colIndex}`}
                  className={cn(
                    'h-4 bg-gray-200 rounded animate-pulse',
                    colIndex === 0 && 'w-3/4'
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface SkeletonGridProps {
  items?: number
  columns?: number
  aspectRatio?: 'square' | 'portrait' | 'landscape'
  className?: string
}

export const SkeletonGrid: FC<SkeletonGridProps> = ({
  items = 6,
  columns = 3,
  aspectRatio = 'portrait',
  className,
}) => {
  const aspectRatioClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]',
  }

  return (
    <div
      className={cn(
        'grid gap-4',
        `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${Math.min(columns, 3)}`,
        className
      )}
    >
      {Array.from({ length: items }, (_, index) => (
        <div
          key={index}
          className={cn(
            'bg-gray-200 rounded-lg animate-pulse',
            aspectRatioClasses[aspectRatio]
          )}
        />
      ))}
    </div>
  )
}

// Mobile-optimized skeleton components
export interface MobileSkeletonCardProps {
  variant?: 'compact' | 'detailed' | 'list-item'
  className?: string
}

export const MobileSkeletonCard: FC<MobileSkeletonCardProps> = ({
  variant = 'compact',
  className,
}) => {
  if (variant === 'list-item') {
    return (
      <div className={cn('flex items-center gap-3 py-3 px-4 border-b border-gray-100', className)}>
        <div className="w-10 h-10 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
        <div className="w-6 h-6 bg-gray-200 rounded animate-pulse" />
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={cn('p-4 border border-gray-200 rounded-xl', className)}>
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-200 rounded w-3/4 animate-pulse" />
            <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
          </div>
          <div className="w-10 h-10 bg-gray-200 rounded-lg animate-pulse" />
        </div>

        {/* Content */}
        <div className="space-y-2 mb-3">
          <div className="h-4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 bg-gray-200 rounded w-4/5 animate-pulse" />
        </div>

        {/* Tags */}
        <div className="flex gap-2">
          <div className="h-6 bg-gray-200 rounded-full w-16 animate-pulse" />
          <div className="h-6 bg-gray-200 rounded-full w-20 animate-pulse" />
        </div>
      </div>
    )
  }

  // Compact variant
  return (
    <div className={cn('p-3 border border-gray-200 rounded-lg', className)}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse flex-shrink-0" />
        <div className="flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse mb-1" />
          <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    </div>
  )
}

// Loading skeleton with progressive loading states
export interface ProgressiveSkeletonProps {
  items: Array<{
    id: string
    component: ReactNode
    loading?: boolean
  }>
  className?: string
}

export const ProgressiveSkeleton: FC<ProgressiveSkeletonProps> = ({
  items,
  className,
}) => {
  return (
    <div className={cn('space-y-2', className)}>
      {items.map((item) =>
        item.loading ? (
          <MobileSkeletonCard key={`skeleton-${item.id}`} />
        ) : (
          <div key={item.id}>{item.component}</div>
        )
      )}
    </div>
  )
}

export default SkeletonLoader
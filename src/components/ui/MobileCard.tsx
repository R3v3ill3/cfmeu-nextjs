"use client"

import React, { useRef, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { mobileSpacing, mobileTokens, device } from '@/styles/mobile-design-tokens'
import { cssAnimation } from '@/styles/mobile-animations'
import { SwipeActions } from './SwipeActions'
import { SkeletonLoader } from './SkeletonLoader'

export interface MobileCardProps extends React.HTMLAttributes<HTMLDivElement> {
  // Content props
  title?: string
  subtitle?: string
  description?: string
  children?: React.ReactNode

  // Visual props
  variant?: 'default' | 'elevated' | 'outlined' | 'filled'
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  size?: 'sm' | 'md' | 'lg'

  // Interaction props
  clickable?: boolean
  onPress?: () => void
  loading?: boolean
  disabled?: boolean

  // Swipe actions
  swipeActions?: {
    left?: Array<{
      icon: React.ReactNode
      label?: string
      color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
      onPress: () => void
    }>
    right?: Array<{
      icon: React.ReactNode
      label?: string
      color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
      onPress: () => void
    }>
  }

  // Mobile-specific props
  safeArea?: boolean
  adaptiveHeight?: boolean
  preventAnimation?: boolean

  // Status props
  status?: 'default' | 'active' | 'selected' | 'disabled'
}

export const MobileCard = React.forwardRef<HTMLDivElement, MobileCardProps>(
  ({
    className,
    title,
    subtitle,
    description,
    children,
    variant = 'default',
    color = 'primary',
    size = 'md',
    clickable = false,
    onPress,
    loading = false,
    disabled = false,
    swipeActions,
    safeArea = false,
    adaptiveHeight = false,
    preventAnimation = false,
    status = 'default',
    style,
    ...props
  }, ref) => {
    const cardRef = useRef<HTMLDivElement>(null)
    const [isPressed, setIsPressed] = useState(false)
    const [isAnimating, setIsAnimating] = useState(false)

    // Merge refs
    const mergedRef = (node: HTMLDivElement) => {
      cardRef.current = node
      if (typeof ref === 'function') ref(node)
      else if (ref) ref.current = node
    }

    // Touch handling for mobile interactions
    const handleTouchStart = () => {
      if (clickable && !disabled && !loading) {
        setIsPressed(true)
        setIsAnimating(true)

        // Add haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(10) // Light vibration for touch
        }
      }
    }

    const handleTouchEnd = () => {
      if (isPressed) {
        setIsPressed(false)
        setTimeout(() => setIsAnimating(false), 150)
      }
    }

    const handleClick = () => {
      if (clickable && !disabled && !loading && onPress) {
        // Add haptic feedback if available
        if ('vibrate' in navigator) {
          navigator.vibrate(25) // Stronger vibration for action
        }
        onPress()
      }
    }

    // Animation classes
    const animationClass = isAnimating ? 'touch-press' : ''
    const loadingClass = loading ? 'loading' : ''
    const disabledClass = disabled ? 'disabled' : ''
    const statusClass = status !== 'default' ? `status-${status}` : ''

    // Size classes
    const sizeClasses = {
      sm: 'py-3 px-4 min-h-[44px]',
      md: 'py-4 px-5 min-h-[60px]',
      lg: 'py-5 px-6 min-h-[72px]',
    }

    // Variant classes
    const variantClasses = {
      default: 'bg-white border border-gray-200',
      elevated: 'bg-white border border-gray-200 shadow-md',
      outlined: 'bg-white border-2 border-gray-300',
      filled: color === 'primary' ? 'bg-blue-50 border border-blue-200' :
             color === 'secondary' ? 'bg-gray-50 border border-gray-200' :
             color === 'success' ? 'bg-green-50 border border-green-200' :
             color === 'warning' ? 'bg-yellow-50 border border-yellow-200' :
             color === 'error' ? 'bg-red-50 border border-red-200' :
             'bg-white border border-gray-200',
    }

    // Touch interaction styles
    const touchStyles: React.CSSProperties = {
      ...cssAnimation.accelerate({}),
      transition: `transform ${mobileTokens.animation.duration.fast} ${mobileTokens.animation.easing.easeOut},
                  opacity ${mobileTokens.animation.duration.fast} ${mobileTokens.animation.easing.easeOut}`,
      transform: isPressed ? 'scale(0.98)' : 'scale(1)',
      opacity: disabled ? 0.6 : 1,
      cursor: clickable && !disabled && !loading ? 'pointer' : 'default',
      minHeight: adaptiveHeight ? undefined : mobileSpacing.touchMin,
      ...style,
    }

    // Safe area styles
    const safeAreaStyles = safeArea ? {
      marginLeft: 'env(safe-area-inset-left, 0)',
      marginRight: 'env(safe-area-inset-right, 0)',
    } : {}

    // Card content
    const cardContent = (
      <div
        ref={mergedRef}
        className={cn(
          // Base classes
          'relative rounded-xl',
          'overflow-hidden',

          // Size and spacing
          sizeClasses[size],

          // Variant and visual
          variantClasses[variant],

          // Interaction states
          clickable && 'active:scale-95',
          disabledClass,
          statusClass,
          animationClass,
          loadingClass,

          // Mobile optimizations
          'touch-manipulation',
          'gpu-accelerated',

          // Custom classes
          className
        )}
        style={{
          ...touchStyles,
          ...safeAreaStyles,
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onClick={handleClick}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={clickable ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        } : undefined}
        aria-disabled={disabled}
        aria-busy={loading}
        {...props}
      >
        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Card content */}
        <div className="relative z-0">
          {/* Header section */}
          {(title || subtitle) && (
            <div className="mb-3">
              {title && (
                <h3 className={cn(
                  'font-semibold text-gray-900',
                  size === 'sm' ? 'text-sm' : 'text-base',
                  disabled && 'text-gray-400'
                )}>
                  {title}
                </h3>
              )}
              {subtitle && (
                <p className={cn(
                  'text-gray-600 mt-1',
                  size === 'sm' ? 'text-xs' : 'text-sm',
                  disabled && 'text-gray-400'
                )}>
                  {subtitle}
                </p>
              )}
            </div>
          )}

          {/* Description */}
          {description && (
            <p className={cn(
              'text-gray-700 mb-3',
              size === 'sm' ? 'text-xs' : 'text-sm',
              disabled && 'text-gray-400'
            )}>
              {description}
            </p>
          )}

          {/* Children content */}
          {children}
        </div>

        {/* Status indicator */}
        {status === 'selected' && (
          <div className="absolute top-4 right-4 w-2 h-2 bg-blue-500 rounded-full" />
        )}

        {status === 'active' && (
          <div className="absolute top-4 right-4 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </div>
    )

    // Wrap with swipe actions if provided
    if (swipeActions && !disabled && !loading) {
      return (
        <SwipeActions
          leftActions={swipeActions.left}
          rightActions={swipeActions.right}
          onActionStart={() => setIsPressed(false)}
          onActionEnd={() => {}}
        >
          {cardContent}
        </SwipeActions>
      )
    }

    return cardContent
  }
)

MobileCard.displayName = 'MobileCard'

// Mobile Card with Skeleton Loader
export const MobileCardWithSkeleton: React.FC<
  MobileCardProps & {
    showSkeleton?: boolean
    skeletonLines?: number
  }
> = ({ showSkeleton = false, skeletonLines = 3, children, ...props }) => {
  if (showSkeleton) {
    return (
      <MobileCard {...props} loading>
        <SkeletonLoader lines={skeletonLines} />
      </MobileCard>
    )
  }

  return (
    <MobileCard {...props}>
      {children}
    </MobileCard>
  )
}

// List version for better mobile list performance
export interface MobileCardListItemProps extends Omit<MobileCardProps, 'size'> {
  index: number
  totalItems: number
  inset?: boolean
}

export const MobileCardListItem: React.FC<MobileCardListItemProps> = ({
  index,
  totalItems,
  inset = false,
  className,
  ...props
}) => {
  const isFirst = index === 0
  const isLast = index === totalItems - 1

  return (
    <div className={cn(
      'w-full',
      inset && 'px-4',
      !isFirst && '-mt-px', // Overlap borders
    )}>
      <MobileCard
        {...props}
        size="sm"
        className={cn(
          // Rounded corners based on position
          isFirst && !inset && 'rounded-t-xl',
          isLast && !inset && 'rounded-b-xl',
          !isFirst && !isLast && 'rounded-none',
          inset && 'rounded-xl',
          className
        )}
      />
    </div>
  )
}

// Grid version for card grids
export interface MobileCardGridItemProps extends Omit<MobileCardProps, 'size'> {
  aspectRatio?: 'square' | 'portrait' | 'landscape'
}

export const MobileCardGridItem: React.FC<MobileCardGridItemProps> = ({
  aspectRatio = 'portrait',
  className,
  children,
  ...props
}) => {
  const aspectRatioClasses = {
    square: 'aspect-square',
    portrait: 'aspect-[3/4]',
    landscape: 'aspect-[4/3]',
  }

  return (
    <div className={cn('w-full', aspectRatioClasses[aspectRatio])}>
      <MobileCard
        {...props}
        size="sm"
        className={cn(
          'h-full flex flex-col',
          className
        )}
      >
        {children}
      </MobileCard>
    </div>
  )
}

export default MobileCard
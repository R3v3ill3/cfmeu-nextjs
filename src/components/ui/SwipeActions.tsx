"use client"

import React, { useRef, useState, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { mobileTokens } from '@/styles/mobile-design-tokens'

export interface SwipeAction {
  icon: React.ReactNode
  label?: string
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  onPress: () => void
}

export interface SwipeActionsProps {
  children: React.ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  onActionStart?: () => void
  onActionEnd?: () => void
  disabled?: boolean
  threshold?: number
  className?: string
}

export const SwipeActions: React.FC<SwipeActionsProps> = ({
  children,
  leftActions = [],
  rightActions = [],
  onActionStart,
  onActionEnd,
  disabled = false,
  threshold = 100,
  className,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [startX, setStartX] = useState(0)
  const [currentX, setCurrentX] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const [activeAction, setActiveAction] = useState<SwipeAction | null>(null)

  const actionWidth = 80 // Width of each action button

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled) return

    const touch = e.touches[0]
    setStartX(touch.clientX)
    setCurrentX(touch.clientX)
    setIsDragging(true)
    setIsAnimating(false)
  }, [disabled])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || disabled) return

    const touch = e.touches[0]
    const deltaX = touch.clientX - startX
    setCurrentX(touch.clientX)

    // Calculate max translation based on available actions
    const maxLeft = leftActions.length * actionWidth
    const maxRight = rightActions.length * actionWidth

    let newTranslateX = deltaX

    // Constrain to available action space
    if (deltaX > 0) {
      // Swiping right - show left actions
      newTranslateX = Math.min(deltaX, maxLeft)
    } else if (deltaX < 0) {
      // Swiping left - show right actions
      newTranslateX = Math.max(deltaX, -maxRight)
    }

    setTranslateX(newTranslateX)

    // Determine active action based on translation
    if (newTranslateX > 0 && leftActions.length > 0) {
      const actionIndex = Math.min(
        Math.floor(newTranslateX / actionWidth),
        leftActions.length - 1
      )
      setActiveAction(leftActions[actionIndex])
    } else if (newTranslateX < 0 && rightActions.length > 0) {
      const actionIndex = Math.min(
        Math.floor(Math.abs(newTranslateX) / actionWidth),
        rightActions.length - 1
      )
      setActiveAction(rightActions[actionIndex])
    } else {
      setActiveAction(null)
    }

    // Provide haptic feedback on action change
    if (activeAction && 'vibrate' in navigator) {
      navigator.vibrate(10)
    }
  }, [isDragging, disabled, startX, leftActions, rightActions, activeAction])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || disabled) return

    setIsDragging(false)
    setIsAnimating(true)

    const maxLeft = leftActions.length * actionWidth
    const maxRight = rightActions.length * actionWidth

    // Determine if we should snap to an action or reset
    let finalTranslateX = 0
    let actionToExecute: SwipeAction | null = null

    if (translateX > threshold && leftActions.length > 0) {
      // Snap to first left action
      const actionIndex = Math.floor(translateX / actionWidth)
      finalTranslateX = (actionIndex + 1) * actionWidth
      actionToExecute = leftActions[Math.min(actionIndex, leftActions.length - 1)]
    } else if (translateX < -threshold && rightActions.length > 0) {
      // Snap to first right action
      const actionIndex = Math.floor(Math.abs(translateX) / actionWidth)
      finalTranslateX = -(actionIndex + 1) * actionWidth
      actionToExecute = rightActions[Math.min(actionIndex, rightActions.length - 1)]
    }

    // Apply final translation with animation
    setTranslateX(finalTranslateX)

    // Execute action if threshold met
    if (actionToExecute) {
      onActionStart?.()

      // Provide stronger haptic feedback for action execution
      if ('vibrate' in navigator) {
        navigator.vibrate(25)
      }

      // Execute action after animation
      setTimeout(() => {
        actionToExecute.onPress()
        onActionEnd?.()

        // Reset position
        setTimeout(() => {
          setTranslateX(0)
          setIsAnimating(false)
        }, 100)
      }, 200)
    } else {
      // Reset position if threshold not met
      setTimeout(() => {
        setTranslateX(0)
        setIsAnimating(false)
        setActiveAction(null)
      }, 200)
    }
  }, [isDragging, disabled, translateX, threshold, leftActions, rightActions, onActionStart, onActionEnd])

  // Reset on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && translateX !== 0) {
        setTranslateX(0)
        setActiveAction(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [translateX])

  // Action color classes
  const getActionColorClass = (color: SwipeAction['color'] = 'primary') => {
    const colors = {
      primary: 'bg-blue-500 text-white',
      secondary: 'bg-gray-500 text-white',
      success: 'bg-green-500 text-white',
      warning: 'bg-yellow-500 text-white',
      error: 'bg-red-500 text-white',
    }
    return colors[color]
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden touch-manipulation',
        disabled && 'pointer-events-none',
        className
      )}
    >
      {/* Left Actions Background */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex items-center">
          <div
            className="flex h-full"
            style={{
              width: `${leftActions.length * actionWidth}px`,
              transform: `translateX(${Math.max(0, -translateX)}px)`,
              transition: isAnimating ? `transform 0.2s ${mobileTokens.animation.easing.easeOut}` : 'none',
            }}
          >
            {leftActions.map((action, index) => (
              <button
                key={`left-${index}`}
                className={cn(
                  'flex flex-col items-center justify-center h-full',
                  getActionColorClass(action.color),
                  'transition-all duration-200',
                  activeAction === action && 'bg-opacity-100',
                  activeAction !== action && 'bg-opacity-80'
                )}
                style={{
                  width: `${actionWidth}px`,
                }}
                onClick={() => {
                  if (onActionStart) onActionStart()
                  action.onPress()
                  if (onActionEnd) onActionEnd()
                  setTranslateX(0)
                }}
                aria-label={action.label}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {action.icon}
                </div>
                {action.label && (
                  <span className="text-xs mt-1 px-1 text-center">
                    {action.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Actions Background */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex items-center">
          <div
            className="flex h-full"
            style={{
              width: `${rightActions.length * actionWidth}px`,
              transform: `translateX(${Math.min(0, -translateX)}px)`,
              transition: isAnimating ? `transform 0.2s ${mobileTokens.animation.easing.easeOut}` : 'none',
            }}
          >
            {rightActions.map((action, index) => (
              <button
                key={`right-${index}`}
                className={cn(
                  'flex flex-col items-center justify-center h-full',
                  getActionColorClass(action.color),
                  'transition-all duration-200',
                  activeAction === action && 'bg-opacity-100',
                  activeAction !== action && 'bg-opacity-80'
                )}
                style={{
                  width: `${actionWidth}px`,
                }}
                onClick={() => {
                  if (onActionStart) onActionStart()
                  action.onPress()
                  if (onActionEnd) onActionEnd()
                  setTranslateX(0)
                }}
                aria-label={action.label}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  {action.icon}
                </div>
                {action.label && (
                  <span className="text-xs mt-1 px-1 text-center">
                    {action.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="relative bg-white"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isAnimating ? `transform 0.2s ${mobileTokens.animation.easing.easeOut}` : 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}

// Keyboard accessible swipe actions alternative
export interface SwipeActionsKeyboardProps {
  actions: SwipeAction[]
  triggerLabel?: string
  className?: string
}

export const SwipeActionsKeyboard: React.FC<SwipeActionsKeyboardProps> = ({
  actions,
  triggerLabel = 'Actions',
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className={cn('relative', className)}>
      <button
        className="p-2 text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label={triggerLabel}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Actions menu */}
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[120px]">
            {actions.map((action, index) => (
              <button
                key={index}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus:bg-gray-50',
                  action.color === 'error' && 'text-red-600 hover:bg-red-50 focus:bg-red-50',
                  action.color === 'success' && 'text-green-600 hover:bg-green-50 focus:bg-green-50',
                  action.color === 'warning' && 'text-yellow-600 hover:bg-yellow-50 focus:bg-yellow-50',
                  action.color === 'primary' && 'text-blue-600 hover:bg-blue-50 focus:bg-blue-50'
                )}
                onClick={() => {
                  action.onPress()
                  setIsOpen(false)
                }}
              >
                <div className="w-5 h-5 flex items-center justify-center">
                  {action.icon}
                </div>
                {action.label && (
                  <span className="text-sm">
                    {action.label}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default SwipeActions
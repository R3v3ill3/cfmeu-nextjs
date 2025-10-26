"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Trash2, Edit, Archive, Star } from "lucide-react"

interface SwipeAction {
  key: string
  icon?: ReactNode
  label: string
  color: string
  backgroundColor: string
  onPress: () => void
}

interface SwipeActionsProps {
  children: ReactNode
  leftActions?: SwipeAction[]
  rightActions?: SwipeAction[]
  className?: string
  threshold?: number
  disabled?: boolean
}

export function SwipeActions({
  children,
  leftActions = [],
  rightActions = [],
  className,
  threshold = 100,
  disabled = false,
}: SwipeActionsProps) {
  const [translateX, setTranslateX] = React.useState(0)
  const [isDragging, setIsDragging] = React.useState(false)
  const [showLeftActions, setShowLeftActions] = React.useState(false)
  const [showRightActions, setShowRightActions] = React.useState(false)

  const startX = React.useRef(0)
  const currentX = React.useRef(0)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return

    const touch = e.touches[0]
    startX.current = touch.clientX
    currentX.current = touch.clientX
    setIsDragging(true)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || disabled) return

    const touch = e.touches[0]
    currentX.current = touch.clientX
    const deltaX = currentX.current - startX.current

    // Calculate max swipe distance based on available actions
    const maxLeftSwipe = leftActions.length * threshold
    const maxRightSwipe = rightActions.length * threshold

    let newTranslateX = deltaX

    // Apply boundaries
    if (deltaX > 0) { // Swiping right (show left actions)
      newTranslateX = Math.min(deltaX, maxLeftSwipe)
      setShowLeftActions(deltaX > threshold / 2)
      setShowRightActions(false)
    } else if (deltaX < 0) { // Swiping left (show right actions)
      newTranslateX = Math.max(deltaX, -maxRightSwipe)
      setShowRightActions(Math.abs(deltaX) > threshold / 2)
      setShowLeftActions(false)
    } else {
      setShowLeftActions(false)
      setShowRightActions(false)
    }

    setTranslateX(newTranslateX)
  }

  const handleTouchEnd = () => {
    if (!isDragging) return

    setIsDragging(false)

    // Determine if we should snap to show actions or snap back
    const absTranslateX = Math.abs(translateX)
    const hasLeftActions = leftActions.length > 0
    const hasRightActions = rightActions.length > 0

    if (translateX > 0 && hasLeftActions) {
      // Swiped right
      if (absTranslateX > threshold / 2) {
        // Snap to show left actions
        setTranslateX(threshold)
      } else {
        // Snap back
        resetPosition()
      }
    } else if (translateX < 0 && hasRightActions) {
      // Swiped left
      if (absTranslateX > threshold / 2) {
        // Snap to show right actions
        setTranslateX(-threshold)
      } else {
        // Snap back
        resetPosition()
      }
    } else {
      resetPosition()
    }
  }

  const resetPosition = () => {
    setTranslateX(0)
    setShowLeftActions(false)
    setShowRightActions(false)
  }

  const handleActionPress = (action: SwipeAction) => {
    action.onPress()
    resetPosition()
  }

  const getActionWidth = () => `${threshold}px`

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden touch-none",
        className
      )}
    >
      {/* Left Actions Background */}
      {leftActions.length > 0 && (
        <div
          className="absolute left-0 top-0 bottom-0 flex z-0"
          style={{
            width: `${leftActions.length * threshold}px`,
          }}
        >
          {leftActions.map((action, index) => (
            <button
              key={action.key}
              className={cn(
                "flex items-center justify-center flex-1 transition-all duration-200",
                showLeftActions ? "opacity-100" : "opacity-70"
              )}
              style={{
                backgroundColor: action.backgroundColor,
                transform: showLeftActions
                  ? "translateX(0)"
                  : `translateX(-${20 * (leftActions.length - index)}px)`,
              }}
              onClick={() => handleActionPress(action)}
              aria-label={action.label}
            >
              <div className="flex flex-col items-center gap-1 text-white">
                {action.icon || <ChevronLeft className="h-5 w-5" />}
                <span className="text-xs font-medium max-w-[60px] truncate">
                  {action.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Right Actions Background */}
      {rightActions.length > 0 && (
        <div
          className="absolute right-0 top-0 bottom-0 flex z-0"
          style={{
            width: `${rightActions.length * threshold}px`,
          }}
        >
          {rightActions.map((action, index) => (
            <button
              key={action.key}
              className={cn(
                "flex items-center justify-center flex-1 transition-all duration-200",
                showRightActions ? "opacity-100" : "opacity-70"
              )}
              style={{
                backgroundColor: action.backgroundColor,
                transform: showRightActions
                  ? "translateX(0)"
                  : `translateX(${20 * (index + 1)}px)`,
              }}
              onClick={() => handleActionPress(action)}
              aria-label={action.label}
            >
              <div className="flex flex-col items-center gap-1 text-white">
                {action.icon || <ChevronRight className="h-5 w-5" />}
                <span className="text-xs font-medium max-w-[60px] truncate">
                  {action.label}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div
        ref={contentRef}
        className="relative z-10 bg-background"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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

// Predefined common actions
export const swipeActions = {
  delete: (onPress: () => void): SwipeAction => ({
    key: 'delete',
    icon: <Trash2 className="h-5 w-5" />,
    label: 'Delete',
    color: 'text-white',
    backgroundColor: '#ef4444',
    onPress,
  }),
  edit: (onPress: () => void): SwipeAction => ({
    key: 'edit',
    icon: <Edit className="h-5 w-5" />,
    label: 'Edit',
    color: 'text-white',
    backgroundColor: '#3b82f6',
    onPress,
  }),
  archive: (onPress: () => void): SwipeAction => ({
    key: 'archive',
    icon: <Archive className="h-5 w-5" />,
    label: 'Archive',
    color: 'text-white',
    backgroundColor: '#6b7280',
    onPress,
  }),
  favorite: (onPress: () => void): SwipeAction => ({
    key: 'favorite',
    icon: <Star className="h-5 w-5" />,
    label: 'Favorite',
    color: 'text-white',
    backgroundColor: '#eab308',
    onPress,
  }),
}
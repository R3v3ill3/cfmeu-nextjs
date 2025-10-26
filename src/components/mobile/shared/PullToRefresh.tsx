"use client"

import {  useState, useEffect, useCallback, useMemo, useRef  } from 'react'
import type { ReactNode } from 'react'
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw } from "lucide-react"

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  className?: string
  threshold?: number
  disabled?: boolean
  refreshing?: boolean
}

export function PullToRefresh({
  onRefresh,
  children,
  className,
  threshold = 80,
  disabled = false,
  refreshing = false,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [shouldRefresh, setShouldRefresh] = useState(false)
  const startY = useRef(0)
  const currentY = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled || refreshing) return

    const touch = e.touches[0]
    startY.current = touch.clientY

    // Only enable pull-to-refresh when at the top
    if (containerRef.current) {
      const scrollTop = containerRef.current.scrollTop
      if (scrollTop > 0) return
    }

    setIsPulling(true)
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!isPulling || disabled || refreshing) return

    const touch = e.touches[0]
    currentY.current = touch.clientY
    const distance = currentY.current - startY.current

    // Only allow pulling down (positive distance)
    if (distance > 0) {
      e.preventDefault()

      // Apply resistance to make it feel more natural
      const resistance = 0.4
      const adjustedDistance = distance * resistance

      // Limit maximum pull distance
      const maxDistance = threshold * 2
      const clampedDistance = Math.min(adjustedDistance, maxDistance)

      setPullDistance(clampedDistance)

      // Check if we've passed the threshold
      if (clampedDistance >= threshold && !shouldRefresh) {
        setShouldRefresh(true)
      } else if (clampedDistance < threshold && shouldRefresh) {
        setShouldRefresh(false)
      }
    }
  }

  const handleTouchEnd = async () => {
    if (!isPulling) return

    setIsPulling(false)

    if (shouldRefresh && !refreshing) {
      setShouldRefresh(false)

      // Trigger refresh
      try {
        await onRefresh()
      } catch (error) {
        console.error('Pull to refresh failed:', error)
      }
    }

    // Reset pull distance with animation
    setPullDistance(0)
  }

  const getRefreshIndicatorOpacity = () => {
    if (pullDistance <= 0) return 0
    const progress = Math.min(pullDistance / threshold, 1)
    return progress
  }

  const getRefreshIconRotation = () => {
    if (!shouldRefresh) return 0
    return pullDistance > threshold ? 180 : 0
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative h-full overflow-y-auto touch-pan-y",
        className
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Refresh indicator */}
      <div
        className="absolute left-0 right-0 top-0 flex items-center justify-center pointer-events-none z-10"
        style={{
          height: `${Math.max(pullDistance, 0)}px`,
          opacity: getRefreshIndicatorOpacity(),
        }}
      >
        <div className="flex items-center gap-2 text-muted-foreground">
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RefreshCw
              className="h-5 w-5 transition-transform duration-200"
              style={{
                transform: `rotate(${getRefreshIconRotation()}deg)`,
              }}
            />
          )}
          <span className="text-sm font-medium">
            {refreshing ? "Refreshing..." : shouldRefresh ? "Release to refresh" : "Pull to refresh"}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="relative"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'translateY(0)',
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  )
}
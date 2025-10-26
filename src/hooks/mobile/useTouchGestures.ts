"use client"

import { useState, useCallback, useRef } from 'react'
import type { TouchEvent, CSSProperties } from 'react'

interface TouchGestureOptions {
  threshold?: number
  restraint?: number
  allowedTime?: number
  preventDefault?: boolean
}

interface TouchGestureState {
  startX: number
  startY: number
  startTime: number
  distX: number
  distY: number
  elapsedTime: number
}

interface UseTouchGesturesReturn {
  touchProps: {
    onTouchStart: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
    onTouchMove?: (e: TouchEvent) => void
  }
  swipeDirection: 'left' | 'right' | 'up' | 'down' | null
  isSwiping: boolean
  tapCount: number
  longPressTriggered: boolean
}

export function useTouchGestures(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  onTap?: () => void,
  onDoubleTap?: () => void,
  onLongPress?: () => void,
  options: TouchGestureOptions = {}
): UseTouchGesturesReturn {
  const {
    threshold = 50,
    restraint = 100,
    allowedTime = 300,
    preventDefault = true,
  } = options

  const [touchState, setTouchState] = useState<TouchGestureState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    distX: 0,
    distY: 0,
    elapsedTime: 0,
  })

  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | 'up' | 'down' | null>(null)
  const [isSwiping, setIsSwiping] = useState(false)
  const [tapCount, setTapCount] = useState(0)
  const [lastTapTime, setLastTapTime] = useState(0)
  const [longPressTriggered, setLongPressTriggered] = useState(false)
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (preventDefault) {
      e.preventDefault()
    }

    const touch = e.touches[0]
    const currentTime = new Date().getTime()

    setTouchState({
      startX: touch.pageX,
      startY: touch.pageY,
      startTime: currentTime,
      distX: 0,
      distY: 0,
      elapsedTime: 0,
    })

    setIsSwiping(false)
    setSwipeDirection(null)
    setLongPressTriggered(false)

    // Clear any existing long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
    }

    // Start long press timer
    longPressTimerRef.current = setTimeout(() => {
      setLongPressTriggered(true)
      onLongPress?.()
    }, 500) // 500ms for long press

    // Handle double tap detection
    if (currentTime - lastTapTime < 300) {
      setTapCount(prev => prev + 1)
      if (tapCount === 1) {
        onDoubleTap?.()
      }
    } else {
      setTapCount(1)
    }
    setLastTapTime(currentTime)
  }, [preventDefault, onLongPress, onDoubleTap, lastTapTime, tapCount])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (preventDefault) {
      e.preventDefault()
    }

    // Cancel long press if user moves finger
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    const touch = e.touches[0]
    const currentTime = new Date().getTime()
    const elapsedTime = currentTime - touchState.startTime
    const distX = touch.pageX - touchState.startX
    const distY = touch.pageY - touchState.startY

    setTouchState(prev => ({
      ...prev,
      distX,
      distY,
      elapsedTime,
    }))

    setIsSwiping(true)
  }, [preventDefault, touchState.startTime, touchState.startX, touchState.startY])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (preventDefault) {
      e.preventDefault()
    }

    // Clear long press timer
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current)
      longPressTimerRef.current = null
    }

    const currentTime = new Date().getTime()
    const elapsedTime = currentTime - touchState.startTime

    // Only handle as swipe if it was a quick movement
    if (elapsedTime <= allowedTime && isSwiping && !longPressTriggered) {
      const { distX, distY } = touchState

      // Determine swipe direction
      if (Math.abs(distX) >= Math.abs(distY)) {
        // Horizontal swipe
        if (distX > 0 && distX >= threshold) {
          setSwipeDirection('right')
          onSwipeRight?.()
        } else if (distX < 0 && Math.abs(distX) >= threshold) {
          setSwipeDirection('left')
          onSwipeLeft?.()
        }
      } else {
        // Vertical swipe
        if (distY > 0 && distY >= threshold) {
          setSwipeDirection('down')
          onSwipeDown?.()
        } else if (distY < 0 && Math.abs(distY) >= threshold) {
          setSwipeDirection('up')
          onSwipeUp?.()
        }
      }
    }

    // Handle tap if it wasn't a swipe or long press
    if (!isSwiping && !longPressTriggered && elapsedTime < allowedTime) {
      onTap?.()
    }

    setIsSwiping(false)
  }, [
    preventDefault,
    touchState,
    allowedTime,
    threshold,
    isSwiping,
    longPressTriggered,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onTap,
  ])

  const touchProps = {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd,
    onTouchMove: handleTouchMove,
  }

  return {
    touchProps,
    swipeDirection,
    isSwiping,
    tapCount,
    longPressTriggered,
  }
}

// Hook for pinch-to-zoom functionality
interface UsePinchZoomOptions {
  minScale?: number
  maxScale?: number
  initialScale?: number
  onScaleChange?: (scale: number) => void
}

interface UsePinchZoomReturn {
  scale: number
  reset: () => void
  touchProps: {
    onTouchStart: (e: TouchEvent) => void
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
  }
  style: CSSProperties
}

export function usePinchZoom(
  options: UsePinchZoomOptions = {}
): UsePinchZoomReturn {
  const {
    minScale = 0.5,
    maxScale = 3,
    initialScale = 1,
    onScaleChange,
  } = options

  const [scale, setScale] = useState(initialScale)
  const [lastDistance, setLastDistance] = useState(0)
  const [isPinching, setIsPinching] = useState(false)

  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX
    const dy = touch1.clientY - touch2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1])
      setLastDistance(distance)
      setIsPinching(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length === 2 && isPinching) {
      e.preventDefault()
      const distance = getDistance(e.touches[0], e.touches[1])
      const scaleChange = distance / lastDistance
      const newScale = Math.max(minScale, Math.min(maxScale, scale * scaleChange))

      setScale(newScale)
      setLastDistance(distance)
      onScaleChange?.(newScale)
    }
  }, [isPinching, lastDistance, scale, minScale, maxScale, onScaleChange])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false)
      setLastDistance(0)
    }
  }, [])

  const reset = useCallback(() => {
    setScale(initialScale)
    onScaleChange?.(initialScale)
  }, [initialScale, onScaleChange])

  const touchProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }

  const style: CSSProperties = {
    transform: `scale(${scale})`,
    transformOrigin: 'center',
    transition: isPinching ? 'none' : 'transform 0.3s ease-out',
    touchAction: 'none',
  }

  return {
    scale,
    reset,
    touchProps,
    style,
  }
}

// Hook for pull-to-refresh functionality
interface UsePullToRefreshOptions {
  threshold?: number
  onRefresh?: () => Promise<void> | void
  disabled?: boolean
}

interface UsePullToRefreshReturn {
  pullDistance: number
  isPulling: boolean
  isRefreshing: boolean
  touchProps: {
    onTouchStart: (e: TouchEvent) => void
    onTouchMove: (e: TouchEvent) => void
    onTouchEnd: (e: TouchEvent) => void
  }
  style: CSSProperties
}

export function usePullToRefresh(
  options: UsePullToRefreshOptions = {}
): UsePullToRefreshReturn {
  const {
    threshold = 80,
    onRefresh,
    disabled = false,
  } = options

  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [startY, setStartY] = useState(0)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (disabled) return

    const touch = e.touches[0]
    setStartY(touch.clientY)
    setIsPulling(true)
    setPullDistance(0)
  }, [disabled])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isPulling || disabled) return

    const touch = e.touches[0]
    const currentY = touch.clientY
    const distance = currentY - startY

    // Only allow pulling down (positive distance)
    if (distance > 0) {
      e.preventDefault()
      setPullDistance(distance)
    }
  }, [isPulling, disabled, startY])

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return

    setIsPulling(false)

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      try {
        await onRefresh?.()
      } finally {
        setIsRefreshing(false)
      }
    }

    setPullDistance(0)
  }, [isPulling, disabled, pullDistance, threshold, isRefreshing, onRefresh])

  const touchProps = {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  }

  const style: CSSProperties = {
    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'translateY(0)',
    transition: isPulling ? 'none' : 'transform 0.3s ease-out',
  }

  return {
    pullDistance,
    isPulling,
    isRefreshing,
    touchProps,
    style,
  }
}
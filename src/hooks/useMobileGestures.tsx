"use client"

import { useState, useEffect, useCallback, useMemo, useRef, useContext, forwardRef, createContext } from 'react'
import type { ReactNode, ComponentType } from 'react'
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"

// Gesture types
export type GestureType =
  | 'tap'
  | 'doubleTap'
  | 'longPress'
  | 'swipeLeft'
  | 'swipeRight'
  | 'swipeUp'
  | 'swipeDown'
  | 'pinch'
  | 'rotate'
  | 'pan'
  | 'custom'

// Gesture event data
export interface GestureEventData {
  type: GestureType
  startTime: number
  endTime: number
  duration: number
  distance?: { x: number; y: number }
  velocity?: { x: number; y: number }
  scale?: number
  rotation?: number
  touchCount: number
  position: { x: number; y: number }
  target: Element
}

// Gesture handler interface
export interface GestureHandler {
  type: GestureType
  handler: (event: GestureEventData) => void
  threshold?: number
  timeout?: number
  enabled?: boolean
}

// Configuration options
export interface GestureOptions {
  preventDefault?: boolean
  stopPropagation?: boolean
  capture?: boolean
  passive?: boolean
  threshold?: number
  longPressDelay?: number
  doubleTapDelay?: number
  swipeThreshold?: number
  pinchThreshold?: number
  rotationThreshold?: number
  enableHaptics?: boolean
  hapticType?: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'
}

// Default options
const DEFAULT_OPTIONS: Required<GestureOptions> = {
  preventDefault: false,
  stopPropagation: false,
  capture: false,
  passive: true,
  threshold: 10,
  longPressDelay: 500,
  doubleTapDelay: 300,
  swipeThreshold: 50,
  pinchThreshold: 20,
  rotationThreshold: 15,
  enableHaptics: true,
  hapticType: 'light'
}

// Hook for advanced gesture handling
export function useMobileGestures(
  handlers: GestureHandler[],
  options: GestureOptions = {}
) {
  const elementRef = useRef<Element>(null)
  const { selection, impact, onPress, onSuccess, onError, onWarning } = useHapticFeedback()
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options }

  // Gesture state
  const gestureState = useRef({
    isTracking: false,
    startTime: 0,
    lastTapTime: 0,
    tapCount: 0,
    startPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    initialDistance: 0,
    initialAngle: 0,
    touches: [] as Touch[],
    longPressTimer: null as NodeJS.Timeout | null,
    doubleTapTimer: null as NodeJS.Timeout | null,
  })

  // Trigger haptic feedback
  const triggerHaptic = useCallback((type: GestureType) => {
    if (!mergedOptions.enableHaptics) return

    switch (type) {
      case 'tap':
      case 'swipeLeft':
      case 'swipeRight':
      case 'swipeUp':
      case 'swipeDown':
        selection()
        break
      case 'longPress':
        onPress()
        break
      case 'doubleTap':
        impact()
        break
      case 'pinch':
      case 'rotate':
        selection()
        break
      default:
        selection()
    }
  }, [mergedOptions.enableHaptics, selection, impact, onPress])

  // Calculate distance between two points
  const calculateDistance = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2))
  }, [])

  // Calculate angle between two points
  const calculateAngle = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI
  }, [])

  // Create gesture event data
  const createGestureEvent = useCallback((
    type: GestureType,
    startTime: number,
    endTime: number,
    touches: Touch[],
    target: Element
  ): GestureEventData => {
    const duration = endTime - startTime
    const startPosition = gestureState.current.startPosition
    const currentPosition = gestureState.current.currentPosition

    const eventData: GestureEventData = {
      type,
      startTime,
      endTime,
      duration,
      touchCount: touches.length,
      position: currentPosition,
      target
    }

    // Calculate distance for swipe gestures
    if (type.startsWith('swipe') || type === 'pan') {
      eventData.distance = {
        x: currentPosition.x - startPosition.x,
        y: currentPosition.y - startPosition.y
      }
      eventData.velocity = {
        x: eventData.distance.x / duration * 1000,
        y: eventData.distance.y / duration * 1000
      }
    }

    // Calculate scale for pinch gestures
    if (type === 'pinch' && touches.length === 2) {
      const currentDistance = calculateDistance(
        touches[0].clientX,
        touches[0].clientY,
        touches[1].clientX,
        touches[1].clientY
      )
      eventData.scale = currentDistance / gestureState.current.initialDistance
    }

    // Calculate rotation for rotate gestures
    if (type === 'rotate' && touches.length === 2) {
      const currentAngle = calculateAngle(
        touches[0].clientX,
        touches[0].clientY,
        touches[1].clientX,
        touches[1].clientY
      )
      eventData.rotation = currentAngle - gestureState.current.initialAngle
    }

    return eventData
  }, [calculateDistance, calculateAngle])

  // Execute gesture handlers
  const executeHandlers = useCallback((type: GestureType, eventData: GestureEventData) => {
    const matchingHandlers = handlers.filter(handler =>
      handler.type === type && handler.enabled !== false
    )

    matchingHandlers.forEach(handler => {
      try {
        handler.handler(eventData)
      } catch (error) {
        console.error('Error in gesture handler:', error)
      }
    })

    // Trigger haptic feedback
    triggerHaptic(type)
  }, [handlers, triggerHaptic])

  // Touch start handler
  const handleTouchStart = useCallback((event: TouchEvent) => {
    const touch = event.touches[0]
    const now = Date.now()

    gestureState.current = {
      ...gestureState.current,
      isTracking: true,
      startTime: now,
      startPosition: { x: touch.clientX, y: touch.clientY },
      currentPosition: { x: touch.clientX, y: touch.clientY },
      touches: Array.from(event.touches),
    }

    // Set up long press timer
    if (mergedOptions.longPressDelay > 0) {
      gestureState.current.longPressTimer = setTimeout(() => {
        if (gestureState.current.isTracking) {
          const eventData = createGestureEvent(
            'longPress',
            gestureState.current.startTime,
            Date.now(),
            gestureState.current.touches,
            event.target as Element
          )
          executeHandlers('longPress', eventData)
        }
      }, mergedOptions.longPressDelay)
    }

    // Handle double tap
    const timeSinceLastTap = now - gestureState.current.lastTapTime
    if (timeSinceLastTap < mergedOptions.doubleTapDelay) {
      gestureState.current.tapCount++
      if (gestureState.current.tapCount === 2) {
        gestureState.current.doubleTapTimer = setTimeout(() => {
          const eventData = createGestureEvent(
            'doubleTap',
            gestureState.current.startTime,
            Date.now(),
            gestureState.current.touches,
            event.target as Element
          )
          executeHandlers('doubleTap', eventData)
          gestureState.current.tapCount = 0
        }, 50)
      }
    } else {
      gestureState.current.tapCount = 1
    }
    gestureState.current.lastTapTime = now

    // Store initial distance and angle for pinch/rotate
    if (event.touches.length === 2) {
      gestureState.current.initialDistance = calculateDistance(
        event.touches[0].clientX,
        event.touches[0].clientY,
        event.touches[1].clientX,
        event.touches[1].clientY
      )
      gestureState.current.initialAngle = calculateAngle(
        event.touches[0].clientX,
        event.touches[0].clientY,
        event.touches[1].clientX,
        event.touches[1].clientY
      )
    }

    if (mergedOptions.preventDefault) {
      event.preventDefault()
    }
    if (mergedOptions.stopPropagation) {
      event.stopPropagation()
    }
  }, [mergedOptions, createGestureEvent, executeHandlers, calculateDistance, calculateAngle])

  // Touch move handler
  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!gestureState.current.isTracking) return

    const touch = event.touches[0]
    gestureState.current.currentPosition = { x: touch.clientX, y: touch.clientY }
    gestureState.current.touches = Array.from(event.touches)

    // Clear long press timer on move
    if (gestureState.current.longPressTimer) {
      clearTimeout(gestureState.current.longPressTimer)
      gestureState.current.longPressTimer = null
    }

    // Handle pinch gesture
    if (event.touches.length === 2) {
      const currentDistance = calculateDistance(
        event.touches[0].clientX,
        event.touches[0].clientY,
        event.touches[1].clientX,
        event.touches[1].clientY
      )
      const scale = currentDistance / gestureState.current.initialDistance

      if (Math.abs(1 - scale) > mergedOptions.pinchThreshold / 100) {
        const eventData = createGestureEvent(
          'pinch',
          gestureState.current.startTime,
          Date.now(),
          gestureState.current.touches,
          event.target as Element
        )
        executeHandlers('pinch', eventData)
      }
    }

    // Handle rotate gesture
    if (event.touches.length === 2) {
      const currentAngle = calculateAngle(
        event.touches[0].clientX,
        event.touches[0].clientY,
        event.touches[1].clientX,
        event.touches[1].clientY
      )
      const rotation = currentAngle - gestureState.current.initialAngle

      if (Math.abs(rotation) > mergedOptions.rotationThreshold) {
        const eventData = createGestureEvent(
          'rotate',
          gestureState.current.startTime,
          Date.now(),
          gestureState.current.touches,
          event.target as Element
        )
        executeHandlers('rotate', eventData)
      }
    }

    if (mergedOptions.preventDefault) {
      event.preventDefault()
    }
    if (mergedOptions.stopPropagation) {
      event.stopPropagation()
    }
  }, [mergedOptions, createGestureEvent, executeHandlers, calculateDistance, calculateAngle])

  // Touch end handler
  const handleTouchEnd = useCallback((event: TouchEvent) => {
    if (!gestureState.current.isTracking) return

    const endTime = Date.now()
    const duration = endTime - gestureState.current.startTime
    const distance = calculateDistance(
      gestureState.current.startPosition.x,
      gestureState.current.startPosition.y,
      gestureState.current.currentPosition.x,
      gestureState.current.currentPosition.y
    )

    // Clear timers
    if (gestureState.current.longPressTimer) {
      clearTimeout(gestureState.current.longPressTimer)
      gestureState.current.longPressTimer = null
    }

    // Determine swipe direction
    if (distance > mergedOptions.swipeThreshold && duration < 500) {
      const deltaX = gestureState.current.currentPosition.x - gestureState.current.startPosition.x
      const deltaY = gestureState.current.currentPosition.y - gestureState.current.startPosition.y

      let swipeType: GestureType = 'custom'
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        swipeType = deltaX > 0 ? 'swipeRight' : 'swipeLeft'
      } else {
        swipeType = deltaY > 0 ? 'swipeDown' : 'swipeUp'
      }

      const eventData = createGestureEvent(
        swipeType,
        gestureState.current.startTime,
        endTime,
        gestureState.current.touches,
        event.target as Element
      )
      executeHandlers(swipeType, eventData)
    } else if (duration < 200 && distance < mergedOptions.threshold) {
      // Handle single tap (if not double tap)
      if (gestureState.current.tapCount === 1) {
        setTimeout(() => {
          if (gestureState.current.tapCount === 1) {
            const eventData = createGestureEvent(
              'tap',
              gestureState.current.startTime,
              endTime,
              gestureState.current.touches,
              event.target as Element
            )
            executeHandlers('tap', eventData)
            gestureState.current.tapCount = 0
          }
        }, mergedOptions.doubleTapDelay)
      }
    } else if (distance >= mergedOptions.threshold) {
      // Handle pan gesture
      const eventData = createGestureEvent(
        'pan',
        gestureState.current.startTime,
        endTime,
        gestureState.current.touches,
        event.target as Element
      )
      executeHandlers('pan', eventData)
    }

    // Reset state
    gestureState.current.isTracking = false
    gestureState.current.touches = []

    if (mergedOptions.preventDefault) {
      event.preventDefault()
    }
    if (mergedOptions.stopPropagation) {
      event.stopPropagation()
    }
  }, [mergedOptions, createGestureEvent, executeHandlers, calculateDistance])

  // Set up event listeners
  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const eventOptions: AddEventListenerOptions = {
      capture: mergedOptions.capture,
      passive: mergedOptions.passive
    }

    element.addEventListener('touchstart', handleTouchStart, eventOptions)
    element.addEventListener('touchmove', handleTouchMove, eventOptions)
    element.addEventListener('touchend', handleTouchEnd, eventOptions)
    element.addEventListener('touchcancel', handleTouchEnd, eventOptions)

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
      element.removeEventListener('touchcancel', handleTouchEnd)

      // Clear any pending timers
      if (gestureState.current.longPressTimer) {
        clearTimeout(gestureState.current.longPressTimer)
      }
      if (gestureState.current.doubleTapTimer) {
        clearTimeout(gestureState.current.doubleTapTimer)
      }
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd, mergedOptions])

  return {
    elementRef,
    gestureState: gestureState.current
  }
}

// Hook for swipe actions
export function useSwipeActions(
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  options: GestureOptions = {}
) {
  const handlers: GestureHandler[] = useMemo(() => {
    const result: GestureHandler[] = []

    if (onSwipeLeft) {
      result.push({ type: 'swipeLeft', handler: onSwipeLeft })
    }
    if (onSwipeRight) {
      result.push({ type: 'swipeRight', handler: onSwipeRight })
    }
    if (onSwipeUp) {
      result.push({ type: 'swipeUp', handler: onSwipeUp })
    }
    if (onSwipeDown) {
      result.push({ type: 'swipeDown', handler: onSwipeDown })
    }

    return result
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown])

  return useMobileGestures(handlers, options)
}

// Hook for tap and long press
export function useTapAndLongPress(
  onTap?: () => void,
  onLongPress?: () => void,
  options: GestureOptions = {}
) {
  const handlers: GestureHandler[] = useMemo(() => {
    const result: GestureHandler[] = []

    if (onTap) {
      result.push({ type: 'tap', handler: onTap })
    }
    if (onLongPress) {
      result.push({ type: 'longPress', handler: onLongPress })
    }

    return result
  }, [onTap, onLongPress])

  return useMobileGestures(handlers, options)
}

// Hook for pinch and zoom
export function usePinchToZoom(
  onPinch?: (scale: number) => void,
  options: GestureOptions = {}
) {
  const handlers: GestureHandler[] = useMemo(() => {
    if (!onPinch) return []

    return [{
      type: 'pinch',
      handler: (event) => {
        if (event.scale) {
          onPinch(event.scale)
        }
      }
    }]
  }, [onPinch])

  return useMobileGestures(handlers, options)
}

// Higher-order component for adding gestures
export function withGestures<P extends object>(
  Component: ComponentType<P>,
  handlers: GestureHandler[],
  options: GestureOptions = {}
) {
  return forwardRef<any, P>((props, ref) => {
    const { elementRef } = useMobileGestures(handlers, options)
    const combinedRef = useCallback((node: Element) => {
      if (typeof ref === 'function') {
        ref(node)
      } else if (ref) {
        ref.current = node
      }
      if (elementRef.current !== node) {
        elementRef.current = node
      }
    }, [ref, elementRef])

    return <Component {...(props as P)} ref={combinedRef} />
  })
}

// Gesture context for complex interactions
export const GestureContext = createContext<{
  addGesture: (handler: GestureHandler) => void
  removeGesture: (handler: GestureHandler) => void
  clearGestures: () => void
} | null>(null)

export function GestureProvider({ children }: { children: ReactNode }) {
  const [handlers, setHandlers] = useState<GestureHandler[]>([])

  const addGesture = useCallback((handler: GestureHandler) => {
    setHandlers(prev => [...prev, handler])
  }, [])

  const removeGesture = useCallback((handler: GestureHandler) => {
    setHandlers(prev => prev.filter(h => h !== handler))
  }, [])

  const clearGestures = useCallback(() => {
    setHandlers([])
  }, [])

  const value = useMemo(() => ({
    addGesture,
    removeGesture,
    clearGestures
  }), [addGesture, removeGesture, clearGestures])

  return (
    <GestureContext.Provider value={value}>
      {children}
    </GestureContext.Provider>
  )
}

export function useGestureContext() {
  const context = useContext(GestureContext)
  if (!context) {
    throw new Error('useGestureContext must be used within a GestureProvider')
  }
  return context
}
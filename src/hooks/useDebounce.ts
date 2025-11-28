import { useEffect, useState, useCallback, useRef } from 'react'

/**
 * Enhanced debounce hook with additional features for performance optimization
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = window.setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      window.clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

/**
 * Advanced debounce hook with callback support and cancellation
 */
export function useDebouncedCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number,
  deps: React.DependencyList = []
): [T, () => void] {
  const callbackRef = useRef(callback)
  const timeoutRef = useRef<NodeJS.Timeout>()

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback
  }, [callback, ...deps])

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args)
    }, delay)
  }, [delay]) as T

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return cancel
  }, [cancel])

  return [debouncedCallback, cancel]
}

/**
 * Hook for debounced search with immediate option for rapid clearing
 */
export function useDebouncedSearch(
  initialValue = '',
  options: {
    delay?: number
    immediateClear?: boolean
    minLength?: number
  } = {}
) {
  const {
    delay = 300,
    immediateClear = true,
    minLength = 2
  } = options

  const [value, setValue] = useState(initialValue)
  const [isDebouncing, setIsDebouncing] = useState(false)
  const debouncedValue = useDebounce(value, delay)

  // Track debouncing state
  useEffect(() => {
    if (value !== debouncedValue) {
      setIsDebouncing(true)
    } else {
      setIsDebouncing(false)
    }
  }, [value, debouncedValue])

  const setDebouncedValue = useCallback((newValue: string) => {
    setValue(newValue)

    // If clearing and immediateClear is enabled, update immediately
    if (newValue.length === 0 && immediateClear) {
      setIsDebouncing(false)
    }
  }, [immediateClear])

  const clear = useCallback(() => {
    setDebouncedValue('')
  }, [setDebouncedValue])

  return {
    value,
    debouncedValue,
    setValue: setDebouncedValue,
    clear,
    isDebouncing,
    canSearch: debouncedValue.length >= minLength
  }
}

/**
 * Performance monitoring for debounce operations
 */
export function useDebounceMetrics() {
  const metricsRef = useRef({
    totalOperations: 0,
    canceledOperations: 0,
    averageDelay: 0,
    totalDelay: 0
  })

  const recordOperation = useCallback((canceled: boolean, actualDelay: number) => {
    const metrics = metricsRef.current
    metrics.totalOperations++

    if (canceled) {
      metrics.canceledOperations++
    }

    metrics.totalDelay += actualDelay
    metrics.averageDelay = metrics.totalDelay / metrics.totalOperations

    // Log warnings if too many operations are being canceled
    if (metrics.totalOperations > 50 && metrics.canceledOperations / metrics.totalOperations > 0.7) {
      console.warn(`[DebounceMetrics] High cancellation rate: ${((metrics.canceledOperations / metrics.totalOperations) * 100).toFixed(1)}%`)
    }
  }, [])

  const getMetrics = useCallback(() => {
    const metrics = metricsRef.current
    return {
      ...metrics,
      cancellationRate: metrics.totalOperations > 0 ? (metrics.canceledOperations / metrics.totalOperations) * 100 : 0
    }
  }, [])

  return { recordOperation, getMetrics }
}

/**
 * Hook for adaptive debounce delay based on typing patterns
 */
export function useAdaptiveDebounce(initialValue = '', baseDelay = 300) {
  const [value, setValue] = useState(initialValue)
  const [adaptiveDelay, setAdaptiveDelay] = useState(baseDelay)
  const typingSpeedRef = useRef({
    lastKeystroke: Date.now(),
    keystrokeCount: 0,
    averageInterval: 200
  })

  // Adaptive delay logic
  const handleValueChange = useCallback((newValue: string) => {
    const now = Date.now()
    const interval = now - typingSpeedRef.current.lastKeystroke

    if (typingSpeedRef.current.keystrokeCount > 0) {
      // Update average interval
      const metrics = typingSpeedRef.current
      metrics.averageInterval = (metrics.averageInterval * 0.8) + (interval * 0.2)

      // Adjust delay based on typing speed
      if (metrics.averageInterval < 50) {
        // Fast typing - increase delay
        setAdaptiveDelay(baseDelay * 1.5)
      } else if (metrics.averageInterval > 500) {
        // Slow typing - decrease delay
        setAdaptiveDelay(baseDelay * 0.7)
      } else {
        // Normal typing - use base delay
        setAdaptiveDelay(baseDelay)
      }
    }

    typingSpeedRef.current.lastKeystroke = now
    typingSpeedRef.current.keystrokeCount++
    setValue(newValue)
  }, [baseDelay])

  const debouncedValue = useDebounce(value, adaptiveDelay)

  return {
    value,
    debouncedValue,
    setValue: handleValueChange,
    adaptiveDelay
  }
}


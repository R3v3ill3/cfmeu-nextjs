"use client"

import React, { ReactNode, useCallback, useContext, createContext, forwardRef, ComponentType } from 'react'

// Types for haptic feedback
export type HapticType =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error"
  | "selection"
  | "impact"

// Check if the device supports haptic feedback
export function supportsHapticFeedback(): boolean {
  return (
    typeof window !== "undefined" &&
    "vibrate" in navigator &&
    navigator.vibrate !== undefined
  )
}

// Vibration patterns for different feedback types
const vibrationPatterns: Record<HapticType, number[]> = {
  light: [10],
  medium: [25],
  heavy: [50],
  success: [10, 50, 10],
  warning: [25, 25, 25],
  error: [50, 30, 50, 30, 50],
  selection: [5],
  impact: [15],
}

// Map haptic types to iOS feedback if available (for iPhone)
const iosFeedbackTypes: Record<HapticType, string> = {
  light: "HapticFeedback.impactLight()",
  medium: "HapticFeedback.impactMedium()",
  heavy: "HapticFeedback.impactHeavy()",
  success: "HapticFeedback.notificationSuccess()",
  warning: "HapticFeedback.notificationWarning()",
  error: "HapticFeedback.notificationError()",
  selection: "HapticFeedback.selectionChanged()",
  impact: "HapticFeedback.impactMedium()",
}

// Core haptic feedback function
export function triggerHapticFeedback(type: HapticType = "light"): void {
  if (!supportsHapticFeedback()) return

  try {
    // Use Web Vibration API as fallback
    const pattern = vibrationPatterns[type]
    if (pattern && pattern.length > 0) {
      navigator.vibrate(pattern)
    }

    // For iOS devices, try to use native haptic feedback through a bridge
    // This would need to be implemented in a native app or through capacitor/cordova
    if (window.webkit?.messageHandlers?.hapticFeedback) {
      window.webkit.messageHandlers.hapticFeedback.postMessage({
        type: iosFeedbackTypes[type],
      })
    }
  } catch (error) {
    // Silently fail if haptic feedback is not available
    console.debug("Haptic feedback not available:", error)
  }
}

// React hook for haptic feedback
export function useHapticFeedback() {
  const trigger = useCallback((type: HapticType = "light") => {
    triggerHapticFeedback(type)
  }, [])

  return {
    trigger,
    light: () => trigger("light"),
    medium: () => trigger("medium"),
    heavy: () => trigger("heavy"),
    success: () => trigger("success"),
    warning: () => trigger("warning"),
    error: () => trigger("error"),
    selection: () => trigger("selection"),
    impact: () => trigger("impact"),
  }
}

// React component that provides haptic feedback context
interface HapticFeedbackContextValue {
  trigger: (type?: HapticType) => void
  light: () => void
  medium: () => void
  heavy: () => void
  success: () => void
  warning: () => void
  error: () => void
  selection: () => void
  impact: () => void
}

const HapticFeedbackContext = createContext<HapticFeedbackContextValue | null>(null)

export function HapticFeedbackProvider({
  children,
}: {
  children: ReactNode
}) {
  const haptic = useHapticFeedback()

  return (
    <HapticFeedbackContext.Provider value={haptic}>
      {children}
    </HapticFeedbackContext.Provider>
  )
}

export function useHapticContext() {
  const context = useContext(HapticFeedbackContext)
  if (!context) {
    throw new Error("useHapticContext must be used within a HapticFeedbackProvider")
  }
  return context
}

// Higher-order component for adding haptic feedback to button presses
export function withHapticFeedback<P extends object>(
  Component: ComponentType<P>,
  hapticType: HapticType = "light"
) {
  return forwardRef<any, P>((props, ref) => {
    const { trigger } = useHapticFeedback()

    const handleClick = useCallback((event: any) => {
      trigger(hapticType)

      // Call original onClick if it exists
      const onClick = (props as any).onClick
      if (onClick) {
        onClick(event)
      }
    }, [trigger, props])

    return <Component {...props} onClick={handleClick} ref={ref} />
  })
}

// Utility functions for common interactions
export const haptic = {
  onPress: () => triggerHapticFeedback("light"),
  onLongPress: () => triggerHapticFeedback("medium"),
  onSwipe: () => triggerHapticFeedback("light"),
  onSuccess: () => triggerHapticFeedback("success"),
  onError: () => triggerHapticFeedback("error"),
  onWarning: () => triggerHapticFeedback("warning"),
  onSelectionChange: () => triggerHapticFeedback("selection"),
  onImpact: () => triggerHapticFeedback("impact"),
}

// Add TypeScript declaration for webkit message handlers
declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        hapticFeedback?: {
          postMessage: (message: { type: string }) => void
        }
      }
    }
  }
}
"use client"

import { useCallback, useEffect, useRef, useState } from "react"

interface KeyboardState {
  isVisible: boolean
  height: number
  viewportHeight: number
  safeAreaInsets: {
    top: number
    right: number
    bottom: number
    left: number
  }
}

interface KeyboardOptions {
  enableAutoScroll?: boolean
  scrollOffset?: number
  enableDismissOnScroll?: boolean
  enableDismissOnTapOutside?: boolean
  onKeyboardShow?: (keyboardHeight: number) => void
  onKeyboardHide?: () => void
}

interface UseMobileKeyboardReturn {
  keyboardState: KeyboardState
  scrollToInput: (element: HTMLElement | null) => void
  dismissKeyboard: () => void
  isInputVisible: (element: HTMLElement | null) => boolean
  getInputPosition: (element: HTMLElement | null) => {
    top: number
    bottom: number
    isHidden: boolean
  } | null
}

export function useMobileKeyboard(options: KeyboardOptions = {}): UseMobileKeyboardReturn {
  const {
    enableAutoScroll = true,
    scrollOffset = 20,
    enableDismissOnScroll = true,
    enableDismissOnTapOutside = true,
    onKeyboardShow,
    onKeyboardHide
  } = options

  const [keyboardState, setKeyboardState] = useState<KeyboardState>({
    isVisible: false,
    height: 0,
    viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 0,
    safeAreaInsets: { top: 0, right: 0, bottom: 0, left: 0 }
  })

  const initialViewportHeight = useRef<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  )
  const focusedInputRef = useRef<HTMLElement | null>(null)

  // Calculate safe area insets (for iOS devices with notches)
  const calculateSafeAreaInsets = useCallback(() => {
    if (typeof window === 'undefined') return { top: 0, right: 0, bottom: 0, left: 0 }

    const style = getComputedStyle(document.documentElement)
    return {
      top: parseInt(style.getPropertyValue('safe-area-inset-top') || '0'),
      right: parseInt(style.getPropertyValue('safe-area-inset-right') || '0'),
      bottom: parseInt(style.getPropertyValue('safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('safe-area-inset-left') || '0')
    }
  }, [])

  // Detect keyboard appearance/disappearance
  const detectKeyboard = useCallback(() => {
    if (typeof window === 'undefined') return

    const currentViewportHeight = window.innerHeight
    const heightDifference = initialViewportHeight.current - currentViewportHeight
    const isVisible = heightDifference > 150 // Keyboard typically takes at least 150px

    const safeAreaInsets = calculateSafeAreaInsets()

    setKeyboardState(prev => ({
      ...prev,
      isVisible,
      height: isVisible ? heightDifference : 0,
      viewportHeight: currentViewportHeight,
      safeAreaInsets
    }))

    if (isVisible) {
      onKeyboardShow?.(heightDifference)
    } else {
      onKeyboardHide?.()
    }
  }, [calculateSafeAreaInsets, onKeyboardShow, onKeyboardHide])

  // Check if an input is visible in viewport
  const isInputVisible = useCallback((element: HTMLElement | null): boolean => {
    if (!element || !keyboardState.isVisible) return true

    const rect = element.getBoundingClientRect()
    const keyboardTop = window.innerHeight - keyboardState.height
    const safeAreaBottom = keyboardState.safeAreaInsets.bottom

    return rect.bottom < (keyboardTop - safeAreaBottom - scrollOffset)
  }, [keyboardState, scrollOffset])

  // Get input position relative to viewport and keyboard
  const getInputPosition = useCallback((element: HTMLElement | null) => {
    if (!element) return null

    const rect = element.getBoundingClientRect()
    const keyboardTop = window.innerHeight - keyboardState.height
    const safeAreaBottom = keyboardState.safeAreaInsets.bottom

    return {
      top: rect.top,
      bottom: rect.bottom,
      isHidden: rect.bottom >= (keyboardTop - safeAreaBottom - scrollOffset)
    }
  }, [keyboardState, scrollOffset])

  // Scroll to input if it's hidden by keyboard
  const scrollToInput = useCallback((element: HTMLElement | null) => {
    if (!element || !enableAutoScroll || !keyboardState.isVisible) return

    const position = getInputPosition(element)
    if (!position || !position.isHidden) return

    const keyboardTop = window.innerHeight - keyboardState.height
    const safeAreaBottom = keyboardState.safeAreaInsets.bottom
    const targetScrollPosition = element.offsetTop - (keyboardTop - safeAreaBottom - element.offsetHeight - scrollOffset)

    // Smooth scroll to the input
    window.scrollTo({
      top: Math.max(0, targetScrollPosition),
      behavior: 'smooth'
    })
  }, [enableAutoScroll, keyboardState, scrollOffset, getInputPosition])

  // Dismiss keyboard
  const dismissKeyboard = useCallback(() => {
    if (focusedInputRef.current && typeof focusedInputRef.current.blur === 'function') {
      focusedInputRef.current.blur()
    }
    focusedInputRef.current = null
  }, [])

  // Handle input focus events
  const handleInputFocus = useCallback((event: FocusEvent) => {
    const target = event.target as HTMLElement
    focusedInputRef.current = target

    // Only apply to input elements
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      // Delay scroll to allow keyboard to appear
      setTimeout(() => {
        scrollToInput(target)
      }, 300)
    }
  }, [scrollToInput])

  // Handle input blur events
  const handleInputBlur = useCallback(() => {
    setTimeout(() => {
      focusedInputRef.current = null
    }, 100)
  }, [])

  // Handle scroll events for keyboard dismissal
  const handleScroll = useCallback(() => {
    if (enableDismissOnScroll && keyboardState.isVisible) {
      dismissKeyboard()
    }
  }, [enableDismissOnScroll, keyboardState.isVisible, dismissKeyboard])

  // Handle tap outside to dismiss keyboard
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!enableDismissOnTapOutside || !keyboardState.isVisible) return

    const target = event.target as HTMLElement
    const isInputElement = target.tagName === 'INPUT' ||
                          target.tagName === 'TEXTAREA' ||
                          target.contentEditable === 'true' ||
                          target.closest('input, textarea, [contenteditable="true"]')

    if (!isInputElement) {
      dismissKeyboard()
    }
  }, [enableDismissOnTapOutside, keyboardState.isVisible, dismissKeyboard])

  // Handle resize events (keyboard show/hide)
  const handleResize = useCallback(() => {
    detectKeyboard()
  }, [detectKeyboard])

  // Set up event listeners
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Initialize viewport height
    initialViewportHeight.current = window.innerHeight

    // Add event listeners
    window.addEventListener('resize', handleResize, { passive: true })
    document.addEventListener('focusin', handleInputFocus, { passive: true })
    document.addEventListener('focusout', handleInputBlur, { passive: true })

    if (enableDismissOnScroll) {
      window.addEventListener('scroll', handleScroll, { passive: true })
    }

    if (enableDismissOnTapOutside) {
      document.addEventListener('touchstart', handleTouchStart, { passive: true })
    }

    // Visual Viewport API for more accurate keyboard detection (if available)
    if ('visualViewport' in window) {
      const visualViewport = (window as any).visualViewport
      visualViewport.addEventListener('resize', handleResize, { passive: true })
    }

    return () => {
      window.removeEventListener('resize', handleResize)
      document.removeEventListener('focusin', handleInputFocus)
      document.removeEventListener('focusout', handleInputBlur)

      if (enableDismissOnScroll) {
        window.removeEventListener('scroll', handleScroll)
      }

      if (enableDismissOnTapOutside) {
        document.removeEventListener('touchstart', handleTouchStart)
      }

      if ('visualViewport' in window) {
        const visualViewport = (window as any).visualViewport
        visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [handleResize, handleInputFocus, handleInputBlur, handleScroll, handleTouchStart, enableDismissOnScroll, enableDismissOnTapOutside])

  return {
    keyboardState,
    scrollToInput,
    dismissKeyboard,
    isInputVisible,
    getInputPosition
  }
}
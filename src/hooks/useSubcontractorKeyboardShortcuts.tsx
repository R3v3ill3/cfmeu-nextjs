"use client"

import React, { useEffect, useCallback, useRef, ComponentType } from 'react'
import { toast } from 'sonner'

interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  description: string
  action: () => void
  enabled?: boolean
  category?: 'navigation' | 'actions' | 'forms' | 'modals'
  preventDefault?: boolean
  stopPropagation?: boolean
}

interface UseSubcontractorKeyboardShortcutsOptions {
  enabled?: boolean
  onShortcutTriggered?: (shortcut: KeyboardShortcut) => void
  onShortcutError?: (error: string, shortcut: KeyboardShortcut) => void
  showToastOnError?: boolean
}

interface ShortcutRegistration {
  id: string
  shortcut: KeyboardShortcut
}

export function useSubcontractorKeyboardShortcuts(options: UseSubcontractorKeyboardShortcutsOptions = {}) {
  const {
    enabled = true,
    onShortcutTriggered,
    onShortcutError,
    showToastOnError = true
  } = options

  const shortcutsRef = useRef<Map<string, ShortcutRegistration>>(new Map())
  const isEnabledRef = useRef(enabled)

  // Update enabled state
  useEffect(() => {
    isEnabledRef.current = enabled
  }, [enabled])

  // Generate a unique key for a shortcut combination
  const getShortcutKey = useCallback((shortcut: KeyboardShortcut): string => {
    const parts = []
    if (shortcut.ctrlKey) parts.push('ctrl')
    if (shortcut.shiftKey) parts.push('shift')
    if (shortcut.altKey) parts.push('alt')
    if (shortcut.metaKey) parts.push('meta')
    parts.push(shortcut.key.toLowerCase())
    return parts.join('+')
  }, [])

  // Check if an event matches a shortcut
  const matchesShortcut = useCallback((event: KeyboardEvent, shortcut: KeyboardShortcut): boolean => {
    const isCtrl = event.ctrlKey || event.metaKey // Treat Cmd as Ctrl on Mac
    const isCorrectModifiers =
      isCtrl === (shortcut.ctrlKey || false) &&
      event.shiftKey === (shortcut.shiftKey || false) &&
      event.altKey === (shortcut.altKey || false) &&
      event.metaKey === (shortcut.metaKey || false)

    return isCorrectModifiers && event.key.toLowerCase() === shortcut.key.toLowerCase()
  }, [])

  // Check if we should ignore the event (typing in input, etc.)
  const shouldIgnoreEvent = useCallback((event: KeyboardEvent): boolean => {
    const target = event.target as HTMLElement

    // Ignore when typing in inputs, textareas, or contenteditable elements
    if (target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable) {
      return true
    }

    // Ignore when focusing on certain elements
    if (target.closest('[data-no-shortcuts="true"]')) {
      return true
    }

    return false
  }, [])

  // Register a keyboard shortcut
  const registerShortcut = useCallback((id: string, shortcut: KeyboardShortcut) => {
    const key = getShortcutKey(shortcut)
    shortcutsRef.current.set(id, { id, shortcut })

    return () => {
      shortcutsRef.current.delete(id)
    }
  }, [getShortcutKey])

  // Unregister a keyboard shortcut
  const unregisterShortcut = useCallback((id: string) => {
    shortcutsRef.current.delete(id)
  }, [])

  // Clear all shortcuts
  const clearShortcuts = useCallback(() => {
    shortcutsRef.current.clear()
  }, [])

  // Get all registered shortcuts
  const getShortcuts = useCallback((): ShortcutRegistration[] => {
    return Array.from(shortcutsRef.current.values())
  }, [])

  // Get shortcuts by category
  const getShortcutsByCategory = useCallback((category: KeyboardShortcut['category']): ShortcutRegistration[] => {
    return Array.from(shortcutsRef.current.values())
      .filter(reg => reg.shortcut.category === category)
  }, [])

  // Trigger a shortcut programmatically
  const triggerShortcut = useCallback((id: string) => {
    const registration = shortcutsRef.current.get(id)
    if (registration && registration.shortcut.enabled !== false) {
      try {
        registration.shortcut.action()
        onShortcutTriggered?.(registration.shortcut)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        onShortcutError?.(errorMessage, registration.shortcut)
        if (showToastOnError) {
          toast.error('Shortcut Error', {
            description: `Failed to execute "${registration.shortcut.description}": ${errorMessage}`
          })
        }
      }
    }
  }, [onShortcutTriggered, onShortcutError, showToastOnError])

  // Main keyboard event handler
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!isEnabledRef.current || shouldIgnoreEvent(event)) {
      return
    }

    // Find matching shortcut
    let matchingRegistration: ShortcutRegistration | null = null

    for (const registration of shortcutsRef.current.values()) {
      if (registration.shortcut.enabled === false) continue
      if (matchesShortcut(event, registration.shortcut)) {
        matchingRegistration = registration
        break
      }
    }

    if (matchingRegistration) {
      const { shortcut } = matchingRegistration

      // Prevent default behavior if specified
      if (shortcut.preventDefault !== false) {
        event.preventDefault()
      }

      // Stop propagation if specified
      if (shortcut.stopPropagation === true) {
        event.stopPropagation()
      }

      try {
        // Execute the action
        shortcut.action()
        onShortcutTriggered?.(shortcut)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        onShortcutError?.(errorMessage, shortcut)
        if (showToastOnError) {
          toast.error('Shortcut Error', {
            description: `Failed to execute "${shortcut.description}": ${errorMessage}`
          })
        }
      }
    }
  }, [matchesShortcut, shouldIgnoreEvent, onShortcutTriggered, onShortcutError, showToastOnError])

  // Set up keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Predefined shortcuts for common subcontractor review actions
  const createSubcontractorShortcuts = useCallback((actions: {
    onSelectNextRow?: () => void
    onSelectPreviousRow?: () => void
    onOpenAliasManagement?: () => void
    onOpenEbaSearch?: () => void
    onSuggestAlias?: () => void
    onToggleQuickActions?: () => void
    onCloseModals?: () => void
    onConfirmAction?: () => void
    onShowHelp?: () => void
  }) => {
    const shortcuts: Array<{ id: string; shortcut: KeyboardShortcut }> = []

    if (actions.onSelectNextRow) {
      shortcuts.push({
        id: 'select-next-row',
        shortcut: {
          key: 'ArrowDown',
          description: 'Select next row',
          action: actions.onSelectNextRow,
          category: 'navigation',
          preventDefault: true
        }
      })
    }

    if (actions.onSelectPreviousRow) {
      shortcuts.push({
        id: 'select-previous-row',
        shortcut: {
          key: 'ArrowUp',
          description: 'Select previous row',
          action: actions.onSelectPreviousRow,
          category: 'navigation',
          preventDefault: true
        }
      })
    }

    if (actions.onOpenAliasManagement) {
      shortcuts.push({
        id: 'open-alias-management',
        shortcut: {
          key: 'a',
          ctrlKey: true,
          description: 'Open alias management',
          action: actions.onOpenAliasManagement,
          category: 'actions'
        }
      })
    }

    if (actions.onOpenEbaSearch) {
      shortcuts.push({
        id: 'open-eba-search',
        shortcut: {
          key: 'e',
          ctrlKey: true,
          description: 'Open EBA search',
          action: actions.onOpenEbaSearch,
          category: 'actions'
        }
      })
    }

    if (actions.onSuggestAlias) {
      shortcuts.push({
        id: 'suggest-alias',
        shortcut: {
          key: 's',
          ctrlKey: true,
          shiftKey: true,
          description: 'Suggest alias',
          action: actions.onSuggestAlias,
          category: 'actions'
        }
      })
    }

    if (actions.onToggleQuickActions) {
      shortcuts.push({
        id: 'toggle-quick-actions',
        shortcut: {
          key: 'k',
          ctrlKey: true,
          description: 'Toggle quick actions',
          action: actions.onToggleQuickActions,
          category: 'navigation'
        }
      })
    }

    if (actions.onCloseModals) {
      shortcuts.push({
        id: 'close-modals',
        shortcut: {
          key: 'Escape',
          description: 'Close modals',
          action: actions.onCloseModals,
          category: 'modals'
        }
      })
    }

    if (actions.onConfirmAction) {
      shortcuts.push({
        id: 'confirm-action',
        shortcut: {
          key: 'Enter',
          description: 'Confirm action',
          action: actions.onConfirmAction,
          category: 'forms'
        }
      })
    }

    if (actions.onShowHelp) {
      shortcuts.push({
        id: 'show-help',
        shortcut: {
          key: '?',
          description: 'Show keyboard shortcuts',
          action: actions.onShowHelp,
          category: 'navigation'
        }
      })
    }

    // Register all shortcuts
    const unregisers = shortcuts.map(({ id, shortcut }) => registerShortcut(id, shortcut))

    // Return cleanup function
    return () => {
      unregisers.forEach(unregister => unregister())
    }
  }, [registerShortcut])

  // Accessibility helper: announce keyboard shortcuts to screen readers
  const announceShortcut = useCallback((shortcut: KeyboardShortcut) => {
    const announcement = `Keyboard shortcut: ${shortcut.description}`

    // Create a live region for screen readers
    const liveRegion = document.createElement('div')
    liveRegion.setAttribute('aria-live', 'polite')
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    liveRegion.textContent = announcement

    document.body.appendChild(liveRegion)

    // Remove after announcement
    setTimeout(() => {
      document.body.removeChild(liveRegion)
    }, 1000)
  }, [])

  // Export shortcut configuration for display purposes
  const getShortcutConfig = useCallback(() => {
    return Array.from(shortcutsRef.current.values()).map(reg => ({
      id: reg.id,
      key: reg.shortcut.key,
      ctrlKey: reg.shortcut.ctrlKey,
      shiftKey: reg.shortcut.shiftKey,
      altKey: reg.shortcut.altKey,
      metaKey: reg.shortcut.metaKey,
      description: reg.shortcut.description,
      category: reg.shortcut.category,
      enabled: reg.shortcut.enabled !== false
    }))
  }, [])

  return {
    registerShortcut,
    unregisterShortcut,
    clearShortcuts,
    getShortcuts,
    getShortcutsByCategory,
    triggerShortcut,
    createSubcontractorShortcuts,
    announceShortcut,
    getShortcutConfig,
    // Convenience method for checking if shortcuts are enabled
    isEnabled: () => isEnabledRef.current,
    // Method to temporarily disable shortcuts
    setEnabled: (enabled: boolean) => {
      isEnabledRef.current = enabled
    }
  }
}

// Higher-order component for adding keyboard shortcuts to components
export function withKeyboardShortcuts<P extends object>(
  Component: ComponentType<P>,
  shortcuts: Array<{ id: string; shortcut: KeyboardShortcut }>
) {
  return function WithKeyboardShortcuts(props: P) {
    const { registerShortcut, clearShortcuts } = useSubcontractorKeyboardShortcuts()

    useEffect(() => {
      const unregisers = shortcuts.map(({ id, shortcut }) =>
        registerShortcut(id, shortcut)
      )

      return () => {
        unregisers.forEach(unregister => unregister())
      }
    }, [registerShortcut])

    return <Component {...props} />
  }
}

// Hook for persisting user keyboard shortcut preferences
export function useKeyboardShortcutPreferences() {
  const getPreferences = useCallback(() => {
    if (typeof window === 'undefined') return {}

    try {
      const stored = localStorage.getItem('subcontractor-keyboard-preferences')
      return stored ? JSON.parse(stored) : {}
    } catch {
      return {}
    }
  }, [])

  const setPreference = useCallback((key: string, value: any) => {
    if (typeof window === 'undefined') return

    try {
      const preferences = getPreferences()
      preferences[key] = value
      localStorage.setItem('subcontractor-keyboard-preferences', JSON.stringify(preferences))
    } catch (error) {
      console.error('Failed to save keyboard shortcut preference:', error)
    }
  }, [getPreferences])

  const getPreference = useCallback((key: string, defaultValue: any = null) => {
    const preferences = getPreferences()
    return preferences[key] !== undefined ? preferences[key] : defaultValue
  }, [getPreferences])

  const resetPreferences = useCallback(() => {
    if (typeof window === 'undefined') return

    try {
      localStorage.removeItem('subcontractor-keyboard-preferences')
    } catch (error) {
      console.error('Failed to reset keyboard shortcut preferences:', error)
    }
  }, [])

  return {
    getPreference,
    setPreference,
    getPreferences,
    resetPreferences
  }
}
"use client"

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'

interface ViewPreferences {
  defaultView: 'compact' | 'detailed' | 'table'
  showProgressIndicators: boolean
  showKeyboardShortcuts: boolean
  showGuidance: boolean
  showQuickActions: boolean
  autoExpandSections: boolean
  colorCodeRows: boolean
  showRowNumbers: boolean
}

interface WorkflowPreferences {
  autoSave: boolean
  autoAdvanceOnComplete: boolean
  confirmDestructiveActions: boolean
  showTooltips: boolean
  enableSounds: boolean
  animationSpeed: 'fast' | 'normal' | 'slow'
  bulkActionThreshold: number
  defaultActionOnMatch: 'import' | 'skip' | 'review'
}

interface AliasPreferences {
  autoSuggestAliases: boolean
  minConfidenceForSuggestion: number
  showAliasConfidence: boolean
  enableBulkAliasOperations: boolean
  defaultAliasSource: 'manual' | 'scan' | 'both'
  aliasConflictResolution: 'skip' | 'overwrite' | 'merge'
}

interface EbaPreferences {
  autoSearchEba: boolean
  batchEbaSearch: boolean
  defaultEbaStatus: 'active' | 'inactive' | 'unknown'
  showEbaExpiry: boolean
  ebaWarningDays: number
  preferFwcResults: boolean
  autoUpdateEbaStatus: boolean
}

interface AccessibilityPreferences {
  highContrast: boolean
  largeText: boolean
  reduceMotion: boolean
  screenReaderOptimized: boolean
  keyboardNavigation: boolean
  focusVisible: boolean
  colorBlindFriendly: boolean
}

interface KeyboardPreferences {
  customShortcuts: Record<string, string>
  enableCustomShortcuts: boolean
  showShortcutHints: boolean
  shortcutCategories: Array<{
    name: string
    enabled: boolean
    shortcuts: Array<{
      id: string
      keys: string
      description: string
      enabled: boolean
    }>
  }>
}

interface PerformancePreferences {
  enableVirtualization: boolean
  enableCaching: boolean
  enableLazyLoading: boolean
  cacheSize: number
  batchSize: number
  prefetchData: boolean
  enablePerformanceMonitoring: boolean
  maxConcurrentRequests: number
}

interface SubcontractorReviewPreferences {
  view: ViewPreferences
  workflow: WorkflowPreferences
  aliases: AliasPreferences
  eba: EbaPreferences
  accessibility: AccessibilityPreferences
  keyboard: KeyboardPreferences
  performance: PerformancePreferences
  lastUpdated: string
  version: string
}

const DEFAULT_PREFERENCES: SubcontractorReviewPreferences = {
  view: {
    defaultView: 'detailed',
    showProgressIndicators: true,
    showKeyboardShortcuts: true,
    showGuidance: true,
    showQuickActions: true,
    autoExpandSections: false,
    colorCodeRows: true,
    showRowNumbers: false
  },
  workflow: {
    autoSave: true,
    autoAdvanceOnComplete: false,
    confirmDestructiveActions: true,
    showTooltips: true,
    enableSounds: false,
    animationSpeed: 'normal',
    bulkActionThreshold: 10,
    defaultActionOnMatch: 'review'
  },
  aliases: {
    autoSuggestAliases: true,
    minConfidenceForSuggestion: 0.7,
    showAliasConfidence: true,
    enableBulkAliasOperations: true,
    defaultAliasSource: 'both',
    aliasConflictResolution: 'skip'
  },
  eba: {
    autoSearchEba: false,
    batchEbaSearch: true,
    defaultEbaStatus: 'unknown',
    showEbaExpiry: true,
    ebaWarningDays: 30,
    preferFwcResults: true,
    autoUpdateEbaStatus: false
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    reduceMotion: false,
    screenReaderOptimized: false,
    keyboardNavigation: true,
    focusVisible: true,
    colorBlindFriendly: false
  },
  keyboard: {
    customShortcuts: {},
    enableCustomShortcuts: false,
    showShortcutHints: true,
    shortcutCategories: [
      {
        name: 'navigation',
        enabled: true,
        shortcuts: [
          { id: 'next-row', keys: 'ArrowDown', description: 'Select next row', enabled: true },
          { id: 'prev-row', keys: 'ArrowUp', description: 'Select previous row', enabled: true }
        ]
      },
      {
        name: 'actions',
        enabled: true,
        shortcuts: [
          { id: 'open-aliases', keys: 'Ctrl+A', description: 'Open alias management', enabled: true },
          { id: 'open-eba', keys: 'Ctrl+E', description: 'Open EBA search', enabled: true }
        ]
      }
    ]
  },
  performance: {
    enableVirtualization: true,
    enableCaching: true,
    enableLazyLoading: true,
    cacheSize: 200,
    batchSize: 50,
    prefetchData: false,
    enablePerformanceMonitoring: false,
    maxConcurrentRequests: 5
  },
  lastUpdated: new Date().toISOString(),
  version: '1.0.0'
}

export function useSubcontractorReviewPreferences() {
  const [preferences, setPreferences] = useState<SubcontractorReviewPreferences>(DEFAULT_PREFERENCES)
  const [isLoading, setIsLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  // Load preferences from localStorage
  useEffect(() => {
    const loadPreferences = () => {
      try {
        const stored = localStorage.getItem('subcontractor-review-preferences')
        if (stored) {
          const parsed = JSON.parse(stored)
          // Merge with defaults to ensure all properties exist
          const merged = mergeWithDefaults(parsed, DEFAULT_PREFERENCES)
          setPreferences(merged)
        }
      } catch (error) {
        console.error('Failed to load preferences:', error)
        toast.error('Could not load preferences', {
          description: 'Using default settings instead'
        })
      } finally {
        setIsLoading(false)
      }
    }

    loadPreferences()
  }, [])

  // Save preferences to localStorage
  const savePreferences = useCallback((updatedPreferences: Partial<SubcontractorReviewPreferences>) => {
    try {
      const newPreferences = {
        ...preferences,
        ...updatedPreferences,
        lastUpdated: new Date().toISOString()
      }

      setPreferences(newPreferences)
      localStorage.setItem('subcontractor-review-preferences', JSON.stringify(newPreferences))
      setIsDirty(false)

      toast.success('Preferences saved', {
        description: 'Your settings have been updated'
      })
    } catch (error) {
      console.error('Failed to save preferences:', error)
      toast.error('Could not save preferences', {
        description: 'Your changes may not be preserved'
      })
    }
  }, [preferences])

  // Merge loaded preferences with defaults
  const mergeWithDefaults = (loaded: any, defaults: SubcontractorReviewPreferences): SubcontractorReviewPreferences => {
    const merged = { ...defaults }

    Object.keys(defaults).forEach(key => {
      const defaultValue = defaults[key as keyof SubcontractorReviewPreferences]
      const loadedValue = loaded[key]

      if (typeof defaultValue === 'object' && defaultValue !== null && !Array.isArray(defaultValue)) {
        merged[key as keyof SubcontractorReviewPreferences] = {
          ...defaultValue,
          ...(loadedValue || {})
        } as any
      } else {
        merged[key as keyof SubcontractorReviewPreferences] = loadedValue !== undefined ? loadedValue : defaultValue
      }
    })

    return merged
  }

  // Update a specific preference section
  const updateViewPreferences = useCallback((updates: Partial<ViewPreferences>) => {
    savePreferences({
      view: { ...preferences.view, ...updates }
    })
  }, [preferences.view, savePreferences])

  const updateWorkflowPreferences = useCallback((updates: Partial<WorkflowPreferences>) => {
    savePreferences({
      workflow: { ...preferences.workflow, ...updates }
    })
  }, [preferences.workflow, savePreferences])

  const updateAliasPreferences = useCallback((updates: Partial<AliasPreferences>) => {
    savePreferences({
      aliases: { ...preferences.aliases, ...updates }
    })
  }, [preferences.aliases, savePreferences])

  const updateEbaPreferences = useCallback((updates: Partial<EbaPreferences>) => {
    savePreferences({
      eba: { ...preferences.eba, ...updates }
    })
  }, [preferences.eba, savePreferences])

  const updateAccessibilityPreferences = useCallback((updates: Partial<AccessibilityPreferences>) => {
    savePreferences({
      accessibility: { ...preferences.accessibility, ...updates }
    })
  }, [preferences.accessibility, savePreferences])

  const updateKeyboardPreferences = useCallback((updates: Partial<KeyboardPreferences>) => {
    savePreferences({
      keyboard: { ...preferences.keyboard, ...updates }
    })
  }, [preferences.keyboard, savePreferences])

  const updatePerformancePreferences = useCallback((updates: Partial<PerformancePreferences>) => {
    savePreferences({
      performance: { ...preferences.performance, ...updates }
    })
  }, [preferences.performance, savePreferences])

  // Reset preferences to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    localStorage.setItem('subcontractor-review-preferences', JSON.stringify(DEFAULT_PREFERENCES))
    setIsDirty(false)

    toast.success('Preferences reset', {
      description: 'All settings have been restored to defaults'
    })
  }, [])

  // Export preferences for backup
  const exportPreferences = useCallback(() => {
    try {
      const dataStr = JSON.stringify(preferences, null, 2)
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

      const exportFileDefaultName = `subcontractor-review-preferences-${new Date().toISOString().split('T')[0]}.json`

      const linkElement = document.createElement('a')
      linkElement.setAttribute('href', dataUri)
      linkElement.setAttribute('download', exportFileDefaultName)
      linkElement.click()

      toast.success('Preferences exported', {
        description: 'Your settings have been downloaded'
      })
    } catch (error) {
      toast.error('Export failed', {
        description: 'Could not export preferences'
      })
    }
  }, [preferences])

  // Import preferences from file
  const importPreferences = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string)
        const merged = mergeWithDefaults(imported, DEFAULT_PREFERENCES)
        setPreferences(merged)
        localStorage.setItem('subcontractor-review-preferences', JSON.stringify(merged))

        toast.success('Preferences imported', {
          description: 'Your settings have been updated from the file'
        })
      } catch (error) {
        toast.error('Import failed', {
          description: 'The file is not a valid preferences file'
        })
      }
    }
    reader.readAsText(file)
  }, [])

  // Get CSS classes based on preferences
  const getThemeClasses = useCallback(() => {
    const classes: string[] = []

    if (preferences.accessibility.highContrast) {
      classes.push('high-contrast')
    }

    if (preferences.accessibility.largeText) {
      classes.push('large-text')
    }

    if (preferences.accessibility.reduceMotion) {
      classes.push('reduce-motion')
    }

    if (preferences.accessibility.screenReaderOptimized) {
      classes.push('screen-reader-optimized')
    }

    if (preferences.accessibility.colorBlindFriendly) {
      classes.push('colorblind-friendly')
    }

    return classes.join(' ')
  }, [preferences.accessibility])

  // Apply preferences to document
  useEffect(() => {
    const classes = getThemeClasses()

    // Remove existing preference classes
    document.body.classList.remove(
      'high-contrast',
      'large-text',
      'reduce-motion',
      'screen-reader-optimized',
      'colorblind-friendly'
    )

    // Add current preference classes
    if (classes) {
      document.body.classList.add(...classes.split(' '))
    }
  }, [getThemeClasses])

  // Get animation duration based on preferences
  const getAnimationDuration = useCallback(() => {
    switch (preferences.workflow.animationSpeed) {
      case 'fast': return '150ms'
      case 'slow': return '500ms'
      default: return '300ms'
    }
  }, [preferences.workflow.animationSpeed])

  // Check if a preference is enabled
  const isPreferenceEnabled = useCallback((category: keyof SubcontractorReviewPreferences, key: string) => {
    const categoryPrefs = preferences[category] as any
    return categoryPrefs?.[key] === true
  }, [preferences])

  // Get custom keyboard shortcuts
  const getCustomShortcut = useCallback((actionId: string) => {
    return preferences.keyboard.customShortcuts[actionId]
  }, [preferences.keyboard.customShortcuts])

  // Validate preferences
  const validatePreferences = useCallback((prefs: Partial<SubcontractorReviewPreferences>) => {
    const errors: string[] = []

    // Validate view preferences
    if (prefs.view?.defaultView && !['compact', 'detailed', 'table'].includes(prefs.view.defaultView)) {
      errors.push('Invalid default view preference')
    }

    // Validate workflow preferences
    if (prefs.workflow?.bulkActionThreshold && (prefs.workflow.bulkActionThreshold < 1 || prefs.workflow.bulkActionThreshold > 1000)) {
      errors.push('Bulk action threshold must be between 1 and 1000')
    }

    // Validate alias preferences
    if (prefs.aliases?.minConfidenceForSuggestion && (prefs.aliases.minConfidenceForSuggestion < 0 || prefs.aliases.minConfidenceForSuggestion > 1)) {
      errors.push('Minimum confidence for alias suggestions must be between 0 and 1')
    }

    // Validate EBA preferences
    if (prefs.eba?.ebaWarningDays && (prefs.eba.ebaWarningDays < 0 || prefs.eba.ebaWarningDays > 365)) {
      errors.push('EBA warning days must be between 0 and 365')
    }

    return errors
  }, [])

  return {
    // State
    preferences,
    isLoading,
    isDirty,

    // Actions
    savePreferences,
    resetPreferences,
    exportPreferences,
    importPreferences,

    // Specific section updates
    updateViewPreferences,
    updateWorkflowPreferences,
    updateAliasPreferences,
    updateEbaPreferences,
    updateAccessibilityPreferences,
    updateKeyboardPreferences,
    updatePerformancePreferences,

    // Utilities
    getThemeClasses,
    getAnimationDuration,
    isPreferenceEnabled,
    getCustomShortcut,
    validatePreferences,

    // Direct access to preference sections
    view: preferences.view,
    workflow: preferences.workflow,
    aliases: preferences.aliases,
    eba: preferences.eba,
    accessibility: preferences.accessibility,
    keyboard: preferences.keyboard,
    performance: preferences.performance
  }
}

// Hook for persisting individual preference items
export function usePreference<T>(
  key: string,
  defaultValue: T,
  options?: {
    persist?: boolean
    namespace?: string
    validator?: (value: T) => boolean
  }
) {
  const { persist = true, namespace = 'subcontractor-review', validator } = options || {}
  const [value, setValue] = useState<T>(defaultValue)
  const [isLoading, setIsLoading] = useState(true)

  // Load preference from localStorage
  useEffect(() => {
    if (!persist) {
      setIsLoading(false)
      return
    }

    try {
      const stored = localStorage.getItem(`${namespace}-${key}`)
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        if (!validator || validator(parsed)) {
          setValue(parsed)
        }
      }
    } catch (error) {
      console.error(`Failed to load preference ${key}:`, error)
    } finally {
      setIsLoading(false)
    }
  }, [key, persist, namespace, validator])

  // Save preference to localStorage
  const saveValue = useCallback((newValue: T) => {
    if (validator && !validator(newValue)) {
      console.warn(`Invalid value for preference ${key}:`, newValue)
      return
    }

    setValue(newValue)

    if (persist) {
      try {
        localStorage.setItem(`${namespace}-${key}`, JSON.stringify(newValue))
      } catch (error) {
        console.error(`Failed to save preference ${key}:`, error)
      }
    }
  }, [key, persist, namespace, validator])

  return [value, saveValue, isLoading] as const
}
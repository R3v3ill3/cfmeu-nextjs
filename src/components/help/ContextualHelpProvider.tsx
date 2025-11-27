"use client"

import { createContext, useContext, useCallback, useEffect, useMemo, useState, ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { useHelpContext } from '@/context/HelpContext'
import { PAGE_ROUTE_MAPPINGS, getHelpConfigurations, type HelpTooltipConfig } from './ContextualHelpConfig'

export interface ContextualHelpState {
  /** Currently active help tooltips for the current page */
  activeTooltips: HelpTooltipConfig[]

  /** Currently displayed tooltip */
  currentTooltip?: HelpTooltipConfig

  /** User's help preferences */
  preferences: {
    showTooltips: boolean
    showOnboarding: boolean
    tooltipDelay: number
    advancedMode: boolean
  }

  /** Help session analytics */
  analytics: {
    tooltipsViewed: string[]
    pagesVisited: string[]
    sessionDuration: number
    lastHelpAccess: Date | null
  }
}

export interface ContextualHelpValue extends ContextualHelpState {
  /** Show a specific help tooltip */
  showTooltip: (tooltipId: string) => void

  /** Hide current tooltip */
  hideTooltip: () => void

  /** Update help preferences */
  updatePreferences: (updates: Partial<ContextualHelpState['preferences']>) => void

  /** Mark tooltip as viewed */
  markTooltipViewed: (tooltipId: string) => void

  /** Get tooltips for current page/section */
  getPageTooltips: (section?: string) => HelpTooltipConfig[]

  /** Check if user has seen specific tooltip */
  hasSeenTooltip: (tooltipId: string) => boolean

  /** Reset help analytics */
  resetAnalytics: () => void

  /** Show comprehensive help dialog */
  showHelpDialog: (topic?: string, context?: any) => void
}

const ContextualHelpContext = createContext<ContextualHelpValue | undefined>(undefined)

interface ContextualHelpProviderProps {
  children: ReactNode
  initialPreferences?: Partial<ContextualHelpState['preferences']>
}

export function ContextualHelpProvider({
  children,
  initialPreferences
}: ContextualHelpProviderProps) {
  const pathname = usePathname()
  const { scope } = useHelpContext()

  const [state, setState] = useState<ContextualHelpState>(() => {
    // Load preferences from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('contextual-help-preferences')
      const storedAnalytics = localStorage.getItem('contextual-help-analytics')

      return {
        activeTooltips: [],
        currentTooltip: undefined,
        preferences: {
          showTooltips: true,
          showOnboarding: true,
          tooltipDelay: 500,
          advancedMode: false,
          ...initialPreferences,
          ...(stored ? JSON.parse(stored) : {})
        },
        analytics: {
          tooltipsViewed: [],
          pagesVisited: [],
          sessionDuration: 0,
          lastHelpAccess: null,
          ...(storedAnalytics ? JSON.parse(storedAnalytics) : {})
        }
      }
    }

    return {
      activeTooltips: [],
      currentTooltip: undefined,
      preferences: {
        showTooltips: true,
        showOnboarding: true,
        tooltipDelay: 500,
        advancedMode: false,
        ...initialPreferences
      },
      analytics: {
        tooltipsViewed: [],
        pagesVisited: [],
        sessionDuration: 0,
        lastHelpAccess: null
      }
    }
  })

  // Track session duration
  useEffect(() => {
    const startTime = Date.now()

    return () => {
      const duration = Date.now() - startTime
      setState(prev => ({
        ...prev,
        analytics: {
          ...prev.analytics,
          sessionDuration: prev.analytics.sessionDuration + duration
        }
      }))
    }
  }, [])

  // Update page tooltips when route changes
  useEffect(() => {
    const pageKey = PAGE_ROUTE_MAPPINGS[pathname] || pathname
    const pageTooltips = getHelpConfigurations(pageKey, scope.section)

    setState(prev => {
      // Track page visit
      const pagesVisited = prev.analytics.pagesVisited.includes(pageKey)
        ? prev.analytics.pagesVisited
        : [...prev.analytics.pagesVisited, pageKey]

      return {
        ...prev,
        activeTooltips: pageTooltips,
        currentTooltip: undefined, // Reset tooltip on page change
        analytics: {
          ...prev.analytics,
          pagesVisited
        }
      }
    })
  }, [pathname, scope.section])

  // Save preferences to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('contextual-help-preferences', JSON.stringify(state.preferences))
    }
  }, [state.preferences])

  // Save analytics to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('contextual-help-analytics', JSON.stringify(state.analytics))
    }
  }, [state.analytics])

  // Listen for help dialog requests
  useEffect(() => {
    const handleHelpDialogRequest = (event: CustomEvent) => {
      const { topic, context } = event.detail
      showHelpDialog(topic, context)
    }

    window.addEventListener('openHelpDialog', handleHelpDialogRequest as EventListener)

    return () => {
      window.removeEventListener('openHelpDialog', handleHelpDialogRequest as EventListener)
    }
  }, [])

  const showTooltip = useCallback((tooltipId: string) => {
    const tooltip = state.activeTooltips.find(t => t.id === tooltipId)
    if (!tooltip) return

    setState(prev => ({
      ...prev,
      currentTooltip: tooltip,
      analytics: {
        ...prev.analytics,
        tooltipsViewed: prev.analytics.tooltipsViewed.includes(tooltipId)
          ? prev.analytics.tooltipsViewed
          : [...prev.analytics.tooltipsViewed, tooltipId],
        lastHelpAccess: new Date()
      }
    }))

    // Track analytics
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'contextual_help_show', {
        tooltip_id: tooltipId,
        page: pathname,
        section: scope.section,
        role: scope.role
      })
    }
  }, [state.activeTooltips, pathname, scope.section, scope.role])

  const hideTooltip = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentTooltip: undefined
    }))
  }, [])

  const updatePreferences = useCallback((updates: Partial<ContextualHelpState['preferences']>) => {
    setState(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        ...updates
      }
    }))
  }, [])

  const markTooltipViewed = useCallback((tooltipId: string) => {
    setState(prev => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        tooltipsViewed: prev.analytics.tooltipsViewed.includes(tooltipId)
          ? prev.analytics.tooltipsViewed
          : [...prev.analytics.tooltipsViewed, tooltipId],
        lastHelpAccess: new Date()
      }
    }))
  }, [])

  const getPageTooltips = useCallback((section?: string) => {
    const pageKey = PAGE_ROUTE_MAPPINGS[pathname] || pathname
    return getHelpConfigurations(pageKey, section || scope.section)
  }, [pathname, scope.section])

  const hasSeenTooltip = useCallback((tooltipId: string) => {
    return state.analytics.tooltipsViewed.includes(tooltipId)
  }, [state.analytics.tooltipsViewed])

  const resetAnalytics = useCallback(() => {
    setState(prev => ({
      ...prev,
      analytics: {
        tooltipsViewed: [],
        pagesVisited: [],
        sessionDuration: 0,
        lastHelpAccess: null
      }
    }))
  }, [])

  const showHelpDialog = useCallback((topic?: string, context?: any) => {
    // Dispatch event to open help dialog
    const event = new CustomEvent('showHelpDialog', {
      detail: {
        topic,
        context: {
          ...context,
          page: pathname,
          section: scope.section,
          role: scope.role
        }
      }
    })
    window.dispatchEvent(event)

    setState(prev => ({
      ...prev,
      analytics: {
        ...prev.analytics,
        lastHelpAccess: new Date()
      }
    }))
  }, [pathname, scope.section, scope.role])

  const value = useMemo(() => ({
    ...state,
    showTooltip,
    hideTooltip,
    updatePreferences,
    markTooltipViewed,
    getPageTooltips,
    hasSeenTooltip,
    resetAnalytics,
    showHelpDialog
  }), [state, showTooltip, hideTooltip, updatePreferences, markTooltipViewed, getPageTooltips, hasSeenTooltip, resetAnalytics, showHelpDialog])

  return (
    <ContextualHelpContext.Provider value={value}>
      {children}
    </ContextualHelpContext.Provider>
  )
}

export function useContextualHelp() {
  const context = useContext(ContextualHelpContext)
  if (!context) {
    throw new Error('useContextualHelp must be used within ContextualHelpProvider')
  }
  return context
}
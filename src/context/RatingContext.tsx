"use client"

import { 
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  ReactNode,
 } from 'react'
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  EmployerRatingData,
  RatingFilters,
  TrafficLightRating,
  RoleType,
} from "@/types/rating"
import { useRatingStats, useRatingAlerts } from "@/hooks/useRatings"
import { useAuth } from "@/hooks/useAuth"
import { useUserRole } from "@/hooks/useUserRole"
import { RatingErrorBoundary } from "@/components/ratings/RatingErrorBoundary"

// State interface for rating context
interface RatingState {
  // Current filters applied
  filters: RatingFilters
  // Selected employers for batch operations
  selectedEmployers: string[]
  // UI state
  showConfidence: boolean
  showTrends: boolean
  compactMode: boolean
  roleContext: RoleType | null
  // Loading states
  isLoading: boolean
  isRefreshing: boolean
  // Error state
  error: string | null
}

// Action types for rating context
type RatingAction =
  | { type: "SET_FILTERS"; payload: Partial<RatingFilters> }
  | { type: "CLEAR_FILTERS" }
  | { type: "SET_SELECTED_EMPLOYERS"; payload: string[] }
  | { type: "ADD_SELECTED_EMPLOYER"; payload: string }
  | { type: "REMOVE_SELECTED_EMPLOYER"; payload: string }
  | { type: "TOGGLE_CONFIDENCE_DISPLAY" }
  | { type: "TOGGLE_TRENDS_DISPLAY" }
  | { type: "TOGGLE_COMPACT_MODE" }
  | { type: "SET_ROLE_CONTEXT"; payload: RoleType }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_REFRESHING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "REFRESH_DATA" }

// Initial state
const initialState: RatingState = {
  filters: {},
  selectedEmployers: [],
  showConfidence: true,
  showTrends: false,
  compactMode: false,
  roleContext: null,
  isLoading: false,
  isRefreshing: false,
  error: null,
}

// Reducer function
function ratingReducer(state: RatingState, action: RatingAction): RatingState {
  switch (action.type) {
    case "SET_FILTERS":
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
      }

    case "CLEAR_FILTERS":
      return {
        ...state,
        filters: {},
      }

    case "SET_SELECTED_EMPLOYERS":
      return {
        ...state,
        selectedEmployers: action.payload,
      }

    case "ADD_SELECTED_EMPLOYER":
      return {
        ...state,
        selectedEmployers: state.selectedEmployers.includes(action.payload)
          ? state.selectedEmployers
          : [...state.selectedEmployers, action.payload],
      }

    case "REMOVE_SELECTED_EMPLOYER":
      return {
        ...state,
        selectedEmployers: state.selectedEmployers.filter(id => id !== action.payload),
      }

    case "TOGGLE_CONFIDENCE_DISPLAY":
      return {
        ...state,
        showConfidence: !state.showConfidence,
      }

    case "TOGGLE_TRENDS_DISPLAY":
      return {
        ...state,
        showTrends: !state.showTrends,
      }

    case "TOGGLE_COMPACT_MODE":
      return {
        ...state,
        compactMode: !state.compactMode,
      }

    case "SET_ROLE_CONTEXT":
      return {
        ...state,
        roleContext: action.payload,
      }

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      }

    case "SET_REFRESHING":
      return {
        ...state,
        isRefreshing: action.payload,
      }

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      }

    case "REFRESH_DATA":
      return {
        ...state,
        isRefreshing: true,
        error: null,
      }

    default:
      return state
  }
}

// Context interface
interface RatingContextValue {
  // State
  state: RatingState

  // Actions
  setFilters: (filters: Partial<RatingFilters>) => void
  clearFilters: () => void
  setSelectedEmployers: (employerIds: string[]) => void
  addSelectedEmployer: (employerId: string) => void
  removeSelectedEmployer: (employerId: string) => void
  toggleConfidenceDisplay: () => void
  toggleTrendsDisplay: () => void
  toggleCompactMode: () => void
  setRoleContext: (role: RoleType) => void
  refreshData: () => void

  // Computed values
  hasActiveFilters: boolean
  hasSelectedEmployers: boolean
  selectedCount: number

  // Data from queries
  stats: ReturnType<typeof useRatingStats>["data"]
  alerts: ReturnType<typeof useRatingAlerts>["data"]
  isStatsLoading: boolean
  isAlertsLoading: boolean

  // Utility functions
  getRatingColor: (rating: TrafficLightRating) => string
  getConfidenceColor: (confidence: string) => string
  formatRatingDate: (date: string) => string
  calculateRatingDistribution: () => Record<TrafficLightRating, number>
}

// Create context
const RatingContext = createContext<RatingContextValue | undefined>(undefined)

// Provider component
interface RatingProviderProps {
  children: ReactNode
}

export function RatingProvider({ children }: RatingProviderProps) {
  const [state, dispatch] = useReducer(ratingReducer, initialState)
  const queryClient = useQueryClient()

  // Hooks must be called unconditionally at the top level (Rules of Hooks)
  // Handle errors through hook results and useEffect instead of try-catch
  const authResult = useAuth()
  const user = authResult?.user ?? null
  
  const roleResult = useUserRole()
  const userRole = roleResult?.role ?? null
  
  // Stable error handlers to prevent hook order issues
  const handleStatsError = useCallback((error: unknown) => {
    console.error('Rating stats error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    dispatch({ type: "SET_ERROR", payload: `Stats error: ${errorMessage}` })
  }, [])
  
  const handleAlertsError = useCallback((error: unknown) => {
    console.error('Rating alerts error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    dispatch({ type: "SET_ERROR", payload: `Alerts error: ${errorMessage}` })
  }, [])
  
  // Fetch rating stats with error handling via onError callback
  const statsResult = useRatingStats({
    onError: handleStatsError,
  })
  const stats = statsResult?.data ?? null
  const isStatsLoading = statsResult?.isLoading ?? false
  const statsError = statsResult?.error ?? null

  // Fetch rating alerts with error handling via onError callback
  const alertsResult = useRatingAlerts({
    onError: handleAlertsError,
  })
  const alerts = alertsResult?.data ?? null
  const isAlertsLoading = alertsResult?.isLoading ?? false
  const alertsError = alertsResult?.error ?? null

  // Handle errors from auth and role hooks via useEffect
  // Use stable error reference to avoid dependency issues
  const roleError = roleResult?.error ?? null
  useEffect(() => {
    if (roleError) {
      console.error('UserRole hook error:', roleError)
      dispatch({ type: "SET_ERROR", payload: "User role error" })
    }
  }, [roleError])

  // Set role context based on user role
  useEffect(() => {
    if (userRole) {
      let roleContext: RoleType = "trade" // default

      switch (userRole) {
        case "admin":
          roleContext = "admin"
          break
        case "organiser":
        case "lead_organiser":
          roleContext = "organiser"
          break
        default:
          roleContext = "trade"
      }

      dispatch({ type: "SET_ROLE_CONTEXT", payload: roleContext })
    }
  }, [userRole])

  // Handle refresh completion
  useEffect(() => {
    if (state.isRefreshing && !isStatsLoading && !isAlertsLoading) {
      dispatch({ type: "SET_REFRESHING", payload: false })
    }
  }, [state.isRefreshing, isStatsLoading, isAlertsLoading])

  // Action functions
  const setFilters = (filters: Partial<RatingFilters>) => {
    dispatch({ type: "SET_FILTERS", payload: filters })
  }

  const clearFilters = () => {
    dispatch({ type: "CLEAR_FILTERS" })
  }

  const setSelectedEmployers = (employerIds: string[]) => {
    dispatch({ type: "SET_SELECTED_EMPLOYERS", payload: employerIds })
  }

  const addSelectedEmployer = (employerId: string) => {
    dispatch({ type: "ADD_SELECTED_EMPLOYER", payload: employerId })
  }

  const removeSelectedEmployer = (employerId: string) => {
    dispatch({ type: "REMOVE_SELECTED_EMPLOYER", payload: employerId })
  }

  const toggleConfidenceDisplay = () => {
    dispatch({ type: "TOGGLE_CONFIDENCE_DISPLAY" })
  }

  const toggleTrendsDisplay = () => {
    dispatch({ type: "TOGGLE_TRENDS_DISPLAY" })
  }

  const toggleCompactMode = () => {
    dispatch({ type: "TOGGLE_COMPACT_MODE" })
  }

  const setRoleContext = (role: RoleType) => {
    dispatch({ type: "SET_ROLE_CONTEXT", payload: role })
  }

  const refreshData = () => {
    dispatch({ type: "REFRESH_DATA" })
    queryClient.invalidateQueries({ queryKey: ["rating-stats"] })
    queryClient.invalidateQueries({ queryKey: ["rating-alerts"] })
    queryClient.invalidateQueries({ queryKey: ["employer-ratings"] })
    queryClient.invalidateQueries({ queryKey: ["multiple-employer-ratings"] })
    queryClient.invalidateQueries({ queryKey: ["rating-search"] })
  }

  // Utility functions
  const getRatingColor = (rating: TrafficLightRating): string => {
    const colors = {
      green: "bg-green-500 text-white border-green-600",
      amber: "bg-amber-500 text-white border-amber-600",
      yellow: "bg-yellow-500 text-black border-yellow-600",
      red: "bg-red-500 text-white border-red-600",
    }
    return colors[rating] || colors.yellow
  }

  const getConfidenceColor = (confidence: string): string => {
    const colors = {
      very_high: "text-green-600 bg-green-50 border-green-200",
      high: "text-blue-600 bg-blue-50 border-blue-200",
      medium: "text-amber-600 bg-amber-50 border-amber-200",
      low: "text-red-600 bg-red-50 border-red-200",
    }
    return colors[confidence as keyof typeof colors] || colors.medium
  }

  const formatRatingDate = (date: string): string => {
    try {
      const dateObj = new Date(date)
      return dateObj.toLocaleDateString("en-AU", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return "Invalid date"
    }
  }

  const calculateRatingDistribution = (): Record<TrafficLightRating, number> => {
    return stats?.rating_distribution || {
      green: 0,
      amber: 0,
      yellow: 0,
      red: 0,
    }
  }

  // Computed values
  const hasActiveFilters = Object.keys(state.filters).length > 0
  const hasSelectedEmployers = state.selectedEmployers.length > 0
  const selectedCount = state.selectedEmployers.length

  // Handle combined error state
  useEffect(() => {
    if (statsError || alertsError) {
      const errorMessage = statsError?.message || alertsError?.message || "Unknown error"
      dispatch({ type: "SET_ERROR", payload: errorMessage })
    }
  }, [statsError, alertsError])

  const value: RatingContextValue = {
    // State
    state,

    // Actions
    setFilters,
    clearFilters,
    setSelectedEmployers,
    addSelectedEmployer,
    removeSelectedEmployer,
    toggleConfidenceDisplay,
    toggleTrendsDisplay,
    toggleCompactMode,
    setRoleContext,
    refreshData,

    // Computed values
    hasActiveFilters,
    hasSelectedEmployers,
    selectedCount,

    // Data from queries
    stats,
    alerts,
    isStatsLoading,
    isAlertsLoading,

    // Utility functions
    getRatingColor,
    getConfidenceColor,
    formatRatingDate,
    calculateRatingDistribution,
  }

  return (
    <RatingErrorBoundary
      onError={(error, errorInfo) => {
        console.error('RatingProvider Error:', error, errorInfo)
      }}
    >
      <RatingContext.Provider value={value}>
        {children}
      </RatingContext.Provider>
    </RatingErrorBoundary>
  )
}

// Hook to use rating context
export function useRatingContext() {
  const context = useContext(RatingContext)
  if (context === undefined) {
    throw new Error("useRatingContext must be used within a RatingProvider")
  }
  return context
}

// Hook to get rating display options
export function useRatingDisplayOptions() {
  const { state } = useRatingContext()

  return {
    showConfidence: state.showConfidence,
    showTrends: state.showTrends,
    compactMode: state.compactMode,
    roleContext: state.roleContext,
  }
}

// Hook to get rating filters
export function useRatingFilters() {
  const { state, setFilters, clearFilters, hasActiveFilters } = useRatingContext()

  return {
    filters: state.filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
  }
}

// Hook to get selected employers
export function useSelectedEmployers() {
  const {
    state,
    setSelectedEmployers,
    addSelectedEmployer,
    removeSelectedEmployer,
    hasSelectedEmployers,
    selectedCount
  } = useRatingContext()

  return {
    selectedEmployers: state.selectedEmployers,
    setSelectedEmployers,
    addSelectedEmployer,
    removeSelectedEmployer,
    hasSelectedEmployers,
    selectedCount,
  }
}
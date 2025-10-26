"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'

export const dynamic = 'force-dynamic'
import { useRouter } from "next/navigation"
import { RatingDashboard } from "@/components/mobile/rating-system/RatingDashboard"
import { EmployerRatingData, RoleType } from "@/types/rating"
import { useMobileOptimizations } from "@/hooks/mobile/useMobileOptimizations"
import { useOfflineSync } from "@/hooks/mobile/useOfflineSync"
import { useToast } from "@/hooks/use-toast"

// Mock data for demonstration
const mockEmployers: EmployerRatingData[] = [
  {
    id: "1",
    employer_name: "BuildRight Construction",
    abn: "12345678901",
    project_count: 12,
    primary_trade: "Construction",
    location: "Sydney, NSW",
    project_data_rating: {
      id: "proj-1",
      employer_id: "1",
      rating: "green",
      confidence: "high",
      track: "project_data",
      role_context: "organiser",
      calculated_at: new Date().toISOString(),
      calculated_by: "system",
      compliance_score: 85,
      participation_rate: 78,
      dispute_count: 1,
      safety_incidents: 0,
      eba_compliance: 92,
    },
    organiser_expertise_rating: {
      id: "exp-1",
      employer_id: "1",
      rating: "green",
      confidence: "very_high",
      track: "organiser_expertise",
      role_context: "organiser",
      calculated_at: new Date().toISOString(),
      calculated_by: "john.doe",
      relationship_quality: 9,
      communication_effectiveness: 8,
      cooperation_level: 9,
      problem_solving: 8,
      historical_performance: 9,
    },
    rating_history: [],
    last_updated: new Date().toISOString(),
  },
  {
    id: "2",
    employer_name: "TradeMaster Services",
    project_count: 8,
    primary_trade: "Electrical",
    location: "Melbourne, VIC",
    project_data_rating: {
      id: "proj-2",
      employer_id: "2",
      rating: "amber",
      confidence: "medium",
      track: "project_data",
      role_context: "organiser",
      calculated_at: new Date().toISOString(),
      calculated_by: "system",
      compliance_score: 65,
      participation_rate: 45,
      dispute_count: 3,
      safety_incidents: 1,
      eba_compliance: 70,
    },
    organiser_expertise_rating: {
      id: "exp-2",
      employer_id: "2",
      rating: "red",
      confidence: "high",
      track: "organiser_expertise",
      role_context: "organiser",
      calculated_at: new Date().toISOString(),
      calculated_by: "jane.smith",
      relationship_quality: 3,
      communication_effectiveness: 4,
      cooperation_level: 2,
      problem_solving: 3,
      historical_performance: 3,
    },
    rating_history: [],
    last_updated: new Date().toISOString(),
  },
  {
    id: "3",
    employer_name: "ProBuild Solutions",
    project_count: 15,
    primary_trade: "Construction",
    location: "Brisbane, QLD",
    project_data_rating: {
      id: "proj-3",
      employer_id: "3",
      rating: "green",
      confidence: "high",
      track: "project_data",
      role_context: "organiser",
      calculated_at: new Date().toISOString(),
      calculated_by: "system",
      compliance_score: 92,
      participation_rate: 88,
      dispute_count: 0,
      safety_incidents: 0,
      eba_compliance: 95,
    },
    rating_history: [],
    last_updated: new Date().toISOString(),
  },
]

const mockStats = {
  totalEmployers: 156,
  greenCount: 98,
  amberCount: 42,
  redCount: 16,
  recentActivity: 23,
}

const mockAlerts = [
  {
    id: "1",
    type: "warning" as const,
    title: "TradeMaster Services",
    message: "Significant rating discrepancy between project data and organiser expertise",
    employerId: "2",
    timestamp: new Date().toISOString(),
  },
  {
    id: "2",
    type: "error" as const,
    title: "Critical Safety Issue",
    message: "Multiple safety incidents reported for ABC Construction",
    employerId: "4",
    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  },
]

export default function MobileRatingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    isMobile,
    isLowEndDevice,
    debounce,
    supportsTouch,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const {
    data: employers,
    loading,
    error,
    isOnline,
    pendingSync,
    forceSync,
  } = useOfflineSync(mockEmployers, {
    storageKey: "mobile-employers",
    autoSync: true,
    syncInterval: 30000,
  })

  const [refreshing, setRefreshing] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Mock user role - in a real app, this would come from auth context
  const userRole: RoleType = "organiser"

  // Handle search with debouncing
  const handleSearch = useCallback(
    debounce((query: string) => {
      setSearchQuery(query)
    }),
    [debounce]
  )

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate API call
      toast({
        title: "Data refreshed",
        description: "Latest employer ratings have been loaded",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to load latest data. Please try again.",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }, [toast])

  // Handle employer interactions
  const handleRateEmployer = useCallback((employer: EmployerRatingData) => {
    router.push(`/mobile/ratings/wizard/${employer.id}`)
  }, [router])

  const handleViewEmployer = useCallback((employer: EmployerRatingData) => {
    router.push(`/mobile/ratings/compare/${employer.id}`)
  }, [router])

  const handleEditEmployer = useCallback((employer: EmployerRatingData) => {
    router.push(`/mobile/ratings/edit/${employer.id}`)
  }, [router])

  const handleViewAllEmployers = useCallback(() => {
    router.push("/mobile/ratings/list")
  }, [router])

  const handleViewAlerts = useCallback(() => {
    router.push("/mobile/ratings/alerts")
  }, [router])

  const handleSettings = useCallback(() => {
    router.push("/mobile/ratings/settings")
  }, [router])

  const handleFilter = useCallback(() => {
    router.push("/mobile/ratings/filters")
  }, [router])

  // Filter employers based on search query
  const filteredEmployers = useMemo(() => {
    if (!searchQuery || !employers) return employers

    return employers.filter(employer =>
      employer.employer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.primary_trade?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      employer.location?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [employers, searchQuery])

  return (
    <div className="min-h-screen bg-background">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span>Offline mode - Changes will sync when connection is restored</span>
          </div>
        </div>
      )}

      {/* Pending sync indicator */}
      {isOnline && pendingSync > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
            <span>{pendingSync} changes pending sync</span>
            <button
              onClick={forceSync}
              className="text-blue-600 underline text-xs"
            >
              Sync now
            </button>
          </div>
        </div>
      )}

      <RatingDashboard
        employers={filteredEmployers || []}
        userRole={userRole}
        loading={loading}
        refreshing={refreshing}
        stats={mockStats}
        alerts={mockAlerts}
        onRefresh={handleRefresh}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRateEmployer={handleRateEmployer}
        onViewEmployer={handleViewEmployer}
        onEditEmployer={handleEditEmployer}
        onViewAllEmployers={handleViewAllEmployers}
        onViewAlerts={handleViewAlerts}
        onSettings={handleSettings}
      />
    </div>
  )
}
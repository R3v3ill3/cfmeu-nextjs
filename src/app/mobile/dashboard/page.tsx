"use client"

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MobileDashboard } from '@/components/mobile/dashboard/MobileDashboard'
import { useOfflineSync } from '@/hooks/mobile/useOfflineSync'
import { useMobileOptimizations } from '@/hooks/mobile/useMobileOptimizations'
import { useToast } from '@/hooks/use-toast'
import { MobileLoadingState } from '@/components/mobile/shared/MobileOptimizationProvider'

interface DashboardData {
  userRole: 'organiser' | 'lead_organiser' | 'official' | 'admin'
  metrics: {
    totalProjects: number
    activeProjects: number
    completedMappings: number
    pendingAudits: number
    unionDensity: number
    membersCount: number
    recentActivity: number
    alertsCount: number
  }
  recentProjects: Array<{
    id: string
    name: string
    address: string
    status: string
    lastVisit?: string
    complianceRating?: 'green' | 'amber' | 'red'
    workforceSize?: number
    unionPercentage?: number
  }>
  alerts: Array<{
    id: string
    type: 'safety' | 'compliance' | 'union_rights' | 'urgent'
    title: string
    message: string
    projectId?: string
    priority: 'high' | 'medium' | 'low'
    timestamp: string
  }>
  tasks: Array<{
    id: string
    title: string
    type: 'mapping' | 'audit' | 'follow_up' | 'meeting'
    priority: 'high' | 'medium' | 'low'
    dueDate?: string
    projectId?: string
    completed: boolean
  }>
  quickActions: Array<{
    id: string
    title: string
    description: string
    icon: string
    route: string
    color: string
  }>
}

export default function MobileDashboardPage() {
  const router = useRouter()
  const { toast } = useToast()

  const {
    isLowEndDevice,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [usingCachedData, setUsingCachedData] = useState(false)

  const {
    data: cachedData,
    isOnline,
    forceSync,
  } = useOfflineSync<DashboardData>([], {
    storageKey: 'mobile-dashboard',
    autoSync: true,
    syncInterval: 60000, // 1 minute
  })

  // Load dashboard data
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)

        // Try to get fresh data if online
        if (isOnline) {
          const response = await fetch('/api/mobile/dashboard', {
            headers: {
              'Cache-Control': 'no-cache'
            }
          })

          if (response.ok) {
            const data = await response.json()
            setDashboardData(data)
            setLoadError(null)
            setUsingCachedData(false)
          } else {
            throw new Error('Failed to fetch dashboard data')
          }
        } else {
          // Use cached data when offline
          if (cachedData && cachedData.length > 0) {
            setDashboardData(cachedData[0])
            setLoadError(null)
            setUsingCachedData(true)
          } else {
            setDashboardData(null)
            setLoadError('You are offline and no cached dashboard is available yet.')
            setUsingCachedData(false)
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)

        // Fallback to cached data
        if (cachedData && cachedData.length > 0) {
          setDashboardData(cachedData[0])
          setLoadError(null)
          setUsingCachedData(true)
          toast({
            title: "Using cached data",
            description: "Offline mode. Showing previously loaded dashboard.",
          })
        } else {
          setDashboardData(null)
          setLoadError(error instanceof Error ? error.message : 'Unable to load dashboard data.')
          setUsingCachedData(false)
          toast({
            title: "Dashboard unavailable",
            description: "Unable to load dashboard data. Please try again when the connection is stable.",
            variant: "destructive",
          })
        }
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [isOnline, cachedData, toast])

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await forceSync()
      toast({
        title: "Dashboard refreshed",
        description: "Latest data has been loaded",
      })
    } catch (error) {
      toast({
        title: "Refresh failed",
        description: "Unable to load latest data",
        variant: "destructive",
      })
    } finally {
      setRefreshing(false)
    }
  }, [forceSync, toast])

  // Handle navigation
  const handleNavigation = useCallback((route: string) => {
    router.push(route)
  }, [router])

  // Handle task completion
  const handleTaskComplete = useCallback(async (taskId: string) => {
    if (!dashboardData) return

    try {
      // Update local state immediately
      const updatedTasks = dashboardData.tasks.map(task =>
        task.id === taskId ? { ...task, completed: true } : task
      )
      setDashboardData({
        ...dashboardData,
        tasks: updatedTasks
      })

      // Would normally sync with server
      toast({
        title: "Task completed",
        description: "Task has been marked as completed",
      })
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update task status",
        variant: "destructive",
      })
    }
  }, [dashboardData, toast])

  if (loading) {
    return <MobileLoadingState message="Loading dashboard..." />
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Dashboard unavailable</h2>
          <p className="text-gray-600 mb-4">
            {loadError ?? 'Unable to load dashboard data.'}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="min-h-[44px] rounded-md bg-red-600 px-4 py-2 text-white hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Offline indicator */}
      {!isOnline && (
        <div className="bg-amber-50 border-b border-amber-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-amber-800">
            <div className="w-2 h-2 bg-amber-600 rounded-full animate-pulse" />
            <span>Offline mode - Showing cached data</span>
          </div>
        </div>
      )}

      {isOnline && usingCachedData && (
        <div className="bg-blue-50 border-b border-blue-200 p-2">
          <div className="flex items-center justify-center gap-2 text-sm text-blue-800">
            <div className="w-2 h-2 bg-blue-600 rounded-full" />
            <span>Showing cached dashboard - latest data unavailable</span>
          </div>
        </div>
      )}

      <MobileDashboard
        data={dashboardData}
        onRefresh={handleRefresh}
        onNavigation={handleNavigation}
        onTaskComplete={handleTaskComplete}
        refreshing={refreshing}
        isOnline={isOnline}
        isLowEndDevice={isLowEndDevice}
      />
    </div>
  )
}

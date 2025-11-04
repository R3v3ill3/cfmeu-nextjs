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
    debounce,
    isMobile,
    isLowEndDevice,
  } = useMobileOptimizations({
    enableDebouncing: true,
    debounceDelay: 300,
  })

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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
          } else {
            throw new Error('Failed to fetch dashboard data')
          }
        } else {
          // Use cached data when offline
          if (cachedData && cachedData.length > 0) {
            setDashboardData(cachedData[0])
          } else {
            // Use mock data as last resort
            setDashboardData(getMockDashboardData())
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)

        // Fallback to cached data
        if (cachedData && cachedData.length > 0) {
          setDashboardData(cachedData[0])
          toast({
            title: "Using cached data",
            description: "Offline mode. Showing previously loaded dashboard.",
          })
        } else {
          // Use mock data
          setDashboardData(getMockDashboardData())
          toast({
            title: "Sample data",
            description: "Showing sample dashboard data.",
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
          <p className="text-gray-600 mb-4">Unable to load dashboard data.</p>
          <button
            onClick={() => window.location.reload()}
            className="text-blue-600 hover:text-blue-700"
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

// Mock dashboard data generator
function getMockDashboardData(): DashboardData {
  const userRoles: Array<'organiser' | 'lead_organiser' | 'official' | 'admin'> = ['organiser', 'lead_organiser', 'official', 'admin']
  const randomRole = userRoles[Math.floor(Math.random() * userRoles.length)]

  return {
    userRole: randomRole,
    metrics: {
      totalProjects: 24,
      activeProjects: 18,
      completedMappings: 15,
      pendingAudits: 6,
      unionDensity: 78,
      membersCount: 342,
      recentActivity: 12,
      alertsCount: 3
    },
    recentProjects: [
      {
        id: '1',
        name: 'Sydney Metro Expansion',
        address: '123 Construction St, Sydney NSW',
        status: 'active',
        lastVisit: '2024-01-15',
        complianceRating: 'green',
        workforceSize: 150,
        unionPercentage: 82
      },
      {
        id: '2',
        name: 'Parramatta High Rise',
        address: '456 Tower Rd, Parramatta NSW',
        status: 'active',
        lastVisit: '2024-01-12',
        complianceRating: 'amber',
        workforceSize: 75,
        unionPercentage: 65
      },
      {
        id: '3',
        name: 'Northern Beaches Hospital',
        address: '789 Health Way, Manly NSW',
        status: 'active',
        lastVisit: '2024-01-10',
        complianceRating: 'green',
        workforceSize: 200,
        unionPercentage: 91
      }
    ],
    alerts: [
      {
        id: '1',
        type: 'safety',
        title: 'Safety Concern at Parramatta High Rise',
        message: 'Multiple safety incidents reported this week',
        projectId: '2',
        priority: 'high',
        timestamp: '2024-01-16T09:30:00Z'
      },
      {
        id: '2',
        type: 'compliance',
        title: 'Union Access Issue',
        message: 'Delegate access restricted at construction site',
        projectId: '4',
        priority: 'medium',
        timestamp: '2024-01-15T14:20:00Z'
      },
      {
        id: '3',
        type: 'urgent',
        title: 'Worker Dispute',
        message: 'Payment dispute requires immediate attention',
        projectId: '5',
        priority: 'high',
        timestamp: '2024-01-16T08:00:00Z'
      }
    ],
    tasks: [
      {
        id: '1',
        title: 'Complete site mapping for Barangang Project',
        type: 'mapping',
        priority: 'high',
        dueDate: '2024-01-20',
        projectId: '6',
        completed: false
      },
      {
        id: '2',
        title: 'Follow up on safety concerns',
        type: 'follow_up',
        priority: 'high',
        dueDate: '2024-01-17',
        projectId: '2',
        completed: false
      },
      {
        id: '3',
        title: 'Monthly compliance audit',
        type: 'audit',
        priority: 'medium',
        dueDate: '2024-01-25',
        projectId: '1',
        completed: false
      },
      {
        id: '4',
        title: 'Delegate meeting',
        type: 'meeting',
        priority: 'medium',
        dueDate: '2024-01-18',
        projectId: '3',
        completed: false
      }
    ],
    quickActions: [
      {
        id: '1',
        title: 'Start Mapping',
        description: 'Begin mapping a new project',
        icon: 'map',
        route: '/mobile/map/discovery',
        color: 'bg-blue-500'
      },
      {
        id: '2',
        title: 'Compliance Audit',
        description: 'Conduct compliance assessment',
        icon: 'audit',
        route: '/mobile/projects',
        color: 'bg-green-500'
      },
      {
        id: '3',
        title: 'View Projects',
        description: 'See all your projects',
        icon: 'projects',
        route: '/mobile/projects',
        color: 'bg-purple-500'
      },
      {
        id: '4',
        title: 'Add Member',
        description: 'Register new union member',
        icon: 'member',
        route: '/mobile/members/add',
        color: 'bg-orange-500'
      }
    ]
  }
}
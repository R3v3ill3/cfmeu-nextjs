"use client"

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'
import {
  MapPin,
  Users,
  Shield,
  AlertTriangle,
  CheckCircle,
  Clock,
  TrendingUp,
  Activity,
  Plus,
  ChevronRight,
  RefreshCw,
  Bell,
  Target,
  Building,
  ClipboardList,
  UserPlus,
  Calendar,
  Filter,
  Search
} from 'lucide-react'

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

interface MobileDashboardProps {
  data: DashboardData
  onRefresh: () => Promise<void>
  onNavigation: (route: string) => void
  onTaskComplete: (taskId: string) => Promise<void>
  refreshing: boolean
  isOnline: boolean
  isLowEndDevice: boolean
}

export function MobileDashboard({
  data,
  onRefresh,
  onNavigation,
  onTaskComplete,
  refreshing,
  isOnline,
  isLowEndDevice
}: MobileDashboardProps) {
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null)
  const [showTasks, setShowTasks] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const { trigger, success } = useHapticFeedback()

  // Filter recent projects based on search
  const filteredProjects = useMemo(() => {
    if (!searchQuery) return data.recentProjects
    return data.recentProjects.filter(project =>
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.address.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [data.recentProjects, searchQuery])

  // Get role-based display configuration
  const roleConfig = useMemo(() => {
    switch (data.userRole) {
      case 'admin':
        return {
          title: 'Admin Dashboard',
          primaryMetrics: ['totalProjects', 'unionDensity', 'alertsCount'],
          showAdvancedStats: true
        }
      case 'official':
        return {
          title: 'Official Dashboard',
          primaryMetrics: ['activeProjects', 'pendingAudits', 'membersCount'],
          showAdvancedStats: true
        }
      case 'lead_organiser':
        return {
          title: 'Lead Organiser Dashboard',
          primaryMetrics: ['activeProjects', 'completedMappings', 'unionDensity'],
          showAdvancedStats: false
        }
      default:
        return {
          title: 'Organiser Dashboard',
          primaryMetrics: ['activeProjects', 'recentActivity', 'alertsCount'],
          showAdvancedStats: false
        }
    }
  }, [data.userRole])

  // Get metric icon and color
  const getMetricInfo = (key: string) => {
    const metrics: Record<string, { icon: any; color: string; label: string }> = {
      totalProjects: { icon: Building, color: 'text-blue-600', label: 'Total Projects' },
      activeProjects: { icon: Activity, color: 'text-green-600', label: 'Active Projects' },
      completedMappings: { icon: MapPin, color: 'text-purple-600', label: 'Completed Mappings' },
      pendingAudits: { icon: ClipboardList, color: 'text-orange-600', label: 'Pending Audits' },
      unionDensity: { icon: Users, color: 'text-cyan-600', label: 'Union Density' },
      membersCount: { icon: UserPlus, color: 'text-indigo-600', label: 'Total Members' },
      recentActivity: { icon: Clock, color: 'text-pink-600', label: 'Recent Activity' },
      alertsCount: { icon: AlertTriangle, color: 'text-red-600', label: 'Active Alerts' }
    }
    return metrics[key] || { icon: Activity, color: 'text-gray-600', label: key }
  }

  // Get alert icon and color
  const getAlertInfo = (type: string) => {
    const alerts: Record<string, { icon: any; color: string }> = {
      safety: { icon: Shield, color: 'text-red-600' },
      compliance: { icon: AlertTriangle, color: 'text-orange-600' },
      union_rights: { icon: Users, color: 'text-blue-600' },
      urgent: { icon: AlertTriangle, color: 'text-red-600' }
    }
    return alerts[type] || { icon: Bell, color: 'text-gray-600' }
  }

  // Get task icon
  const getTaskIcon = (type: string) => {
    const tasks: Record<string, any> = {
      mapping: MapPin,
      audit: ClipboardList,
      follow_up: Clock,
      meeting: Calendar
    }
    return tasks[type] || Activity
  }

  // Get compliance rating color
  const getComplianceColor = (rating?: string) => {
    switch (rating) {
      case 'green': return 'bg-green-500'
      case 'amber': return 'bg-yellow-500'
      case 'red': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  // Handle metric tap
  const handleMetricTap = useCallback((metricKey: string) => {
    trigger()
    setSelectedMetric(metricKey === selectedMetric ? null : metricKey)
  }, [selectedMetric, trigger])

  // Handle project tap
  const handleProjectTap = useCallback((projectId: string) => {
    trigger()
    onNavigation(`/mobile/projects/${projectId}`)
  }, [onNavigation, trigger])

  // Handle quick action tap
  const handleQuickActionTap = useCallback((route: string) => {
    trigger()
    success()
    onNavigation(route)
  }, [onNavigation, trigger, success])

  // Handle task completion
  const handleTaskComplete = useCallback(async (taskId: string) => {
    trigger()
    await onTaskComplete(taskId)
    success()
  }, [onTaskComplete, trigger, success])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">{roleConfig.title}</h1>
              <p className="text-sm text-muted-foreground">
                Welcome back! Here's your organizing overview.
              </p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={refreshing || !isOnline}
              className="h-10 w-10"
            >
              <RefreshCw className={`h-5 w-5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="p-4 space-y-6">
          {/* Key Metrics */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Key Metrics</h2>
            <div className="grid grid-cols-2 gap-3">
              {roleConfig.primaryMetrics.map((metricKey) => {
                const metric = getMetricInfo(metricKey)
                const value = data.metrics[metricKey as keyof typeof data.metrics]
                const isSelected = selectedMetric === metricKey
                const MetricIcon = metric.icon

                return (
                  <Card
                    key={metricKey}
                    className={`cursor-pointer transition-all ${
                      isSelected ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => handleMetricTap(metricKey)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <MetricIcon className={`h-5 w-5 ${metric.color}`} />
                        {metricKey === 'alertsCount' && value > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {value}
                          </Badge>
                        )}
                      </div>
                      <div className="text-2xl font-bold text-gray-900">
                        {metricKey === 'unionDensity' ? `${value}%` : value}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metric.label}
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Expanded metric details */}
            {selectedMetric && (
              <Card className="mt-3 border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-medium">{getMetricInfo(selectedMetric).label}</h3>
                    <p className="text-sm text-muted-foreground">
                      Detailed information about this metric would appear here.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onNavigation('/mobile/analytics')}
                    >
                      View Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Quick Actions */}
          <div>
            <h2 className="text-lg font-semibold mb-3">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {data.quickActions.slice(0, 4).map((action) => (
                <Card
                  key={action.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleQuickActionTap(action.route)}
                >
                  <CardContent className="p-4">
                    <div className={`w-10 h-10 ${action.color} rounded-lg flex items-center justify-center mb-3`}>
                      {action.icon === 'map' && <MapPin className="h-5 w-5 text-white" />}
                      {action.icon === 'audit' && <ClipboardList className="h-5 w-5 text-white" />}
                      {action.icon === 'projects' && <Building className="h-5 w-5 text-white" />}
                      {action.icon === 'member' && <UserPlus className="h-5 w-5 text-white" />}
                    </div>
                    <h3 className="font-medium text-sm mb-1">{action.title}</h3>
                    <p className="text-xs text-muted-foreground">{action.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Recent Projects */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Recent Projects</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigation('/mobile/projects')}
              >
                View All
              </Button>
            </div>
            <div className="space-y-3">
              {filteredProjects.slice(0, 3).map((project) => (
                <Card
                  key={project.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handleProjectTap(project.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-medium text-sm mb-1">{project.name}</h3>
                        <p className="text-xs text-muted-foreground mb-2">{project.address}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={project.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {project.status}
                        </Badge>
                        {project.complianceRating && (
                          <div className={`w-3 h-3 ${getComplianceColor(project.complianceRating)} rounded-full`} />
                        )}
                      </div>
                    </div>

                    {(project.workforceSize || project.unionPercentage) && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {project.workforceSize && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{project.workforceSize} workers</span>
                          </div>
                        )}
                        {project.unionPercentage && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>{project.unionPercentage}% union</span>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Tasks and Alerts */}
          <div className="grid grid-cols-2 gap-3">
            {/* Tasks */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Tasks</CardTitle>
                  <Badge variant="outline">
                    {data.tasks.filter(t => !t.completed).length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.tasks.filter(t => !t.completed).slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg"
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => handleTaskComplete(task.id)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{task.title}</p>
                        {task.dueDate && (
                          <p className="text-xs text-muted-foreground">
                            Due {new Date(task.dueDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {data.tasks.filter(t => !t.completed).length > 2 && (
                  <Sheet open={showTasks} onOpenChange={setShowTasks}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View All Tasks
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[60vh]">
                      <SheetHeader>
                        <SheetTitle>Tasks</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6 space-y-3">
                        {data.tasks.filter(t => !t.completed).map((task) => {
                          const TaskIcon = getTaskIcon(task.type)
                          return (
                          <Card key={task.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={task.completed}
                                  onChange={() => handleTaskComplete(task.id)}
                                  className="h-4 w-4 mt-1"
                                />
                                <div className="flex-1">
                                  <h4 className="font-medium text-sm">{task.title}</h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <TaskIcon className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground capitalize">{task.type}</span>
                                    {task.dueDate && (
                                      <span className="text-xs text-muted-foreground">
                                        Due {new Date(task.dueDate).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <Badge variant={
                                  task.priority === 'high' ? 'destructive' :
                                  task.priority === 'medium' ? 'default' : 'secondary'
                                } className="text-xs">
                                  {task.priority}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                          )
                        })}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </CardContent>
            </Card>

            {/* Alerts */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Alerts</CardTitle>
                  <Badge variant="destructive">
                    {data.alerts.length}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {data.alerts.slice(0, 2).map((alert) => {
                    const alertInfo = getAlertInfo(alert.type)
                    const AlertIcon = alertInfo.icon
                    return (
                      <div
                        key={alert.id}
                        className="flex items-start gap-2 p-2 bg-red-50 rounded-lg"
                      >
                        <AlertIcon className={`h-4 w-4 ${alertInfo.color} mt-0.5`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{alert.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(alert.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {data.alerts.length > 2 && (
                  <Sheet open={showAlerts} onOpenChange={setShowAlerts}>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full mt-2">
                        View All Alerts
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[60vh]">
                      <SheetHeader>
                        <SheetTitle>Alerts</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6 space-y-3">
                        {data.alerts.map((alert) => {
                          const alertInfo = getAlertInfo(alert.type)
                          const AlertIcon = alertInfo.icon
                          return (
                            <Card key={alert.id}>
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <AlertIcon className={`h-5 w-5 ${alertInfo.color} mt-0.5`} />
                                  <div className="flex-1">
                                    <h4 className="font-medium text-sm">{alert.title}</h4>
                                    <p className="text-xs text-muted-foreground mt-1">{alert.message}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      <span className="text-xs text-muted-foreground">
                                        {new Date(alert.timestamp).toLocaleDateString()}
                                      </span>
                                      <Badge variant={
                                        alert.priority === 'high' ? 'destructive' :
                                        alert.priority === 'medium' ? 'default' : 'secondary'
                                      } className="text-xs">
                                        {alert.priority}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          )
                        })}
                      </div>
                    </SheetContent>
                  </Sheet>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}
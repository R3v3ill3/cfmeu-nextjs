'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import {
  Activity,
  Users,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Calendar,
  Clock,
  Zap,
  FileText,
  BarChart3,
  PieChart as PieChartIcon,
  RefreshCw,
  Download,
  Settings,
  Filter,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'

interface AnalyticsData {
  summary: {
    total_changes: number
    unique_employers: number
    unique_users: number
    avg_changes_per_employer: number
    most_active_user: {
      user_id: string
      change_count: number
    }
    most_changed_employer: {
      employer_id: string
      employer_name: string
      change_count: number
    }
  }
  change_trends: Array<{
    date: string
    change_count: number
    user_count: number
    employer_count: number
  }>
  conflict_analysis: Array<{
    conflict_type: string
    severity: string
    total_conflicts: number
    resolved_conflicts: number
    auto_resolved: number
    manual_resolved: number
    avg_resolution_time: string
    most_conflicted_fields: Array<{
      field: string
      count: number
    }>
    most_active_users: Array<{
      user_id: string
      conflicts: number
    }>
  }>
  field_change_frequency: Array<{
    field: string
    change_count: number
    percentage: number
  }>
  user_activity: Array<{
    user_id: string
    user_name: string
    user_email: string
    change_count: number
    conflict_count: number
    last_activity: string
  }>
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D']

interface EmployerChangeAnalyticsProps {
  className?: string
  defaultDateRange?: string
}

export function EmployerChangeAnalytics({
  className,
  defaultDateRange = '30d'
}: EmployerChangeAnalyticsProps) {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState(defaultDateRange)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string>('')
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [isPerformingAction, setIsPerformingAction] = useState(false)

  const supabase = createClientComponentClient()
  const { toast } = useToast()

  // Get date range based on selection
  const getDateRange = useCallback((range: string) => {
    const now = new Date()
    let startDate: Date

    switch (range) {
      case '7d':
        startDate = subDays(now, 7)
        break
      case '30d':
        startDate = subDays(now, 30)
        break
      case '90d':
        startDate = subDays(now, 90)
        break
      case '1y':
        startDate = subDays(now, 365)
        break
      default:
        startDate = subDays(now, 30)
    }

    return {
      start_date: startOfDay(startDate).toISOString().split('T')[0],
      end_date: endOfDay(now).toISOString().split('T')[0]
    }
  }, [])

  // Fetch analytics data
  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const dateParams = getDateRange(dateRange)
      const params = new URLSearchParams(dateParams)

      if (selectedEmployerId) {
        params.append('employer_id', selectedEmployerId)
      }

      if (selectedUserId) {
        params.append('user_id', selectedUserId)
      }

      const response = await fetch(`/api/analytics/employer-changes?${params}`)

      if (!response.ok) {
        throw new Error('Failed to fetch analytics')
      }

      const data = await response.json()
      setAnalytics(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      toast({
        title: 'Error',
        description: 'Failed to load analytics data',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }, [dateRange, selectedEmployerId, selectedUserId, getDateRange, toast])

  // Perform analytics actions
  const performAction = useCallback(async (action: string) => {
    setIsPerformingAction(true)

    try {
      const response = await fetch('/api/analytics/employer-changes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action })
      })

      if (!response.ok) {
        throw new Error('Failed to perform action')
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: 'Success',
          description: action === 'resolve_simple_conflicts'
            ? `Resolved ${result.result.conflicts_resolved} conflicts`
            : `Cleaned up ${result.deleted_conflicts} old conflicts`,
        })

        // Refresh analytics
        await fetchAnalytics()
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast({
        title: 'Error',
        description: `Failed to ${action.replace('_', ' ')}`,
        variant: 'destructive'
      })
    } finally {
      setIsPerformingAction(false)
    }
  }, [fetchAnalytics, toast])

  // Initial fetch
  useEffect(() => {
    fetchAnalytics()
  }, [fetchAnalytics])

  // Format percentage
  const formatPercentage = (value: number) => `${Math.round(value * 100) / 100}%`

  // Get conflict resolution rate
  const getConflictResolutionRate = () => {
    if (!analytics?.conflict_analysis.length) return 0
    const totalConflicts = analytics.conflict_analysis.reduce((sum, c) => sum + c.total_conflicts, 0)
    const resolvedConflicts = analytics.conflict_analysis.reduce((sum, c) => sum + c.resolved_conflicts, 0)
    return totalConflicts > 0 ? (resolvedConflicts / totalConflicts) * 100 : 0
  }

  // Get field change data for pie chart
  const getFieldChangeData = () => {
    if (!analytics?.field_change_frequency) return []
    return analytics.field_change_frequency.slice(0, 8).map(item => ({
      name: item.field,
      value: item.change_count
    }))
  }

  // Get conflict severity data
  const getConflictSeverityData = () => {
    if (!analytics?.conflict_analysis) return []
    return analytics.conflict_analysis.map(item => ({
      severity: item.severity,
      total: item.total_conflicts,
      resolved: item.resolved_conflicts
    }))
  }

  return (
    <div className={cn('w-full space-y-6', className)}>
      {/* Header Controls */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Employer Change Analytics
              </CardTitle>
              <CardDescription>
                Comprehensive analysis of employer data changes and collaboration patterns
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="1y">Last year</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={fetchAnalytics}
                disabled={isLoading}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {error ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <AlertTriangle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-600 mb-4">{error}</p>
              <Button onClick={fetchAnalytics}>Retry</Button>
            </div>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </CardContent>
        </Card>
      ) : analytics ? (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="conflicts">Conflicts</TabsTrigger>
            <TabsTrigger value="fields">Fields</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Activity className="h-4 w-4 text-blue-600" />
                    Total Changes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.summary.total_changes.toLocaleString()}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {analytics.summary.unique_employers} employers
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-green-600" />
                    Active Users
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{analytics.summary.unique_users}</div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(analytics.summary.avg_changes_per_employer)} changes/employer avg
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-orange-600" />
                    Conflicts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.conflict_analysis.reduce((sum, c) => sum + c.total_conflicts, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatPercentage(getConflictResolutionRate())} resolved
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Zap className="h-4 w-4 text-purple-600" />
                    Auto Resolved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {analytics.conflict_analysis.reduce((sum, c) => sum + c.auto_resolved, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(
                      (analytics.conflict_analysis.reduce((sum, c) => sum + c.auto_resolved, 0) /
                       Math.max(1, analytics.conflict_analysis.reduce((sum, c) => sum + c.total_conflicts, 0))) * 100
                    )}% of conflicts
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Most Active */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Most Active User</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">User {analytics.summary.most_active_user.user_id.slice(0, 8)}...</p>
                      <p className="text-sm text-muted-foreground">
                        {analytics.summary.most_active_user.change_count} changes
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-green-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Most Changed Employer</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{analytics.summary.most_changed_employer.employer_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {analytics.summary.most_changed_employer.change_count} changes
                      </p>
                    </div>
                    <FileText className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Field Change Frequency Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Top Changed Fields
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={getFieldChangeData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getFieldChangeData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Change Activity Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={analytics.change_trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="change_count"
                      stackId="1"
                      stroke="#8884d8"
                      fill="#8884d8"
                      name="Changes"
                    />
                    <Area
                      type="monotone"
                      dataKey="user_count"
                      stackId="2"
                      stroke="#82ca9d"
                      fill="#82ca9d"
                      name="Active Users"
                    />
                    <Area
                      type="monotone"
                      dataKey="employer_count"
                      stackId="3"
                      stroke="#ffc658"
                      fill="#ffc658"
                      name="Employers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conflicts Tab */}
          <TabsContent value="conflicts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conflict Analysis by Severity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getConflictSeverityData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="severity" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="total" fill="#ff7c7c" name="Total Conflicts" />
                      <Bar dataKey="resolved" fill="#90ee90" name="Resolved Conflicts" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Conflict Resolution Rates</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {analytics.conflict_analysis.map((conflict, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium capitalize">{conflict.severity} Severity</span>
                        <span>{conflict.resolved_conflicts}/{conflict.total_conflicts} resolved</span>
                      </div>
                      <Progress
                        value={conflict.total_conflicts > 0 ? (conflict.resolved_conflicts / conflict.total_conflicts) * 100 : 0}
                        className="h-2"
                      />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {/* Most Conflicted Fields */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Most Conflicted Fields</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {analytics.conflict_analysis[0]?.most_conflicted_fields?.map((field, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">{index + 1}</Badge>
                        <span className="font-medium">{field.field}</span>
                      </div>
                      <Badge>{field.count} conflicts</Badge>
                    </div>
                  )) || <p className="text-center text-gray-500">No conflicted fields</p>}
                </div>
              </CardContent>
            </Card>

            {/* Admin Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Admin Actions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={() => performAction('resolve_simple_conflicts')}
                    disabled={isPerformingAction}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {isPerformingAction ? 'Processing...' : 'Resolve Simple Conflicts'}
                  </Button>
                  <Button
                    onClick={() => performAction('cleanup_old_conflicts')}
                    disabled={isPerformingAction}
                    variant="outline"
                    className="w-full"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {isPerformingAction ? 'Processing...' : 'Cleanup Old Conflicts'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Field Change Frequency</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {analytics.field_change_frequency.map((field, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded">
                        <div className="flex items-center gap-3">
                          <span className="font-medium w-32">{field.field}</span>
                          <Badge variant="outline">{field.change_count} changes</Badge>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32">
                            <Progress value={field.percentage} className="h-2" />
                          </div>
                          <span className="text-sm text-gray-600 w-16 text-right">
                            {formatPercentage(field.percentage)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">User Activity Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {analytics.user_activity.map((user, index) => (
                      <div key={index} className="flex items-center justify-between p-4 border rounded">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <Users className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">{user.user_name}</p>
                            <p className="text-sm text-gray-600">{user.user_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <p className="font-medium">{user.change_count}</p>
                            <p className="text-xs text-gray-600">changes</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{user.conflict_count}</p>
                            <p className="text-xs text-gray-600">conflicts</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-gray-600">
                              {user.last_activity ? format(new Date(user.last_activity), 'MMM d') : 'Never'}
                            </p>
                            <p className="text-xs text-gray-500">last active</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  )
}
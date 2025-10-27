"use client"

import { useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calendar,
  Search,
  Filter,
  Users,
  Shield,
  Building,
  Clock,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  TrendingUp,
  Download,
  RefreshCw,
  Plus,
  Eye,
  Edit,
  Trash2,
  Settings,
  FileText,
  Target,
  Activity,
  Zap
} from "lucide-react"
import {
  FourPointRatingDisplay,
  FourPointTrendIndicator
} from "@/components/ui/FourPointRatingDisplay"
import { format, isAfter, subDays, startOfMonth, endOfMonth } from "date-fns"
import {
  FourPointRating,
  Assessment,
  AssessmentType,
  AssessmentStatus,
  AssessmentFilters,
  AssessmentSearch
} from "@/types/assessments"

interface AssessmentSummary {
  id: string
  employerId: string
  employerName: string
  employerRole: string
  assessmentType: AssessmentType
  status: AssessmentStatus
  assessmentDate: string
  lastUpdated: string
  overallScore?: FourPointRating
  assessorName: string
  nextAssessmentDue?: string
  completionPercentage: number
  hasOutstandingActions: boolean
  priority: 'high' | 'medium' | 'low'
}

interface ManagementStats {
  totalAssessments: number
  pendingAssessments: number
  inProgressAssessments: number
  completedAssessments: number
  overdueAssessments: number
  averageScore: number
  completionRate: number
  qualityScore: number
}

interface CalendarEvent {
  id: string
  title: string
  date: string
  type: 'assessment_due' | 'assessment_completed' | 'follow_up'
  employerName: string
  assessmentType?: AssessmentType
  priority?: 'high' | 'medium' | 'low'
}

interface AssessmentManagementDashboardProps {
  assessments: AssessmentSummary[]
  onRefresh?: () => void
  onExport?: () => void
  onAssessmentClick?: (assessmentId: string) => void
  onAssessmentEdit?: (assessmentId: string) => void
  onAssessmentDelete?: (assessmentId: string) => void
  onCreateAssessment?: (employerId: string, type: AssessmentType) => void
  className?: string
}

export function AssessmentManagementDashboard({
  assessments,
  onRefresh,
  onExport,
  onAssessmentClick,
  onAssessmentEdit,
  onAssessmentDelete,
  onCreateAssessment,
  className
}: AssessmentManagementDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<string>('all')
  const [selectedDateRange, setSelectedDateRange] = useState<string>('month')
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'employer' | 'score'>('date')

  // Calculate management statistics
  const stats: ManagementStats = useMemo(() => {
    const totalAssessments = assessments.length
    const pendingAssessments = assessments.filter(a => a.status === 'draft').length
    const inProgressAssessments = assessments.filter(a => a.status === 'submitted' || a.status === 'reviewed').length
    const completedAssessments = assessments.filter(a => a.status === 'approved').length
    const overdueAssessments = assessments.filter(a => {
      if (!a.nextAssessmentDue) return false
      return isAfter(new Date(), new Date(a.nextAssessmentDue))
    }).length

    const scoredAssessments = assessments.filter(a => a.overallScore)
    const averageScore = scoredAssessments.length > 0
      ? scoredAssessments.reduce((sum, a) => sum + (a.overallScore || 0), 0) / scoredAssessments.length
      : 0

    const completionRate = totalAssessments > 0 ? (completedAssessments / totalAssessments) * 100 : 0
    const qualityScore = Math.min(100, (averageScore / 4) * 100 * completionRate / 100)

    return {
      totalAssessments,
      pendingAssessments,
      inProgressAssessments,
      completedAssessments,
      overdueAssessments,
      averageScore,
      completionRate,
      qualityScore
    }
  }, [assessments])

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    let filtered = assessments

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(a =>
        a.employerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.assessmentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.assessorName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter(a => a.status === selectedFilter)
    }

    // Apply date range filter
    const now = new Date()
    let startDate: Date

    switch (selectedDateRange) {
      case 'week':
        startDate = subDays(now, 7)
        break
      case 'month':
        startDate = startOfMonth(now)
        break
      case 'quarter':
        startDate = subDays(now, 90)
        break
      case 'year':
        startDate = subDays(now, 365)
        break
      default:
        startDate = subDays(now, 30)
    }

    filtered = filtered.filter(a => new Date(a.assessmentDate) >= startDate)

    return filtered
  }, [assessments, searchQuery, selectedFilter, selectedDateRange])

  // Sort assessments
  const sortedAssessments = useMemo(() => {
    return [...filteredAssessments].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.assessmentDate).getTime() - new Date(a.assessmentDate).getTime()
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'employer':
          return a.employerName.localeCompare(b.employerName)
        case 'score':
          return (b.overallScore || 0) - (a.overallScore || 0)
        default:
          return 0
      }
    })
  }, [filteredAssessments, sortBy])

  // Generate calendar events
  const calendarEvents: CalendarEvent[] = useMemo(() => {
    const events: CalendarEvent[] = []

    // Assessment due events
    assessments.forEach(assessment => {
      if (assessment.nextAssessmentDue) {
        events.push({
          id: `due-${assessment.id}`,
          title: `Assessment Due`,
          date: assessment.nextAssessmentDue,
          type: 'assessment_due',
          employerName: assessment.employerName,
          assessmentType: assessment.assessmentType,
          priority: assessment.priority
        })
      }

      // Assessment completed events
      if (assessment.status === 'approved') {
        events.push({
          id: `completed-${assessment.id}`,
          title: 'Assessment Completed',
          date: assessment.assessmentDate,
          type: 'assessment_completed',
          employerName: assessment.employerName,
          assessmentType: assessment.assessmentType
        })
      }
    })

    return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [assessments])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-amber-600 bg-amber-50 border-amber-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStatusColor = (status: AssessmentStatus) => {
    switch (status) {
      case 'draft':
        return 'text-gray-600 bg-gray-50'
      case 'submitted':
        return 'text-blue-600 bg-blue-50'
      case 'reviewed':
        return 'text-amber-600 bg-amber-50'
      case 'approved':
        return 'text-green-600 bg-green-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getAssessmentTypeIcon = (type: AssessmentType) => {
    switch (type) {
      case 'union_respect':
        return Users
      case 'safety_4_point':
        return Shield
      case 'subcontractor_use':
        return Building
      case 'role_specific':
        return Target
      default:
        return FileText
    }
  }

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Assessment Management Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Monitor and manage all 4-point assessments across the organization
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <RefreshCw className="h-4 w-4 mr-1" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={onExport}>
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
              {onCreateAssessment && (
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  New Assessment
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">
                {stats.pendingAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.inProgressAssessments}
              </div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {stats.completedAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">
                {stats.overdueAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Overdue</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">
                {stats.averageScore.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Score</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {stats.completionRate.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Completion</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.qualityScore.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Quality</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Alerts */}
      {stats.overdueAssessments > 0 && (
        <Alert className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>{stats.overdueAssessments}</strong> assessment{stats.overdueAssessments > 1 ? 's' : ''} are overdue and require immediate attention.
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <Tabs defaultValue="assessments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="queue">Assessment Queue</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="quality">Quality Control</TabsTrigger>
        </TabsList>

        {/* Assessments Tab */}
        <TabsContent value="assessments" className="space-y-4">
          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search assessments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedDateRange} onValueChange={setSelectedDateRange}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Date range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">Last Quarter</SelectItem>
                  <SelectItem value="year">Last Year</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy as any}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="employer">Employer</SelectItem>
                  <SelectItem value="score">Score</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Assessment List */}
          <div className="space-y-3">
            {sortedAssessments.map((assessment) => {
              const TypeIcon = getAssessmentTypeIcon(assessment.assessmentType)

              return (
                <Card key={assessment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-full flex items-center justify-center text-white",
                            assessment.assessmentType === 'union_respect' ? 'bg-blue-600' :
                            assessment.assessmentType === 'safety_4_point' ? 'bg-green-600' :
                            assessment.assessmentType === 'subcontractor_use' ? 'bg-purple-600' :
                            'bg-orange-600'
                          )}>
                            <TypeIcon className="h-5 w-5" />
                          </div>
                          <div>
                            <div className="font-medium">{assessment.employerName}</div>
                            <div className="text-sm text-muted-foreground">
                              {assessment.assessmentType.replace('_', ' ')} • {assessment.employerRole.replace('_', ' ')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Assessed by {assessment.assessorName} • {format(new Date(assessment.assessmentDate), 'MMM d, yyyy')}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          {assessment.overallScore && (
                            <FourPointRatingDisplay
                              rating={assessment.overallScore}
                              variant="minimal"
                            />
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <Badge className={cn("text-xs", getPriorityColor(assessment.priority))}>
                              {assessment.priority}
                            </Badge>
                            <Badge className={cn("text-xs", getStatusColor(assessment.status))}>
                              {assessment.status}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onAssessmentClick?.(assessment.id)}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          {onAssessmentEdit && (
                            <Button variant="ghost" size="sm" onClick={() => onAssessmentEdit?.(assessment.id)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {onAssessmentDelete && (
                            <Button variant="ghost" size="sm" onClick={() => onAssessmentDelete?.(assessment.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {assessment.hasOutstandingActions && (
                      <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                        <div className="flex items-center gap-2 text-sm text-amber-800">
                          <AlertTriangle className="h-4 w-4" />
                          <span>Outstanding actions require attention</span>
                        </div>
                      </div>
                    )}

                    {assessment.nextAssessmentDue && isAfter(new Date(), new Date(assessment.nextAssessmentDue)) && (
                      <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded">
                        <div className="flex items-center gap-2 text-sm text-red-800">
                          <Clock className="h-4 w-4" />
                          <span>Overdue - was due {format(new Date(assessment.nextAssessmentDue), 'MMM d, yyyy')}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {sortedAssessments.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No assessments found</p>
              <p className="text-sm">
                {searchQuery || selectedFilter !== 'all' ? 'Try adjusting your filters or search query.' : 'No assessments match the current criteria.'}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Assessment Queue Tab */}
        <TabsContent value="queue" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Assessment Queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* High Priority */}
                <div className="space-y-3">
                  <h4 className="font-medium text-red-600">High Priority</h4>
                  {assessments.filter(a => a.priority === 'high' && a.status !== 'approved').map((assessment) => (
                    <div key={assessment.id} className="flex items-center justify-between p-3 border-l-4 border-l-red-500 bg-red-50 rounded">
                      <div>
                        <div className="font-medium">{assessment.employerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {assessment.assessmentType.replace('_', ' ')} • Due {format(new Date(assessment.nextAssessmentDue || ''), 'MMM d')}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => onAssessmentClick?.(assessment.id)}>
                        Start Assessment
                      </Button>
                    </div>
                  ))}
                  {assessments.filter(a => a.priority === 'high' && a.status !== 'approved').length === 0 && (
                    <p className="text-sm text-muted-foreground">No high priority assessments</p>
                  )}
                </div>

                {/* Medium Priority */}
                <div className="space-y-3">
                  <h4 className="font-medium text-amber-600">Medium Priority</h4>
                  {assessments.filter(a => a.priority === 'medium' && a.status !== 'approved').map((assessment) => (
                    <div key={assessment.id} className="flex items-center justify-between p-3 border-l-4 border-l-amber-500 bg-amber-50 rounded">
                      <div>
                        <div className="font-medium">{assessment.employerName}</div>
                        <div className="text-sm text-muted-foreground">
                          {assessment.assessmentType.replace('_', ' ')} • Due {format(new Date(assessment.nextAssessmentDue || ''), 'MMM d')}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => onAssessmentClick?.(assessment.id)}>
                        Start Assessment
                      </Button>
                    </div>
                  ))}
                  {assessments.filter(a => a.priority === 'medium' && a.status !== 'approved').length === 0 && (
                    <p className="text-sm text-muted-foreground">No medium priority assessments</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Assessment Calendar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Upcoming Events */}
                <div className="space-y-3">
                  <h4 className="font-medium">Upcoming Events</h4>
                  {calendarEvents
                    .filter(event => new Date(event.date) >= new Date())
                    .slice(0, 10)
                    .map((event) => {
                      const TypeIcon = event.type === 'assessment_due' ? Clock :
                                     event.type === 'assessment_completed' ? CheckCircle :
                                     Activity

                      return (
                        <div key={event.id} className="flex items-center justify-between p-3 border rounded">
                          <div className="flex items-center gap-3">
                            <TypeIcon className={cn(
                              "h-5 w-5",
                              event.type === 'assessment_due' ? 'text-red-600' :
                              event.type === 'assessment_completed' ? 'text-green-600' :
                              'text-blue-600'
                            )} />
                            <div>
                              <div className="font-medium">{event.title}</div>
                              <div className="text-sm text-muted-foreground">
                                {event.employerName}
                                {event.assessmentType && ` • ${event.assessmentType.replace('_', ' ')}`}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium">
                              {format(new Date(event.date), 'MMM d, yyyy')}
                            </div>
                            {event.priority && (
                              <Badge className={cn("text-xs mt-1", getPriorityColor(event.priority))}>
                                {event.priority}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance Trends */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Performance Trends
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <FourPointTrendIndicator
                    currentRating={stats.averageScore as FourPointRating}
                    previousRatings={assessments
                      .filter(a => a.overallScore)
                      .map(a => ({
                        date: a.assessmentDate,
                        rating: a.overallScore!
                      }))}
                    period="month"
                    showChart={true}
                    showStats={true}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Assessment Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {['union_respect', 'safety_4_point', 'subcontractor_use', 'role_specific'].map((type) => {
                    const count = assessments.filter(a => a.assessmentType === type).length
                    const percentage = assessments.length > 0 ? (count / assessments.length) * 100 : 0
                    const TypeIcon = getAssessmentTypeIcon(type as AssessmentType)

                    return (
                      <div key={type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {count} ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                        <Progress value={percentage} className="h-2" />
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Quality Control Tab */}
        <TabsContent value="quality" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quality Control Metrics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {stats.qualityScore.toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Overall Quality Score</div>
                  <Progress value={stats.qualityScore} className="mt-2" />
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.completionRate.toFixed(0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">Completion Rate</div>
                  <Progress value={stats.completionRate} className="mt-2" />
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.averageScore.toFixed(1)}
                  </div>
                  <div className="text-sm text-muted-foreground">Average Score</div>
                  <FourPointRatingDisplay
                    rating={stats.averageScore as FourPointRating}
                    variant="minimal"
                    className="mt-2"
                  />
                </div>
              </div>

              {/* Quality Recommendations */}
              <div className="mt-6 space-y-3">
                <h4 className="font-medium">Quality Recommendations</h4>
                {stats.qualityScore < 70 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      Quality score below 70%. Focus on completing pending assessments and improving assessment consistency.
                    </AlertDescription>
                  </Alert>
                )}
                {stats.completionRate < 80 && (
                  <Alert>
                    <Clock className="h-4 w-4" />
                    <AlertDescription>
                      Completion rate below 80%. Prioritize completing overdue assessments to improve overall quality metrics.
                    </AlertDescription>
                  </Alert>
                )}
                {stats.averageScore < 3 && (
                  <Alert>
                    <TrendingUp className="h-4 w-4" />
                    <AlertDescription>
                      Average score below 3.0. Consider additional training for assessors and review assessment criteria.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
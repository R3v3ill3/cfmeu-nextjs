"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Building,
  Users,
  Shield,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  BarChart3,
  Calendar,
  Filter,
  Download,
  RefreshCw,
  Eye,
  Settings
} from "lucide-react"
import {
  FourPointRatingDisplay,
  FourPointTrendIndicator
} from "@/components/ui/FourPointRatingDisplay"
import { EnhancedEmployerRatingCard } from "@/components/ratings/EnhancedEmployerRatingCard"
import { format, isAfter, subDays } from "date-fns"
import {
  FourPointRating,
  Assessment,
  EmployerRole
} from "@/types/assessments"

interface ProjectEmployerData {
  id: string
  name: string
  role: EmployerRole
  overallRating?: FourPointRating
  previousRating?: FourPointRating
  assessments: Assessment[]
  lastAssessmentDate?: string
  nextAssessmentDue?: string
  complianceScore?: number
  outstandingTasks: number
  cbusCompliance: boolean
  incolinkCompliance: boolean
  isActive: boolean
}

interface ProjectComplianceDashboardProps {
  projectId: string
  projectName: string
  employers: ProjectEmployerData[]
  onRefresh?: () => void
  onExport?: () => void
  onEmployerClick?: (employerId: string) => void
  onEmployerEdit?: (employerId: string) => void
  onEmployerViewDetails?: (employerId: string) => void
  className?: string
}

interface DashboardStats {
  totalEmployers: number
  activeEmployers: number
  overallComplianceScore: number
  averageRating: number
  completedAssessments: number
  outstandingTasks: number
  criticalIssues: number
  upcomingAssessments: number
}

interface ComplianceTrend {
  date: string
  score: number
  employersAssessed: number
}

export function ProjectComplianceDashboard({
  projectId,
  projectName,
  employers,
  onRefresh,
  onExport,
  onEmployerClick,
  onEmployerEdit,
  onEmployerViewDetails,
  className
}: ProjectComplianceDashboardProps) {
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'active' | 'issues' | 'overdue'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'compliance' | 'last-assessment'>('rating')

  // Calculate dashboard statistics
  const stats: DashboardStats = useMemo(() => {
    const activeEmployers = employers.filter(e => e.isActive).length
    const employersWithRatings = employers.filter(e => e.overallRating)
    const averageRating = employersWithRatings.length > 0
      ? employersWithRatings.reduce((sum, e) => sum + (e.overallRating || 0), 0) / employersWithRatings.length
      : 0

    const totalComplianceScore = employers.reduce((sum, e) => sum + (e.complianceScore || 0), 0)
    const overallComplianceScore = employers.length > 0 ? totalComplianceScore / employers.length : 0

    const completedAssessments = employers.reduce((sum, e) => sum + e.assessments.length, 0)
    const outstandingTasks = employers.reduce((sum, e) => sum + e.outstandingTasks, 0)
    const criticalIssues = employers.filter(e => !e.cbusCompliance || !e.incolinkCompliance).length

    const upcomingAssessments = employers.filter(e => {
      if (!e.nextAssessmentDue) return false
      return isAfter(new Date(), subDays(new Date(e.nextAssessmentDue), 7))
    }).length

    return {
      totalEmployers: employers.length,
      activeEmployers,
      overallComplianceScore,
      averageRating,
      completedAssessments,
      outstandingTasks,
      criticalIssues,
      upcomingAssessments
    }
  }, [employers])

  // Filter employers based on selected filter
  const filteredEmployers = useMemo(() => {
    switch (selectedFilter) {
      case 'active':
        return employers.filter(e => e.isActive)
      case 'issues':
        return employers.filter(e => e.outstandingTasks > 0 || !e.cbusCompliance || !e.incolinkCompliance)
      case 'overdue':
        return employers.filter(e => {
          if (!e.nextAssessmentDue) return false
          return isAfter(new Date(), new Date(e.nextAssessmentDue))
        })
      default:
        return employers
    }
  }, [employers, selectedFilter])

  // Sort employers
  const sortedEmployers = useMemo(() => {
    return [...filteredEmployers].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'rating':
          return (b.overallRating || 0) - (a.overallRating || 0)
        case 'compliance':
          return (b.complianceScore || 0) - (a.complianceScore || 0)
        case 'last-assessment':
          const aDate = a.lastAssessmentDate ? new Date(a.lastAssessmentDate).getTime() : 0
          const bDate = b.lastAssessmentDate ? new Date(b.lastAssessmentDate).getTime() : 0
          return bDate - aDate
        default:
          return 0
      }
    })
  }, [filteredEmployers, sortBy])

  // Generate mock trend data
  const trendData: ComplianceTrend[] = useMemo(() => {
    const data: ComplianceTrend[] = []
    for (let i = 30; i >= 0; i -= 7) {
      const date = subDays(new Date(), i)
      data.push({
        date: date.toISOString().split('T')[0],
        score: 65 + Math.random() * 30, // Mock score between 65-95
        employersAssessed: Math.floor(Math.random() * 10) + 5
      })
    }
    return data
  }, [])

  const getHealthStatus = () => {
    if (stats.criticalIssues > 0) return { status: 'critical', color: 'red', icon: AlertTriangle }
    if (stats.overallComplianceScore < 70) return { status: 'warning', color: 'amber', icon: TrendingDown }
    if (stats.upcomingAssessments > 3) return { status: 'attention', color: 'blue', icon: Clock }
    return { status: 'healthy', color: 'green', icon: CheckCircle }
  }

  const healthStatus = getHealthStatus()
  const HealthIcon = healthStatus.icon

  return (
    <div className={className}>
      {/* Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {projectName} - Compliance Dashboard
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Real-time overview of project compliance and employer performance
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
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalEmployers}
              </div>
              <div className="text-xs text-muted-foreground">Total Employers</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {stats.activeEmployers}
              </div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.overallComplianceScore.toFixed(0)}%
              </div>
              <div className="text-xs text-muted-foreground">Compliance</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {stats.completedAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Assessments</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">
                {stats.outstandingTasks}
              </div>
              <div className="text-xs text-muted-foreground">Open Tasks</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-red-600">
                {stats.criticalIssues}
              </div>
              <div className="text-xs text-muted-foreground">Issues</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-amber-600">
                {stats.upcomingAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Due Soon</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health Status */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center",
              `bg-${healthStatus.color}-100`
            )}>
              <HealthIcon className={`h-6 w-6 text-${healthStatus.color}-600`} />
            </div>
            <div className="flex-1">
              <div className="font-medium">
                Project Health Status: {healthStatus.status.charAt(0).toUpperCase() + healthStatus.status.slice(1)}
              </div>
              <div className="text-sm text-muted-foreground">
                {healthStatus.status === 'critical' && `${stats.criticalIssues} critical issues require immediate attention.`}
                {healthStatus.status === 'warning' && `Overall compliance score of ${stats.overallComplianceScore.toFixed(0)}% needs improvement.`}
                {healthStatus.status === 'attention' && `${stats.upcomingAssessments} assessments due in the next week.`}
                {healthStatus.status === 'healthy' && 'All systems operating within normal parameters.'}
              </div>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              Configure Alerts
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="employers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="employers">Employers</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
        </TabsList>

        {/* Employers Tab */}
        <TabsContent value="employers" className="space-y-4">
          {/* Filters and Sort */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All', count: employers.length },
                { id: 'active', label: 'Active', count: employers.filter(e => e.isActive).length },
                { id: 'issues', label: 'Issues', count: employers.filter(e => e.outstandingTasks > 0 || !e.cbusCompliance || !e.incolinkCompliance).length },
                { id: 'overdue', label: 'Overdue', count: employers.filter(e => {
                  if (!e.nextAssessmentDue) return false
                  return isAfter(new Date(), new Date(e.nextAssessmentDue))
                }).length }
              ].map((filter) => (
                <Button
                  key={filter.id}
                  variant={selectedFilter === filter.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedFilter(filter.id as any)}
                  className="gap-1"
                >
                  {filter.label}
                  <Badge variant="secondary" className="text-xs">
                    {filter.count}
                  </Badge>
                </Button>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="rating">Sort by Rating</option>
                <option value="name">Sort by Name</option>
                <option value="compliance">Sort by Compliance</option>
                <option value="last-assessment">Sort by Last Assessment</option>
              </select>
            </div>
          </div>

          {/* Employer Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedEmployers.map((employer) => (
              <EnhancedEmployerRatingCard
                key={employer.id}
                employerId={employer.id}
                employerName={employer.name}
                employerRole={employer.role}
                overallRating={employer.overallRating}
                previousRating={employer.previousRating}
                assessments={employer.assessments}
                lastAssessmentDate={employer.lastAssessmentDate}
                nextAssessmentDue={employer.nextAssessmentDue}
                complianceScore={employer.complianceScore}
                outstandingTasks={employer.outstandingTasks}
                onClick={() => onEmployerClick?.(employer.id)}
                onEdit={() => onEmployerEdit?.(employer.id)}
                onViewDetails={() => onEmployerViewDetails?.(employer.id)}
                showTrends={true}
                showActions={true}
              />
            ))}
          </div>

          {sortedEmployers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Building className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">No employers found</p>
              <p className="text-sm">
                {selectedFilter === 'all' ? 'No employers have been added to this project yet.' :
                 `No employers match the "${selectedFilter}" filter.`}
              </p>
            </div>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Compliance Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Overall Rating Trend */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Overall Rating Trend</h4>
                    <FourPointTrendIndicator
                      currentRating={stats.averageRating as FourPointRating}
                      previousRatings={trendData.map(d => ({
                        date: d.date,
                        rating: Math.max(1, Math.min(4, d.score / 25)) as FourPointRating
                      }))}
                      period="month"
                      showChart={true}
                      showStats={true}
                    />
                  </div>

                  {/* Compliance Score Trend */}
                  <div className="space-y-3">
                    <h4 className="font-medium">Compliance Score Trend</h4>
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-4">
                        <span className="text-sm font-medium">Current Compliance</span>
                        <span className="text-2xl font-bold text-blue-600">
                          {stats.overallComplianceScore.toFixed(0)}%
                        </span>
                      </div>
                      <Progress value={stats.overallComplianceScore} className="h-3" />
                      <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                        <span>7 days ago: 68%</span>
                        <span className="text-green-600">+{stats.overallComplianceScore - 68}%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* CBUS Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">CBUS Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Compliant Employers</span>
                    <span className="font-bold">
                      {employers.filter(e => e.cbusCompliance).length}/{employers.length}
                    </span>
                  </div>
                  <Progress
                    value={(employers.filter(e => e.cbusCompliance).length / employers.length) * 100}
                    className="h-2"
                  />

                  <div className="space-y-2">
                    {employers.filter(e => !e.cbusCompliance).map((employer) => (
                      <div key={employer.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="text-sm font-medium">{employer.name}</span>
                        <Badge variant="destructive">Non-compliant</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* INCOLINK Compliance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">INCOLINK Compliance Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Compliant Employers</span>
                    <span className="font-bold">
                      {employers.filter(e => e.incolinkCompliance).length}/{employers.length}
                    </span>
                  </div>
                  <Progress
                    value={(employers.filter(e => e.incolinkCompliance).length / employers.length) * 100}
                    className="h-2"
                  />

                  <div className="space-y-2">
                    {employers.filter(e => !e.incolinkCompliance).map((employer) => (
                      <div key={employer.id} className="flex items-center justify-between p-2 bg-red-50 rounded">
                        <span className="text-sm font-medium">{employer.name}</span>
                        <Badge variant="destructive">Non-compliant</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Assessments Tab */}
        <TabsContent value="assessments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Assessment Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">
                    {stats.completedAssessments}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Completed</div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-green-600">
                    {employers.filter(e => e.assessments.length > 0).length}
                  </div>
                  <div className="text-sm text-muted-foreground">Employers Assessed</div>
                </div>

                <div className="text-center p-4 border rounded-lg">
                  <div className="text-3xl font-bold text-purple-600">
                    {stats.upcomingAssessments}
                  </div>
                  <div className="text-sm text-muted-foreground">Due This Week</div>
                </div>
              </div>

              {/* Recent Assessments */}
              <div className="mt-6">
                <h4 className="font-medium mb-3">Recent Assessments</h4>
                <div className="space-y-2">
                  {employers
                    .flatMap(e => e.assessments.map(a => ({ ...a, employerName: e.name })))
                    .sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())
                    .slice(0, 5)
                    .map((assessment) => (
                      <div key={assessment.id} className="flex items-center justify-between p-3 border rounded">
                        <div>
                          <div className="font-medium text-sm">{(assessment as any).employerName}</div>
                          <div className="text-xs text-muted-foreground">
                            {assessment.assessment_type.replace('_', ' ')} • {format(new Date(assessment.assessment_date), 'MMM d, yyyy')}
                          </div>
                        </div>
                        <FourPointRatingDisplay
                          rating={
                            assessment.assessment_type === 'union_respect' ? (assessment as UnionRespectAssessment).overall_score :
                            assessment.assessment_type === 'safety_4_point' ? (assessment as Safety4PointAssessment).overall_safety_score :
                            3
                          }
                          variant="minimal"
                        />
                      </div>
                    ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
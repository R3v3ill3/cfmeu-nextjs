"use client"

import { useState, useCallback, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Building,
  Users,
  Shield,
  Star,
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  Eye,
  Edit,
  MoreHorizontal,
  Activity
} from "lucide-react"
import {
  FourPointRatingDisplay,
  FourPointTrendIndicator,
  DetailedFourPointRatingDisplay,
  MiniTrendIndicator
} from "@/components/ui/FourPointRatingDisplay"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import {
  FourPointRating,
  Assessment,
  UnionRespectAssessment,
  Safety4PointAssessment,
  EmployerRole
} from "@/types/assessments"

interface EnhancedEmployerRatingCardProps {
  employerId: string
  employerName: string
  employerRole: EmployerRole
  overallRating?: FourPointRating
  previousRating?: FourPointRating
  assessments: Assessment[]
  lastAssessmentDate?: string
  nextAssessmentDue?: string
  complianceScore?: number
  outstandingTasks?: number
  onClick?: () => void
  onEdit?: () => void
  onViewDetails?: () => void
  onViewHistory?: () => void
  compact?: boolean
  showTrends?: boolean
  showActions?: boolean
  className?: string
}

interface AssessmentBreakdown {
  type: string
  rating?: FourPointRating
  label: string
  color: string
  icon: React.ComponentType<{ className?: string }>
  lastUpdated?: string
  trend?: 'up' | 'down' | 'stable'
}

export function EnhancedEmployerRatingCard({
  employerId,
  employerName,
  employerRole,
  overallRating,
  previousRating,
  assessments,
  lastAssessmentDate,
  nextAssessmentDue,
  complianceScore,
  outstandingTasks = 0,
  onClick,
  onEdit,
  onViewDetails,
  onViewHistory,
  compact = false,
  showTrends = true,
  showActions = true,
  className
}: EnhancedEmployerRatingCardProps) {
  const { trigger } = useHapticFeedback()
  const [isExpanded, setIsExpanded] = useState(false)

  const handleClick = useCallback(() => {
    trigger('selection')
    onClick?.()
  }, [onClick, trigger])

  const handleEdit = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    trigger('selection')
    onEdit?.()
  }, [onEdit, trigger])

  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    trigger('selection')
    onViewDetails?.()
  }, [onViewDetails, trigger])

  const handleViewHistory = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    trigger('selection')
    onViewHistory?.()
  }, [onViewHistory, trigger])

  // Calculate assessment breakdowns
  const assessmentBreakdowns: AssessmentBreakdown[] = useMemo(() => {
    const breakdowns: AssessmentBreakdown[] = [
      {
        type: 'union_respect',
        label: 'Union Respect',
        color: '#3b82f6',
        icon: Users
      },
      {
        type: 'safety_4_point',
        label: 'Safety',
        color: '#10b981',
        icon: Shield
      },
      {
        type: 'subcontractor_use',
        label: 'Subcontractor Relations',
        color: '#8b5cf6',
        icon: Building
      },
      {
        type: 'role_specific',
        label: 'Role Specific',
        color: '#f59e0b',
        icon: Star
      }
    ]

    return breakdowns.map(breakdown => {
      const assessment = assessments.find(a => a.assessment_type === breakdown.type)

      if (assessment) {
        let rating: FourPointRating | undefined
        let lastUpdated = assessment.assessment_date

        switch (assessment.assessment_type) {
          case 'union_respect':
            rating = (assessment as UnionRespectAssessment).overall_score
            break
          case 'safety_4_point':
            rating = (assessment as Safety4PointAssessment).overall_safety_score
            break
          default:
            rating = undefined
        }

        return {
          ...breakdown,
          rating,
          lastUpdated
        }
      }

      return breakdown
    })
  }, [assessments])

  // Calculate completion percentage
  const completionPercentage = useMemo(() => {
    const completedAssessments = assessmentBreakdowns.filter(b => b.rating).length
    return (completedAssessments / assessmentBreakdowns.length) * 100
  }, [assessmentBreakdowns])

  // Get status color
  const getStatusColor = () => {
    if (!overallRating) return 'bg-gray-100 text-gray-700 border-gray-200'
    if (overallRating >= 4) return 'bg-green-100 text-green-700 border-green-200'
    if (overallRating >= 3) return 'bg-lime-100 text-lime-700 border-lime-200'
    if (overallRating >= 2) return 'bg-amber-100 text-amber-700 border-amber-200'
    return 'bg-red-100 text-red-700 border-red-200'
  }

  const getRoleIcon = () => {
    switch (employerRole) {
      case 'head_contractor':
        return Building
      case 'subcontractor':
        return Users
      case 'trade_contractor':
        return Star
      case 'labour_hire':
        return Users
      case 'consultant':
        return BarChart3
      default:
        return Building
    }
  }

  const RoleIcon = getRoleIcon()

  if (compact) {
    return (
      <Card
        className={cn(
          "cursor-pointer hover:shadow-md transition-shadow duration-200",
          onClick && "hover:bg-accent/50",
          className
        )}
        onClick={handleClick}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarFallback className={getStatusColor()}>
                  <RoleIcon className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold text-sm">{employerName}</h3>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {employerRole.replace('_', ' ')}
                  </Badge>
                  {overallRating && (
                    <FourPointRatingDisplay
                      rating={overallRating}
                      variant="badge"
                      size="sm"
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {showTrends && previousRating && (
                <MiniTrendIndicator
                  currentRating={overallRating!}
                  previousRating={previousRating}
                />
              )}
              {onViewDetails && (
                <Button variant="ghost" size="sm" onClick={handleViewDetails}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={cn(
        "cursor-pointer hover:shadow-lg transition-all duration-200",
        onClick && "hover:bg-accent/50",
        className
      )}
      onClick={handleClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={getStatusColor()}>
                <RoleIcon className="h-6 w-6" />
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{employerName}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="gap-1">
                  <RoleIcon className="h-3 w-3" />
                  {employerRole.replace('_', ' ')}
                </Badge>
                {lastAssessmentDate && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(lastAssessmentDate), 'MMM d')}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showActions && (
            <div className="flex items-center gap-1">
              {onViewDetails && (
                <Button variant="ghost" size="sm" onClick={handleViewDetails}>
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              {onEdit && (
                <Button variant="ghost" size="sm" onClick={handleEdit}>
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Overall Rating Display */}
        {overallRating && (
          <div className="mt-4">
            <FourPointRatingDisplay
              rating={overallRating}
              label="Overall 4-Point Rating"
              size="md"
              variant="detailed"
              confidenceLevel={Math.round(completionPercentage)}
              showTrend={showTrends}
              trend={previousRating ? (overallRating > previousRating ? 'up' : overallRating < previousRating ? 'down' : 'stable') : undefined}
              previousRating={previousRating}
              lastUpdated={lastAssessmentDate}
              showConfidence={true}
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Assessment Breakdowns */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Assessment Breakdown</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setIsExpanded(!isExpanded)
              }}
            >
              {isExpanded ? 'Show Less' : 'Show All'}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {assessmentBreakdowns.slice(0, isExpanded ? undefined : 2).map((breakdown) => {
              const Icon = breakdown.icon
              return (
                <div
                  key={breakdown.type}
                  className="flex items-center gap-3 p-3 rounded-lg border"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                    style={{ backgroundColor: breakdown.color }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{breakdown.label}</div>
                    {breakdown.rating ? (
                      <FourPointRatingDisplay
                        rating={breakdown.rating}
                        variant="minimal"
                        size="sm"
                      />
                    ) : (
                      <div className="text-xs text-muted-foreground">Not assessed</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Progress Overview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Assessment Progress</span>
            <span className="text-muted-foreground">
              {assessmentBreakdowns.filter(b => b.rating).length} of {assessmentBreakdowns.length} complete
            </span>
          </div>
          <Progress value={completionPercentage} className="h-2" />
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-4 text-sm">
          {nextAssessmentDue && (
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>Due: {format(new Date(nextAssessmentDue), 'MMM d, yyyy')}</span>
            </div>
          )}

          {outstandingTasks > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <AlertTriangle className="h-4 w-4" />
              <span>{outstandingTasks} task{outstandingTasks > 1 ? 's' : ''}</span>
            </div>
          )}

          {complianceScore !== undefined && (
            <div className="flex items-center gap-1 text-blue-600">
              <CheckCircle className="h-4 w-4" />
              <span>{complianceScore}% compliant</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {showActions && (
          <div className="flex gap-2 pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleViewHistory}
            >
              <Activity className="h-4 w-4 mr-1" />
              History
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleEdit}
            >
              <Edit className="h-4 w-4 mr-1" />
              Update
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Enhanced version with detailed breakdown
export function DetailedEmployerRatingCard({
  employerId,
  employerName,
  employerRole,
  overallRating,
  previousRating,
  assessments,
  lastAssessmentDate,
  nextAssessmentDue,
  complianceScore,
  outstandingTasks = 0,
  onClick,
  onEdit,
  onViewDetails,
  onViewHistory,
  className
}: Omit<EnhancedEmployerRatingCardProps, 'compact' | 'showTrends' | 'showActions'>) {
  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {employerName}
              <Badge variant="outline">{employerRole.replace('_', ' ')}</Badge>
            </CardTitle>
            {lastAssessmentDate && (
              <p className="text-sm text-muted-foreground">
                Last assessed: {format(new Date(lastAssessmentDate), 'MMMM d, yyyy')}
              </p>
            )}
          </div>
          {overallRating && (
            <FourPointRatingDisplay
              rating={overallRating}
              variant="badge"
              size="lg"
            />
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Overall Rating with Trend */}
        {overallRating && (
          <DetailedFourPointRatingDisplay
            rating={overallRating}
            label="Overall 4-Point Rating"
            description="Based on all completed assessments"
            breakdown={assessments.map(assessment => {
              let rating: FourPointRating
              let label: string
              let weight: number

              switch (assessment.assessment_type) {
                case 'union_respect':
                  rating = (assessment as UnionRespectAssessment).overall_score
                  label = 'Union Respect'
                  weight = 25
                  break
                case 'safety_4_point':
                  rating = (assessment as Safety4PointAssessment).overall_safety_score
                  label = 'Safety'
                  weight = 25
                  break
                default:
                  rating = 3
                  label = assessment.assessment_type
                  weight = 25
              }

              return {
                category: label,
                score: rating,
                weight
              }
            })}
            trend={previousRating ? {
              current: overallRating,
              previous: previousRating,
              trend: overallRating > previousRating ? 'up' : overallRating < previousRating ? 'down' : 'stable',
              changePercentage: ((overallRating - previousRating) / previousRating) * 100
            } : undefined}
            confidenceLevel={85}
            lastUpdated={lastAssessmentDate}
            totalAssessments={assessments.length}
          />
        )}

        {/* Recent Activity */}
        <div className="space-y-3">
          <h4 className="font-medium">Recent Activity</h4>
          <div className="space-y-2">
            {assessments.slice(0, 3).map((assessment) => (
              <div key={assessment.id} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <div>
                    <div className="font-medium text-sm">
                      {assessment.assessment_type === 'union_respect' ? 'Union Respect' :
                       assessment.assessment_type === 'safety_4_point' ? 'Safety Assessment' :
                       assessment.assessment_type}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(assessment.assessment_date), 'MMM d, yyyy')}
                    </div>
                  </div>
                </div>
                <div className="text-sm font-medium">
                  {assessment.assessment_type === 'union_respect' && (
                    (assessment as UnionRespectAssessment).overall_score
                  )}/4
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-blue-600">
              {assessments.length}
            </div>
            <div className="text-xs text-muted-foreground">Total Assessments</div>
          </div>

          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-green-600">
              {overallRating || '-'}
            </div>
            <div className="text-xs text-muted-foreground">Current Rating</div>
          </div>

          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-orange-600">
              {outstandingTasks}
            </div>
            <div className="text-xs text-muted-foreground">Open Tasks</div>
          </div>

          <div className="text-center p-3 rounded-lg border">
            <div className="text-2xl font-bold text-purple-600">
              {complianceScore || '-'}%
            </div>
            <div className="text-xs text-muted-foreground">Compliance</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button variant="outline" onClick={onViewHistory}>
            <Activity className="h-4 w-4 mr-2" />
            View History
          </Button>
          <Button onClick={onEdit}>
            <Edit className="h-4 w-4 mr-2" />
            Update Assessment
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
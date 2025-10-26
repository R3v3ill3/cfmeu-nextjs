"use client"

import { useState, useEffect, useCallback, useMemo } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  ArrowLeftRight,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  MessageSquare,
  Calendar,
  User
} from "lucide-react"
import { RatingComparison, RatingTrack, RoleType, TrafficLightRating } from "@/types/rating"
import { TrafficLightDisplay } from "./TrafficLightDisplay"
import { useHapticFeedback } from "../shared/HapticFeedback"

interface RatingComparisonProps {
  comparison: RatingComparison
  showHistoricalContext?: boolean
  showActions?: boolean
  className?: string
  onResolveDiscrepancy?: () => void
  onAddComment?: () => void
  onViewDetails?: (track: RatingTrack) => void
  onSwitchRole?: (role: RoleType) => void
}

// Discrepancy severity styling
const discrepancyConfig = {
  none: {
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle,
    label: "No Discrepancy",
  },
  minor: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
    icon: Info,
    label: "Minor Discrepancy",
  },
  moderate: {
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    icon: AlertTriangle,
    label: "Moderate Discrepancy",
  },
  significant: {
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: AlertTriangle,
    label: "Significant Discrepancy",
  },
  critical: {
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: AlertTriangle,
    label: "Critical Discrepancy",
  },
}

// Rating comparison card
function RatingComparisonCard({
  title,
  subtitle,
  rating,
  confidence,
  lastUpdated,
  track,
  onViewDetails,
  isSelected,
  onClick,
}: {
  title: string
  subtitle?: string
  rating?: TrafficLightRating
  confidence?: string
  lastUpdated?: string
  track: RatingTrack
  onViewDetails?: () => void
  isSelected?: boolean
  onClick?: () => void
}) {
  const { selection } = useHapticFeedback()

  const handleClick = useCallback(() => {
    selection()
    onClick?.()
  }, [selection, onClick])

  const handleViewDetails = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selection()
    onViewDetails?.()
  }, [selection, onViewDetails])

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isSelected && "ring-2 ring-primary ring-offset-2",
        onClick && "touch-manipulation"
      )}
      onClick={handleClick}
    >
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm">{title}</h3>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {rating && (
                <TrafficLightDisplay
                  rating={rating}
                  confidence={confidence as any}
                  size="sm"
                  showConfidence={false}
                />
              )}
            </div>
          </div>

          {/* Rating details */}
          {rating && (
            <div className="flex items-center justify-between p-2 bg-muted rounded">
              <span className="text-xs font-medium capitalize">
                {track.replace('_', ' ')} Rating
              </span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground capitalize">
                  {rating}
                </span>
                {confidence && (
                  <Badge variant="outline" className="text-xs">
                    {confidence}
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Metadata */}
          {lastUpdated && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>Updated {new Date(lastUpdated).toLocaleDateString()}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleViewDetails}
              >
                <Eye className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// Discrepancy explanation component
function DiscrepancyExplanation({
  discrepancy,
  onResolve,
  onAddComment,
}: {
  discrepancy: NonNullable<RatingComparison['discrepancy']>
  onResolve?: () => void
  onAddComment?: () => void
}) {
  const config = discrepancyConfig[discrepancy.severity]
  const Icon = config.icon
  const { trigger } = useHapticFeedback()

  const handleResolve = useCallback(() => {
    trigger()
    onResolve?.()
  }, [trigger, onResolve])

  const handleAddComment = useCallback(() => {
    trigger()
    onAddComment?.()
  }, [trigger, onAddComment])

  if (discrepancy.severity === 'none') {
    return (
      <Card className={cn("border-2", config.borderColor, config.bgColor)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
            <div className="flex-1">
              <h4 className="font-medium text-sm text-green-800 mb-1">
                Ratings Aligned
              </h4>
              <p className="text-xs text-green-700">
                Both project data and organiser expertise ratings are consistent.
                This indicates good alignment between data-driven and experiential assessments.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border-2", config.borderColor, config.bgColor)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Icon className={cn("h-5 w-5 mt-0.5", config.color)} />
            <div className="flex-1">
              <h4 className={cn("font-medium text-sm mb-1", config.color)}>
                {config.label}
              </h4>
              <p className="text-xs text-gray-700 mb-2">
                {discrepancy.explanation}
              </p>
              {discrepancy.recommended_action && (
                <div className="p-2 bg-white/50 rounded text-xs">
                  <span className="font-medium">Recommended action:</span>
                  <p className="mt-1">{discrepancy.recommended_action}</p>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons for discrepancies */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleAddComment}
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              Add Comment
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={handleResolve}
            >
              <CheckCircle className="h-3 w-3 mr-1" />
              Investigate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// Historical trend component
function HistoricalTrend({
  trendData,
}: {
  trendData: Array<{ date: string; rating: TrafficLightRating; confidence: string }>
}) {
  const getRatingValue = (rating: TrafficLightRating): number => {
    const values = { red: 1, amber: 2, yellow: 3, green: 4 }
    return values[rating]
  }

  const latestTrend = trendData[trendData.length - 1]
  const previousTrend = trendData[trendData.length - 2]

  const trend = useMemo(() => {
    if (!latestTrend || !previousTrend) return 'stable'
    const diff = getRatingValue(latestTrend.rating) - getRatingValue(previousTrend.rating)
    if (diff > 0) return 'improving'
    if (diff < 0) return 'declining'
    return 'stable'
  }, [latestTrend, previousTrend])

  const TrendIcon = trend === 'improving' ? TrendingUp : trend === 'declining' ? TrendingDown : Minus
  const trendColor = trend === 'improving' ? 'text-green-600' : trend === 'declining' ? 'text-red-600' : 'text-blue-600'

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Historical Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Recent trend</span>
            <div className="flex items-center gap-1">
              <TrendIcon className={cn("h-4 w-4", trendColor)} />
              <span className={cn("text-sm font-medium", trendColor)}>
                {trend}
              </span>
            </div>
          </div>

          {/* Mini timeline */}
          <div className="space-y-2">
            {trendData.slice(-3).map((data, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <div
                    className={cn(
                      "w-3 h-3 rounded-full",
                      data.rating === 'green' && "bg-green-500",
                      data.rating === 'yellow' && "bg-yellow-500",
                      data.rating === 'amber' && "bg-amber-500",
                      data.rating === 'red' && "bg-red-500"
                    )}
                  />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs capitalize">{data.rating}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(data.date).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function RatingComparison({
  comparison,
  showHistoricalContext = true,
  showActions = true,
  className,
  onResolveDiscrepancy,
  onAddComment,
  onViewDetails,
  onSwitchRole,
}: RatingComparisonProps) {
  const [selectedTrack, setSelectedTrack] = useState<RatingTrack | null>(null)
  const { selection } = useHapticFeedback()

  const discrepancyConfig = useMemo(
    () => discrepancyConfig[comparison.discrepancy.severity],
    [comparison.discrepancy.severity]
  )

  const handleTrackSelect = useCallback((track: RatingTrack) => {
    setSelectedTrack(track === selectedTrack ? null : track)
    selection()
  }, [selectedTrack, selection])

  const mockTrendData = useMemo(() => [
    { date: '2024-01-01', rating: 'green' as TrafficLightRating, confidence: 'high' },
    { date: '2024-02-01', rating: 'yellow' as TrafficLightRating, confidence: 'medium' },
    { date: '2024-03-01', rating: 'green' as TrafficLightRating, confidence: 'high' },
  ], [])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rating Comparison</CardTitle>
            <Badge variant="outline" className="capitalize">
              {comparison.role_context}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Comparing project data and organiser expertise ratings for {comparison.employer_name}
          </p>
        </CardHeader>
      </Card>

      {/* Discrepancy alert */}
      <DiscrepancyExplanation
        discrepancy={comparison.discrepancy}
        onResolve={onResolveDiscrepancy}
        onAddComment={onAddComment}
      />

      {/* Rating comparison cards */}
      <div className="grid grid-cols-1 gap-3">
        <RatingComparisonCard
          title="Project Data Rating"
          subtitle="Based on compliance metrics and performance data"
          rating={comparison.project_data_rating?.rating}
          confidence={comparison.project_data_rating?.confidence}
          lastUpdated={comparison.project_data_rating?.calculated_at}
          track="project_data"
          onViewDetails={() => onViewDetails?.('project_data')}
          isSelected={selectedTrack === 'project_data'}
          onClick={() => handleTrackSelect('project_data')}
        />

        <div className="flex items-center justify-center">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ArrowLeftRight className="h-4 w-4" />
            <span className="text-xs">VS</span>
          </div>
        </div>

        <RatingComparisonCard
          title="Organiser Expertise Rating"
          subtitle="Based on organiser experience and assessment"
          rating={comparison.organiser_expertise_rating?.rating}
          confidence={comparison.organiser_expertise_rating?.confidence}
          lastUpdated={comparison.organiser_expertise_rating?.calculated_at}
          track="organiser_expertise"
          onViewDetails={() => onViewDetails?.('organiser_expertise')}
          isSelected={selectedTrack === 'organiser_expertise'}
          onClick={() => handleTrackSelect('organiser_expertise')}
        />
      </div>

      {/* Detailed comparison tabs */}
      {selectedTrack && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base capitalize">
              {selectedTrack.replace('_', ' ')} Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="factors">Factors</TabsTrigger>
                <TabsTrigger value="context">Context</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-3 mt-4">
                <div className="text-center p-4">
                  <TrafficLightDisplay
                    rating={
                      selectedTrack === 'project_data'
                        ? comparison.project_data_rating?.rating || 'green'
                        : comparison.organiser_expertise_rating?.rating || 'green'
                    }
                    confidence="high"
                    size="lg"
                    showLabel={true}
                    showConfidence={true}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Last updated</span>
                    <span className="font-medium">
                      {selectedTrack === 'project_data'
                        ? comparison.project_data_rating?.calculated_at
                        : comparison.organiser_expertise_rating?.calculated_at
                        ? new Date(
                            selectedTrack === 'project_data'
                              ? comparison.project_data_rating?.calculated_at || ''
                              : comparison.organiser_expertise_rating?.calculated_at || ''
                          ).toLocaleDateString()
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Confidence level</span>
                    <span className="font-medium">
                      {selectedTrack === 'project_data'
                        ? comparison.project_data_rating?.confidence || 'medium'
                        : comparison.organiser_expertise_rating?.confidence || 'medium'}
                    </span>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="factors" className="space-y-3 mt-4">
                <div className="space-y-3">
                  {[
                    { name: 'Compliance', value: 85, status: 'good' },
                    { name: 'Communication', value: 72, status: 'average' },
                    { name: 'Cooperation', value: 90, status: 'excellent' },
                    { name: 'Safety', value: 78, status: 'good' },
                  ].map((factor, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{factor.name}</span>
                        <span className="font-medium">{factor.value}%</span>
                      </div>
                      <Progress value={factor.value} className="h-2" />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="context" className="space-y-3 mt-4">
                <div className="space-y-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Assessment Context</h4>
                    <p className="text-xs text-muted-foreground">
                      This rating is based on {selectedTrack === 'project_data'
                        ? 'objective project metrics and compliance data'
                        : 'subjective organiser expertise and experience'
                      }.
                    </p>
                  </div>

                  <div className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium text-sm mb-2">Role Context</h4>
                    <p className="text-xs text-muted-foreground">
                      Assessed from the perspective of a {comparison.role_context}.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Historical context */}
      {showHistoricalContext && (
        <HistoricalTrend trendData={mockTrendData} />
      )}

      {/* Role switcher */}
      {showActions && onSwitchRole && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Current role: {comparison.role_context}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSwitchRole(comparison.role_context)}
              >
                Switch Role
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
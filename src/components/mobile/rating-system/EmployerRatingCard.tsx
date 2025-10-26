"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Building2,
  MapPin,
  Users,
  Calendar,
  TrendingUp,
  TrendingDown,
  MoreVertical,
  Star,
  Clock
} from "lucide-react"
import { EmployerRatingData, TrafficLightRating, ConfidenceLevel } from "@/types/rating"
import { TrafficLightDisplay, TrafficLightIndicator } from "./TrafficLightDisplay"
import { useHapticFeedback } from "../shared/HapticFeedback"
import { SwipeActions, swipeActions } from "../shared/SwipeActions"

interface EmployerRatingCardProps {
  employer: EmployerRatingData
  size?: "compact" | "normal" | "detailed"
  showActions?: boolean
  showTrends?: boolean
  showProjectCount?: boolean
  enableSwipe?: boolean
  className?: string
  onClick?: () => void
  onEdit?: () => void
  onViewDetails?: () => void
  onViewTrends?: () => void
  onRate?: () => void
  onToggleFavorite?: () => void
}

// Function to calculate rating trend
function getRatingTrend(history: any[]): 'up' | 'down' | 'stable' | 'no-data' {
  if (history.length < 2) return 'no-data'

  const recent = history[0]
  const previous = history[1]

  const ratingOrder = { red: 0, amber: 1, yellow: 2, green: 3 }
  const currentScore = ratingOrder[recent.rating as TrafficLightRating]
  const previousScore = ratingOrder[previous.rating as TrafficLightRating]

  if (currentScore > previousScore) return 'up'
  if (currentScore < previousScore) return 'down'
  return 'stable'
}

// Function to get confidence level from rating
function getConfidenceFromRating(rating?: any): ConfidenceLevel {
  if (!rating) return 'low'
  return rating.confidence || 'medium'
}

export function EmployerRatingCard({
  employer,
  size = "normal",
  showActions = true,
  showTrends = true,
  showProjectCount = true,
  enableSwipe = true,
  className,
  onClick,
  onEdit,
  onViewDetails,
  onViewTrends,
  onRate,
  onToggleFavorite,
}: EmployerRatingCardProps) {
  const { selection, onPress } = useHapticFeedback()

  const trend = React.useMemo(() => getRatingTrend(employer.rating_history), [employer.rating_history])
  const projectDataConfidence = React.useMemo(() => getConfidenceFromRating(employer.project_data_rating), [employer.project_data_rating])
  const organiserConfidence = React.useMemo(() => getConfidenceFromRating(employer.organiser_expertise_rating), [employer.organiser_expertise_rating])

  const handleCardClick = React.useCallback(() => {
    selection()
    onClick?.()
  }, [selection, onClick])

  const handleRate = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onPress()
    onRate?.()
  }, [onPress, onRate])

  const handleEdit = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selection()
    onEdit?.()
  }, [selection, onEdit])

  const handleViewDetails = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selection()
    onViewDetails?.()
  }, [selection, onViewDetails])

  const handleViewTrends = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    selection()
    onViewTrends?.()
  }, [selection, onViewTrends])

  const handleToggleFavorite = React.useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onPress()
    onToggleFavorite?.()
  }, [onPress, onToggleFavorite])

  // Card content based on size
  const cardContent = React.useMemo(() => {
    switch (size) {
      case "compact":
        return (
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-muted text-xs">
                  {employer.employer_name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm truncate">{employer.employer_name}</h3>
                {employer.primary_trade && (
                  <p className="text-xs text-muted-foreground">{employer.primary_trade}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {employer.project_data_rating && (
                <TrafficLightIndicator
                  rating={employer.project_data_rating.rating}
                  confidence={projectDataConfidence}
                />
              )}
              {showActions && (
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )

      case "detailed":
        return (
          <div className="p-4 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-12 w-12">
                  <AvatarFallback className="bg-muted text-sm">
                    {employer.employer_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{employer.employer_name}</h3>
                  {employer.abn && (
                    <p className="text-xs text-muted-foreground">ABN: {employer.abn}</p>
                  )}
                  {employer.primary_trade && (
                    <Badge variant="secondary" className="mt-1">
                      {employer.primary_trade}
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleToggleFavorite}
              >
                <Star className="h-4 w-4" />
              </Button>
            </div>

            {/* Location and stats */}
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {employer.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{employer.location}</span>
                </div>
              )}
              {showProjectCount && employer.project_count > 0 && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span>{employer.project_count} project{employer.project_count !== 1 ? 's' : ''}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>Updated {new Date(employer.last_updated).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Rating displays */}
            <div className="space-y-3">
              {/* Project Data Rating */}
              {employer.project_data_rating && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Project Data Rating</p>
                    <p className="text-xs text-muted-foreground">
                      Based on compliance and performance
                    </p>
                  </div>
                  <TrafficLightDisplay
                    rating={employer.project_data_rating.rating}
                    confidence={projectDataConfidence}
                    size="md"
                  />
                </div>
              )}

              {/* Organiser Expertise Rating */}
              {employer.organiser_expertise_rating && (
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm font-medium">Organiser Expertise</p>
                    <p className="text-xs text-muted-foreground">
                      Based on organiser assessment
                    </p>
                  </div>
                  <TrafficLightDisplay
                    rating={employer.organiser_expertise_rating.rating}
                    confidence={organiserConfidence}
                    size="md"
                  />
                </div>
              )}
            </div>

            {/* Trend indicator */}
            {showTrends && trend !== 'no-data' && (
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded-lg">
                {trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                {trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                {trend === 'stable' && <TrendingUp className="h-4 w-4 text-blue-600" />}
                <span className="text-xs text-blue-800">
                  {trend === 'up' && 'Improving trend'}
                  {trend === 'down' && 'Declining trend'}
                  {trend === 'stable' && 'Stable performance'}
                </span>
              </div>
            )}

            {/* Action buttons */}
            {showActions && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleViewDetails}
                >
                  View Details
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={handleViewTrends}
                >
                  Trends
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleRate}
                >
                  Rate
                </Button>
              </div>
            )}
          </div>
        )

      default: // normal
        return (
          <div className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-muted text-sm">
                    {employer.employer_name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">{employer.employer_name}</h3>
                  {employer.primary_trade && (
                    <p className="text-xs text-muted-foreground">{employer.primary_trade}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {employer.project_data_rating && (
                  <TrafficLightIndicator
                    rating={employer.project_data_rating.rating}
                    confidence={projectDataConfidence}
                  />
                )}
                {showTrends && trend !== 'no-data' && (
                  <div className="flex items-center gap-1">
                    {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-600" />}
                    {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-600" />}
                    {trend === 'stable' && <TrendingUp className="h-3 w-3 text-blue-600" />}
                  </div>
                )}
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {employer.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  <span className="truncate">{employer.location}</span>
                </div>
              )}
              {showProjectCount && employer.project_count > 0 && (
                <div className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  <span>{employer.project_count}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            {showActions && (
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleViewDetails}
                >
                  Details
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs"
                  onClick={handleRate}
                >
                  Rate
                </Button>
              </div>
            )}
          </div>
        )
    }
  }, [
    size,
    employer,
    projectDataConfidence,
    organiserConfidence,
    trend,
    showActions,
    showTrends,
    showProjectCount,
    handleCardClick,
    handleRate,
    handleEdit,
    handleViewDetails,
    handleViewTrends,
    handleToggleFavorite,
  ])

  const card = (
    <Card
      className={cn(
        "transition-all duration-200 hover:shadow-md cursor-pointer touch-manipulation",
        size === "compact" && "border-l-4",
        className
      )}
      onClick={handleCardClick}
    >
      {cardContent}
    </Card>
  )

  // Wrap with swipe actions if enabled
  if (enableSwipe && showActions) {
    const swipeActionsList = [
      swipeActions.rate(() => {
        onPress()
        onRate?.()
      }),
      swipeActions.edit(() => {
        selection()
        onEdit?.()
      }),
    ]

    return (
      <SwipeActions
        rightActions={swipeActionsList}
        className="mb-3"
      >
        {card}
      </SwipeActions>
    )
  }

  return <div className="mb-3">{card}</div>
}

// List component for displaying multiple employer cards
export function EmployerRatingList({
  employers,
  loading = false,
  onEmployerClick,
  onEmployerRate,
  onEmployerEdit,
  className,
}: {
  employers: EmployerRatingData[]
  loading?: boolean
  onEmployerClick?: (employer: EmployerRatingData) => void
  onEmployerRate?: (employer: EmployerRatingData) => void
  onEmployerEdit?: (employer: EmployerRatingData) => void
  className?: string
}) {
  if (loading) {
    return (
      <div className={cn("space-y-3", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Card key={index} className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  if (employers.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium text-foreground mb-1">No employers found</h3>
        <p className="text-sm text-muted-foreground">
          Try adjusting your search or filters to find employers.
        </p>
      </Card>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      {employers.map((employer) => (
        <EmployerRatingCard
          key={employer.id}
          employer={employer}
          onClick={() => onEmployerClick?.(employer)}
          onRate={() => onEmployerRate?.(employer)}
          onEdit={() => onEmployerEdit?.(employer)}
          enableSwipe={true}
        />
      ))}
    </div>
  )
}
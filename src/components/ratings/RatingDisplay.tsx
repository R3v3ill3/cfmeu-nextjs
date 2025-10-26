"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, TrendingUp, TrendingDown, Minus, Info } from "lucide-react"
import { EmployerRatingData, TrafficLightRating, ConfidenceLevel } from "@/types/rating"
import { useEmployerRatings } from "@/hooks/useRatings"
import { useRatingDisplayOptions } from "@/context/RatingContext"

interface RatingDisplayProps {
  employerId: string
  employerName: string
  variant?: "card" | "list" | "compact"
  showDetails?: boolean
  className?: string
}

// Rating color mapping
const ratingColors: Record<TrafficLightRating, { bg: string; text: string; border: string }> = {
  green: { bg: "bg-green-100", text: "text-green-800", border: "border-green-200" },
  amber: { bg: "bg-amber-100", text: "text-amber-800", border: "border-amber-200" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  red: { bg: "bg-red-100", text: "text-red-800", border: "border-red-200" },
}

// Confidence level indicators
const confidenceIcons: Record<ConfidenceLevel, React.ReactNode> = {
  very_high: <div className="w-2 h-2 bg-green-500 rounded-full" />,
  high: <div className="w-2 h-2 bg-blue-500 rounded-full" />,
  medium: <div className="w-2 h-2 bg-amber-500 rounded-full" />,
  low: <div className="w-2 h-2 bg-red-500 rounded-full" />,
}

function RatingBadge({
  rating,
  confidence,
  showConfidence,
  size = "default"
}: {
  rating: TrafficLightRating
  confidence?: ConfidenceLevel
  showConfidence?: boolean
  size?: "sm" | "default"
}) {
  const colors = ratingColors[rating]
  const sizeClasses = size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${colors.bg} ${colors.text} ${colors.border} ${sizeClasses} font-medium`}
          >
            <div className="flex items-center gap-1">
              {showConfidence && confidence && confidenceIcons[confidence]}
              <span className="capitalize">{rating}</span>
            </div>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div className="font-medium capitalize">{rating} Rating</div>
            {confidence && (
              <div className="flex items-center gap-1">
                {confidenceIcons[confidence]}
                <span>Confidence: {confidence.replace('_', ' ')}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function RatingTrend({
  current,
  previous
}: {
  current: TrafficLightRating
  previous?: TrafficLightRating
}) {
  if (!previous || previous === current) {
    return <Minus className="h-3 w-3 text-gray-400" />
  }

  const ratingValues: Record<TrafficLightRating, number> = {
    green: 4,
    amber: 3,
    yellow: 2,
    red: 1,
  }

  const currentValue = ratingValues[current]
  const previousValue = ratingValues[previous]

  if (currentValue > previousValue) {
    return <TrendingUp className="h-3 w-3 text-green-600" />
  } else {
    return <TrendingDown className="h-3 w-3 text-red-600" />
  }
}

export function RatingDisplay({
  employerId,
  employerName,
  variant = "card",
  showDetails = true,
  className = ""
}: RatingDisplayProps) {
  const { showConfidence, compactMode } = useRatingDisplayOptions()
  const {
    data: ratingData,
    isLoading,
    error
  } = useEmployerRatings(employerId)

  // Loading state
  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Skeleton className="h-5 w-16" />
        {showDetails && <Skeleton className="h-5 w-16" />}
      </div>
    )
  }

  // Error state
  if (error || !ratingData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-1 ${className}`}>
              <AlertCircle className="h-4 w-4 text-gray-400" />
              {showDetails && (
                <span className="text-xs text-muted-foreground">No rating</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs max-w-xs">
              {error instanceof Error
                ? `Failed to load rating: ${error.message}`
                : "No rating data available for this employer"
              }
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const {
    project_data_rating,
    organiser_expertise_rating,
    rating_history
  } = ratingData

  // Get previous rating for trend calculation
  const previousRating = rating_history.length > 0
    ? rating_history[rating_history.length - 1]
    : undefined

  const currentRating = project_data_rating || organiser_expertise_rating
  const previousRatingValue = previousRating?.rating

  if (!currentRating) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <Info className="h-4 w-4 text-gray-400" />
        {showDetails && !compactMode && (
          <span className="text-xs text-muted-foreground">Not rated</span>
        )}
      </div>
    )
  }

  // Compact variant - just show the rating badge
  if (variant === "compact" || compactMode) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <RatingBadge
          rating={currentRating.rating}
          confidence={currentRating.confidence}
          showConfidence={showConfidence}
          size="sm"
        />
      </div>
    )
  }

  // List variant - show rating with trend
  if (variant === "list") {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <RatingBadge
          rating={currentRating.rating}
          confidence={currentRating.confidence}
          showConfidence={showConfidence}
          size="sm"
        />
        <RatingTrend
          current={currentRating.rating}
          previous={previousRatingValue}
        />
      </div>
    )
  }

  // Card variant - show full rating details
  return (
    <div className={`space-y-2 ${className}`}>
      {/* Primary rating */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Rating:</span>
        <RatingBadge
          rating={currentRating.rating}
          confidence={currentRating.confidence}
          showConfidence={showConfidence}
        />
        <RatingTrend
          current={currentRating.rating}
          previous={previousRatingValue}
        />
      </div>

      {/* Show details if enabled */}
      {showDetails && (
        <div className="space-y-1">
          {/* Rating source */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Source:</span>
            <span className="text-xs capitalize">
              {project_data_rating ? "Project Data" : "Organiser"}
            </span>
          </div>

          {/* Last updated */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Updated:</span>
            <span className="text-xs">
              {new Date(currentRating.calculated_at).toLocaleDateString()}
            </span>
          </div>

          {/* Show discrepancy warning if both ratings exist and differ significantly */}
          {project_data_rating && organiser_expertise_rating &&
           project_data_rating.rating !== organiser_expertise_rating.rating && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-amber-600 cursor-help">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-xs">Rating discrepancy</span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs max-w-xs">
                    <div className="font-medium mb-1">Rating Discrepancy</div>
                    <div>Project data: {project_data_rating.rating}</div>
                    <div>Organiser expertise: {organiser_expertise_rating.rating}</div>
                    <div className="mt-1 text-muted-foreground">
                      Consider reviewing this employer for updated assessment
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  )
}

// Quick rating indicator for inline use (e.g., in tables)
export function QuickRatingIndicator({
  employerId,
  size = "sm"
}: {
  employerId: string
  size?: "sm" | "default"
}) {
  const { showConfidence } = useRatingDisplayOptions()
  const { data: ratingData, isLoading } = useEmployerRatings(employerId)

  if (isLoading) {
    return <Skeleton className={`h-4 w-12 rounded`} />
  }

  if (!ratingData) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-12 h-4 bg-gray-100 rounded flex items-center justify-center">
              <Minus className="h-3 w-3 text-gray-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">No rating data</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const primaryRating = ratingData.project_data_rating || ratingData.organiser_expertise_rating

  if (!primaryRating) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="w-12 h-4 bg-gray-100 rounded flex items-center justify-center">
              <Minus className="h-3 w-3 text-gray-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="text-xs">Not rated</div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const colors = ratingColors[primaryRating.rating]
  const sizeClasses = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1"

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center gap-1 ${colors.bg} ${colors.text} ${colors.border} ${sizeClasses} rounded border font-medium cursor-help`}>
            {showConfidence && confidenceIcons[primaryRating.confidence]}
            <span className="capitalize">{primaryRating.rating.slice(0, 1)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-1">
            <div className="font-medium capitalize">{primaryRating.rating} Rating</div>
            <div>Confidence: {primaryRating.confidence.replace('_', ' ')}</div>
            <div>Source: {ratingData.project_data_rating ? "Project Data" : "Organiser"}</div>
            <div>Updated: {new Date(primaryRating.calculated_at).toLocaleDateString()}</div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  TrendingUp,
  TrendingDown,
  TrendingUpIcon as TrendingFlat,
  ArrowUp,
  ArrowDown,
  Minus,
  Calendar,
  BarChart3,
  Activity,
  AlertTriangle
} from "lucide-react"
import { FourPointRating, getFourPointLabel, getFourPointColor } from "@/types/assessments"

interface TrendData {
  date: string
  rating: FourPointRating
  assessor?: string
  notes?: string
}

interface FourPointTrendIndicatorProps {
  currentRating: FourPointRating
  previousRatings: TrendData[]
  period?: 'week' | 'month' | 'quarter' | 'year' | 'all'
  showChart?: boolean
  showStats?: boolean
  compact?: boolean
  className?: string
}

interface TrendStats {
  direction: 'improving' | 'declining' | 'stable'
  changeValue: number
  changePercentage: number
  averageRating: number
  volatility: number
  totalAssessments: number
  trendStrength: 'strong' | 'moderate' | 'weak'
}

export function FourPointTrendIndicator({
  currentRating,
  previousRatings,
  period = 'quarter',
  showChart = true,
  showStats = true,
  compact = false,
  className
}: FourPointTrendIndicatorProps) {
  const [stats, setStats] = useState<TrendStats | null>(null)

  // Filter ratings based on period
  const getFilteredRatings = () => {
    if (period === 'all') return previousRatings

    const now = new Date()
    const cutoffDate = new Date()

    switch (period) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1)
        break
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3)
        break
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1)
        break
    }

    return previousRatings.filter(rating =>
      new Date(rating.date) >= cutoffDate
    )
  }

  // Calculate trend statistics
  useEffect(() => {
    const filteredRatings = getFilteredRatings()
    if (filteredRatings.length === 0) return

    const ratings = filteredRatings.map(r => r.rating)
    const averageRating = ratings.reduce((sum, r) => sum + r, 0) / ratings.length
    const firstRating = ratings[ratings.length - 1]
    const lastRating = ratings[0]

    const changeValue = lastRating - firstRating
    const changePercentage = (changeValue / firstRating) * 100

    // Calculate volatility (standard deviation)
    const variance = ratings.reduce((sum, r) => {
      return sum + Math.pow(r - averageRating, 2)
    }, 0) / ratings.length
    const volatility = Math.sqrt(variance)

    // Determine trend direction
    let direction: 'improving' | 'declining' | 'stable'
    if (changeValue > 0.3) {
      direction = 'improving'
    } else if (changeValue < -0.3) {
      direction = 'declining'
    } else {
      direction = 'stable'
    }

    // Determine trend strength based on consistency and change magnitude
    let trendStrength: 'strong' | 'moderate' | 'weak'
    const consistency = 1 - (volatility / 3) // Normalized volatility
    const changeMagnitude = Math.abs(changePercentage)

    if (consistency > 0.8 && changeMagnitude > 10) {
      trendStrength = 'strong'
    } else if (consistency > 0.6 && changeMagnitude > 5) {
      trendStrength = 'moderate'
    } else {
      trendStrength = 'weak'
    }

    setStats({
      direction,
      changeValue,
      changePercentage,
      averageRating,
      volatility,
      totalAssessments: ratings.length,
      trendStrength
    })
  }, [currentRating, previousRatings, period])

  if (!stats) {
    return (
      <Card className={cn("p-4", className)}>
        <CardContent className="p-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-4 w-4" />
            <span>No trend data available</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getTrendIcon = () => {
    switch (stats.direction) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-600" />
      case 'declining':
        return <TrendingDown className="h-5 w-5 text-red-600" />
      case 'stable':
        return <TrendingFlat className="h-5 w-5 text-gray-600" />
    }
  }

  const getTrendColor = () => {
    switch (stats.direction) {
      case 'improving':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'declining':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'stable':
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const getStrengthBadge = () => {
    const colors = {
      strong: 'bg-green-100 text-green-800 border-green-200',
      moderate: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      weak: 'bg-gray-100 text-gray-800 border-gray-200'
    }

    return (
      <Badge
        variant="outline"
        className={cn("text-xs", colors[stats.trendStrength])}
      >
        {stats.trendStrength} trend
      </Badge>
    )
  }

  if (compact) {
    return (
      <div className={cn("flex items-center gap-3 p-3 rounded-lg border", getTrendColor(), className)}>
        {getTrendIcon()}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {stats.direction === 'improving' ? 'Improving' :
               stats.direction === 'declining' ? 'Declining' : 'Stable'}
            </span>
            {getStrengthBadge()}
          </div>
          <div className="text-xs opacity-75">
            {stats.changeValue > 0 ? '+' : ''}{stats.changeValue.toFixed(1)} points
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold">
            {currentRating}/4
          </div>
          <div className="text-xs opacity-75">
            {getFourPointLabel(currentRating)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("", className)}>
      <CardContent className="p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getTrendIcon()}
            <div>
              <h3 className="font-semibold">
                Rating Trend
              </h3>
              <p className="text-sm text-muted-foreground">
                {period === 'all' ? 'All time' :
                 period === 'week' ? 'Last week' :
                 period === 'month' ? 'Last month' :
                 period === 'quarter' ? 'Last 3 months' :
                 'Last year'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {getStrengthBadge()}
            <div className="text-right">
              <div className="text-2xl font-bold">
                {currentRating}/4
              </div>
              <div className="text-sm text-muted-foreground">
                {getFourPointLabel(currentRating)}
              </div>
            </div>
          </div>
        </div>

        {/* Trend Summary */}
        <div className={cn(
          "p-4 rounded-lg border",
          getTrendColor()
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {stats.direction === 'improving' && <ArrowUp className="h-4 w-4" />}
              {stats.direction === 'declining' && <ArrowDown className="h-4 w-4" />}
              {stats.direction === 'stable' && <Minus className="h-4 w-4" />}
              <span className="font-medium">
                {stats.direction === 'improving' ? 'Improving trend' :
                 stats.direction === 'declining' ? 'Declining trend' :
                 'Stable performance'}
              </span>
            </div>
            <span className="font-bold">
              {stats.changeValue > 0 ? '+' : ''}{stats.changeValue.toFixed(1)} points
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({stats.changePercentage > 0 ? '+' : ''}{stats.changePercentage.toFixed(0)}%)
              </span>
            </span>
          </div>
        </div>

        {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-blue-600">
                {stats.averageRating.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Average Rating</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-green-600">
                {stats.totalAssessments}
              </div>
              <div className="text-xs text-muted-foreground">Total Assessments</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-orange-600">
                {stats.volatility.toFixed(1)}
              </div>
              <div className="text-xs text-muted-foreground">Volatility</div>
            </div>

            <div className="text-center p-3 rounded-lg border">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(stats.trendStrength === 'strong' ? 100 :
                           stats.trendStrength === 'moderate' ? 65 : 30)}%
              </div>
              <div className="text-xs text-muted-foreground">Trend Confidence</div>
            </div>
          </div>
        )}

        {/* Simple chart visualization */}
        {showChart && previousRatings.length > 1 && (
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Rating Progression</h4>
            <div className="space-y-2">
              {getFilteredRatings().slice(0, 10).reverse().map((rating, index) => {
                const isLatest = index === 0
                const ratingColor = getFourPointColor(rating.rating)
                const ratingPercentage = (rating.rating / 4) * 100

                return (
                  <div key={rating.date} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">
                          {new Date(rating.date).toLocaleDateString()}
                        </span>
                        {isLatest && (
                          <Badge variant="secondary" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rating.rating}/4</span>
                        {rating.assessor && (
                          <span className="text-muted-foreground">
                            by {rating.assessor}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="relative">
                      <Progress
                        value={ratingPercentage}
                        className="h-2"
                        style={{
                          '--progress-background': ratingColor
                        } as any}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Alerts */}
        {stats.direction === 'declining' && stats.changeValue < -1 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">
                Significant Decline Detected
              </p>
              <p className="text-xs text-red-700 mt-1">
                Rating has decreased by {Math.abs(stats.changeValue).toFixed(1)} points.
                Consider reviewing recent changes and implementing improvement measures.
              </p>
            </div>
          </div>
        )}

        {stats.direction === 'improving' && stats.changeValue > 1 && (
          <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
            <BarChart3 className="h-4 w-4 text-green-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-green-800">
                Strong Improvement Trend
              </p>
              <p className="text-xs text-green-700 mt-1">
                Rating has increased by {stats.changeValue.toFixed(1)} points.
                Keep maintaining current practices and standards.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Mini trend component for inline use
export function MiniTrendIndicator({
  currentRating,
  previousRating,
  className
}: {
  currentRating: FourPointRating
  previousRating?: FourPointRating
  className?: string
}) {
  if (!previousRating || previousRating === currentRating) {
    return (
      <div className={cn("flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Minus className="h-3 w-3" />
        <span>Stable</span>
      </div>
    )
  }

  const isImproving = currentRating > previousRating
  const change = currentRating - previousRating

  return (
    <div className={cn(
      "flex items-center gap-1 text-xs font-medium",
      isImproving ? "text-green-600" : "text-red-600",
      className
    )}>
      {isImproving ? (
        <ArrowUp className="h-3 w-3" />
      ) : (
        <ArrowDown className="h-3 w-3" />
      )}
      <span>
        {isImproving ? '+' : ''}{change.toFixed(1)}
      </span>
    </div>
  )
}
"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import {
  TrendingUp,
  TrendingDown,
  TrendingUpIcon as TrendingFlat,
  Star,
  Calendar,
  User,
  BarChart3,
  Target,
  CheckCircle,
  AlertCircle,
  Clock
} from "lucide-react"
import { FourPointRating, FourPointRatingLabel, getFourPointLabel, getFourPointColor } from "@/types/assessments"

interface FourPointRatingDisplayProps {
  rating: FourPointRating
  label?: string
  description?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'card' | 'badge' | 'minimal' | 'detailed'
  showTrend?: boolean
  trend?: 'up' | 'down' | 'stable'
  previousRating?: FourPointRating
  lastUpdated?: string
  assessor?: string
  confidenceLevel?: number
  showConfidence?: boolean
  className?: string
}

interface RatingTrendData {
  current: FourPointRating
  previous: FourPointRating
  trend: 'up' | 'down' | 'stable'
  changePercentage: number
}

interface RatingDistribution {
  rating: FourPointRating
  count: number
  percentage: number
}

interface DetailedRatingDisplayProps {
  rating: FourPointRating
  label: string
  description?: string
  breakdown?: {
    category: string
    score: FourPointRating
    weight: number
  }[]
  trend?: RatingTrendData
  history?: Array<{
    date: string
    rating: FourPointRating
    assessor: string
  }>
  confidenceLevel?: number
  lastUpdated?: string
  assessor?: string
  totalAssessments?: number
  distribution?: RatingDistribution[]
  className?: string
}

export function FourPointRatingDisplay({
  rating,
  label,
  description,
  size = 'md',
  variant = 'card',
  showTrend = false,
  trend,
  previousRating,
  lastUpdated,
  assessor,
  confidenceLevel,
  showConfidence = true,
  className
}: FourPointRatingDisplayProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0)

  const ratingColor = getFourPointColor(rating)
  const ratingLabel = getFourPointLabel(rating)
  const ratingPercentage = (rating / 4) * 100

  // Calculate trend if previous rating is provided but trend is not
  const calculatedTrend = trend || (previousRating
    ? rating > previousRating ? 'up'
    : rating < previousRating ? 'down'
    : 'stable'
    : undefined)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedProgress(ratingPercentage)
    }, 100)
    return () => clearTimeout(timer)
  }, [ratingPercentage])

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          card: 'p-3',
          title: 'text-sm',
          value: 'text-2xl',
          label: 'text-xs',
          progress: 'h-1'
        }
      case 'lg':
        return {
          card: 'p-6',
          title: 'text-lg',
          value: 'text-5xl',
          label: 'text-base',
          progress: 'h-3'
        }
      case 'xl':
        return {
          card: 'p-8',
          title: 'text-xl',
          value: 'text-6xl',
          label: 'text-lg',
          progress: 'h-4'
        }
      default:
        return {
          card: 'p-4',
          title: 'text-base',
          value: 'text-3xl',
          label: 'text-sm',
          progress: 'h-2'
        }
    }
  }

  const sizeClasses = getSizeClasses()

  const getTrendIcon = () => {
    switch (calculatedTrend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'stable':
        return <TrendingFlat className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const getTrendColor = () => {
    switch (calculatedTrend) {
      case 'up':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'down':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'stable':
        return 'text-gray-600 bg-gray-50 border-gray-200'
      default:
        return ''
    }
  }

  if (variant === 'minimal') {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center text-white font-semibold"
          )}
          style={{ backgroundColor: ratingColor }}
        >
          {rating}
        </div>
        <div>
          <div className="font-medium text-sm">{ratingLabel}</div>
          {label && <div className="text-xs text-muted-foreground">{label}</div>}
        </div>
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <Badge
        variant="outline"
        className={cn(
          "gap-1 border-2 font-medium",
          className
        )}
        style={{
          backgroundColor: `${ratingColor}20`,
          borderColor: ratingColor,
          color: ratingColor
        }}
      >
        <Star className="h-3 w-3" />
        {rating}/4 - {ratingLabel}
      </Badge>
    )
  }

  if (variant === 'detailed') {
    return (
      <Card className={cn("w-full", className)}>
        <CardHeader className={sizeClasses.card}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={sizeClasses.title}>{label}</CardTitle>
              {description && (
                <p className="text-sm text-muted-foreground mt-1">{description}</p>
              )}
            </div>
            {showTrend && calculatedTrend && previousRating && (
              <div className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium",
                getTrendColor()
              )}>
                {getTrendIcon()}
                <span>{previousRating} → {rating}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className={cn("space-y-4", sizeClasses.card)}>
          {/* Main rating display */}
          <div className="flex items-center gap-4">
            <div
              className={cn(
                "w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl"
              )}
              style={{ backgroundColor: ratingColor }}
            >
              {rating}
            </div>
            <div className="flex-1">
              <div className="font-semibold text-lg">{ratingLabel}</div>
              <Progress
                value={animatedProgress}
                className={cn("mt-2", sizeClasses.progress)}
                style={{
                  '--progress-background': ratingColor
                } as any}
              />
            </div>
          </div>

          {/* Confidence level */}
          {showConfidence && confidenceLevel !== undefined && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence Level</span>
                <span className="font-medium">{confidenceLevel}%</span>
              </div>
              <Progress value={confidenceLevel} className="h-2" />
            </div>
          )}

          {/* Metadata */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              {assessor && (
                <>
                  <User className="h-3 w-3" />
                  <span>{assessor}</span>
                </>
              )}
              {lastUpdated && (
                <>
                  <Calendar className="h-3 w-3" />
                  <span>{new Date(lastUpdated).toLocaleDateString()}</span>
                </>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Target className="h-3 w-3" />
              <span>{rating}/4</span>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Default card variant
  return (
    <Card className={cn("", className)}>
      <CardContent className={cn("space-y-3", sizeClasses.card)}>
        <div className="flex items-center justify-between">
          {label && <h3 className={sizeClasses.title}>{label}</h3>}
          {showTrend && calculatedTrend && previousRating && (
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-full border text-xs font-medium",
              getTrendColor()
            )}>
              {getTrendIcon()}
              <span>{previousRating} → {rating}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div
            className={cn(
              "rounded-full flex items-center justify-center text-white font-bold",
              size === 'sm' ? 'w-10 h-10 text-lg' :
              size === 'lg' ? 'w-16 h-16 text-2xl' :
              size === 'xl' ? 'w-20 h-20 text-3xl' :
              'w-12 h-12 text-xl'
            )}
            style={{ backgroundColor: ratingColor }}
          >
            {rating}
          </div>
          <div className="flex-1 space-y-2">
            <div className="font-semibold">{ratingLabel}</div>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
            <Progress
              value={animatedProgress}
              className={sizeClasses.progress}
              style={{
                '--progress-background': ratingColor
              } as any}
            />
          </div>
        </div>

        {(showConfidence && confidenceLevel !== undefined) || assessor || lastUpdated ? (
          <div className="space-y-2">
            {showConfidence && confidenceLevel !== undefined && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence</span>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-muted rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full bg-primary"
                      style={{ width: `${confidenceLevel}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium">{confidenceLevel}%</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-3">
                {assessor && (
                  <div className="flex items-center gap-1">
                    <User className="h-3 w-3" />
                    <span>{assessor}</span>
                  </div>
                )}
                {lastUpdated && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    <span>{new Date(lastUpdated).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                <span>{rating}/4</span>
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

// Enhanced detailed rating display with breakdowns and trends
export function DetailedFourPointRatingDisplay({
  rating,
  label,
  description,
  breakdown,
  trend,
  history,
  confidenceLevel,
  lastUpdated,
  assessor,
  totalAssessments,
  distribution,
  className
}: DetailedRatingDisplayProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'history' | 'distribution'>('overview')

  const getTrendIcon = (trendType: 'up' | 'down' | 'stable') => {
    switch (trendType) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'stable':
        return <TrendingFlat className="h-4 w-4 text-gray-600" />
    }
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              {label}
              {trend && (
                <Badge variant="outline" className="gap-1">
                  {getTrendIcon(trend.trend)}
                  <span>{trend.changePercentage > 0 ? '+' : ''}{trend.changePercentage}%</span>
                </Badge>
              )}
            </CardTitle>
            {description && (
              <p className="text-sm text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FourPointRatingDisplay
              rating={rating}
              variant="minimal"
              size="lg"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'history', label: 'History', icon: Clock, disabled: !history || history.length === 0 },
            { id: 'distribution', label: 'Distribution', icon: Target, disabled: !distribution || distribution.length === 0 }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <Button
                key={tab.id}
                variant={activeTab === tab.id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab(tab.id as any)}
                disabled={tab.disabled}
                className="gap-1"
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </Button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Confidence and metadata */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {confidenceLevel !== undefined && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Confidence Level</span>
                    <span className="font-medium">{confidenceLevel}%</span>
                  </div>
                  <Progress value={confidenceLevel} className="h-2" />
                </div>
              )}

              {assessor && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Assessed by:</span>
                  <span className="font-medium">{assessor}</span>
                </div>
              )}

              {totalAssessments && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Total assessments:</span>
                  <span className="font-medium">{totalAssessments}</span>
                </div>
              )}
            </div>

            {/* Category breakdown */}
            {breakdown && breakdown.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium">Category Breakdown</h4>
                <div className="space-y-3">
                  {breakdown.map((category) => (
                    <div key={category.category} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{category.category}</span>
                        <div className="flex items-center gap-2">
                          <FourPointRatingDisplay
                            rating={category.score}
                            variant="badge"
                            size="sm"
                          />
                          <span className="text-xs text-muted-foreground">
                            {category.weight}% weight
                          </span>
                        </div>
                      </div>
                      <Progress
                        value={(category.score / 4) * 100}
                        className="h-2"
                        style={{
                          '--progress-background': getFourPointColor(category.score)
                        } as any}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && history && history.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Assessment History</h4>
            <div className="space-y-3">
              {history.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <FourPointRatingDisplay
                      rating={entry.rating}
                      variant="minimal"
                      size="sm"
                    />
                    <div>
                      <div className="font-medium text-sm">{getFourPointLabel(entry.rating)}</div>
                      <div className="text-xs text-muted-foreground">
                        by {entry.assessor}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(entry.date).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'distribution' && distribution && distribution.length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Rating Distribution</h4>
            <div className="space-y-3">
              {distribution.map((item) => (
                <div key={item.rating} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <FourPointRatingDisplay
                        rating={item.rating}
                        variant="minimal"
                        size="sm"
                      />
                      <span>{getFourPointLabel(item.rating)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{item.count}</span>
                      <span className="text-xs text-muted-foreground">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                  <Progress value={item.percentage} className="h-2" />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
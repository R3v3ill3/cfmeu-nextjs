"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Calendar,
  User,
  Scales,
  Shield,
  Users,
  History,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { EmployerRating4PointData } from "@/types/assessment"

interface RatingDisplay4PointProps {
  rating: EmployerRating4PointData
  employerName: string
  showDetails?: boolean
  showHistory?: boolean
  className?: string
}

// 4-point rating scale configuration
const RATING_SCALE = {
  1: {
    label: "Good",
    description: "Exceeds expectations",
    color: "bg-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
    icon: CheckCircle,
    progress: 100
  },
  2: {
    label: "Fair",
    description: "Meets expectations",
    color: "bg-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
    icon: AlertTriangle,
    progress: 75
  },
  3: {
    label: "Poor",
    description: "Below expectations",
    color: "bg-orange-500",
    textColor: "text-orange-700",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
    icon: TrendingDown,
    progress: 50
  },
  4: {
    label: "Terrible",
    description: "Major concerns",
    color: "bg-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
    icon: XCircle,
    progress: 25
  }
}

// Component rating configuration
const COMPONENT_CONFIG = {
  eba_status: {
    name: "EBA Status",
    icon: Scales,
    description: "Enterprise Bargaining Agreement coverage and compliance",
    critical: true
  },
  union_respect: {
    name: "Union Respect",
    icon: Users,
    description: "Union relationship and cooperation",
    critical: true
  },
  safety: {
    name: "Safety Performance",
    icon: Shield,
    description: "Workplace safety standards and incident record",
    critical: false
  },
  subcontractor: {
    name: "Subcontractor Relations",
    icon: Users,
    description: "Treatment and relationships with subcontractors",
    critical: false
  }
}

export function RatingDisplay4Point({
  rating,
  employerName,
  showDetails = true,
  showHistory = true,
  className
}: RatingDisplay4PointProps) {
  const [showCalculationDetails, setShowCalculationDetails] = useState(false)

  const overallRating = RATING_SCALE[rating.overall_rating as keyof typeof RATING_SCALE]
  const Icon = overallRating.icon

  // Calculate rating percentages for progress bars
  const ratingProgress = useMemo(() => {
    const maxRating = 4
    return {
      overall: ((maxRating - rating.overall_rating + 1) / maxRating) * 100,
      eba: ((maxRating - rating.eba_status_rating + 1) / maxRating) * 100,
      union: ((maxRating - rating.union_respect_rating + 1) / maxRating) * 100,
      safety: ((maxRating - rating.safety_rating + 1) / maxRating) * 100,
      subcontractor: ((maxRating - rating.subcontractor_rating + 1) / maxRating) * 100
    }
  }, [rating])

  // Determine rating trend
  const getRatingTrend = () => {
    // This would normally compare with previous rating
    // For now, return neutral
    return { trend: "stable", percentage: 0 }
  }

  const trend = getRatingTrend()

  const renderComponentRating = (
    key: keyof typeof COMPONENT_CONFIG,
    value: number,
    label: string
  ) => {
    const config = COMPONENT_CONFIG[key]
    const ComponentIcon = config.icon
    const scale = RATING_SCALE[value as keyof typeof RATING_SCALE]
    const progress = ratingProgress[key as keyof typeof ratingProgress]

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ComponentIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{config.name}</span>
            {config.critical && (
              <Badge variant="outline" className="text-xs">
                Critical
              </Badge>
            )}
          </div>
          <Badge className={scale.color}>
            {value} - {scale.label}
          </Badge>
        </div>

        <div className="space-y-1">
          <Progress
            value={progress}
            className="h-2"
            // @ts-ignore
            style={{
              // @ts-ignore
              '--progress-background': scale.color.replace('bg-', 'rgb(var(--')
            }}
          />
          <p className="text-xs text-muted-foreground">
            {scale.description}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Main Rating Card */}
      <Card className={cn("border-2", overallRating.borderColor)}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-full flex items-center justify-center",
                overallRating.bgColor
              )}>
                <Icon className={cn("h-6 w-6", overallRating.textColor)} />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {employerName}
                  <Badge className={overallRating.color} variant="secondary">
                    {rating.overall_rating}/4
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {overallRating.description}
                </p>
              </div>
            </div>

            <div className="text-right">
              <div className="flex items-center gap-1">
                {trend.trend === "up" && <TrendingUp className="h-4 w-4 text-green-600" />}
                {trend.trend === "down" && <TrendingDown className="h-4 w-4 text-red-600" />}
                <span className="text-sm text-muted-foreground">
                  {trend.trend === "stable" ? "No change" : `${Math.abs(trend.percentage)}%`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Last updated: {format(new Date(rating.created_at || Date.now()), "MMM d, yyyy")}
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Overall Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Overall Performance</span>
              <span className="text-sm text-muted-foreground">
                {ratingProgress.overall.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={ratingProgress.overall}
              className="h-3"
              // @ts-ignore
              style={{
                // @ts-ignore
                '--progress-background': overallRating.color.replace('bg-', 'rgb(var(--')
              }}
            />
          </div>

          {/* Critical Factors Alert */}
          {(rating.eba_status_rating === 1 || rating.eba_status_rating === 2) && (
            <div className={cn(
              "rounded-lg p-3 border",
              rating.eba_status_rating === 1 ? "bg-red-50 border-red-200" : "bg-yellow-50 border-yellow-200"
            )}>
              <div className="flex items-start gap-2">
                <AlertTriangle className={cn(
                  "h-4 w-4 mt-0.5",
                  rating.eba_status_rating === 1 ? "text-red-600" : "text-yellow-600"
                )} />
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium",
                    rating.eba_status_rating === 1 ? "text-red-800" : "text-yellow-800"
                  )}>
                    EBA Status Issue
                  </p>
                  <p className={cn(
                    "text-xs mt-1",
                    rating.eba_status_rating === 1 ? "text-red-700" : "text-yellow-700"
                  )}>
                    {rating.eba_status_rating === 1
                      ? "No EBA coverage - automatic Red rating"
                      : "Expired EBA - rating capped at Amber"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showDetails && (
        <Tabs defaultValue="components" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="calculation">Calculation</TabsTrigger>
            {showHistory && <TabsTrigger value="history">History</TabsTrigger>}
          </TabsList>

          {/* Component Breakdown */}
          <TabsContent value="components" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Rating Components</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Detailed breakdown of each assessment component
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                {renderComponentRating("eba_status", rating.eba_status_rating, "EBA Status")}
                <Separator />
                {renderComponentRating("union_respect", rating.union_respect_rating, "Union Respect")}
                <Separator />
                {renderComponentRating("safety", rating.safety_rating, "Safety Performance")}
                <Separator />
                {renderComponentRating("subcontractor", rating.subcontractor_rating, "Subcontractor Relations")}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Calculation Details */}
          <TabsContent value="calculation" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Rating Calculation</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowCalculationDetails(!showCalculationDetails)}
                  >
                    {showCalculationDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  How the overall rating was calculated
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Calculation Method</Label>
                    <p className="font-medium capitalize">
                      {rating.calculation_method.replace("_", " ")}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Rating Basis</Label>
                    <p className="font-medium capitalize">
                      {rating.rating_basis.replace("_", " ")}
                    </p>
                  </div>
                </div>

                {showCalculationDetails && rating.weights && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Component Weights</Label>
                      <div className="space-y-2">
                        {Object.entries(rating.weights).map(([key, weight]) => {
                          const config = COMPONENT_CONFIG[key as keyof typeof COMPONENT_CONFIG]
                          return (
                            <div key={key} className="flex items-center justify-between">
                              <span className="text-sm">{config.name}</span>
                              <Badge variant="outline">
                                {(weight as number * 100).toFixed(0)}%
                              </Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}

                {rating.rating_factors && showCalculationDetails && (
                  <>
                    <Separator />
                    <div>
                      <Label className="text-sm font-medium mb-3 block">Rating Factors</Label>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <pre className="text-xs overflow-auto">
                          {JSON.stringify(rating.rating_factors, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History */}
          {showHistory && (
            <TabsContent value="history" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <History className="h-4 w-4" />
                    Rating History
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Previous ratings and changes over time
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Rating history will be available here</p>
                    <p className="text-xs mt-1">Historical data is being processed</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}
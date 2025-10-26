"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  ChevronDown,
  ChevronUp,
  Info,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  CheckCircle,
  XCircle
} from "lucide-react"
import { RatingCalculationResult, FactorBreakdown } from "@/types/rating"
import { TrafficLightDisplay } from "./TrafficLightDisplay"
import { useHapticFeedback } from "../shared/HapticFeedback"

interface RatingBreakdownProps {
  result: RatingCalculationResult
  showDetails?: boolean
  className?: string
  onFactorClick?: (factor: FactorBreakdown) => void
}

interface FactorItemProps {
  factor: FactorBreakdown
  isExpanded?: boolean
  onToggle?: () => void
  onClick?: () => void
}

// Factor status styling
const factorStatusConfig = {
  excellent: {
    icon: CheckCircle,
    color: "text-green-600",
    bgColor: "bg-green-50",
    progressColor: "bg-green-500",
    label: "Excellent",
  },
  good: {
    icon: TrendingUp,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    progressColor: "bg-blue-500",
    label: "Good",
  },
  average: {
    icon: Minus,
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    progressColor: "bg-yellow-500",
    label: "Average",
  },
  poor: {
    icon: AlertCircle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    progressColor: "bg-orange-500",
    label: "Poor",
  },
  critical: {
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    progressColor: "bg-red-500",
    label: "Critical",
  },
}

function FactorItem({ factor, isExpanded = false, onToggle, onClick }: FactorItemProps) {
  const [expanded, setExpanded] = React.useState(isExpanded)
  const { selection } = useHapticFeedback()
  const statusConfig = factorStatusConfig[factor.status]
  const StatusIcon = statusConfig.icon

  const handleToggle = React.useCallback(() => {
    setExpanded(prev => !prev)
    selection()
    onToggle?.()
  }, [selection, onToggle])

  const handleClick = React.useCallback(() => {
    selection()
    onClick?.()
  }, [selection, onClick])

  const progressPercentage = Math.max(0, Math.min(100, (factor.value / factor.weight) * 100))

  return (
    <Card className="mb-3 overflow-hidden">
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 flex-1">
              <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
              <span className="font-medium text-sm">{factor.factor_name}</span>
              <Badge
                variant="secondary"
                className={cn("text-xs", statusConfig.bgColor, statusConfig.color)}
              >
                {statusConfig.label}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {factor.contribution.toFixed(1)}%
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={handleToggle}
              >
                {expanded ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Score: {factor.value.toFixed(1)}</span>
              <span>Weight: {factor.weight}%</span>
            </div>
            <Progress
              value={progressPercentage}
              className="h-2"
            />
          </div>

          {/* Expanded details */}
          {expanded && (
            <div className={cn("pt-3 border-t", statusConfig.bgColor)}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raw Value:</span>
                  <span className="font-medium">{factor.value.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Weight:</span>
                  <span className="font-medium">{factor.weight}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Contribution:</span>
                  <span className="font-medium">{factor.contribution.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={statusConfig.color}>
                    {statusConfig.label}
                  </Badge>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-3"
                onClick={handleClick}
              >
                <Info className="h-3 w-3 mr-1" />
                View Details
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function RatingBreakdown({
  result,
  showDetails = true,
  className,
  onFactorClick,
}: RatingBreakdownProps) {
  const [allExpanded, setAllExpanded] = React.useState(false)
  const { trigger, success } = useHapticFeedback()

  const sortedFactors = React.useMemo(() => {
    return [...result.breakdown].sort((a, b) => b.contribution - a.contribution)
  }, [result.breakdown])

  const criticalFactors = React.useMemo(() => {
    return sortedFactors.filter(f => f.status === 'critical' || f.status === 'poor')
  }, [sortedFactors])

  const handleToggleAll = React.useCallback(() => {
    setAllExpanded(prev => !prev)
    trigger()
  }, [trigger])

  const handleExportBreakdown = React.useCallback(() => {
    // Export functionality could be implemented here
    const breakdownText = sortedFactors.map(factor =>
      `${factor.factor_name}: ${factor.value.toFixed(1)} (${factor.status})`
    ).join('\n')

    if (navigator.share) {
      navigator.share({
        title: 'Rating Breakdown',
        text: breakdownText,
      })
    } else {
      console.log('Rating breakdown:', breakdownText)
    }

    success()
  }, [sortedFactors, success])

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Rating Breakdown</CardTitle>
            <TrafficLightDisplay
              rating={result.rating}
              confidence="high"
              size="md"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Overall score */}
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <span className="text-sm font-medium">Overall Score</span>
              <span className="text-lg font-bold text-foreground">
                {result.score.toFixed(1)}%
              </span>
            </div>

            {/* Critical factors alert */}
            {criticalFactors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <span className="text-sm font-medium text-red-800">
                    {criticalFactors.length} critical factor{criticalFactors.length > 1 ? 's' : ''} identified
                  </span>
                </div>
                <p className="text-xs text-red-700">
                  These factors significantly impact the rating and require attention.
                </p>
              </div>
            )}

            {/* Calculation details */}
            {showDetails && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Formula:</span>
                  <code className="text-xs bg-muted px-1 rounded">
                    {result.calculation_details.formula}
                  </code>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Weighting:</span>
                  <span className="text-xs">{result.calculation_details.weighting_used}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Calculated:</span>
                  <span className="text-xs">
                    {new Date(result.calculated_at).toLocaleString()}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleToggleAll}
          className="flex-1"
        >
          {allExpanded ? "Collapse All" : "Expand All"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportBreakdown}
        >
          Export
        </Button>
      </div>

      {/* Factor breakdown list */}
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground mb-3">
          Contributing Factors ({sortedFactors.length})
        </h3>

        {sortedFactors.map((factor) => (
          <FactorItem
            key={factor.factor_id}
            factor={factor}
            isExpanded={allExpanded}
            onClick={() => onFactorClick?.(factor)}
          />
        ))}
      </div>

      {/* Additional insights */}
      {showDetails && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-medium text-blue-800">Rating Insights</h4>
                <p className="text-xs text-blue-700">
                  The rating is calculated based on {sortedFactors.length} factors with varying weights.
                  Factors with lower scores have a greater impact on the final rating when they have higher weights.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
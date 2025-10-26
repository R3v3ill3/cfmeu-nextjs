"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { cn } from "@/lib/utils"
import { TrafficLightRating, ConfidenceLevel } from "@/types/rating"
import { useHapticFeedback } from "../shared/HapticFeedback"

interface TrafficLightDisplayProps {
  rating: TrafficLightRating
  confidence?: ConfidenceLevel
  size?: "sm" | "md" | "lg" | "xl"
  showConfidence?: boolean
  showLabel?: boolean
  animated?: boolean
  className?: string
  onClick?: () => void
}

// Rating colors and styling
const ratingConfig = {
  red: {
    color: "bg-red-500",
    borderColor: "border-red-500",
    textColor: "text-red-700",
    bgColor: "bg-red-50",
    label: "Red",
    description: "Significant issues",
    pulseColor: "animate-pulse-red",
  },
  amber: {
    color: "bg-amber-500",
    borderColor: "border-amber-500",
    textColor: "text-amber-700",
    bgColor: "bg-amber-50",
    label: "Amber",
    description: "Needs attention",
    pulseColor: "animate-pulse-amber",
  },
  yellow: {
    color: "bg-yellow-500",
    borderColor: "border-yellow-500",
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50",
    label: "Yellow",
    description: "Moderate performance",
    pulseColor: "animate-pulse-yellow",
  },
  green: {
    color: "bg-green-500",
    borderColor: "border-green-500",
    textColor: "text-green-700",
    bgColor: "bg-green-50",
    label: "Green",
    description: "Good performance",
    pulseColor: "animate-pulse-green",
  },
}

// Confidence level styling
const confidenceConfig = {
  low: {
    opacity: "opacity-40",
    label: "Low confidence",
    color: "text-gray-500",
  },
  medium: {
    opacity: "opacity-60",
    label: "Medium confidence",
    color: "text-gray-600",
  },
  high: {
    opacity: "opacity-80",
    label: "High confidence",
    color: "text-gray-700",
  },
  very_high: {
    opacity: "opacity-100",
    label: "Very high confidence",
    color: "text-gray-800",
  },
}

// Size configurations
const sizeConfig = {
  sm: {
    container: "w-8 h-8",
    dot: "w-4 h-4",
    text: "text-xs",
  },
  md: {
    container: "w-10 h-10",
    dot: "w-5 h-5",
    text: "text-sm",
  },
  lg: {
    container: "w-12 h-12",
    dot: "w-6 h-6",
    text: "text-base",
  },
  xl: {
    container: "w-16 h-16",
    dot: "w-8 h-8",
    text: "text-lg",
  },
}

export function TrafficLightDisplay({
  rating,
  confidence = "high",
  size = "md",
  showConfidence = true,
  showLabel = true,
  animated = false,
  className,
  onClick,
}: TrafficLightDisplayProps) {
  const { trigger, selection } = useHapticFeedback()
  const [isPressed, setIsPressed] = React.useState(false)

  const config = ratingConfig[rating]
  const sizeClasses = sizeConfig[size]
  const confidenceClasses = confidenceConfig[confidence]

  const handleClick = React.useCallback(() => {
    if (onClick) {
      selection()
      onClick()
    }
  }, [onClick, selection])

  const handleTouchStart = React.useCallback(() => {
    setIsPressed(true)
    trigger()
  }, [trigger])

  const handleTouchEnd = React.useCallback(() => {
    setIsPressed(false)
  }, [])

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        onClick && "cursor-pointer touch-manipulation",
        className
      )}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Traffic light indicator */}
      <div
        className={cn(
          "relative rounded-full border-2 flex items-center justify-center transition-all duration-200",
          sizeClasses.container,
          config.borderColor,
          config.bgColor,
          showConfidence && confidenceClasses.opacity,
          onClick && "active:scale-95",
          animated && config.pulseColor,
          isPressed && "scale-95"
        )}
      >
        <div
          className={cn(
            "rounded-full transition-all duration-300",
            sizeClasses.dot,
            config.color,
            animated && "animate-pulse"
          )}
        />

        {/* Confidence indicator - small ring */}
        {showConfidence && confidence === "very_high" && (
          <div
            className={cn(
              "absolute inset-0 rounded-full border-2",
              config.borderColor,
              "opacity-60"
            )}
          />
        )}
      </div>

      {/* Label and confidence */}
      {(showLabel || showConfidence) && (
        <div className="flex flex-col">
          {showLabel && (
            <span className={cn("font-medium", sizeClasses.text, config.textColor)}>
              {config.label}
            </span>
          )}
          {showConfidence && (
            <span className={cn("text-xs", confidenceClasses.color)}>
              {confidenceClasses.label}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// Compact version for cards and lists
export function TrafficLightIndicator({
  rating,
  confidence = "high",
  className,
}: {
  rating: TrafficLightRating
  confidence?: ConfidenceLevel
  className?: string
}) {
  const config = ratingConfig[rating]
  const confidenceClasses = confidenceConfig[confidence]

  return (
    <div
      className={cn(
        "flex items-center gap-1.5",
        className
      )}
    >
      <div
        className={cn(
          "w-3 h-3 rounded-full",
          config.color,
          confidenceClasses.opacity
        )}
      />
      <span className={cn("text-xs font-medium", config.textColor)}>
        {config.label}
      </span>
    </div>
  )
}

// Large version for dashboards
export function TrafficLightCard({
  rating,
  confidence = "high",
  title,
  subtitle,
  stats,
  className,
  onClick,
}: {
  rating: TrafficLightRating
  confidence?: ConfidenceLevel
  title: string
  subtitle?: string
  stats?: Array<{ label: string; value: string }>
  className?: string
  onClick?: () => void
}) {
  const config = ratingConfig[rating]
  const confidenceClasses = confidenceConfig[confidence]
  const { selection } = useHapticFeedback()

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 transition-all duration-200",
        config.borderColor,
        config.bgColor,
        onClick && "cursor-pointer active:scale-98 touch-manipulation",
        confidenceClasses.opacity,
        className
      )}
      onClick={() => {
        if (onClick) {
          selection()
          onClick()
        }
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-foreground">{title}</h3>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="w-8 h-8 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
          <div className={cn("w-4 h-4 rounded-full", config.color)} />
        </div>
      </div>

      {/* Stats */}
      {stats && stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-lg font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Rating label */}
      <div className="mt-3 flex items-center justify-between">
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
        <span className={cn("text-xs", confidenceClasses.color)}>
          {confidenceClasses.label}
        </span>
      </div>
    </div>
  )
}

// Legend component for explaining ratings
export function TrafficLightLegend({
  compact = false,
  className,
}: {
  compact?: boolean
  className?: string
}) {
  if (compact) {
    return (
      <div className={cn("flex items-center gap-4 text-xs", className)}>
        {Object.entries(ratingConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={cn("w-2 h-2 rounded-full", config.color)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      <h4 className="text-sm font-medium text-foreground">Rating System</h4>
      <div className="space-y-1">
        {Object.entries(ratingConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn("w-3 h-3 rounded-full", config.color)} />
            <div>
              <span className="text-sm font-medium">{config.label}:</span>
              <span className="text-sm text-muted-foreground ml-1">
                {config.description}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
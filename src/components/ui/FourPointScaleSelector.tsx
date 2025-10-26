"use client"

import { useState, useCallback, type ComponentType } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Star, TrendingUp, CheckCircle } from "lucide-react"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"
import { FourPointRating, FourPointRatingLabel, getFourPointLabel, getFourPointColor } from "@/types/assessments"

interface FourPointScaleSelectorProps {
  value?: FourPointRating
  onChange: (value: FourPointRating) => void
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'compact' | 'detailed'
  showLabels?: boolean
  showColors?: boolean
  allowHalfSteps?: boolean
  className?: string
}

interface RatingOption {
  value: FourPointRating
  label: FourPointRatingLabel
  description: string
  color: string
  icon: ComponentType<{ className?: string }>
}

const ratingOptions: RatingOption[] = [
  {
    value: 1,
    label: 'Poor',
    description: 'Significant issues require immediate attention',
    color: '#dc2626',
    icon: Star
  },
  {
    value: 2,
    label: 'Fair',
    description: 'Some areas need improvement',
    color: '#f59e0b',
    icon: TrendingUp
  },
  {
    value: 3,
    label: 'Good',
    description: 'Meets expectations consistently',
    color: '#84cc16',
    icon: CheckCircle
  },
  {
    value: 4,
    label: 'Excellent',
    description: 'Exceeds expectations, sets best practice',
    color: '#16a34a',
    icon: Star
  }
]

export function FourPointScaleSelector({
  value,
  onChange,
  disabled = false,
  size = 'md',
  variant = 'default',
  showLabels = true,
  showColors = true,
  allowHalfSteps = false,
  className
}: FourPointScaleSelectorProps) {
  const { trigger } = useHapticFeedback()
  const [hoveredValue, setHoveredValue] = useState<FourPointRating | null>(null)

  const handleValueChange = useCallback((newValue: FourPointRating) => {
    if (disabled) return

    onChange(newValue)
    trigger('success')
  }, [onChange, disabled, trigger])

  const handleMouseEnter = useCallback((ratingValue: FourPointRating) => {
    if (!disabled) {
      setHoveredValue(ratingValue)
    }
  }, [disabled])

  const handleMouseLeave = useCallback(() => {
    setHoveredValue(null)
  }, [])

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return {
          button: 'h-8 w-8 text-xs',
          card: 'p-2',
          label: 'text-xs',
          description: 'text-xs'
        }
      case 'lg':
        return {
          button: 'h-16 w-16 text-2xl',
          card: 'p-6',
          label: 'text-lg',
          description: 'text-sm'
        }
      default:
        return {
          button: 'h-12 w-12 text-sm',
          card: 'p-4',
          label: 'text-sm',
          description: 'text-xs'
        }
    }
  }

  const sizeClasses = getSizeClasses()

  if (variant === 'compact') {
    return (
      <div className={cn("flex gap-2", className)}>
        {ratingOptions.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value
          const isHovered = hoveredValue === option.value

          return (
            <Button
              key={option.value}
              variant={isSelected ? "default" : "outline"}
              size="sm"
              disabled={disabled}
              onClick={() => handleValueChange(option.value)}
              onMouseEnter={() => handleMouseEnter(option.value)}
              onMouseLeave={handleMouseLeave}
              className={cn(
                "flex-1 transition-all duration-200",
                isSelected && showColors && "shadow-md",
                isSelected && showColors && `bg-[${option.color}] hover:bg-[${option.color}] border-[${option.color}]`
              )}
              style={{
                backgroundColor: isSelected && showColors ? option.color : undefined,
                borderColor: isSelected && showColors ? option.color : undefined
              }}
            >
              <Icon className={cn("h-4 w-4", isSelected && "text-white")} />
              {showLabels && (
                <span className={cn("ml-2", isSelected && "text-white")}>
                  {option.label}
                </span>
              )}
            </Button>
          )
        })}
      </div>
    )
  }

  if (variant === 'detailed') {
    return (
      <div className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4", className)}>
        {ratingOptions.map((option) => {
          const Icon = option.icon
          const isSelected = value === option.value
          const isHovered = hoveredValue === option.value

          return (
            <Card
              key={option.value}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-lg",
                isSelected && "ring-2 ring-offset-2",
                disabled && "opacity-50 cursor-not-allowed",
                isSelected && showColors && `ring-[${option.color}]`
              )}
              style={{
                ringColor: isSelected && showColors ? option.color : undefined
              }}
              onClick={() => handleValueChange(option.value)}
              onMouseEnter={() => handleMouseEnter(option.value)}
              onMouseLeave={handleMouseLeave}
            >
              <CardContent className={cn("text-center", sizeClasses.card)}>
                <div className="flex justify-center mb-2">
                  <div
                    className={cn(
                      "rounded-full p-2 flex items-center justify-center transition-colors",
                      isSelected && showColors ? "text-white" : "text-muted-foreground"
                    )}
                    style={{
                      backgroundColor: isSelected && showColors ? option.color : undefined
                    }}
                  >
                    <Icon className={sizeClasses.button.replace('h-', 'h-').replace('w-', 'w-')} />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2">
                    <h3 className={cn("font-semibold", sizeClasses.label)}>
                      {option.label}
                    </h3>
                    {isSelected && (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    )}
                  </div>

                  {showLabels && (
                    <Badge
                      variant={isSelected ? "default" : "secondary"}
                      className={cn("text-xs", isSelected && showColors && "text-white")}
                      style={{
                        backgroundColor: isSelected && showColors ? option.color : undefined
                      }}
                    >
                      {option.value}/4
                    </Badge>
                  )}

                  <p className={cn("text-muted-foreground", sizeClasses.description)}>
                    {option.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    )
  }

  // Default variant
  return (
    <div className={cn("flex gap-3 items-center", className)}>
      {ratingOptions.map((option, index) => {
        const Icon = option.icon
        const isSelected = value === option.value
        const isHovered = hoveredValue === option.value
        const showConnector = index < ratingOptions.length - 1

        return (
          <div key={option.value} className="flex items-center">
            <Button
              variant={isSelected ? "default" : "outline"}
              size={size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default'}
              disabled={disabled}
              onClick={() => handleValueChange(option.value)}
              onMouseEnter={() => handleMouseEnter(option.value)}
              onMouseLeave={handleMouseLeave}
              className={cn(
                "transition-all duration-200 relative",
                isSelected && "shadow-md scale-105",
                isHovered && !isSelected && "scale-105"
              )}
              style={{
                backgroundColor: isSelected && showColors ? option.color : undefined,
                borderColor: isSelected && showColors ? option.color : undefined
              }}
            >
              <Icon className={cn(sizeClasses.button.split(' ')[0], sizeClasses.button.split(' ')[1],
                isSelected && showColors && "text-white")} />
              {showLabels && (
                <span className={cn("ml-2", isSelected && showColors && "text-white")}>
                  {option.label}
                </span>
              )}
            </Button>

            {showConnector && (
              <div className={cn(
                "w-8 h-0.5 mx-1",
                isSelected && showColors ? "bg-[${option.color}]" : "bg-muted"
              )}
                style={{
                  backgroundColor: isSelected && showColors ? option.color : undefined
                }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Helper component for displaying a single rating value
export function FourPointRatingDisplay({
  value,
  size = 'md',
  showLabel = true,
  showColor = true,
  className
}: {
  value: FourPointRating
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
  showColor?: boolean
  className?: string
}) {
  const option = ratingOptions.find(opt => opt.value === value)
  if (!option) return null

  const Icon = option.icon
  const color = getFourPointColor(value)
  const label = getFourPointLabel(value)

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'h-6 w-6 text-xs'
      case 'lg':
        return 'h-10 w-10 text-lg'
      default:
        return 'h-8 w-8 text-sm'
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className={cn(
          "rounded-full p-1.5 flex items-center justify-center",
          showColor ? "text-white" : "text-muted-foreground"
        )}
        style={{
          backgroundColor: showColor ? color : undefined
        }}
      >
        <Icon className={getSizeClasses()} />
      </div>
      {showLabel && (
        <div className="space-y-0.5">
          <div className="flex items-center gap-1">
            <span className="font-medium text-sm">{label}</span>
            <Badge variant="outline" className="text-xs">
              {value}/4
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{option.description}</p>
        </div>
      )}
    </div>
  )
}

// Touch-optimized mobile version
export function FourPointScaleMobile({
  value,
  onChange,
  disabled = false,
  className
}: {
  value?: FourPointRating
  onChange: (value: FourPointRating) => void
  disabled?: boolean
  className?: string
}) {
  const { trigger } = useHapticFeedback()

  const handleValueChange = useCallback((newValue: FourPointRating) => {
    if (disabled) return

    onChange(newValue)
    trigger('success')
    trigger('selection') // Additional haptic for mobile
  }, [onChange, disabled, trigger])

  return (
    <div className={cn("grid grid-cols-2 gap-4", className)}>
      {ratingOptions.map((option) => {
        const Icon = option.icon
        const isSelected = value === option.value

        return (
          <Button
            key={option.value}
            variant={isSelected ? "default" : "outline"}
            size="lg"
            disabled={disabled}
            onClick={() => handleValueChange(option.value)}
            className={cn(
              "h-20 flex-col gap-2 transition-all duration-200",
              isSelected && "shadow-lg scale-105"
            )}
            style={{
              backgroundColor: isSelected ? option.color : undefined,
              borderColor: isSelected ? option.color : undefined
            }}
          >
            <Icon className={cn("h-8 w-8", isSelected && "text-white")} />
            <div className="text-center">
              <div className={cn("font-semibold", isSelected && "text-white")}>
                {option.label}
              </div>
              <div className={cn("text-xs opacity-75", isSelected && "text-white")}>
                {option.value}/4
              </div>
            </div>
          </Button>
        )
      })}
    </div>
  )
}
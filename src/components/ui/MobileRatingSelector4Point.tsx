"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useHapticFeedback } from "@/components/mobile/shared/HapticFeedback"

interface MobileRatingSelector4PointProps {
  value: number
  onChange: (value: number) => void
  labels?: string[]
  descriptions?: string[]
  disabled?: boolean
  className?: string
}

const defaultLabels = ['Good', 'Fair', 'Poor', 'Terrible']
const defaultDescriptions = [
  'Excellent performance - meets all standards',
  'Acceptable performance - minor issues',
  'Below expectations - significant concerns',
  'Major problems - immediate action required'
]

const ratingColors = {
  4: 'bg-green-500 border-green-500 text-white',
  3: 'bg-yellow-500 border-yellow-500 text-white',
  2: 'bg-amber-500 border-amber-500 text-white',
  1: 'bg-red-500 border-red-500 text-white'
}

const ratingBgColors = {
  4: 'bg-green-50 border-green-200 text-green-700',
  3: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  2: 'bg-amber-50 border-amber-200 text-amber-700',
  1: 'bg-red-50 border-red-200 text-red-700'
}

export function MobileRatingSelector4Point({
  value,
  onChange,
  labels = defaultLabels,
  descriptions = defaultDescriptions,
  disabled = false,
  className = ""
}: MobileRatingSelector4PointProps) {
  const [selectedValue, setSelectedValue] = useState(value)
  const { hapticFeedback } = useHapticFeedback()

  const handleRatingSelect = (rating: number) => {
    if (disabled) return

    setSelectedValue(rating)
    onChange(rating)
    hapticFeedback?.('selectionChanged')
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Rating Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-3">
        {[4, 3, 2, 1].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleRatingSelect(rating)}
            disabled={disabled}
            className={cn(
              "relative p-4 rounded-lg border-2 transition-all",
              "min-h-[80px] flex flex-col items-center justify-center",
              "focus:outline-none focus:ring-2 focus:ring-offset-2",
              selectedValue === rating
                ? `${ratingBgColors[rating as keyof typeof ratingBgColors]} border-current`
                : "bg-white border-gray-200 hover:border-gray-300",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            {/* Rating Number */}
            <div className="text-2xl font-bold mb-1">
              {rating}
            </div>

            {/* Rating Label */}
            <div className="text-sm font-medium text-center">
              {labels[4 - rating]}
            </div>

            {/* Selected Indicator */}
            {selectedValue === rating && (
              <div className={cn(
                "absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center",
                ratingColors[rating as keyof typeof ratingColors]
              )}>
                <span className="text-xs">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Selected Rating Description */}
      {selectedValue > 0 && (
        <div className={cn(
          "p-3 rounded-lg border text-sm",
          ratingBgColors[selectedValue as keyof typeof ratingBgColors]
        )}>
          <div className="font-medium mb-1">
            {labels[4 - selectedValue]} ({selectedValue}/4)
          </div>
          <div className="text-xs opacity-80">
            {descriptions[4 - selectedValue]}
          </div>
        </div>
      )}
    </div>
  )
}

// Compact version for smaller spaces
export function MobileRatingSelector4PointCompact({
  value,
  onChange,
  labels = defaultLabels,
  disabled = false,
  className = ""
}: Omit<MobileRatingSelector4PointProps, 'descriptions'>) {
  const [selectedValue, setSelectedValue] = useState(value)
  const { hapticFeedback } = useHapticFeedback()

  const handleRatingSelect = (rating: number) => {
    if (disabled) return

    setSelectedValue(rating)
    onChange(rating)
    hapticFeedback?.('selectionChanged')
  }

  return (
    <div className={cn("flex gap-2", className)}>
      {[4, 3, 2, 1].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => handleRatingSelect(rating)}
          disabled={disabled}
          className={cn(
            "flex-1 py-4 px-2 rounded-lg border text-center transition-all",
            "min-h-[56px] min-w-[44px] touch-manipulation",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
            "hover:scale-105 active:scale-95",
            selectedValue === rating
              ? `${ratingColors[rating as keyof typeof ratingColors]} border-current shadow-md`
              : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="text-lg font-bold">{rating}</div>
          <div className="text-xs leading-tight">{labels[4 - rating]}</div>
        </button>
      ))}
    </div>
  )
}

// Horizontal scroll version for very tight spaces
export function MobileRatingSelector4PointScroll({
  value,
  onChange,
  labels = defaultLabels,
  disabled = false,
  className = ""
}: Omit<MobileRatingSelector4PointProps, 'descriptions'>) {
  const [selectedValue, setSelectedValue] = useState(value)
  const { hapticFeedback } = useHapticFeedback()

  const handleRatingSelect = (rating: number) => {
    if (disabled) return

    setSelectedValue(rating)
    onChange(rating)
    hapticFeedback?.('selectionChanged')
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="flex gap-2 min-w-max pb-2">
        {[4, 3, 2, 1].map((rating) => (
          <button
            key={rating}
            type="button"
            onClick={() => handleRatingSelect(rating)}
            disabled={disabled}
            className={cn(
              "py-4 px-6 rounded-lg border text-center transition-all whitespace-nowrap",
              "min-h-[56px] min-w-[80px] touch-manipulation",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500",
              "hover:scale-105 active:scale-95",
              selectedValue === rating
                ? `${ratingColors[rating as keyof typeof ratingColors]} border-current shadow-md`
                : "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <div className="text-xl font-bold">{rating}</div>
            <div className="text-sm leading-tight">{labels[4 - rating]}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
"use client"

import React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Filter, ChevronDown, ChevronUp, X } from "lucide-react"
import { RatingFilters, TrafficLightRating, ConfidenceLevel, RatingTrack, RoleType } from "@/types/rating"
import { useRatingFilters } from "@/context/RatingContext"

interface RatingFiltersProps {
  className?: string
  onFiltersChange?: (filters: RatingFilters) => void
  showResetButton?: boolean
  compact?: boolean
}

// Traffic light rating options
const ratingOptions: { value: TrafficLightRating; label: string; color: string }[] = [
  { value: "green", label: "Green", color: "bg-green-500" },
  { value: "amber", label: "Amber", color: "bg-amber-500" },
  { value: "yellow", label: "Yellow", color: "bg-yellow-500" },
  { value: "red", label: "Red", color: "bg-red-500" },
]

// Confidence level options
const confidenceOptions: { value: ConfidenceLevel; label: string }[] = [
  { value: "very_high", label: "Very High" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

// Rating track options
const trackOptions: { value: RatingTrack; label: string }[] = [
  { value: "project_data", label: "Project Data" },
  { value: "organiser_expertise", label: "Organiser Expertise" },
]

// Role context options
const roleContextOptions: { value: RoleType; label: string }[] = [
  { value: "trade", label: "Trade" },
  { value: "builder", label: "Builder" },
  { value: "admin", label: "Admin" },
  { value: "organiser", label: "Organiser" },
]

export function RatingFiltersComponent({
  className = "",
  onFiltersChange,
  showResetButton = true,
  compact = false
}: RatingFiltersProps) {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useRatingFilters()
  const [isOpen, setIsOpen] = React.useState(false)

  // Handle rating selection
  const handleRatingChange = (rating: TrafficLightRating, checked: boolean) => {
    const currentRatings = filters.rating || []
    const newRatings = checked
      ? [...currentRatings, rating]
      : currentRatings.filter(r => r !== rating)

    const newFilters = { ...filters, rating: newRatings.length > 0 ? newRatings : undefined }
    setFilters(newFilters)
    onFiltersChange?.(newFilters)
  }

  // Handle confidence selection
  const handleConfidenceChange = (confidence: ConfidenceLevel, checked: boolean) => {
    const currentConfidence = filters.confidence || []
    const newConfidence = checked
      ? [...currentConfidence, confidence]
      : currentConfidence.filter(c => c !== confidence)

    const newFilters = { ...filters, confidence: newConfidence.length > 0 ? newConfidence : undefined }
    setFilters(newFilters)
    onFiltersChange?.(newFilters)
  }

  // Handle single-select filters
  const handleSingleFilterChange = (key: keyof RatingFilters, value: string | undefined) => {
    const newFilters = { ...filters, [key]: value || undefined }
    setFilters(newFilters)
    onFiltersChange?.(newFilters)
  }

  // Handle reset
  const handleReset = () => {
    clearFilters()
    onFiltersChange?.({})
  }

  // Count active filters
  const activeFilterCount = [
    filters.rating?.length || 0,
    filters.confidence?.length || 0,
    filters.track ? 1 : 0,
    filters.role_context ? 1 : 0,
  ].reduce((sum, count) => sum + count, 0)

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Badge variant="outline" className="gap-1">
          <Filter className="h-3 w-3" />
          {activeFilterCount} rating filter{activeFilterCount !== 1 ? 's' : ''}
        </Badge>
        {showResetButton && hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="w-full justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Rating Filters
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                  {activeFilterCount}
                </Badge>
              )}
            </div>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">

            {/* Rating Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating</label>
              <div className="space-y-2">
                {ratingOptions.map(({ value, label, color }) => {
                  const isChecked = filters.rating?.includes(value) || false
                  return (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`rating-${value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleRatingChange(value, !!checked)}
                      />
                      <label
                        htmlFor={`rating-${value}`}
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        <div className={`w-3 h-3 rounded-full ${color}`} />
                        {label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Confidence Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Confidence</label>
              <div className="space-y-2">
                {confidenceOptions.map(({ value, label }) => {
                  const isChecked = filters.confidence?.includes(value) || false
                  return (
                    <div key={value} className="flex items-center space-x-2">
                      <Checkbox
                        id={`confidence-${value}`}
                        checked={isChecked}
                        onCheckedChange={(checked) => handleConfidenceChange(value, !!checked)}
                      />
                      <label
                        htmlFor={`confidence-${value}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {label}
                      </label>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Track Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Rating Track</label>
              <Select
                value={filters.track || ""}
                onValueChange={(value) => handleSingleFilterChange("track", value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All tracks" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All tracks</SelectItem>
                  {trackOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Role Context Filter */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Role Context</label>
              <Select
                value={filters.role_context || ""}
                onValueChange={(value) => handleSingleFilterChange("role_context", value || undefined)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All roles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All roles</SelectItem>
                  {roleContextOptions.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reset Button */}
          {showResetButton && hasActiveFilters && (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={handleReset}>
                <X className="h-3 w-3 mr-2" />
                Clear Rating Filters
              </Button>
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// Active rating filters display component
export function ActiveRatingFilters({
  onRemoveFilter,
  className = ""
}: {
  onRemoveFilter?: (key: keyof RatingFilters, value?: any) => void
  className?: string
}) {
  const { filters, clearFilters } = useRatingFilters()

  const hasActiveFilters = Object.keys(filters).length > 0
  if (!hasActiveFilters) return null

  const handleRemove = (key: keyof RatingFilters, value?: any) => {
    if (onRemoveFilter) {
      onRemoveFilter(key, value)
    }
  }

  const getFilterLabel = (key: keyof RatingFilters, value?: any): string => {
    switch (key) {
      case "rating":
        return `Rating: ${(value as TrafficLightRating[]).join(", ")}`
      case "confidence":
        return `Confidence: ${(value as ConfidenceLevel[]).join(", ")}`
      case "track":
        return `Track: ${trackOptions.find(t => t.value === value)?.label || value}`
      case "role_context":
        return `Role: ${roleContextOptions.find(r => r.value === value)?.label || value}`
      default:
        return `${key}: ${value}`
    }
  }

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <span className="text-sm text-muted-foreground">Rating filters:</span>
      {Object.entries(filters).map(([key, value]) => {
        if (!value) return null
        return (
          <Badge key={key} variant="secondary" className="gap-1 pr-1">
            {getFilterLabel(key as keyof RatingFilters, value)}
            <Button
              variant="ghost"
              size="sm"
              className="h-4 w-4 p-0 hover:bg-transparent"
              onClick={() => handleRemove(key as keyof RatingFilters, value)}
            >
              <X className="h-3 w-3" />
            </Button>
          </Badge>
        )
      })}
      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-6">
        Clear all
      </Button>
    </div>
  )
}

// Quick rating filter for inline use
export function QuickRatingFilter({
  selectedRating,
  onRatingChange,
  className = ""
}: {
  selectedRating?: TrafficLightRating
  onRatingChange: (rating?: TrafficLightRating) => void
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <span className="text-xs text-muted-foreground mr-2">Rating:</span>
      {ratingOptions.map(({ value, label, color }) => (
        <Button
          key={value}
          variant={selectedRating === value ? "default" : "outline"}
          size="sm"
          onClick={() => onRatingChange(selectedRating === value ? undefined : value)}
          className="h-8 px-3 text-xs"
        >
          <div className={`w-2 h-2 rounded-full ${color} mr-1`} />
          {label}
        </Button>
      ))}
      {selectedRating && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRatingChange(undefined)}
          className="h-8 px-2 text-xs"
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
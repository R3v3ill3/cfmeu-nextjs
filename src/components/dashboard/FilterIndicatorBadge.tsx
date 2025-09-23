"use client"
import { Badge } from "@/components/ui/badge"
import { Filter } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterIndicatorBadgeProps {
  hasActiveFilters: boolean
  activeFilters?: string[]
  className?: string
  variant?: "default" | "small"
}

/**
 * Small purple badge that indicates when dashboard data is being filtered
 * Appears in card headers when filters are applied
 */
export function FilterIndicatorBadge({ 
  hasActiveFilters, 
  activeFilters = [], 
  className,
  variant = "default" 
}: FilterIndicatorBadgeProps) {
  if (!hasActiveFilters) {
    return null
  }

  const isSmall = variant === "small"
  const filterText = activeFilters.length > 0 
    ? `Filtered (${activeFilters.length})`
    : "Filtered"

  return (
    <Badge 
      variant="secondary"
      className={cn(
        "bg-purple-100 text-purple-700 border-purple-300 hover:bg-purple-200 transition-colors",
        isSmall ? "text-xs h-5 px-2" : "text-xs",
        className
      )}
      title={activeFilters.length > 0 ? `Active filters: ${activeFilters.join(', ')}` : "Data is filtered"}
    >
      <Filter className={cn("mr-1", isSmall ? "h-2.5 w-2.5" : "h-3 w-3")} />
      {isSmall ? "Filtered" : filterText}
    </Badge>
  )
}

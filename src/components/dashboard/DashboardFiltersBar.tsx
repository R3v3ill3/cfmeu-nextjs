"use client"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { 
  Filter, 
  X, 
  Search, 
  RotateCcw,
  ChevronDown,
  ChevronUp
} from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export interface DashboardFilters {
  tier?: string
  stage?: string
  universe?: string
  eba?: string
  q?: string
}

interface DashboardFiltersBarProps {
  onFiltersChange?: (filters: DashboardFilters) => void
  showSearch?: boolean
  compact?: boolean
}

/**
 * Dashboard filters bar that integrates with projects page filter logic
 * Allows filtering of dashboard summary metrics in real-time
 */
export function DashboardFiltersBar({ 
  onFiltersChange, 
  showSearch = true,
  compact = false 
}: DashboardFiltersBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isExpanded, setIsExpanded] = useState(false)
  
  // Extract current filters from URL
  const currentFilters: DashboardFilters = {
    tier: searchParams.get("tier") || "all",
    stage: searchParams.get("stage") || "all", 
    universe: searchParams.get("universe") || "all",
    eba: searchParams.get("eba") || "all",
    q: searchParams.get("q") || ""
  }

  // Notify parent of filter changes
  useEffect(() => {
    if (onFiltersChange) {
      onFiltersChange(currentFilters)
    }
  }, [searchParams, onFiltersChange])

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (value === "all" || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    
    router.push(`${pathname}?${params.toString()}`)
  }

  const resetFilters = () => {
    router.push(pathname)
  }

  const hasActiveFilters = Object.entries(currentFilters).some(([key, value]) => 
    key !== 'q' && value && value !== "all"
  ) || (currentFilters.q && currentFilters.q.length > 0)

  const activeFilterCount = Object.entries(currentFilters).filter(([key, value]) => 
    key !== 'q' && value && value !== "all"
  ).length + (currentFilters.q ? 1 : 0)

  if (compact) {
    return (
      <div className="border-b bg-white px-4 py-2">
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="h-8">
                  <Filter className="h-4 w-4 mr-2" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 h-4 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4 ml-2" />
                  ) : (
                    <ChevronDown className="h-4 w-4 ml-2" />
                  )}
                </Button>
              </CollapsibleTrigger>
              
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetFilters}
                  className="h-8 text-xs"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
              )}
            </div>
            
            {showSearch && (
              <div className="relative w-64">
                <Search className="absolute left-2 top-2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search projects..."
                  value={currentFilters.q || ""}
                  onChange={(e) => updateFilter("q", e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            )}
          </div>
          
          <CollapsibleContent className="mt-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Tier</label>
                <Select value={currentFilters.tier} onValueChange={(value) => updateFilter("tier", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    <SelectItem value="tier_1">Tier 1</SelectItem>
                    <SelectItem value="tier_2">Tier 2</SelectItem>
                    <SelectItem value="tier_3">Tier 3</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Stage</label>
                <Select value={currentFilters.stage} onValueChange={(value) => updateFilter("stage", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Stages</SelectItem>
                    <SelectItem value="construction">Construction</SelectItem>
                    <SelectItem value="pre_construction">Pre-Construction</SelectItem>
                    <SelectItem value="future">Future</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">Universe</label>
                <Select value={currentFilters.universe} onValueChange={(value) => updateFilter("universe", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="potential">Potential</SelectItem>
                    <SelectItem value="excluded">Excluded</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-700">EBA Status</label>
                <Select value={currentFilters.eba} onValueChange={(value) => updateFilter("eba", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active EBA</SelectItem>
                    <SelectItem value="lodged">Lodged</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="no_eba">No EBA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    )
  }

  return (
    <div className="border-b bg-white px-6 py-4">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Filters:</span>
          </div>

          <Select value={currentFilters.tier} onValueChange={(value) => updateFilter("tier", value)}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="tier_1">Tier 1</SelectItem>
              <SelectItem value="tier_2">Tier 2</SelectItem>
              <SelectItem value="tier_3">Tier 3</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentFilters.stage} onValueChange={(value) => updateFilter("stage", value)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              <SelectItem value="construction">Construction</SelectItem>
              <SelectItem value="pre_construction">Pre-Construction</SelectItem>
              <SelectItem value="future">Future</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentFilters.universe} onValueChange={(value) => updateFilter("universe", value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Universe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="potential">Potential</SelectItem>
              <SelectItem value="excluded">Excluded</SelectItem>
            </SelectContent>
          </Select>

          <Select value={currentFilters.eba} onValueChange={(value) => updateFilter("eba", value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="EBA" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active EBA</SelectItem>
              <SelectItem value="lodged">Lodged</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="no_eba">No EBA</SelectItem>
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Search */}
        {showSearch && (
          <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search projects..."
              value={currentFilters.q || ""}
              onChange={(e) => updateFilter("q", e.target.value)}
              className="pl-10"
            />
          </div>
        )}
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {Object.entries(currentFilters).map(([key, value]) => {
            if (!value || value === "all" || (key === 'q' && !value)) return null
            
            return (
              <Badge key={key} variant="secondary" className="text-xs">
                {key}: {value}
                <button
                  className="ml-1 hover:bg-gray-300 rounded-full p-0.5"
                  onClick={() => updateFilter(key, key === 'q' ? '' : 'all')}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )
          })}
        </div>
      )}
    </div>
  )
}

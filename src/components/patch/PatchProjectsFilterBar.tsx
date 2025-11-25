"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Filter, Search, Navigation, MapPin } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useOptimizedSearch, useMobileFocus } from "@/hooks/useOptimizedSearch"
import { GoogleAddressInput, GoogleAddress, AddressValidationError } from "@/components/projects/GoogleAddressInput"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"

export type PatchProjectFilters = {
  patchId: string | null
  q: string
  tier: "all" | ProjectTier
  universe: "all" | "active" | "potential" | "excluded"
  stage: "all" | "future" | "pre_construction" | "construction" | "archived"
  eba: "all" | "eba_active" | "eba_inactive" | "builder_unknown"
  sort: "name" | "value" | "tier" | "workers" | "members" | "delegates" | "eba_coverage" | "employers"
  dir: "asc" | "desc"
  searchMode?: "name" | "address" | "closest"
}

interface PatchProjectsFilterBarProps {
  patchOptions: { value: string; label: string }[]
  filters: PatchProjectFilters
  onFiltersChange: (changes: Partial<PatchProjectFilters>) => void
  onClear?: () => void
  disablePatchSelect?: boolean
  onAddressSelect?: (address: GoogleAddress, error?: AddressValidationError | null) => void
}

const universeOptions: Array<{ value: PatchProjectFilters["universe"]; label: string }> = [
  { value: "all", label: "All universes" },
  { value: "active", label: "Active" },
  { value: "potential", label: "Potential" },
  { value: "excluded", label: "Excluded" }
]

const stageOptions: Array<{ value: PatchProjectFilters["stage"]; label: string }> = [
  { value: "all", label: "All stages" },
  { value: "future", label: "Future" },
  { value: "pre_construction", label: "Pre-construction" },
  { value: "construction", label: "Construction" },
  { value: "archived", label: "Archived" }
]

const ebaOptions: Array<{ value: PatchProjectFilters["eba"]; label: string }> = [
  { value: "all", label: "EBA: All" },
  { value: "eba_active", label: "EBA: Builder Active" },
  { value: "eba_inactive", label: "EBA: Builder Inactive" },
  { value: "builder_unknown", label: "EBA: Builder Unknown" }
]

const sortOptions: Array<{ value: PatchProjectFilters["sort"]; label: string }> = [
  { value: "name", label: "Name" },
  { value: "tier", label: "Tier" },
  { value: "value", label: "Project value" },
  { value: "workers", label: "Workers" },
  { value: "members", label: "Members" },
  { value: "delegates", label: "Delegates" },
  { value: "eba_coverage", label: "EBA coverage" },
  { value: "employers", label: "Employers" }
]

export function PatchProjectsFilterBar({ patchOptions, filters, onFiltersChange, onClear, disablePatchSelect, onAddressSelect }: PatchProjectsFilterBarProps) {
  const isMobile = useIsMobile()
  const searchParams = useSearchParams()

  // Check if we're in a PWA on mobile
  const [isPWA, setIsPWA] = useState(false)
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [isGettingLocation, setIsGettingLocation] = useState(false)

  // Platform-optimized search state
  const [searchValue, setSearchValue, syncToUrl] = useOptimizedSearch("")
  const { inputRef, preserveFocus } = useMobileFocus()

  const searchMode = (searchParams.get("searchMode") || "name") as "name" | "address" | "closest"
  const addressQuery = searchParams.get("addressQuery") || ""

  // Track if search is pending (only for mobile where we defer URL sync)
  const qParam = searchParams.get("q") || ""
  const isSearchPending = isMobile && searchValue !== qParam && searchMode === "name"
  
  // Sync search with parent filters
  useEffect(() => {
    // On desktop, searchValue is already in sync with URL
    // On mobile, we need to trigger filter change when URL updates
    if (isMobile) {
      const urlValue = searchParams.get("q") || ""
      if (urlValue !== filters.q) {
        onFiltersChange({ q: urlValue || undefined })
      }
    } else {
      // Desktop: update filters when searchValue changes
      if (searchValue !== filters.q) {
        onFiltersChange({ q: searchValue || undefined })
      }
    }
  }, [searchValue, searchParams.get("q")])

  // Check if we're in PWA mode
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isPWA = window.matchMedia?.('(display-mode: standalone)')?.matches ||
                    (window.navigator as any).standalone === true
      setIsPWA(isPWA)
    }
  }, [])

  // Handle getting current location for "Closest to me"
  const getCurrentLocation = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      console.error('Geolocation is not supported')
      return
    }

    setIsGettingLocation(true)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes cache
        })
      })

      const { latitude, longitude } = position.coords
      setCurrentLocation({ lat: latitude, lng: longitude })

      // Update filters with current location
      onFiltersChange({
        searchMode: 'closest',
        q: undefined,
        addressQuery: 'Your current location',
        // We'll need to pass these to the parent component to handle in URL
        addressLat: latitude.toString(),
        addressLng: longitude.toString()
      })
    } catch (error) {
      console.error('Error getting location:', error)
    } finally {
      setIsGettingLocation(false)
    }
  }, [onFiltersChange])

  // Handle "Closest to me" selection
  const handleClosestToMe = useCallback(() => {
    if (currentLocation) {
      onFiltersChange({
        searchMode: 'closest',
        q: undefined,
        addressQuery: 'Your current location',
        addressLat: currentLocation.lat.toString(),
        addressLng: currentLocation.lng.toString()
      })
    } else {
      getCurrentLocation()
    }
  }, [currentLocation, onFiltersChange, getCurrentLocation])
  
  // Handle search mode change
  const handleSearchModeChange = useCallback((mode: "name" | "address") => {
    if (mode === "address") {
      onFiltersChange({ q: undefined, searchMode: "address" })
    } else {
      onFiltersChange({ searchMode: undefined })
    }
  }, [onFiltersChange])
  
  // Handle address selection
  const handleAddressSelect = useCallback((address: GoogleAddress, error?: AddressValidationError | null) => {
    if (onAddressSelect) {
      onAddressSelect(address, error)
    }
  }, [onAddressSelect])

  // Handle immediate search on Enter key
  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()

      if (isMobile && syncToUrl) {
        // On mobile, sync to URL immediately on Enter
        syncToUrl()
      } else {
        // On desktop, trigger immediate filter change
        onFiltersChange({ q: searchValue || undefined })
      }
    }
  }, [searchValue, onFiltersChange, isMobile, syncToUrl])

  // Handle input blur to sync on mobile
  const handleSearchBlur = useCallback(() => {
    if (isMobile && syncToUrl) {
      syncToUrl()
    }
  }, [isMobile, syncToUrl])
  
  return (
    <div className="flex flex-col sm:flex-row flex-wrap items-center gap-2 sm:gap-3 rounded-md border bg-white/60 p-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground w-full sm:w-auto">
        <Filter className="h-4 w-4" />
        Filters
      </div>

      {disablePatchSelect ? (
        <div className="w-full sm:min-w-[180px] text-sm font-medium text-primary">
          {patchOptions.find((option) => option.value === filters.patchId)?.label || "Your patch"}
        </div>
      ) : (
        <Select
          value={filters.patchId ?? ""}
          onValueChange={(value) => onFiltersChange({ patchId: value || null })}
        >
          <SelectTrigger className="w-full sm:min-w-[180px]">
            <SelectValue placeholder="Select patch" />
          </SelectTrigger>
          <SelectContent>
            {patchOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Mobile: Tabs for Name/Address/Closest search */}
      {isMobile ? (
        <div className="w-full">
          <Tabs
            value={searchMode === 'closest' ? 'closest' : searchMode === 'address' ? 'address' : 'name'}
            onValueChange={(v) => {
              if (v === 'closest') {
                handleClosestToMe()
              } else {
                handleSearchModeChange(v as "name" | "address")
              }
            }}
            className="w-full"
          >
            <TabsList className={`grid w-full ${isPWA ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <TabsTrigger value="name">
                <Search className="h-4 w-4 mr-2" />
                By Name
              </TabsTrigger>
              <TabsTrigger value="address">
                <Navigation className="h-4 w-4 mr-2" />
                By Address
              </TabsTrigger>
              {isPWA && (
                <TabsTrigger value="closest">
                  <MapPin className="h-4 w-4 mr-2" />
                  Closest
                </TabsTrigger>
              )}
            </TabsList>
            <TabsContent value="name" className="mt-2">
              <div className="relative">
                <Search data-testid="search-icon" className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  ref={inputRef}
                  id="patch-project-search-mobile"
                  type="search"
                  placeholder="Search projects..."
                  value={searchValue}
                  onChange={(e) => setSearchValue(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  onBlur={handleSearchBlur}
                  className="pl-12 pr-12 min-h-[44px]"
                  style={{ paddingLeft: '3rem', paddingRight: '3rem' }}
                  autoComplete="off"
                  enterKeyHint="search"
                  inputMode="text"
                />
                {isSearchPending && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 z-10">
                    <LoadingSpinner size={16} alt="Searching" />
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="address" className="mt-2">
              <GoogleAddressInput
                value={addressQuery}
                onChange={handleAddressSelect}
                placeholder="Enter an address..."
                showLabel={false}
                requireSelection={false}
              />
            </TabsContent>
            <TabsContent value="closest" className="mt-2">
              <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2">
                  {isGettingLocation ? (
                    <>
                      <LoadingSpinner size={16} alt="Getting location" />
                      <span className="text-sm text-blue-700 dark:text-blue-300">Getting your location...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Finding projects closest to you
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-300">
                          Using your current location
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      ) : (
        /* Desktop: Simple input (backward compatible) */
        <Input
          placeholder="Search projects..."
          className="w-full sm:w-60"
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          autoComplete="off"
        />
      )}

      <Select value={filters.tier} onValueChange={(value) => onFiltersChange({ tier: value as PatchProjectFilters["tier"] })}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Tier" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tiers</SelectItem>
          {Object.entries(PROJECT_TIER_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.universe} onValueChange={(value) => onFiltersChange({ universe: value as PatchProjectFilters["universe"] })}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Universe" />
        </SelectTrigger>
        <SelectContent>
          {universeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.stage} onValueChange={(value) => onFiltersChange({ stage: value as PatchProjectFilters["stage"] })}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="Stage" />
        </SelectTrigger>
        <SelectContent>
          {stageOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.eba} onValueChange={(value) => onFiltersChange({ eba: value as PatchProjectFilters["eba"] })}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="EBA" />
        </SelectTrigger>
        <SelectContent>
          {ebaOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.sort} onValueChange={(value) => onFiltersChange({ sort: value as PatchProjectFilters["sort"] })}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="sm"
        onClick={() => onFiltersChange({ dir: filters.dir === "asc" ? "desc" : "asc" })}
        className="w-full sm:w-auto min-h-[44px]"
      >
        {filters.dir === "asc" ? <ArrowUpNarrowWide className="h-4 w-4 mr-1" /> : <ArrowDownNarrowWide className="h-4 w-4 mr-1" />}
        {filters.dir === "asc" ? "Asc" : "Desc"}
      </Button>

      {onClear && (
        <Button variant="ghost" size="sm" onClick={onClear} className="w-full sm:w-auto min-h-[44px]">
          Clear
        </Button>
      )}
    </div>
  )
}

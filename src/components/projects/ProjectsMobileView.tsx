"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect, useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Badge } from "@/components/ui/badge"
import {
  Filter,
  ChevronDown,
  ChevronUp,
  SortAsc,
  SortDesc,
  Grid3X3,
  List,
  Map as MapIcon,
  Search,
  X
} from "lucide-react"
import CreateProjectDialog from "@/components/projects/CreateProjectDialog"
import { useProjectsServerSideCompatible } from "@/hooks/useProjectsServerSide"
import { ProjectCard, ProjectCardData } from "./ProjectCard"
import { PROJECT_TIER_LABELS, ProjectTier } from "./types"
import ProjectsMapView from "./ProjectsMapView"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { OrganizingUniverseBadge } from "@/components/ui/OrganizingUniverseBadge"
import Link from "next/link"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { GoogleAddressInput, GoogleAddress, AddressValidationError } from "@/components/projects/GoogleAddressInput"
import { useAddressSearch } from "@/hooks/useAddressSearch"
import { AddressSearchResults } from "@/components/projects/AddressSearchResults"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"

// State persistence key
const PROJECTS_STATE_KEY = 'projects-page-state-mobile'

// Skeleton loading components
function ProjectCardSkeleton() {
  return (
    <div className="border rounded-lg p-4 bg-white space-y-4">
      <div className="flex items-start justify-between">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-5 w-5 rounded-full" />
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-20" />
        </div>
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="pt-4 border-t">
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  )
}

function ProjectListItemSkeleton() {
  return (
    <div className="border rounded-lg p-3 bg-white space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="flex flex-col items-end gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-5" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  )
}

// Save state to sessionStorage
const saveProjectsState = (params: URLSearchParams) => {
  try {
    const state = {
      q: params.get('q') || '',
      page: params.get('page') || '1',
      tier: params.get('tier') || 'all',
      sort: params.get('sort') || 'name',
      dir: params.get('dir') || 'asc',
      view: params.get('view') || 'card',
      workers: params.get('workers') || 'all',
      universe: params.get('universe') || 'all',
      stage: params.get('stage') || 'all',
      eba: params.get('eba') || 'all',
    }
    sessionStorage.setItem(PROJECTS_STATE_KEY, JSON.stringify(state))
  } catch (e) {
    // Silent fail
  }
}

// Load state from sessionStorage
const loadProjectsState = () => {
  try {
    const saved = sessionStorage.getItem(PROJECTS_STATE_KEY)
    return saved ? JSON.parse(saved) : null
  } catch (e) {
    return null
  }
}

// Mobile list item component
function ProjectListItem({ project }: { project: ProjectCardData }) {
  const { startNavigation } = useNavigationLoading()
  const router = useRouter()
  const ebaStatus = getProjectEbaStatus(project.builderName)
  
  const handleClick = () => {
    startNavigation(`/projects/${project.id}`)
    // Use setTimeout to ensure loading overlay shows before navigation
    setTimeout(() => {
      router.push(`/projects/${project.id}`)
    }, 50)
  };
  
  return (
    <div className="border rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors cursor-pointer" onClick={handleClick}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-sm truncate">{project.name}</h3>
          {project.full_address && (
            <p className="text-xs text-muted-foreground truncate mt-1">{project.full_address}</p>
          )}
          {project.builderName && (
            <p className="text-xs text-muted-foreground truncate mt-1">Builder: {project.builderName}</p>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <ProjectTierBadge tier={project.tier} size="sm" />
          {ebaStatus.hasActiveEba && (
            <CfmeuEbaBadge hasActiveEba={true} size="sm" showText={false} />
          )}
        </div>
      </div>
      
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2">
          <OrganizingUniverseBadge
            projectId={project.id}
            currentStatus={project.organising_universe as any}
            size="sm"
          />
          <Badge variant="outline" className="text-xs">
            {project.stage_class?.replace('_', ' ')}
          </Badge>
        </div>
        
        {project.value && (
          <span className="text-xs text-muted-foreground">
            ${(project.value / 1000000).toFixed(1)}M
          </span>
        )}
      </div>
    </div>
  )
}

export function ProjectsMobileView() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const { startNavigation } = useNavigationLoading()
  
  // All the same parameters as desktop version
  const [searchInput, setSearchInput] = useState(() => sp.get("q") || "")
  const qParam = sp.get("q") || ""
  const q = qParam.toLowerCase()
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const tierFilter = (sp.get("tier") || "all") as ProjectTier | 'all'
  const sort = sp.get("sort") || "name"
  const dir = sp.get("dir") || "asc"
  const view = sp.get("view") || "card"
  const workersFilter = sp.get("workers") || "all"
  const universeFilter = sp.get("universe") || sp.get("universeFilter") || "all"
  const stageFilter = sp.get("stage") || sp.get("stageFilter") || "all"
  const ebaFilter = sp.get("eba") || "all"
  const ratingStatusFilter = sp.get("ratingStatus") || "all"
  const auditStatusFilter = sp.get("auditStatus") || "all"
  const mappingStatusFilter = sp.get("mappingStatus") || "all"
  const mappingUpdateStatusFilter = sp.get("mappingUpdateStatus") || "all"
  const complianceCheckStatusFilter = sp.get("complianceCheckStatus") || "all"
  
  const PAGE_SIZE = 12 // Slightly smaller for mobile
  
  // Mobile-specific state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  // Address search state
  const searchMode = (sp.get("searchMode") || "name") as "name" | "address"
  const addressLat = sp.get("addressLat") ? parseFloat(sp.get("addressLat")!) : null
  const addressLng = sp.get("addressLng") ? parseFloat(sp.get("addressLng")!) : null
  const addressQuery = sp.get("addressQuery") || ""

  // Address search query
  const addressSearchQuery = useAddressSearch({
    lat: addressLat,
    lng: addressLng,
    address: addressQuery,
    enabled: searchMode === "address" && addressLat !== null && addressLng !== null
  })

  // Auto-navigate to exact match
  useEffect(() => {
    if (searchMode === "address" && addressSearchQuery.data && addressSearchQuery.data.length > 0) {
      const exactMatch = addressSearchQuery.data.find(r => r.is_exact_match)
      if (exactMatch) {
        toast.success(`Found exact match: ${exactMatch.project_name}`)
        startNavigation(`/projects/${exactMatch.project_id}`)
        setTimeout(() => router.push(`/projects/${exactMatch.project_id}`), 300)
      }
    }
  }, [addressSearchQuery.data, searchMode, router, startNavigation])

  useEffect(() => {
    saveProjectsState(sp)
  }, [sp])

  useEffect(() => {
    if (sp.toString() === '') {
      const savedState = loadProjectsState()
      if (savedState) {
        const params = new URLSearchParams()
        Object.entries(savedState).forEach(([key, value]) => {
          if (value && value !== 'all' && value !== '1') {
            params.set(key, String(value))
          }
        })
        if (params.toString()) {
          router.replace(`${pathname}?${params.toString()}`)
        }
      }
    }
  }, [])

  useEffect(() => {
    const current = sp.get("q") || ""
    setSearchInput((prev) => (prev === current ? prev : current))
  }, [sp])

  const setParam = useCallback((key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === 'all') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    if (key !== 'page') {
      params.delete('page')
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, router, sp])

  const handleSearchModeChange = useCallback((mode: string) => {
    const params = new URLSearchParams(sp.toString())
    if (mode === "address") {
      params.set("searchMode", "address")
      params.delete("q")
    } else {
      params.delete("searchMode")
      params.delete("addressLat")
      params.delete("addressLng")
      params.delete("addressQuery")
    }
    params.delete('page')
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [pathname, router, sp])

  const handleAddressSelect = useCallback((address: GoogleAddress, error?: AddressValidationError | null) => {
    console.log('[Address Search Mobile] handleAddressSelect called', { address, error, hasCoordinates: !!(address.lat && address.lng) })
    if (address.lat && address.lng) {
      console.log('[Address Search Mobile] Setting URL params', { lat: address.lat, lng: address.lng, formatted: address.formatted })
      const params = new URLSearchParams(sp.toString())
      params.set("searchMode", "address")
      params.set("addressLat", address.lat.toString())
      params.set("addressLng", address.lng.toString())
      params.set("addressQuery", address.formatted)
      params.delete("q")
      params.delete('page')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname)
    } else {
      console.log('[Address Search Mobile] No coordinates available, search will not execute')
    }
  }, [pathname, router, sp])

  useEffect(() => {
    const handler = window.setTimeout(() => {
      const currentParam = sp.get("q") || ""
      if (searchInput === currentParam) return
      const nextValue = searchInput
      setParam("q", nextValue.length > 0 ? nextValue : undefined)
    }, 300)

    return () => {
      window.clearTimeout(handler)
    }
  }, [searchInput, setParam, sp])

  // For map view, fetch all projects with larger page size; for card/list view, use standard pagination
  const serverSideResult = useProjectsServerSideCompatible({
    page: view === "map" ? 1 : page,
    pageSize: view === "map" ? 9999 : PAGE_SIZE, // Fetch all projects for map view
    sort: sort as 'name' | 'value' | 'tier' | 'workers' | 'members' | 'delegates' | 'eba_coverage' | 'employers' | 'created_at' | 'key_contractors_rated_value',
    dir: dir as 'asc' | 'desc',
    q: q || undefined,
    tier: tierFilter !== 'all' ? tierFilter.replace('_', '') as any : undefined,
    workers: workersFilter !== 'all' ? workersFilter as any : undefined,
    universe: universeFilter !== 'all' ? universeFilter as any : undefined,
    stage: stageFilter !== 'all' ? stageFilter as any : undefined,
    eba: ebaFilter !== 'all' ? ebaFilter as any : undefined,
    ratingStatus: ratingStatusFilter !== 'all' ? ratingStatusFilter as any : undefined,
    auditStatus: auditStatusFilter !== 'all' ? auditStatusFilter as any : undefined,
    mappingStatus: mappingStatusFilter !== 'all' ? mappingStatusFilter as any : undefined,
    mappingUpdateStatus: mappingUpdateStatusFilter !== 'all' ? mappingUpdateStatusFilter as any : undefined,
    complianceCheckStatus: complianceCheckStatusFilter !== 'all' ? complianceCheckStatusFilter as any : undefined,
  })

  const { projects, totalCount, hasNext, hasPrev, isLoading, isFetching, error } = serverSideResult
  const hasLoadedData = projects.length > 0
  const isInitialLoad = isLoading && !hasLoadedData

  // Track if data is being refreshed (not initial load)
  const isRefreshing = isFetching && hasLoadedData

  // Track if search is being typed (debounced)
  const isSearchPending = searchInput !== qParam && searchMode === 'name'
  
  // For pagination display, use the actual page size
  const displayTotalCount = view === "map" ? projects.length : totalCount
  const displayHasNext = view === "map" ? false : hasNext
  const displayHasPrev = view === "map" ? false : hasPrev
  
  // Count active filters
  const activeFilters = [
    tierFilter !== 'all' ? 'tier' : null,
    workersFilter !== 'all' ? 'workers' : null,
    universeFilter !== 'all' ? 'universe' : null,
    stageFilter !== 'all' ? 'stage' : null,
    ebaFilter !== 'all' ? 'eba' : null,
    ratingStatusFilter !== 'all' ? 'ratingStatus' : null,
    auditStatusFilter !== 'all' ? 'auditStatus' : null,
    mappingStatusFilter !== 'all' ? 'mappingStatus' : null,
    mappingUpdateStatusFilter !== 'all' ? 'mappingUpdateStatus' : null,
    complianceCheckStatusFilter !== 'all' ? 'complianceCheckStatus' : null,
  ].filter(Boolean).length

  if (isInitialLoad) {
    return (
      <div className="px-safe py-4 pb-safe-bottom space-y-4">
        {/* Header Skeleton */}
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-32" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-24" />
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <Skeleton className="h-11 w-11" />
              <Skeleton className="h-11 w-11" />
              <Skeleton className="h-11 w-11" />
            </div>
          </div>
        </div>

        {/* Search Skeleton */}
        <Skeleton className="h-10 w-full" />
        <div className="space-y-2">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>

        {/* Results count skeleton */}
        <Skeleton className="h-4 w-48" />

        {/* Loading cards */}
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>

        {/* Pagination skeleton */}
        <div className="flex items-center justify-between pt-4">
          <Skeleton className="h-11 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-11 w-24" />
        </div>
      </div>
    )
  }

  // Error state
  if (error && !hasLoadedData) {
    return (
      <div className="px-safe py-4 pb-safe-bottom space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Projects</h1>
          <CreateProjectDialog />
        </div>

        <div className="border border-red-300 bg-red-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <h3 className="font-semibold">Failed to Load Projects</h3>
          </div>
          <p className="text-sm text-red-700">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Reload Page
          </Button>
        </div>
      </div>
    )
  }

  const cardData = projects.map(p => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    stage_class: p.stage_class,
    organising_universe: p.organising_universe,
    value: p.value,
    builderName: p.builder_name,
    full_address: p.full_address
  }))

  return (
    <div className="px-safe py-4 pb-safe-bottom space-y-4">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Projects</h1>

        <div className="flex items-center gap-2">
          <CreateProjectDialog />
          {/* View toggle buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={view === "card" ? "default" : "ghost"}
            size="sm"
            className="h-11 px-3"
            onClick={() => setParam("view", "card")}
            disabled={isRefreshing}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-11 px-3"
            onClick={() => setParam("view", "list")}
            disabled={isRefreshing}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "map" ? "default" : "ghost"}
            size="sm"
            className="h-11 px-3"
            onClick={() => setParam("view", "map")}
            disabled={isRefreshing}
          >
            <MapIcon className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </div>

      {/* Search */}
      <Tabs value={searchMode} onValueChange={handleSearchModeChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="name">
            <Search className="h-4 w-4 mr-2" />
            By Name
          </TabsTrigger>
          <TabsTrigger value="address">
            <MapIcon className="h-4 w-4 mr-2" />
            By Address
          </TabsTrigger>
        </TabsList>
        <TabsContent value="name" className="mt-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="project-search-mobile"
              placeholder="Search projects…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {isSearchPending && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
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
      </Tabs>


      {/* Mobile filters and sort */}
      <div className="space-y-2">
        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full h-11">
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilters > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-xs">
                  {activeFilters}
                </Badge>
              )}
              {filtersOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tier</label>
              <Select value={tierFilter} onValueChange={(value) => setParam("tier", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {Object.entries(PROJECT_TIER_LABELS).map(([tier, label]) => (
                    <SelectItem key={tier} value={tier}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Stage</label>
              <Select value={stageFilter} onValueChange={(value) => setParam("stage", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="future">Future</SelectItem>
                  <SelectItem value="pre_construction">Pre-construction</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Universe</label>
              <Select value={universeFilter} onValueChange={(value) => setParam("universe", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">EBA</label>
              <Select value={ebaFilter} onValueChange={(value) => setParam("eba", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
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

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Rating Status</label>
              <Select value={ratingStatusFilter} onValueChange={(value) => setParam("ratingStatus", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="rated">Rated</SelectItem>
                  <SelectItem value="unrated">Unrated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Audit Status</label>
              <Select value={auditStatusFilter} onValueChange={(value) => setParam("auditStatus", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="has_audit">Has Audit</SelectItem>
                  <SelectItem value="no_audit">No Audit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mapping Status</label>
              <Select value={mappingStatusFilter} onValueChange={(value) => setParam("mappingStatus", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="no_roles">No Roles</SelectItem>
                  <SelectItem value="no_trades">No Trades</SelectItem>
                  <SelectItem value="bci_only">BCI Only</SelectItem>
                  <SelectItem value="has_manual">Has Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Mapping Update</label>
              <Select value={mappingUpdateStatusFilter} onValueChange={(value) => setParam("mappingUpdateStatus", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="recent">Recent (0-7 days)</SelectItem>
                  <SelectItem value="recent_week">Recent Week (7-30 days)</SelectItem>
                  <SelectItem value="stale">Stale (30+ days)</SelectItem>
                  <SelectItem value="never">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Compliance Check</label>
              <Select value={complianceCheckStatusFilter} onValueChange={(value) => setParam("complianceCheckStatus", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="0-3_months">0-3 months</SelectItem>
                  <SelectItem value="3-6_months">3-6 months</SelectItem>
                  <SelectItem value="6-12_months">6-12 months</SelectItem>
                  <SelectItem value="12_plus_never">12+ months/Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {activeFilters > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setParam("tier", "all")
                setParam("stage", "all")
                setParam("universe", "all")
                setParam("eba", "all")
                setParam("workers", "all")
                setParam("ratingStatus", "all")
                setParam("auditStatus", "all")
                setParam("mappingStatus", "all")
                setParam("mappingUpdateStatus", "all")
                setParam("complianceCheckStatus", "all")
              }}
              className="w-full text-muted-foreground h-11"
            >
              <X className="h-4 w-4 mr-2" />
              Clear All Filters
            </Button>
          )}
        </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Sort */}
        <Collapsible open={sortOpen} onOpenChange={setSortOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full h-11">
              {dir === "asc" ? <SortAsc className="h-4 w-4 mr-2" /> : <SortDesc className="h-4 w-4 mr-2" />}
              Sort
              {sortOpen ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
        <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Sort By</label>
              <Select value={sort} onValueChange={(value) => setParam("sort", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="tier">Tier</SelectItem>
                  <SelectItem value="workers">Workers</SelectItem>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="created_at">Created</SelectItem>
                  <SelectItem value="key_contractors_rated_value">$ Key Contractors Rated</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Direction</label>
              <Select value={dir} onValueChange={(value) => setParam("dir", value)}>
                <SelectTrigger className="h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="asc">Ascending</SelectItem>
                  <SelectItem value="desc">Descending</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* Loading indicator for filter/search/pagination changes */}
      {isRefreshing && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2 sticky top-0 z-10 shadow-sm">
          <LoadingSpinner size={18} alt="Refreshing" />
          <span className="text-sm font-medium text-blue-900">Updating projects...</span>
        </div>
      )}

      {/* Address Search Results */}
      {searchMode === "address" && addressLat && addressLng && view !== 'map' && (
        <div className="space-y-3">
          {addressSearchQuery.isLoading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2 p-4 justify-center">
              <LoadingSpinner size={16} /> Searching nearby…
            </div>
          )}
          {addressSearchQuery.error && (
            <div className="border border-red-300 bg-red-50 rounded-lg p-3">
              <p className="text-red-800 text-sm">Error searching for projects. Please try again.</p>
            </div>
          )}
          {addressSearchQuery.data && addressSearchQuery.data.length > 0 && !addressSearchQuery.data.some(r => r.is_exact_match) && (
            <AddressSearchResults
              searchAddress={addressQuery}
              searchLat={addressLat}
              searchLng={addressLng}
              results={addressSearchQuery.data}
              onProjectClick={(projectId) => {
                startNavigation(`/projects/${projectId}`)
                setTimeout(() => router.push(`/projects/${projectId}`), 50)
              }}
              onShowOnMap={() => setParam("view", "map")}
              isMobile
            />
          )}
          {addressSearchQuery.data && addressSearchQuery.data.length === 0 && !addressSearchQuery.isLoading && (
            <div className="text-center py-6">
              <MapIcon className="h-10 w-10 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 text-sm">No projects found within 100km.</p>
            </div>
          )}
        </div>
      )}


      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {view === "map" ? (
            `Showing ${displayTotalCount} projects on map`
          ) : (
            `Showing ${((page - 1) * PAGE_SIZE) + 1}-${Math.min(page * PAGE_SIZE, totalCount)} of ${totalCount} projects`
          )}
        </span>
        {activeFilters > 0 && (
          <Badge variant="outline" className="text-xs">
            {activeFilters} filter{activeFilters > 1 ? 's' : ''} active
          </Badge>
        )}
      </div>

      {/* Content based on view */}
      {view === "map" ? (
        <div className="space-y-3">
          {projects.length > 0 && (
            <div className="text-xs text-muted-foreground bg-blue-50 border border-blue-200 rounded-lg p-3">
              💡 <strong>Map View:</strong> Showing all {projects.length} projects that match your current filters.
              Tap on any project marker to view details.
            </div>
          )}
          <ProjectsMapView
            projects={projects}
            onProjectClick={(id) => {
              startNavigation(`/projects/${id}`)
              setTimeout(() => router.push(`/projects/${id}`), 50)
            }}
            searchQuery={q}
            patchIds={[]}
            tierFilter={tierFilter}
            workersFilter={workersFilter}
            currentFilters={{
              q,
              tier: tierFilter,
              universe: universeFilter,
              stage: stageFilter,
              workers: workersFilter,
              eba: ebaFilter
            }}
            addressSearchPin={
              searchMode === "address" && addressLat && addressLng
                ? { lat: addressLat, lng: addressLng, address: addressQuery }
                : undefined
            }
            highlightedProjectIds={
              searchMode === "address" && addressSearchQuery.data
                ? addressSearchQuery.data.map(r => r.project_id)
                : []
            }
          />
        </div>
      ) : projects.length === 0 && !isLoading ? (
        <p className="text-center text-muted-foreground pt-8">No projects found.</p>
      ) : isRefreshing ? (
        // Show skeleton cards during refresh to prevent layout shift
        <div className={view === "list" ? "space-y-2" : "space-y-4"}>
          <div className="relative">
            {/* Semi-transparent overlay with old data */}
            <div className="opacity-40 pointer-events-none">
              {cardData.map((p: ProjectCardData) => (
                view === "list" ? (
                  <ProjectListItem key={p.id} project={p} />
                ) : (
                  <ProjectCard key={p.id} project={p} />
                )
              ))}
            </div>

            {/* Skeleton overlay */}
            <div className="absolute inset-0 space-y-2">
              {[...Array(Math.min(cardData.length, PAGE_SIZE))].map((_, i) => (
                view === "list" ? (
                  <ProjectListItemSkeleton key={i} />
                ) : (
                  <ProjectCardSkeleton key={i} />
                )
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={view === "list" ? "space-y-2" : "space-y-4"}>
          {cardData.map((p: ProjectCardData) => (
            view === "list" ? (
              <ProjectListItem key={p.id} project={p} />
            ) : (
              <ProjectCard key={p.id} project={p} />
            )
          ))}
        </div>
      )}

      {/* Pagination - only show for card/list views */}
      {view !== "map" && (
        <div className="flex items-center justify-between pt-4">
          <Button
            variant="outline"
            size="sm"
            className="h-11"
            disabled={!displayHasPrev || isRefreshing}
            onClick={() => setParam('page', String(page - 1))}
          >
            Previous
          </Button>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {isRefreshing && <LoadingSpinner size={14} />}
            Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-11"
            disabled={!displayHasNext || isRefreshing}
            onClick={() => setParam('page', String(page + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

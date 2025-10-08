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
import { useProjectsServerSideCompatible } from "@/hooks/useProjectsServerSide"
import { ProjectCard, ProjectCardData } from "./ProjectCard"
import { PROJECT_TIER_LABELS, ProjectTier } from "./types"
import ProjectsMapView from "./ProjectsMapView"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import { getOrganisingUniverseBadgeVariant } from "@/utils/organisingUniverse"
import Link from "next/link"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { Upload } from "lucide-react"
import { UploadMappingSheetDialog } from "@/components/projects/mapping/UploadMappingSheetDialog"
import { ProjectQuickFinder } from "@/components/projects/ProjectQuickFinder"

// State persistence key
const PROJECTS_STATE_KEY = 'projects-page-state-mobile'

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
          <Badge 
            variant={getOrganisingUniverseBadgeVariant(project.organising_universe as any)} 
            className="text-xs"
          >
            {project.organising_universe}
          </Badge>
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
  
  const PAGE_SIZE = 12 // Slightly smaller for mobile
  
  // Mobile-specific state
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false)
  const [scanToReview, setScanToReview] = useState<{ scanId: string; projectId?: string } | null>(null)

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
    sort: sort as 'name' | 'value' | 'tier' | 'workers' | 'members' | 'delegates' | 'eba_coverage' | 'employers' | 'created_at',
    dir: dir as 'asc' | 'desc',
    q: q || undefined,
    tier: tierFilter !== 'all' ? tierFilter.replace('_', '') as any : undefined,
    workers: workersFilter !== 'all' ? workersFilter as any : undefined,
    universe: universeFilter !== 'all' ? universeFilter as any : undefined,
    stage: stageFilter !== 'all' ? stageFilter as any : undefined,
    eba: ebaFilter !== 'all' ? ebaFilter as any : undefined,
  })

  const { projects, totalCount, hasNext, hasPrev, isLoading, isFetching } = serverSideResult
  const hasLoadedData = projects.length > 0
  const isInitialLoad = isLoading && !hasLoadedData
  
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
  ].filter(Boolean).length

  if (isInitialLoad) {
    return (
      <div className="px-safe py-4 pb-safe-bottom space-y-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        <Input placeholder="Search projects…" disabled />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-lg h-32 animate-pulse" />
          ))}
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
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => setIsQuickUploadOpen(true)}
          >
            <Upload className="h-4 w-4" />
            Upload scan
          </Button>
          {/* View toggle buttons */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <Button
            variant={view === "card" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3"
            onClick={() => setParam("view", "card")}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "list" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3"
            onClick={() => setParam("view", "list")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={view === "map" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-3"
            onClick={() => setParam("view", "map")}
          >
            <MapIcon className="h-4 w-4" />
          </Button>
        </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input 
          id="project-search-mobile"
          placeholder="Search projects…" 
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="pl-10"
          autoComplete="off"
        />
      </div>

      {/* Mobile filters and sort */}
      <div className="space-y-2">
        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
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
                <SelectTrigger className="h-8">
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
                <SelectTrigger className="h-8">
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
                <SelectTrigger className="h-8">
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
                <SelectTrigger className="h-8">
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
              }}
              className="w-full text-muted-foreground"
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
            <Button variant="outline" size="sm" className="w-full">
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
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="value">Value</SelectItem>
                  <SelectItem value="tier">Tier</SelectItem>
                  <SelectItem value="workers">Workers</SelectItem>
                  <SelectItem value="members">Members</SelectItem>
                  <SelectItem value="created_at">Created</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Direction</label>
              <Select value={dir} onValueChange={(value) => setParam("dir", value)}>
                <SelectTrigger className="h-8">
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

      {!isInitialLoad && isFetching && (
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <LoadingSpinner size={16} alt="Refreshing" />
          Updating projects…
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
            summaries={{}}
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
          />
        </div>
      ) : projects.length === 0 && !isLoading ? (
        <p className="text-center text-muted-foreground pt-8">No projects found.</p>
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
          <Button variant="outline" size="sm" disabled={!displayHasPrev} onClick={() => setParam('page', String(page - 1))}>
            Previous
          </Button>
          <div className="text-sm text-muted-foreground">
            Page {page} of {Math.ceil(totalCount / PAGE_SIZE)}
          </div>
          <Button variant="outline" size="sm" disabled={!displayHasNext} onClick={() => setParam('page', String(page + 1))}>
            Next
          </Button>
        </div>
      )}

      <UploadMappingSheetDialog
        mode="new_project"
        open={isQuickUploadOpen}
        onOpenChange={(open) => {
          setIsQuickUploadOpen(open)
          if (!open) {
            setScanToReview(null)
          }
        }}
        onScanReady={(scanId, projectId) => {
          if (projectId) {
            startNavigation(`/projects/${projectId}/scan-review/${scanId}`)
            setTimeout(() => router.push(`/projects/${projectId}/scan-review/${scanId}`), 50)
            return
          }
          setScanToReview({ scanId })
        }}
      />

      <ProjectQuickFinder
        open={!!scanToReview}
        onOpenChange={(open) => {
          if (!open) {
            setScanToReview(null)
          }
        }}
        onSelectExistingProject={(projectId) => {
          if (!scanToReview) return
          startNavigation(`/projects/${projectId}/scan-review/${scanToReview.scanId}`)
          setTimeout(() => router.push(`/projects/${projectId}/scan-review/${scanToReview.scanId}`), 50)
        }}
        onCreateNewProject={() => {
          if (!scanToReview) return
          startNavigation(`/projects/new-scan-review/${scanToReview.scanId}`)
          setTimeout(() => router.push(`/projects/new-scan-review/${scanToReview.scanId}`), 50)
        }}
      />
    </div>
  )
}

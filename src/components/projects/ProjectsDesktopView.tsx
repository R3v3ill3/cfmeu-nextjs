"use client"
export const dynamic = 'force-dynamic'

import { useCallback, useMemo, useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
// Progress replaced by custom gradient bar
import { Badge } from "@/components/ui/badge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon, MapPin, Filter, X, ChevronDown, ChevronUp } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import CreateProjectDialog from "@/components/projects/CreateProjectDialog"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { useProjectsServerSideCompatible } from "@/hooks/useProjectsServerSide"
import { ProjectTable } from "@/components/projects/ProjectTable"
import ProjectsMapView from "@/components/projects/ProjectsMapView"
import { useMultipleProjectSubsetStats } from "@/hooks/useProjectSubsetStats"
import { SubsetEbaStats } from "@/components/projects/SubsetEbaStats"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { LoadingSpinner } from "@/components/ui/LoadingSpinner"
import Link from "next/link"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"

type ProjectWithRoles = {
  id: string
  name: string
  main_job_site_id: string | null
  value: number | null
  tier: string | null
  project_assignments?: Array<{
    assignment_type: string
    employer_id: string
    contractor_role_types?: { code: string } | null
    trade_types?: { code: string } | null
    employers?: { 
      name: string | null
      enterprise_agreement_status?: boolean | null
    } | null
  }>
}

type ProjectSummary = {
  project_id: string
  total_workers: number
  total_members: number
  engaged_employer_count: number
  eba_active_employer_count: number
  estimated_total: number
  delegate_name: string | null
  first_patch_name: string | null
  organiser_names: string | null
}

function GradientBar({ percent, baseRgb }: { percent: number; baseRgb: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  const stops: string[] = []
  for (let i = 0; i < 10; i++) {
    const start = i * 10
    const end = start + 10
    const alpha = (i + 1) / 10
    stops.push(`rgba(${baseRgb},${alpha}) ${start}%`, `rgba(${baseRgb},${alpha}) ${end}%`)
  }
  const gradient = `linear-gradient(to right, ${stops.join(', ')})`
  return (
    <div className="w-full h-1 rounded bg-muted/30 overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: gradient }} />
    </div>
  )
}

interface CompactStatBarProps {
  label: string
  value: number
  of: number
  onClick?: () => void
  color?: string
}

function CompactStatBar({ label, value, of, onClick, color = '222,27,18' }: CompactStatBarProps) {
  const pct = of > 0 ? (value / of) * 100 : 0
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium">{value}/{of} ({Math.round(pct)}%)</span>
      </div>
      <GradientBar percent={pct} baseRgb={color} />
    </button>
  )
}

interface EbaPercentBarProps {
  active: number
  total: number
  onClick?: () => void
}

function EbaPercentBar({ active, total, onClick }: EbaPercentBarProps) {
  const safeTotal = Math.max(0, total)
  const safeActive = Math.max(0, Math.min(active, safeTotal))
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>EBA</span>
        <span>{safeTotal}</span>
      </div>
      <div className="w-full h-1 rounded bg-muted/30 overflow-hidden flex gap-px">
        {Array.from({ length: safeTotal }).map((_, index) => (
          <div
            key={index}
            className={`h-full flex-1 ${index < safeActive ? 'bg-green-500' : 'bg-transparent'}`}
          />
        ))}
      </div>
    </button>
  )
}

function ProjectListCard({ p, summary, subsetStats, onOpenEmployer }: { p: ProjectWithRoles; summary?: ProjectSummary; subsetStats?: any; onOpenEmployer: (id: string) => void }) {
  const { startNavigation } = useNavigationLoading()
  const router = useRouter()
  
  const builderNames = useMemo(() => {
    // Get all contractor role assignments as potential builders
    const contractors = (p.project_assignments || []).filter((a) => 
      a.assignment_type === 'contractor_role'
    )
    return contractors.map((a) => ({ id: a.employer_id, name: a.employers?.name || `Employer ${a.employer_id.slice(0, 8)}` }))
  }, [p.project_assignments])

  const head = useMemo(() => {
    // For now, treat first contractor role as head contractor  
    const hc = (p.project_assignments || []).find((a) => 
      a.assignment_type === 'contractor_role'
    )
    return hc ? { id: hc.employer_id, name: hc.employers?.name || `Employer ${hc.employer_id.slice(0, 8)}` } : null
  }, [p.project_assignments])

  // Also show trade contractors
  const tradeContractors = useMemo(() => {
    const trades = (p.project_assignments || []).filter((a) => 
      a.assignment_type === 'trade_work'
    )
    return trades.map((a) => ({ id: a.employer_id, name: a.employers?.name || `Employer ${a.employer_id.slice(0, 8)}` }))
  }, [p.project_assignments])

  // Calculate key contractor mapping metrics
  // Key contractors are critical roles and trades that significantly impact project success
  const keyContractorMetrics = useMemo(() => {
    const KEY_CONTRACTOR_TRADES = new Set([
      'demolition', 'piling', 'concrete', 'scaffolding', 'form_work',
      'tower_crane', 'mobile_crane', 'labour_hire', 'earthworks', 'traffic_control'
    ]);
    const KEY_CONTRACTOR_ROLES = new Set(['builder', 'project_manager']);
    
    // Total key categories (10 critical trades + 2 key roles = 12)
    const totalKeyCategories = KEY_CONTRACTOR_TRADES.size + KEY_CONTRACTOR_ROLES.size;
    
    // Count mapped key contractor categories
    const mappedKeyRoles = new Set();
    const mappedKeyTrades = new Set();
    let keyContractorsWithEba = 0;
    let totalKeyContractors = 0;

    (p.project_assignments || []).forEach((assignment) => {
      if (assignment.assignment_type === 'contractor_role' && assignment.contractor_role_types) {
        const roleCode = assignment.contractor_role_types.code;
        if (KEY_CONTRACTOR_ROLES.has(roleCode)) {
          mappedKeyRoles.add(roleCode);
          totalKeyContractors++;
          if (assignment.employers?.enterprise_agreement_status === true) {
            keyContractorsWithEba++;
          }
        }
      }
      
      if (assignment.assignment_type === 'trade_work' && assignment.trade_types) {
        const tradeCode = assignment.trade_types.code;
        if (KEY_CONTRACTOR_TRADES.has(tradeCode)) {
          mappedKeyTrades.add(tradeCode);
          totalKeyContractors++;
          if (assignment.employers?.enterprise_agreement_status === true) {
            keyContractorsWithEba++;
          }
        }
      }
    });

    const mappedCategories = mappedKeyRoles.size + mappedKeyTrades.size;
    const mappingPercentage = totalKeyCategories > 0 ? Math.round((mappedCategories / totalKeyCategories) * 100) : 0;
    const ebaPercentage = totalKeyContractors > 0 ? Math.round((keyContractorsWithEba / totalKeyContractors) * 100) : 0;

    return {
      mappedCategories,
      totalKeyCategories,
      mappingPercentage,
      keyContractorsWithEba,
      totalKeyContractors,
      ebaPercentage
    };
  }, [p.project_assignments]);

  const primary = builderNames[0] || head
  const secondary = head && primary && head.id !== primary.id ? head : null

  const ebaActive = summary?.eba_active_employer_count || 0
  const engaged = summary?.engaged_employer_count || 0
  const delegateName = summary?.delegate_name || null
  const patchName = summary?.first_patch_name || '—'
  const totalWorkers = summary?.total_workers || 0

  return (
    <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium">
          <div className="space-y-2">
            {/* Project name and mapping sheets button */}
            <div className="flex items-center justify-between gap-2">
              <Link 
                href={`/projects/${p.id}`} 
                className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1 truncate min-w-0 flex-1"
                onClick={(e) => {
                  e.preventDefault()
                  startNavigation(`/projects/${p.id}`)
                  setTimeout(() => router.push(`/projects/${p.id}`), 50)
                }}
              >
                {p.name}
              </Link>
              <button
                type="button"
                className="text-xs text-primary hover:underline whitespace-nowrap flex-shrink-0"
                onClick={() => {
                  try {
                    const ua = navigator.userAgent.toLowerCase()
                    const isMobile = /iphone|ipad|ipod|android/.test(ua)
                    const href = isMobile ? `/projects/${p.id}/mappingsheets-mobile` : `/projects/${p.id}?tab=mappingsheets`
                    startNavigation(href)
                    setTimeout(() => router.push(href), 50)
                  } catch {
                    const href = `/projects/${p.id}?tab=mappingsheets`
                    startNavigation(href)
                    setTimeout(() => router.push(href), 50)
                  }
                }}
              >
                Mapping Sheets
              </button>
            </div>
            {/* Badges row - always visible */}
            <div className="flex items-center gap-2 flex-wrap">
              {p.tier && (
                <ProjectTierBadge tier={p.tier as any} />
              )}
              {(() => {
                const ebaStatus = getProjectEbaStatus(p)
                return (
                  <CfmeuEbaBadge 
                    hasActiveEba={ebaStatus.hasActiveEba} 
                    builderName={ebaStatus.builderName}
                    size="sm"
                    showText={false}
                  />
                )
              })()}
              {('stage_class' in p && (p as any).stage_class) && (
                <Badge variant="secondary" className="text-[10px] capitalize">{String((p as any).stage_class).replace('_',' ')}</Badge>
              )}
              {('organising_universe' in p && (p as any).organising_universe) && (
                <Badge 
                  variant="outline" 
                  className={`text-[10px] capitalize border-2 font-medium ${
                    (p as any).organising_universe === 'active' 
                      ? 'bg-green-50 text-green-800 border-green-300 hover:bg-green-100'
                      : (p as any).organising_universe === 'potential'
                      ? 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                      : (p as any).organising_universe === 'excluded'
                      ? 'bg-red-50 text-red-800 border-red-300 hover:bg-red-100'
                      : 'bg-gray-50 text-gray-800 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {String((p as any).organising_universe)}
                </Badge>
              )}
            </div>
          </div>
        </CardTitle>
        <div className="mt-1 flex items-center gap-2 text-sm">
          {primary && (
            <button type="button" className="text-primary/80 hover:text-primary hover:underline truncate rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1" onClick={() => onOpenEmployer(primary.id)} title={primary.name}>
              {primary.name}
            </button>
          )}
          {secondary && (
            <>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-primary/80 hover:text-primary hover:underline truncate rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1" onClick={() => onOpenEmployer(secondary.id)} title={secondary.name}>
                {secondary.name}
              </button>
            </>
          )}
          {tradeContractors.length > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-xs text-blue-600">
                +{tradeContractors.length} trade contractor{tradeContractors.length !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            Patch: {patchName}
          </span>
          {summary?.organiser_names && (
            <>
              <span className="text-muted-foreground">•</span>
              <span>
                Organiser{summary.organiser_names.includes(',') ? 's' : ''}: {summary.organiser_names}
              </span>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
        <div className="space-y-2">
          <CompactStatBar
            label="Key Contractor Coverage"
            value={keyContractorMetrics.mappedCategories}
            of={keyContractorMetrics.totalKeyCategories}
            color="59,130,246" // Blue for mapping coverage
            onClick={() => { 
              startNavigation(`/projects/${p.id}?tab=contractors`)
              setTimeout(() => router.push(`/projects/${p.id}?tab=contractors`), 50)
            }}
          />
          <CompactStatBar
            label="Key Contractor EBA Active"
            value={keyContractorMetrics.keyContractorsWithEba}
            of={keyContractorMetrics.totalKeyContractors}
            color="34,197,94" // Green for EBA status
            onClick={() => { 
              startNavigation(`/projects/${p.id}?tab=contractors`)
              setTimeout(() => router.push(`/projects/${p.id}?tab=contractors`), 50)
            }}
          />
          <EbaPercentBar
            active={ebaActive}
            total={engaged}
            onClick={() => { 
              startNavigation(`/projects/${p.id}?tab=contractors`)
              setTimeout(() => router.push(`/projects/${p.id}?tab=contractors`), 50)
            }}
          />
          {subsetStats && (
            <SubsetEbaStats
              stats={subsetStats}
              variant="compact"
              onClick={() => { 
                startNavigation(`/projects/${p.id}?tab=contractors`)
                setTimeout(() => router.push(`/projects/${p.id}?tab=contractors`), 50)
              }}
            />
          )}
        </div>
        
        {/* Employer Count Display */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Linked Employers:</span>
          <Badge variant="outline" className="text-xs border-gray-800 text-black bg-white">
            {engaged} {engaged === 1 ? 'employer' : 'employers'}
          </Badge>
        </div>
        <div className="pt-1 text-xs text-muted-foreground flex items-center justify-between min-w-0">
          {delegateName ? (
            <div className="truncate min-w-0">
              <span className="mr-1">Site delegate:</span>
              <span title={delegateName}>{delegateName}</span>
            </div>
          ) : (
            <span className="truncate">Site delegate: —</span>
          )}
          {totalWorkers > 0 && (
            <Badge variant="secondary" className="text-[10px]">{totalWorkers} workers</Badge>
          )}
        </div>
        <div className="pt-2 mt-auto">
          <Button 
            className="w-full" 
            size="sm" 
            onClick={() => { 
              startNavigation(`/projects/${p.id}`)
              setTimeout(() => router.push(`/projects/${p.id}`), 50)
            }}
          >
            Open project
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// State persistence key
const PROJECTS_STATE_KEY = 'projects-page-state'

// Save state to sessionStorage
const saveProjectsState = (params: URLSearchParams) => {
  try {
    const state = {
      q: params.get('q') || '',
      patch: params.get('patch') || '',
      tier: params.get('tier') || 'all',
      sort: params.get('sort') || 'name',
      dir: params.get('dir') || 'asc',
      view: params.get('view') || 'card',
      workers: params.get('workers') || 'all',
      universe: params.get('universe') || 'all',
      stage: params.get('stage') || 'all',
      special: params.get('special') || 'all',
      eba: params.get('eba') || 'all',
      page: params.get('page') || '1'
    }
    sessionStorage.setItem(PROJECTS_STATE_KEY, JSON.stringify(state))
  } catch (e) {
    // Silent fail if sessionStorage unavailable
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

export function ProjectsDesktopView() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const { startNavigation } = useNavigationLoading()
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [searchInput, setSearchInput] = useState(() => sp.get("q") || "")
  const qParam = sp.get("q") || ""
  const q = qParam.toLowerCase()
  const patchParam = sp.get("patch") || ""
  const patchIds = patchParam.split(",").map(s => s.trim()).filter(Boolean)
  const tierFilter = (sp.get("tier") || "all") as ProjectTier | 'all'
  const sort = sp.get("sort") || "name"
  const dir = sp.get("dir") || "asc"
  const view = sp.get("view") || "card"
  const workersFilter = sp.get("workers") || "all" // all, zero, nonzero
  const universeFilter = sp.get("universe") || sp.get("universeFilter") || "all"
  const stageFilter = sp.get("stage") || sp.get("stageFilter") || "all"
  const specialFilter = sp.get("special") || "all"
  const ebaFilter = sp.get("eba") || "all"
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 24

  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_PROJECTS === 'true'

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isEmployerOpen, setIsEmployerOpen] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [isWorkerOpen, setIsWorkerOpen] = useState(false)

  // Enhanced state persistence
  useEffect(() => {
    // Save current state whenever search params change
    saveProjectsState(sp)
  }, [sp])

  // Restore state on mount if no params in URL
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
  }, []) // Only run on mount

  useEffect(() => {
    const current = sp.get("q") || ""
    setSearchInput((prev) => (prev === current ? prev : current))
  }, [sp])

  const setParam = useCallback((key: string, value?: string) => {
    const params = new URLSearchParams(sp.toString())
    if (!value || value === "all" || value === "") {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // Reset page when changing filters
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
  
  // Clear all filters
  const clearAllFilters = () => {
    router.replace(pathname)
  }
  
  // Get active filters for display
  const activeFilters = useMemo(() => {
    const filters = []
    if (q) filters.push({ key: 'q', value: q, label: `Search: ${q}` })
    if (tierFilter !== 'all') filters.push({ key: 'tier', value: tierFilter, label: `Tier: ${PROJECT_TIER_LABELS[tierFilter as ProjectTier] || tierFilter}` })
    if (universeFilter !== 'all') filters.push({ key: 'universe', value: universeFilter, label: `Universe: ${universeFilter}` })
    if (stageFilter !== 'all') filters.push({ key: 'stage', value: stageFilter, label: `Stage: ${stageFilter.replace('_', ' ')}` })
    if (workersFilter !== 'all') filters.push({ key: 'workers', value: workersFilter, label: `Workers: ${workersFilter === 'zero' ? 'None' : 'Has workers'}` })
    if (specialFilter !== 'all') filters.push({ key: 'special', value: specialFilter, label: 'No Builder, Has Employers' })
    if (ebaFilter !== 'all') {
      const ebaLabels = {
        'eba_active': 'EBA: Builder Active',
        'eba_inactive': 'EBA: Builder Known, Inactive', 
        'builder_unknown': 'EBA: Builder Unknown'
      }
      filters.push({ key: 'eba', value: ebaFilter, label: ebaLabels[ebaFilter as keyof typeof ebaLabels] || `EBA: ${ebaFilter}` })
    }
    return filters
  }, [q, tierFilter, universeFilter, stageFilter, workersFilter, specialFilter, ebaFilter])

  // If a patch is selected, compute project ids that have at least one site linked to these patches
  const { data: patchProjectIds = [], isFetching: fetchingPatchProjects } = useQuery<string[]>({
    queryKey: ["project-ids-for-patch", patchIds],
    enabled: patchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      console.log("🎯 Patch filtering for patches:", { patchIds })
      
      // Use simple direct query - job_sites.patch_id is properly synced
      const { data, error } = await supabase
        .from("job_sites")
        .select("project_id")
        .in("patch_id", patchIds)
        .not("project_id", "is", null)
      
      if (error) {
        console.error("❌ Patch filtering error:", error)
        throw error
      }
      
      // Extract unique project IDs
      const projectIds = Array.from(
        new Set(((data as any[]) || []).map((row: any) => row.project_id).filter(Boolean))
      )
      
      console.log("🎯 Found projects for patches:", { patchIds, projectIds, count: projectIds.length })
      return projectIds
    }
  })

  // SERVER-SIDE DATA FETCHING (New implementation)
  // For map view, fetch all projects; for card/list view, use pagination
  const serverSideResult = useProjectsServerSideCompatible({
    page: view === 'map' ? 1 : page,
    pageSize: view === 'map' ? 9999 : PAGE_SIZE, // Fetch all projects for map view
    sort: sort as any,
    dir: dir as 'asc' | 'desc',
    q: q || undefined,
    patch: patchParam || undefined,
    tier: tierFilter as any,
    universe: universeFilter,
    stage: stageFilter,
    workers: workersFilter as any,
    special: specialFilter as any,
    eba: ebaFilter as any,
  })

  // CLIENT-SIDE DATA FETCHING (Original implementation)
  const { data: clientProjectsData, isLoading: clientIsLoading } = useQuery<{ projects: ProjectWithRoles[]; summaries: Record<string, ProjectSummary> }>({
    queryKey: ["projects-list+summary", patchIds, patchProjectIds, tierFilter, universeFilter, stageFilter, ebaFilter, q],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    enabled: !USE_SERVER_SIDE, // Only run when server-side is disabled
    queryFn: async () => {
      // Load projects first
      let qy: any = supabase
        .from("projects")
        .select(`
          id,
          name,
          main_job_site_id,
          value,
          tier,
          organising_universe,
          stage_class
        `)

      // Apply search filter
      if (q) {
        qy = qy.ilike('name', `%${q}%`)
      }

      if (tierFilter !== "all") {
        qy = qy.eq('tier', tierFilter)
      }
      if (universeFilter !== "all") {
        qy = qy.eq('organising_universe', universeFilter)
      }
      if (stageFilter !== "all") {
        qy = qy.eq('stage_class', stageFilter)
      }

      if (patchIds.length > 0) {
        if ((patchProjectIds as string[]).length === 0) return { projects: [], summaries: {} }
        qy = qy.in('id', patchProjectIds as string[])
      }

      // For database-sortable fields, apply sorting here
      const ascending = dir === "asc"
      const needsClientSorting = ["workers", "members", "delegates", "eba_coverage", "employers"].includes(sort)
      
      if (!needsClientSorting) {
        if (sort === "name") {
          qy = qy.order("name", { ascending })
        } else if (sort === "value") {
          qy = qy.order("value", { ascending, nullsFirst: false })
        } else if (sort === "tier") {
          qy = qy.order("tier", { ascending, nullsFirst: false })
        } else {
          qy = qy.order("created_at", { ascending: false }) // default
        }
      }

      const { data, error } = await qy
      if (error) throw error
      const baseProjects = (data as any[]) || []
      
      // Load project assignments separately to avoid RLS issues
      let projectsWithAssignments = baseProjects;
      if (baseProjects.length > 0) {
        const projectIds = baseProjects.map((p: any) => p.id);
        const { data: assignments } = await supabase
          .from("project_assignments")
          .select(`
            project_id,
            assignment_type,
            employer_id,
            contractor_role_types(code),
            trade_types(code),
            employers(name, enterprise_agreement_status)
          `)
          .in('project_id', projectIds);
        
        // Group assignments by project
        const assignmentsByProject = new Map<string, any[]>();
        (assignments || []).forEach((assignment: any) => {
          if (!assignmentsByProject.has(assignment.project_id)) {
            assignmentsByProject.set(assignment.project_id, []);
          }
          assignmentsByProject.get(assignment.project_id)!.push(assignment);
        });
        
        // Combine projects with their assignments
        projectsWithAssignments = baseProjects.map((project: any) => ({
          ...project,
          project_assignments: assignmentsByProject.get(project.id) || []
        }));
      }
      
      const allProjects = projectsWithAssignments;
      
      // Get summaries for all projects
      let summaries: Record<string, ProjectSummary> = {}
      if (allProjects.length > 0) {
        const ids = allProjects.map((p: any) => p.id)
        const { data: sumRows } = await (supabase as any)
          .from('project_dashboard_summary')
          .select('*')
          .in('project_id', ids)
        summaries = ((sumRows as any[]) || []).reduce((acc, r: any) => {
          acc[r.project_id as string] = r as ProjectSummary
          return acc
        }, {} as Record<string, ProjectSummary>)
      }
      
      return { projects: allProjects as ProjectWithRoles[], summaries }
    }
  })

  // Conditional data selection based on feature flag
  const allProjects = USE_SERVER_SIDE ? serverSideResult.projects : (clientProjectsData?.projects || [])
  const summaries = USE_SERVER_SIDE ? serverSideResult.summaries : (clientProjectsData?.summaries || {})
  const isLoading = USE_SERVER_SIDE ? serverSideResult.isLoading : clientIsLoading
  const isFetching = USE_SERVER_SIDE ? serverSideResult.isFetching : clientIsLoading
  const hasLoadedData = USE_SERVER_SIDE
    ? (serverSideResult.projects || []).length > 0
    : (clientProjectsData?.projects || []).length > 0
  const isInitialLoad = isLoading && !hasLoadedData

  // Efficiently check which projects have a builder using the new RPC function
  const projectIdsWithBuilderQuery = useQuery({
    queryKey: ["projects-with-builder", allProjects.map(p => p.id)],
    enabled: allProjects.length > 0,
    staleTime: 60000, // Cache for 1 minute
    queryFn: async () => {
      const projectIds = allProjects.map(p => p.id);
      const { data, error } = await (supabase.rpc as any)('get_projects_with_builder', { project_ids: projectIds });
      if (error) throw error;
      return new Set(((data as any[]) || []).map((row: any) => row.project_id));
    }
  });

  const projectsWithBuilder = projectIdsWithBuilderQuery.data || new Set<string>();
  
  // Get subset EBA stats for all projects
  const projectIds = allProjects.map(p => p.id)
  const { data: subsetStats = {} } = useMultipleProjectSubsetStats(projectIds)
  
  // Apply client-side filtering and sorting (only for client-side mode)
  const filteredAndSortedProjects = useMemo(() => {
    if (USE_SERVER_SIDE) {
      // SERVER-SIDE: Data is already filtered and sorted
      return allProjects
    } else {
      // CLIENT-SIDE: Apply original filtering and sorting logic
      let filtered = allProjects.slice()
      
      // Apply workers filter
      if (workersFilter !== "all") {
        filtered = filtered.filter((p: any) => {
          const summary = summaries[p.id]
          const workerCount = summary?.total_workers || 0
          return workersFilter === "zero" ? workerCount === 0 : workerCount > 0
        })
      }
      
      if (specialFilter === "noBuilderWithEmployers") {
        filtered = filtered.filter(p => {
          const summary = summaries[p.id]
          const employerCount = summary?.engaged_employer_count || 0
          const hasBuilder = projectsWithBuilder.has(p.id);
          return employerCount > 0 && !hasBuilder
        })
      }
      
      // Apply EBA site filter
      if (ebaFilter !== "all") {
        filtered = filtered.filter(p => {
          const hasBuilder = projectsWithBuilder.has(p.id);
          const builderAssignments = (p.project_assignments || []).filter((a) => 
            a.assignment_type === 'contractor_role'
          )
          const builderEbaStatus = builderAssignments.some(a => a.employers?.enterprise_agreement_status === true)
          
          if (ebaFilter === "eba_active") {
            // Builder/Main contractor EBA = active
            return hasBuilder && builderEbaStatus
          } else if (ebaFilter === "eba_inactive") {
            // Builder/Main Contractor known, EBA status not active
            return hasBuilder && !builderEbaStatus
          } else if (ebaFilter === "builder_unknown") {
            // Builder/Main Contractor unknown
            return !hasBuilder
          }
          return true
        })
      }
      
      // Apply client-side sorting for summary-based fields
      const needsClientSorting = ["workers", "members", "delegates", "eba_coverage", "employers"].includes(sort)
      if (needsClientSorting) {
        const ascending = dir === "asc"
        filtered.sort((a: any, b: any) => {
          const summaryA = summaries[a.id]
          const summaryB = summaries[b.id]
          
          let valueA = 0
          let valueB = 0
          
          if (sort === "workers") {
            valueA = summaryA?.total_workers || 0
            valueB = summaryB?.total_workers || 0
          } else if (sort === "members") {
            valueA = summaryA?.total_members || 0
            valueB = summaryB?.total_members || 0
          } else if (sort === "employers") {
            valueA = summaryA?.engaged_employer_count || 0
            valueB = summaryB?.engaged_employer_count || 0
          } else if (sort === "delegates") {
            valueA = summaryA?.delegate_name ? 1 : 0
            valueB = summaryB?.delegate_name ? 1 : 0
          } else if (sort === "eba_coverage") {
            const ebaA = summaryA?.eba_active_employer_count || 0
            const engagedA = summaryA?.engaged_employer_count || 0
            const ebaB = summaryB?.eba_active_employer_count || 0
            const engagedB = summaryB?.engaged_employer_count || 0
            valueA = engagedA > 0 ? (ebaA / engagedA) * 100 : 0
            valueB = engagedB > 0 ? (ebaB / engagedB) * 100 : 0
          }
          
          return ascending ? valueA - valueB : valueB - valueA
        })
      }
      
      return filtered
    }
  }, [USE_SERVER_SIDE, allProjects, summaries, workersFilter, specialFilter, projectsWithBuilder, sort, dir])
  
  // Apply pagination (conditional based on implementation)
  const totalProjects = USE_SERVER_SIDE ? serverSideResult.totalCount : filteredAndSortedProjects.length
  const projects = USE_SERVER_SIDE ? filteredAndSortedProjects : filteredAndSortedProjects.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const hasNext = USE_SERVER_SIDE ? serverSideResult.hasNext : ((page - 1) * PAGE_SIZE + PAGE_SIZE) < totalProjects
  const hasPrev = USE_SERVER_SIDE ? serverSideResult.hasPrev : page > 1

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {/* Development indicator for which implementation is active */}
        {process.env.NODE_ENV === 'development' && (
          <div className="text-xs px-2 py-1 rounded border">
            {USE_SERVER_SIDE ? (
              <span className="text-green-600">🚀 Projects Server-side {serverSideResult.debug?.queryTime ? `(${serverSideResult.debug.queryTime}ms)` : ''}</span>
            ) : (
              <span className="text-blue-600">💻 Projects Client-side</span>
            )}
          </div>
        )}
      </div>
      {/* Improved Header with Search and Quick Actions */}
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-white shadow-sm border-b space-y-3">
        {/* Top Row: Search, Actions, and View Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex-1 max-w-md">
            <Input 
              id="project-search-desktop"
              placeholder="Search projects…" 
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9"
              autoComplete="off"
            />
          </div>
          
          {/* Filter Toggle */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {activeFilters.length}
                  </Badge>
                )}
                {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          
          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger className="w-40 h-9">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name</SelectItem>
                <SelectItem value="value">Project Value</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
                <SelectItem value="employers">Employer Count</SelectItem>
                <SelectItem value="workers">Worker Count</SelectItem>
                <SelectItem value="members">Member Count</SelectItem>
                <SelectItem value="delegates">Has Delegate</SelectItem>
                <SelectItem value="eba_coverage">EBA Coverage</SelectItem>
              </SelectContent>
            </Select>
            <ToggleGroup type="single" variant="outline" size="sm" value={dir} onValueChange={(v) => v && setParam("dir", v)}>
              <ToggleGroupItem value="asc" aria-label="Ascending"><ArrowUp className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="desc" aria-label="Descending"><ArrowDown className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <CreateProjectDialog />
          </div>

          {/* View Toggle */}
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setParam("view", v)}>
            <ToggleGroupItem value="card" aria-label="Card view" className="gap-1"><LayoutGrid className="h-4 w-4" /> Card</ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="gap-1"><ListIcon className="h-4 w-4" /> List</ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view" className="gap-1"><MapPin className="h-4 w-4" /> Map</ToggleGroupItem>
          </ToggleGroup>
        </div>
        
        {/* Active Filters Pills */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {activeFilters.map((filter) => (
              <Badge 
                key={filter.key} 
                variant="secondary" 
                className="gap-1 pr-1"
              >
                {filter.label}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => setParam(filter.key, 'all')}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-xs h-6">
              Clear all
            </Button>
          </div>
        )}
        
        {/* Collapsible Filters Panel */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <CollapsibleContent className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <div className="text-xs text-muted-foreground mb-1">Tier</div>
                <Select value={tierFilter} onValueChange={(value) => setParam("tier", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All Tiers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tiers</SelectItem>
                    {Object.entries(PROJECT_TIER_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Universe</div>
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
                <div className="text-xs text-muted-foreground mb-1">Stage</div>
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
                <div className="text-xs text-muted-foreground mb-1">EBA Site</div>
                <Select value={ebaFilter} onValueChange={(value) => setParam("eba", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="eba_active">Builder EBA Active</SelectItem>
                    <SelectItem value="eba_inactive">Builder Known, EBA Inactive</SelectItem>
                    <SelectItem value="builder_unknown">Builder Unknown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Workers</div>
                <Select value={workersFilter} onValueChange={(value) => setParam("workers", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    <SelectItem value="nonzero">Has Workers</SelectItem>
                    <SelectItem value="zero">No Workers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <div className="text-xs text-muted-foreground mb-1">Advanced</div>
                <Select value={specialFilter} onValueChange={(value) => setParam("special", value)}>
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="noBuilderWithEmployers">No Builder, Has Employers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
      {isInitialLoad && (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><LoadingSpinner size={16} /> Loading projects…</div>
      )}
      {!isInitialLoad && isFetching && (
        <div className="text-sm text-muted-foreground flex items-center gap-2"><LoadingSpinner size={16} alt="Refreshing" /> Updating projects…</div>
      )}
      {(projects as any[]).length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground">No projects found.</p>
      ) : view === 'list' ? (
        <div className="rounded-md border overflow-x-auto">
          <ProjectTable
            rows={projects as any[]}
            summaries={summaries}
            subsetStats={subsetStats}
            onRowClick={(id) => {
              startNavigation(`/projects/${id}`)
              setTimeout(() => router.push(`/projects/${id}`), 50)
            }}
            onOpenEmployer={(id) => {
              setSelectedEmployerId(id)
              setIsEmployerOpen(true)
            }}
          />
        </div>
      ) : view === 'map' ? (
        <ProjectsMapView
          projects={filteredAndSortedProjects as any[]}
          summaries={summaries}
          onProjectClick={(id) => {
            startNavigation(`/projects/${id}`)
            setTimeout(() => router.push(`/projects/${id}`), 50)
          }}
          searchQuery={q}
          patchIds={patchIds}
          tierFilter={tierFilter}
          workersFilter={workersFilter}
          currentFilters={{
            q,
            patch: patchParam,
            tier: tierFilter,
            universe: universeFilter,
            stage: stageFilter,
            workers: workersFilter,
            special: specialFilter,
            eba: ebaFilter
          }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as any[]).map((p: any) => (
            <ProjectListCard
              key={p.id}
              p={p}
              summary={summaries[p.id]}
              subsetStats={subsetStats[p.id] as any}
              onOpenEmployer={(id) => { setSelectedEmployerId(id); setIsEmployerOpen(true) }}
            />
          ))}
        </div>
      )}

      {view !== 'map' && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {((page - 1) * PAGE_SIZE) + 1}-{Math.min(page * PAGE_SIZE, totalProjects)} of {totalProjects} projects
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={!hasPrev} onClick={() => setParam('page', String(page - 1))}>
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page} of {Math.ceil(totalProjects / PAGE_SIZE)}</span>
            <Button variant="outline" size="sm" disabled={!hasNext} onClick={() => setParam('page', String(page + 1))}>
              Next
            </Button>
          </div>
        </div>
      )}
      
      {view === 'map' && (
        <div className="text-sm text-muted-foreground">
          Showing all {filteredAndSortedProjects.length} project location{filteredAndSortedProjects.length !== 1 ? 's' : ''} matching current filters
        </div>
      )}

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isEmployerOpen}
        onClose={() => setIsEmployerOpen(false)}
        initialTab="overview"
      />
      <WorkerDetailModal
        workerId={selectedWorkerId}
        isOpen={isWorkerOpen}
        onClose={() => setIsWorkerOpen(false)}
      />
    </div>
  )
}

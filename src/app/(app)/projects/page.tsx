"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
// Progress replaced by custom gradient bar
import { Badge } from "@/components/ui/badge"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon, MapPin, Filter, X, ChevronDown, ChevronUp, Bell } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import CreateProjectDialog from "@/components/projects/CreateProjectDialog"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { useProjectsServerSideCompatible } from "@/hooks/useProjectsServerSide"
import { useIsMobile } from "@/hooks/use-mobile"
import { ProjectsMobileView } from "@/components/projects/ProjectsMobileView"
import { ProjectsDesktopView } from "@/components/projects/ProjectsDesktopView"
import { ProjectTable } from "@/components/projects/ProjectTable"
import DuplicateEmployerManager from "@/components/admin/DuplicateEmployerManager"
import ProjectsMapView from "@/components/projects/ProjectsMapView"
import NewProjectsBanner from "./NewProjectsBanner"
import { useMultipleProjectSubsetStats } from "@/hooks/useProjectSubsetStats"
import { SubsetEbaStats } from "@/components/projects/SubsetEbaStats"
import { CfmeuEbaBadge, getProjectEbaStatus } from "@/components/ui/CfmeuEbaBadge"
import { getOrganisingUniverseBadgeVariant } from "@/utils/organisingUniverse";

type ProjectWithRoles = {
  id: string
  name: string
  main_job_site_id: string | null
  value: number | null
  tier: string | null
  created_at?: string
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

function useProjectStats(projectId: string) {
  // Sites for this project
  const { data: sites = [] } = useQuery({
    queryKey: ["project-sites", projectId],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name")
        .eq("project_id", projectId)
      if (error) throw error
      return data || []
    }
  })

  const siteIds = useMemo(() => (sites as any[]).map((s: any) => String(s.id)), [sites])

  // Worker totals and members across these sites, plus assigned counts by employer
  const { data: totals } = useQuery({
    queryKey: ["project-worker-totals", projectId, siteIds],
    enabled: siteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: placementRows } = await (supabase as any)
        .from("worker_placements")
        .select("worker_id, employer_id, workers!inner(id, union_membership_status)")
        .in("job_site_id", siteIds)

      const workerMap: Record<string, { isMember: boolean }> = {}
      const byEmployerToWorkers = new Map<string, Set<string>>()
      ;(placementRows || []).forEach((row: any) => {
        const wid = row.worker_id as string
        const isMember = row.workers?.union_membership_status === "member"
        if (!workerMap[wid]) workerMap[wid] = { isMember }
        else if (isMember) workerMap[wid].isMember = true

        const eid = row.employer_id as string | null
        if (eid) {
          if (!byEmployerToWorkers.has(eid)) byEmployerToWorkers.set(eid, new Set<string>())
          byEmployerToWorkers.get(eid)!.add(wid)
        }
      })

      const workerIds = Object.keys(workerMap)
      const assignedByEmployer: Record<string, number> = {}
      Array.from(byEmployerToWorkers.entries()).forEach(([eid, set]) => {
        assignedByEmployer[eid] = set.size
      })
      return {
        totalWorkers: workerIds.length,
        totalMembers: Object.values(workerMap).filter((w) => w.isMember).length,
        assignedByEmployer,
      }
    }
  })

  // Engaged contractors (by site trades + head contractor) and project-level estimated workforce
  const { data: contractorAndEst } = useQuery({
    queryKey: ["project-contractors-estimate", projectId, siteIds],
    enabled: true,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Contractors via site_contractor_trades (skip query if there are no sites)
      let sct: any[] = []
      if (siteIds.length > 0) {
        const { data } = await (supabase as any)
          .from("site_contractor_trades")
          .select("employer_id, job_site_id")
          .in("job_site_id", siteIds)
        sct = (data as any[]) || []
      }

      const employerIdSet = new Set<string>(
        ((sct || []).map((r: any) => r.employer_id).filter(Boolean)) as string[]
      )

      // Include head contractor in engaged employer ids
      try {
        const { data: assignments } = await (supabase as any)
          .from("project_assignments")
          .select("assignment_type, employer_id, contractor_role_types(name)")
          .eq("project_id", projectId)
          .eq("assignment_type", "contractor_role") // Get contractor role assignments
        ;(assignments || []).forEach((a: any) => {
          if (a?.employer_id) employerIdSet.add(String(a.employer_id))
        })
      } catch {}

      const employerIds = Array.from(employerIdSet)

      // Estimated workforce via project_contractor_trades
      const { data: pct } = await (supabase as any)
        .from("project_contractor_trades")
        .select("employer_id, estimated_project_workforce")
        .eq("project_id", projectId)

      // Sum estimates by employer to avoid double-counting across multiple trade rows
      const estByEmployer: Record<string, number> = {}
      ;(pct || []).forEach((r: any) => {
        const eid = r.employer_id as string
        const v = Number(r.estimated_project_workforce) || 0
        if (!estByEmployer[eid]) estByEmployer[eid] = 0
        estByEmployer[eid] += v
      })

      const estimatedTotal = Object.values(estByEmployer).reduce((a, b) => a + b, 0)

      return { employerIds, estimatedTotal, estByEmployer }
    }
  })

  // EBA employers among engaged contractors (count any employer with an EBA record)
  const { data: ebaActive } = useQuery({
    queryKey: ["project-eba-active", projectId, contractorAndEst?.employerIds || []],
    enabled: (contractorAndEst?.employerIds?.length || 0) > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = contractorAndEst!.employerIds
      const { data } = await supabase
        .from("company_eba_records")
        .select("employer_id")
        .in("employer_id", ids)
      const withEba = new Set<string>((data || []).map((r: any) => r.employer_id as string))
      return { activeCount: withEba.size, total: ids.length }
    }
  })

  // Delegate: prefer site_delegate, else any of shift/company delegate/hsr
  const { data: delegate } = useQuery({
    queryKey: ["project-delegate", projectId, siteIds],
    enabled: siteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const wanted = ["site_delegate", "shift_delegate", "company_delegate", "hsr"]
      const { data } = await supabase
        .from("union_roles")
        .select("worker_id, name, end_date, workers(id, first_name, surname)")
        .in("job_site_id", siteIds)
        .in("name", wanted)
      const active = (data || []).filter((r: any) => !r.end_date || new Date(r.end_date) > new Date())
      const byPriority = (role: string) => {
        const order: Record<string, number> = { site_delegate: 0, shift_delegate: 1, company_delegate: 2, hsr: 3 }
        return order[role] ?? 99
      }
      active.sort((a: any, b: any) => byPriority(a.name) - byPriority(b.name))
      const d = active[0]
      if (!d) return null
      const workers: any = (d as any).workers
      const w = Array.isArray(workers) ? workers[0] : workers
      const firstName = w?.first_name || ''
      const surname = w?.surname || ''
      return { workerId: d.worker_id as string, name: `${firstName} ${surname}`.trim() }
    }
  })

  return {
    sites,
    totals,
    contractorAndEst,
    ebaActive,
    delegate,
  }
}

function GradientBar({ percent, baseRgb }: { percent: number; baseRgb: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  const stops: string[] = []
  for (let i = 0; i < 10; i++) {
    const start = i * 10
    const end = start + 10
    const alpha = (i + 1) / 10 // 0.1 .. 1.0
    stops.push(`rgba(${baseRgb},${alpha}) ${start}%`, `rgba(${baseRgb},${alpha}) ${end}%`)
  }
  const gradient = `linear-gradient(to right, ${stops.join(', ')})`
  return (
    <div className="w-full h-1 rounded bg-muted/30 overflow-hidden">
      <div className="h-full" style={{ width: `${pct}%`, background: gradient }} />
    </div>
  )
}

function CompactStatBar({ label, value, of, onClick, color = '222,27,18' }: { 
  label: string; 
  value: number; 
  of: number; 
  onClick?: () => void; 
  color?: string;
}) {
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

function EbaPercentBar({ active, total, onClick }: { active: number; total: number; onClick?: () => void }) {
  const safeTotal = Math.max(0, total)
  const safeActive = Math.max(0, Math.min(active, safeTotal))
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>EBA</span>
        <span>{safeTotal}</span>
      </div>
      <div className="w-full h-1 rounded bg-muted/30 overflow-hidden flex gap-px">
        {Array.from({ length: safeTotal }).map((_, i) => (
          <div
            key={i}
            className={`h-full flex-1 ${i < safeActive ? 'bg-green-500' : 'bg-transparent'}`}
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
                onClick={() => {
                  startNavigation(`/projects/${p.id}`)
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
          <Button className="w-full" size="sm" onClick={() => { 
            startNavigation(`/projects/${p.id}`)
            setTimeout(() => router.push(`/projects/${p.id}`), 50)
          }}>Open project</Button>
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

export default function ProjectsPage() {
  const isMobile = useIsMobile()

  return isMobile ? <ProjectsMobileView /> : <ProjectsDesktopView />
}

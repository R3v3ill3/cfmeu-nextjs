"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSearchParams, usePathname, useRouter } from "next/navigation"
// Progress replaced by custom gradient bar
import { Badge } from "@/components/ui/badge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import AddressLookupDialog from "@/components/AddressLookupDialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { ArrowUp, ArrowDown, LayoutGrid, List as ListIcon, MapPin } from "lucide-react"
import CreateProjectDialog from "@/components/projects/CreateProjectDialog"
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { PROJECT_TIER_LABELS, ProjectTier } from "@/components/projects/types"
import { ProjectTable } from "@/components/projects/ProjectTable"
import DuplicateEmployerManager from "@/components/admin/DuplicateEmployerManager"
import ProjectsMapView from "@/components/projects/ProjectsMapView"

type ProjectWithRoles = {
  id: string
  name: string
  main_job_site_id: string | null
  value: number | null
  tier: string | null
  project_assignments?: Array<{
    assignment_type: string
    employer_id: string
    employers?: { name: string | null } | null
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

function CompactStatBar({ label, value, of, onClick }: { label: string; value: number; of: number; onClick?: () => void }) {
  const pct = of > 0 ? (value / of) * 100 : 0
  // Member red from worker color coding (rgb values)
  const memberRedRgb = '222,27,18'
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="sr-only">{Math.round(pct)}%</span>
      </div>
      <GradientBar percent={pct} baseRgb={memberRedRgb} />
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

function ProjectListCard({ p, summary, onOpenEmployer }: { p: ProjectWithRoles; summary?: ProjectSummary; onOpenEmployer: (id: string) => void }) {
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

  const primary = builderNames[0] || head
  const secondary = head && primary && head.id !== primary.id ? head : null

  const members = summary?.total_members || 0
  const estimated = summary?.estimated_total || 0
  const ebaActive = summary?.eba_active_employer_count || 0
  const engaged = summary?.engaged_employer_count || 0
  const delegateName = summary?.delegate_name || null
  const patchName = summary?.first_patch_name || '—'
  const totalWorkers = summary?.total_workers || 0

  return (
    <Card className="transition-colors hover:bg-accent/40 h-full flex flex-col">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium truncate">
          <div className="flex items-center justify-between gap-2">
            <Link href={`/projects/${p.id}`} className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1">
              {p.name}
            </Link>
            <div className="flex items-center gap-2">
              {('stage_class' in p && (p as any).stage_class) && (
                <Badge variant="secondary" className="text-[10px] capitalize">{String((p as any).stage_class).replace('_',' ')}</Badge>
              )}
              {('organising_universe' in p && (p as any).organising_universe) && (
                <Badge variant="outline" className="text-[10px] capitalize">{String((p as any).organising_universe)}</Badge>
              )}
            </div>
            <button
              type="button"
              className="text-xs text-primary hover:underline whitespace-nowrap"
              onClick={() => {
                try {
                  const ua = navigator.userAgent.toLowerCase()
                  const isMobile = /iphone|ipad|ipod|android/.test(ua)
                  const href = isMobile ? `/projects/${p.id}/mappingsheets-mobile` : `/projects/${p.id}?tab=mappingsheets`
                  window.location.href = href
                } catch {
                  window.location.href = `/projects/${p.id}?tab=mappingsheets`
                }
              }}
            >
              Mapping Sheets
            </button>
          </div>
        </CardTitle>
        <div className="mt-1 flex items-center gap-2 text-sm">
          {primary && (
            <button type="button" className="text-primary hover:underline truncate rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1" onClick={() => onOpenEmployer(primary.id)} title={primary.name}>
              {primary.name}
            </button>
          )}
          {secondary && (
            <>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-primary hover:underline truncate rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1" onClick={() => onOpenEmployer(secondary.id)} title={secondary.name}>
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
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2 flex-1 flex flex-col">
        <div className="space-y-2">
          <CompactStatBar
            label="Members vs Est. Workers"
            value={members}
            of={estimated}
            onClick={() => { window.location.href = `/projects/${p.id}?tab=contractors` }}
          />
          <EbaPercentBar
            active={ebaActive}
            total={engaged}
            onClick={() => { window.location.href = `/projects/${p.id}?tab=contractors` }}
          />
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
          <Button className="w-full" size="sm" onClick={() => { window.location.href = `/projects/${p.id}` }}>Open project</Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProjectsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const [lookupOpen, setLookupOpen] = useState(false)
  const q = (sp.get("q") || "").toLowerCase()
  const patchParam = sp.get("patch") || ""
  const patchIds = patchParam.split(",").map(s => s.trim()).filter(Boolean)
  const tierFilter = (sp.get("tier") || "all") as ProjectTier | 'all'
  const sort = sp.get("sort") || "name"
  const dir = sp.get("dir") || "asc"
  const view = sp.get("view") || "card"
  const workersFilter = sp.get("workers") || "all" // all, zero, nonzero
  const universeFilter = sp.get("universe") || sp.get("universeFilter") || "all"
  const stageFilter = sp.get("stage") || sp.get("stageFilter") || "all"
  const page = Math.max(1, parseInt(sp.get('page') || '1', 10) || 1)
  const PAGE_SIZE = 24

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isEmployerOpen, setIsEmployerOpen] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [isWorkerOpen, setIsWorkerOpen] = useState(false)

  const setParam = (key: string, value?: string) => {
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
  }

  // If a patch is selected, compute project ids that have at least one site linked to these patches
  const { data: patchProjectIds = [], isFetching: fetchingPatchProjects } = useQuery<string[]>({
    queryKey: ["project-ids-for-patch", patchIds],
    enabled: patchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("patch_job_sites")
        .select("job_sites:job_site_id(project_id), patch_id")
        .is("effective_to", null)
        .in("patch_id", patchIds)
      const projIds = new Set<string>()
      ;((data as any[]) || []).forEach((row: any) => {
        const js = Array.isArray(row.job_sites) ? row.job_sites[0] : row.job_sites
        const pid = js?.project_id as string | undefined
        if (pid) projIds.add(pid)
      })
      return Array.from(projIds)
    }
  })

  const { data: projectsData, isLoading } = useQuery<{ projects: ProjectWithRoles[]; summaries: Record<string, ProjectSummary> }>({
    queryKey: ["projects-list+summary", patchIds, patchProjectIds, tierFilter, universeFilter, stageFilter, q],
    staleTime: 30000,
    refetchOnWindowFocus: false,
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
            employers(name)
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

  const allProjects = projectsData?.projects || []
  const summaries = projectsData?.summaries || {}
  
  // Apply client-side filtering and sorting
  const filteredAndSortedProjects = useMemo(() => {
    let filtered = allProjects.slice()
    
    // Apply workers filter
    if (workersFilter !== "all") {
      filtered = filtered.filter((p: any) => {
        const summary = summaries[p.id]
        const workerCount = summary?.total_workers || 0
        return workersFilter === "zero" ? workerCount === 0 : workerCount > 0
      })
    }
    
    // Employers filter removed
    
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
  }, [allProjects, summaries, workersFilter, sort, dir])
  
  // Apply pagination
  const totalProjects = filteredAndSortedProjects.length
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE
  const projects = filteredAndSortedProjects.slice(from, to)
  const hasNext = to < totalProjects
  const hasPrev = page > 1

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Projects</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-2"><img src="/spinner.gif" alt="Loading" className="h-4 w-4" /> Loading projects…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="sticky top-0 z-30 -mx-6 px-6 py-3 bg-background/40 backdrop-blur supports-[backdrop-filter]:bg-background/30 border-b">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[240px] flex-1">
            <div className="text-xs text-muted-foreground mb-1">Search</div>
            <Input placeholder="Search projects…" value={sp.get("q") || ""} onChange={(e) => setParam("q", e.target.value)} />
          </div>
          <div className="w-48">
            <div className="text-xs text-muted-foreground mb-1">Tier</div>
            <Select value={tierFilter} onValueChange={(value) => setParam("tier", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tier" />
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
          <div className="w-44">
            <div className="text-xs text-muted-foreground mb-1">Universe</div>
            <Select value={universeFilter} onValueChange={(value) => setParam("universe", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by universe" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="potential">Potential</SelectItem>
                <SelectItem value="excluded">Excluded</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-56">
            <div className="text-xs text-muted-foreground mb-1">Stage</div>
            <Select value={stageFilter} onValueChange={(value) => setParam("stage", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by stage" />
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
          <div className="w-40">
            <div className="text-xs text-muted-foreground mb-1">Workers</div>
            <Select value={workersFilter} onValueChange={(value) => setParam("workers", value)}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by workers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                <SelectItem value="nonzero">Has Workers</SelectItem>
                <SelectItem value="zero">No Workers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <div className="text-xs text-muted-foreground mb-1">Sort by</div>
            <Select value={sort} onValueChange={(v) => setParam("sort", v)}>
              <SelectTrigger>
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
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Order</span>
            <ToggleGroup type="single" variant="outline" size="sm" value={dir} onValueChange={(v) => v && setParam("dir", v)}>
              <ToggleGroupItem value="asc" aria-label="Ascending"><ArrowUp className="h-4 w-4" /></ToggleGroupItem>
              <ToggleGroupItem value="desc" aria-label="Descending"><ArrowDown className="h-4 w-4" /></ToggleGroupItem>
            </ToggleGroup>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setLookupOpen(true)}>Address Lookup</Button>
            <CreateProjectDialog />
          </div>
          <ToggleGroup type="single" variant="outline" size="sm" value={view} onValueChange={(v) => v && setParam("view", v)}>
            <ToggleGroupItem value="card" aria-label="Card view" className="gap-1"><LayoutGrid className="h-4 w-4" /> Card</ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" className="gap-1"><ListIcon className="h-4 w-4" /> List</ToggleGroupItem>
            <ToggleGroupItem value="map" aria-label="Map view" className="gap-1"><MapPin className="h-4 w-4" /> Map</ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {(projects as any[]).length === 0 && !isLoading ? (
        <p className="text-sm text-muted-foreground">No projects found.</p>
      ) : view === 'list' ? (
        <div className="rounded-md border overflow-x-auto">
          <ProjectTable
            rows={projects as any[]}
            summaries={summaries}
            onRowClick={(id) => {
              window.location.href = `/projects/${id}`
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
            window.location.href = `/projects/${id}`
          }}
          searchQuery={q}
          patchIds={patchIds}
          tierFilter={tierFilter}
          workersFilter={workersFilter}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as any[]).map((p: any) => (
            <ProjectListCard
              key={p.id}
              p={p}
              summary={summaries[p.id]}
              onOpenEmployer={(id) => { setSelectedEmployerId(id); setIsEmployerOpen(true) }}
            />
          ))}
        </div>
      )}

      {view !== 'map' && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {from + 1}-{Math.min(to, totalProjects)} of {totalProjects} projects
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
          Showing all {totalProjects} projects matching current filters
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

      <AddressLookupDialog open={lookupOpen} onOpenChange={setLookupOpen} />
    </div>
  )
}


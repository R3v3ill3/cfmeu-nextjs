"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import JobSitesManager from "@/components/projects/JobSitesManager"
import EditProjectDialog from "@/components/projects/EditProjectDialog"
import DeleteProjectDialog from "@/components/projects/DeleteProjectDialog"
import ContractorsSummary from "@/components/projects/ContractorsSummary"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import StageTradeAssignmentManager from "@/components/projects/StageTradeAssignmentManager"
import SiteContactsEditor from "@/components/projects/SiteContactsEditor"
import { UnifiedContractorAssignmentModal } from "@/components/projects/UnifiedContractorAssignmentModal"
import { EmployerWorkerChart } from "@/components/patchwall/EmployerWorkerChart"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { useUnifiedContractors } from "@/hooks/useUnifiedContractors"

function SiteContactsSummary({ projectId, siteIds }: { projectId: string; siteIds: string[] }) {
  const [delegates, setDelegates] = useState<string[]>([])
  const [hsrs, setHsrs] = useState<string[]>([])

  useEffect(() => {
    const load = async () => {
      if (!projectId || siteIds.length === 0) { setDelegates([]); setHsrs([]); return }
      const { data } = await (supabase as any)
        .from("union_roles")
        .select("worker_id, name, end_date, workers(id, first_name, surname)")
        .in("job_site_id", siteIds)
        .in("name", ["site_delegate", "hsr"])  // company_delegate/shift_delegate intentionally excluded
      const active = (data || []).filter((r: any) => !r.end_date || new Date(r.end_date) > new Date())
      const fullNames: Record<string, string> = {}
      ;(active || []).forEach((r: any) => {
        const w = Array.isArray(r.workers) ? r.workers[0] : r.workers
        const fn = `${w?.first_name || ''} ${w?.surname || ''}`.trim()
        fullNames[r.worker_id] = fn || r.worker_id
      })
      const ds = Array.from(new Set<string>((active || [])
        .filter((r: any) => r.name === 'site_delegate')
        .map((r: any) => fullNames[r.worker_id] as string | undefined)
        .filter((n: string | undefined): n is string => Boolean(n))))
      const hs = Array.from(new Set<string>((active || [])
        .filter((r: any) => r.name === 'hsr')
        .map((r: any) => fullNames[r.worker_id] as string | undefined)
        .filter((n: string | undefined): n is string => Boolean(n))))
      setDelegates(ds)
      setHsrs(hs)
    }
    load()
  }, [projectId, siteIds])

  return (
    <div className="space-y-1">
      <div className="font-medium">Site Delegate{delegates.length === 1 ? '' : 's'}</div>
      <div className="text-muted-foreground truncate">{delegates.slice(0, 3).join(', ') || '—'}</div>
      <div className="font-medium mt-2">Site HSR{hsrs.length === 1 ? '' : 's'}</div>
      <div className="text-muted-foreground truncate">{hsrs.slice(0, 3).join(', ') || '—'}</div>
    </div>
  )
}

import { getEbaCategory } from "@/components/employers/ebaHelpers"
import { format } from "date-fns"

export default function ProjectDetailPage() {
  const params = useParams()
  const sp = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const projectId = params?.projectId as string
  const [tab, setTab] = useState(sp.get("tab") || "mappingsheets")
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [showEbaForEmployerId, setShowEbaForEmployerId] = useState<string | null>(null)
  const [chartEmployer, setChartEmployer] = useState<{ id: string; name: string } | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [estPrompt, setEstPrompt] = useState<{ employerId: string; employerName: string } | null>(null)
  const [estValue, setEstValue] = useState<string>("")
  const [estSaving, setEstSaving] = useState(false)
  const [showContractorAssignment, setShowContractorAssignment] = useState(false)

  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, main_job_site_id, value, tier, organising_universe, stage_class, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, builder_id")
        .eq("id", projectId)
        .maybeSingle()
      if (error) throw error
      return data
    }
  })

  const { data: sites = [] } = useQuery({
    queryKey: ["project-sites", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id,name")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  const siteOptions = useMemo(() => (sites as any[]).map(s => ({ id: s.id as string, name: s.name as string })), [sites])
  const sortedSiteIds = useMemo(
    () => Array.from(new Set(((sites as any[]) || []).map((s: any) => String(s.id)).filter(Boolean))).sort(),
    [sites]
  )

  // Patch and organiser info for this project (via linked job sites)
  const { data: projectPatches = [] } = useQuery({
    queryKey: ["project-patches", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("patch_job_sites")
        .select("patch_id, patches:patch_id(id,name)")
        .in("job_site_id", sortedSiteIds)
      const list = ((data as any[]) || [])
      const byId = new Map<string, { id: string; name: string }>()
      list.forEach((r: any) => {
        const patch = Array.isArray(r.patches) ? r.patches[0] : r.patches
        if (patch?.id) byId.set(patch.id, { id: patch.id, name: patch.name })
      })
      return Array.from(byId.values())
    }
  })

  const patchIds = useMemo(() => (projectPatches as any[]).map((pp: any) => pp.id), [projectPatches])

  const { mergedList: patchOrganisers = [] } = usePatchOrganiserLabels(patchIds)

  const { data: contractorSummary = [] } = useQuery({
    queryKey: ["project-contractor-employers", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const siteIds = sortedSiteIds
      if (siteIds.length === 0) return []
      const { data, error } = await (supabase as any)
        .from("site_contractor_trades")
        .select("employer_id, job_site_id")
        .in("job_site_id", siteIds)
      if (error) return []
      const unique = Array.from(new Set((data || []).map((r: any) => r.employer_id).filter(Boolean)))
      return unique
    }
  })

  // Builder and main site address for mapping sheet
  const { data: mappingSheetData } = useQuery({
    queryKey: ["project-mapping-details", project?.id, project?.main_job_site_id, project?.builder_id],
    enabled: !!project?.id,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      let builderName: string | null = null
      let builderHasEba: boolean | null = null
      let address: string | null = null

      if (project?.main_job_site_id) {
        const { data: site } = await supabase.from("job_sites").select("full_address, location").eq("id", project.main_job_site_id).maybeSingle()
        address = site?.full_address || site?.location || null
      }

      // First, check project_employer_roles for builder role (preferred)
      const { data: builderRoles } = await supabase
        .from("project_employer_roles")
        .select("employer_id, employers(name, enterprise_agreement_status)")
        .eq("project_id", project!.id)
        .eq("role", "builder")
        .limit(1)
      
      if (builderRoles && builderRoles.length > 0) {
        const builderRole = builderRoles[0] as any
        const employer = builderRole.employers
        builderName = employer?.name || builderRole.employer_id
        const status = employer?.enterprise_agreement_status as string | null
        builderHasEba = status ? status !== "no_eba" : null
      } else if (project?.builder_id) {
        // Fallback to legacy projects.builder_id field
        const { data: b } = await supabase
          .from("employers")
          .select("name, enterprise_agreement_status")
          .eq("id", project.builder_id)
          .maybeSingle()
        builderName = (b as any)?.name as string || project.builder_id
        const status = (b as any)?.enterprise_agreement_status as string | null
        builderHasEba = status ? status !== "no_eba" : null
      }

      return { builderName, builderHasEba, address }
    }
  })

  const { data: workerTotals } = useQuery({
    queryKey: ["project-worker-totals", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const siteIds = sortedSiteIds
      // Fetch placements joined with workers to derive distinct workers and members on this project
      const { data: placementRows } = await (supabase as any)
        .from("worker_placements")
        .select("worker_id, workers!inner(id, union_membership_status)")
        .in("job_site_id", siteIds)

      const workerMap: Record<string, { isMember: boolean }> = {}
      ;(placementRows || []).forEach((row: any) => {
        const wid = row.worker_id as string
        const isMember = row.workers?.union_membership_status === "member"
        if (!workerMap[wid]) workerMap[wid] = { isMember }
        else if (isMember) workerMap[wid].isMember = true
      })

      const workerIds = Object.keys(workerMap)

      // Leaders: active roles among these workers and on these sites
      let leaders = new Set<string>()
      if (workerIds.length > 0) {
        const { data: roles } = await supabase
          .from("union_roles")
          .select("worker_id, job_site_id, name, end_date")
          .in("job_site_id", siteIds)
          .in("worker_id", workerIds)
        const leaderRoleSet = new Set(["site_delegate", "shift_delegate", "company_delegate", "hsr"])
        ;(roles || []).forEach((r: any) => {
          const active = !r.end_date || new Date(r.end_date) > new Date()
          if (active && leaderRoleSet.has(r.name)) {
            leaders.add(r.worker_id as string)
          }
        })
      }

      return {
        totalWorkers: workerIds.length,
        totalMembers: Object.values(workerMap).filter((w) => w.isMember).length,
        totalLeaders: leaders.size,
      }
    }
  })

  // Per-site membership totals for overview bars
  const { data: siteMembershipTotals = {} } = useQuery({
    queryKey: ["project-site-membership-totals", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const siteIds = sortedSiteIds
      if (siteIds.length === 0) return {}
      const { data: placementRows } = await (supabase as any)
        .from("worker_placements")
        .select("worker_id, job_site_id, workers!inner(id, union_membership_status)")
        .in("job_site_id", siteIds)

      const bySiteToWorkers = new Map<string, Set<string>>()
      const bySiteToMembers = new Map<string, Set<string>>()
      ;(placementRows || []).forEach((row: any) => {
        const siteId = String(row.job_site_id)
        const wid = String(row.worker_id)
        if (!bySiteToWorkers.has(siteId)) bySiteToWorkers.set(siteId, new Set<string>())
        bySiteToWorkers.get(siteId)!.add(wid)
        const isMember = row.workers?.union_membership_status === "member"
        if (isMember) {
          if (!bySiteToMembers.has(siteId)) bySiteToMembers.set(siteId, new Set<string>())
          bySiteToMembers.get(siteId)!.add(wid)
        }
      })
      const result: Record<string, { members: number; total: number }> = {}
      Array.from(bySiteToWorkers.keys()).forEach((sid) => {
        const total = bySiteToWorkers.get(sid)!.size
        const members = (bySiteToMembers.get(sid)?.size) || 0
        result[sid] = { members, total }
      })
      return result
    }
  })

  const stableEmployerIds = useMemo(
    () => Array.from(new Set(((contractorSummary as string[]) || []).filter(Boolean))).sort(),
    [contractorSummary]
  )
  // ebaStats will be computed after contractorRows is available lower in the file

  const { data: lastVisit } = useQuery({
    queryKey: ["project-last-visit", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("site_visit")
        .select("date")
        .eq("project_id", projectId)
        .order("date", { ascending: false })
        .limit(1)
      return (data && data[0]?.date) ? format(new Date(data[0].date), "dd/MM/yyyy") : "—"
    }
  })

  const { data: contractorNames = [] } = useQuery({
    queryKey: ["project-contractor-names", stableEmployerIds],
    enabled: stableEmployerIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = stableEmployerIds
      const { data } = await supabase
        .from("employers")
        .select("id, name")
        .in("id", ids)
      return (data || []).map((e: any) => e.name as string).sort((a: string, b: string) => a.localeCompare(b))
    }
  })

  // Use unified contractor data from all sources
  const { data: unifiedContractors = [] } = useUnifiedContractors(projectId, sortedSiteIds)
  
  // Transform to match existing interface for backward compatibility
  const contractorRows = useMemo(() => {
    return unifiedContractors.map(contractor => ({
      id: contractor.id,
      employerId: contractor.employerId,
      employerName: contractor.employerName,
      siteName: contractor.siteName,
      siteId: contractor.siteId,
      tradeLabel: contractor.tradeLabel,
    }))
  }, [unifiedContractors])

  // Compute EBA stats including all employers represented in contractorRows (includes head contractor)
  const stableAllEmployerIds = useMemo(
    () => Array.from(new Set(((contractorRows as any[]) || []).map((r: any) => r.employerId).filter(Boolean))).sort(),
    [contractorRows]
  )
  const { data: ebaStats } = useQuery({
    queryKey: ["project-eba-stats", projectId, stableAllEmployerIds],
    enabled: !!projectId && stableAllEmployerIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const employerIds = stableAllEmployerIds
      if (!employerIds || employerIds.length === 0) return { ebaCount: 0, employerCount: 0 }
      const { data } = await supabase
        .from("company_eba_records")
        .select("employer_id")
        .in("employer_id", employerIds)
      const ebaEmployers = new Set((data || []).map((r: any) => r.employer_id))
      return { ebaCount: ebaEmployers.size, employerCount: employerIds.length }
    }
  })

  // Fetch EBA employer ids for fast lookup and make EBA badge actionable
  const stableContractorEmployerIds = useMemo(
    () => Array.from(new Set(((contractorRows as any[]) || []).map((r: any) => r.employerId).filter(Boolean))).sort(),
    [contractorRows]
  )
  const { data: ebaEmployerIds = [] } = useQuery({
    queryKey: ["project-eba-employers", stableContractorEmployerIds],
    enabled: stableContractorEmployerIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = stableContractorEmployerIds
      if (ids.length === 0) return []
      const { data } = await supabase.from("company_eba_records").select("employer_id, fwc_document_url").in("employer_id", ids)
      return (data || []).map((r: any) => r.employer_id as string)
    }
  })
  const ebaEmployers = useMemo(() => new Set<string>(ebaEmployerIds as string[]), [ebaEmployerIds])

  // EBA category map for color coding in contractors table
  const { data: ebaCategoryByEmployer = {} } = useQuery({
    queryKey: ["project-eba-categories", stableContractorEmployerIds],
    enabled: stableContractorEmployerIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = stableContractorEmployerIds
      if (ids.length === 0) return {}
      const { data } = await supabase
        .from("company_eba_records")
        .select("employer_id, fwc_certified_date, eba_lodged_fwc, date_eba_signed, date_vote_occurred, date_vote_occured")
        .in("employer_id", ids)
      const byId = new Map<string, any>()
      ;(data || []).forEach((r: any) => {
        // Keep first record; for advanced handling we could pick the best category
        if (!byId.has(r.employer_id)) byId.set(r.employer_id, r)
      })
      const result: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {}
      ids.forEach((id) => {
        const rec = byId.get(id)
        if (rec) {
          const cat = getEbaCategory(rec)
          result[id] = { label: cat.label, variant: cat.variant }
        } else {
          result[id] = { label: 'No EBA', variant: 'destructive' }
        }
      })
      return result
    }
  })

  // Overlay employer enterprise_agreement_status where available (e.g., 'active') onto EBA categories
  const { data: employerStatuses = [] } = useQuery({
    queryKey: ["project-employer-statuses", stableContractorEmployerIds],
    enabled: stableContractorEmployerIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = stableContractorEmployerIds
      const { data } = await supabase
        .from("employers")
        .select("id, enterprise_agreement_status")
        .in("id", ids)
      return (data as any[]) || []
    }
  })

  const statusByEmployer = useMemo(() => {
    const map: Record<string, string> = {}
    ;(employerStatuses as any[]).forEach((r: any) => {
      if (r?.id) map[String(r.id)] = String(r.enterprise_agreement_status || '')
    })
    return map
  }, [employerStatuses])

  const finalEbaCategoryByEmployer = useMemo(() => {
    const base = (ebaCategoryByEmployer as Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>) || {}
    const merged: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = { ...base }
    ;(stableContractorEmployerIds as string[]).forEach((id) => {
      const status = statusByEmployer[id]
      if (status && String(status).toLowerCase() === 'active') {
        merged[id] = { label: 'Active', variant: 'default' }
      }
    })
    return merged
  }, [ebaCategoryByEmployer, statusByEmployer, stableContractorEmployerIds])

  // Membership by employer-site for contractors table membership bars
  const { data: membershipByEmployerSite = {} } = useQuery({
    queryKey: ["project-membership-by-employer-site", projectId, sortedSiteIds],
    enabled: !!projectId && sortedSiteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const siteIds = sortedSiteIds
      if (siteIds.length === 0) return {}
      const { data: placementRows } = await (supabase as any)
        .from("worker_placements")
        .select("worker_id, employer_id, job_site_id, workers!inner(id, union_membership_status)")
        .in("job_site_id", siteIds)

      const byKeyToWorkers = new Map<string, Set<string>>()
      const byKeyToMembers = new Map<string, Set<string>>()
      ;(placementRows || []).forEach((row: any) => {
        const key = `${String(row.job_site_id)}:${String(row.employer_id)}`
        const wid = String(row.worker_id)
        if (!byKeyToWorkers.has(key)) byKeyToWorkers.set(key, new Set<string>())
        byKeyToWorkers.get(key)!.add(wid)
        const isMember = row.workers?.union_membership_status === "member"
        if (isMember) {
          if (!byKeyToMembers.has(key)) byKeyToMembers.set(key, new Set<string>())
          byKeyToMembers.get(key)!.add(wid)
        }
      })
      const result: Record<string, { members: number; total: number }> = {}
      Array.from(byKeyToWorkers.keys()).forEach((k) => {
        const total = byKeyToWorkers.get(k)!.size
        const members = (byKeyToMembers.get(k)?.size) || 0
        result[k] = { members, total }
      })
      return result
    }
  })

  // Helper components for overview bars (slightly larger)
  function GradientBar({ percent, baseRgb, heightClass = "h-2" }: { percent: number; baseRgb: string; heightClass?: string }) {
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
      <div className={`w-full ${heightClass} rounded bg-muted/30 overflow-hidden`}>
        <div className="h-full" style={{ width: `${pct}%`, background: gradient }} />
      </div>
    )
  }
  function EbaBlocks({ active, total, heightClass = "h-2" }: { active: number; total: number; heightClass?: string }) {
    const safeTotal = Math.max(0, total)
    const safeActive = Math.max(0, Math.min(active, safeTotal))
    return (
      <div className={`w-full ${heightClass} rounded bg-muted/30 overflow-hidden flex gap-px`}>
        {Array.from({ length: safeTotal }).map((_, i) => (
          <div key={i} className={`h-full flex-1 ${i < safeActive ? 'bg-green-500' : 'bg-transparent'}`} />
        ))}
      </div>
    )
  }
  const memberRedRgb = '222,27,18'

  // Derive per-site EBA counts from contractorRows and ebaEmployers
  const ebaBySite = useMemo(() => {
    const map = new Map<string, { active: number; total: number }>()
    const bySiteToEmployers = new Map<string, Set<string>>()
    ;((contractorRows as any[]) || []).forEach((r: any) => {
      if (!r.siteId) return
      const sid = String(r.siteId)
      if (!bySiteToEmployers.has(sid)) bySiteToEmployers.set(sid, new Set<string>())
      bySiteToEmployers.get(sid)!.add(String(r.employerId))
    })
    Array.from(bySiteToEmployers.entries()).forEach(([sid, set]) => {
      const total = set.size
      let active = 0
      set.forEach((eid) => { if (ebaEmployers.has(eid)) active += 1 })
      map.set(sid, { active, total })
    })
    return map
  }, [contractorRows, ebaEmployers])

  return (
    <div className="p-6 space-y-6">
      {/* Project Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">{project?.name}</h1>
          <div className="flex items-center gap-3">
                            <ProjectTierBadge tier={project?.tier || null} size="lg" />
            {project?.stage_class && (
              <Badge variant="secondary" className="capitalize">{String(project.stage_class).replace('_',' ')}</Badge>
            )}
            {project?.organising_universe && (
              <Badge variant="outline" className="capitalize">{String(project.organising_universe)}</Badge>
            )}
            {project?.value && (
              <span className="text-lg text-muted-foreground">
                ${(project.value / 1000000).toFixed(1)}M
              </span>
            )}
          </div>
        </div>
        {project && (
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { try { router.push('/projects') } catch {} }}>Close</Button>
            <EditProjectDialog project={project} />
            <DeleteProjectDialog projectId={project.id} projectName={project.name} />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {/* Sites tab trigger hidden; accessible via Overview 'Sites' link */}
          <TabsTrigger value="mappingsheets">Mapping Sheets</TabsTrigger>
          <TabsTrigger value="wallcharts">Wallcharts</TabsTrigger>
        </TabsList>

        <TabsContent value="mappingsheets">
          <div className="space-y-4">
            {project && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Project Mapping</h2>
                  <Button onClick={() => setShowContractorAssignment(true)}>
                    Add Contractor
                  </Button>
                </div>
                <div className="grid gap-6">
                  {(() => {
                    const Comp = require("@/components/projects/mapping/MappingSheetPage1").MappingSheetPage1;
                    const projectData = {
                      ...(project as any),
                      address: mappingSheetData?.address,
                      builderName: mappingSheetData?.builderName,
                      builderHasEba: mappingSheetData?.builderHasEba,
                      organisers: (patchOrganisers as any[]).join(', '),
                      workerTotals,
                      ebaStats,
                      lastVisit,
                      patches: projectPatches,
                    }
                    const handleProjectUpdate = (patch: any) => {
                      // No need to update local state as react-query will refetch
                    }
                    const handleAddressUpdate = (address: string) => {
                      // No need to update local state as react-query will refetch
                    }
                    return <Comp projectData={projectData} onProjectUpdate={handleProjectUpdate} onAddressUpdate={handleAddressUpdate} />
                  })()}
                  {(() => {
                    const Subs = require("@/components/projects/mapping/MappingSubcontractorsTable").MappingSubcontractorsTable;
                    return <Subs projectId={project.id} />
                  })()}
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sites">
          {project && (
            <div className="space-y-4">
              <JobSitesManager projectId={project.id} projectName={project.name} />
              <SiteContactsEditor projectId={project.id} siteIds={sortedSiteIds} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="wallcharts">
          <Card>
            <CardHeader>
              <CardTitle>Employer Workers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="text-sm text-muted-foreground">Select an employer on this project to view their wallchart, filtered to this project.</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(Array.from(new Map((contractorRows as any[]).map((r: any) => [r.employerId, r.employerName])).entries()).map(([id, name]) => ({ id, name })) as any[]).map((e) => (
                    <div key={e.id} className="flex items-center justify-between border rounded px-3 py-2">
                      <div className="font-medium truncate mr-3">{e.name}</div>
                      <Button size="sm" onClick={() => { setChartEmployer({ id: e.id, name: e.name }); setChartOpen(true) }}>Open chart</Button>
                    </div>
                  ))}
                </div>
                {(contractorRows as any[]).length === 0 && (
                  <p className="text-sm text-muted-foreground">No employers found on this project yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={!!selectedEmployerId}
        onClose={() => setSelectedEmployerId(null)}
        initialTab="overview"
      />

      {/* Estimate prompt dialog */}
      <Dialog open={!!estPrompt} onOpenChange={(v: boolean) => { if (!v) setEstPrompt(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set estimated workforce</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm">Enter estimated workers for {estPrompt?.employerName}</div>
            <Input type="number" min={0} value={estValue} onChange={(e) => setEstValue(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEstPrompt(null)}>Cancel</Button>
              <Button disabled={!estValue} onClick={async () => {
                try {
                  const est = Number(estValue)
                  if (!Number.isFinite(est) || est < 0) return
                  // Upsert a single estimate row per employer on this project
                  const { data: existingPct } = await (supabase as any)
                    .from('project_contractor_trades')
                    .select('id')
                    .eq('project_id', projectId)
                    .eq('employer_id', estPrompt!.employerId)
                  if (!existingPct || existingPct.length === 0) {
                    await (supabase as any)
                      .from('project_contractor_trades')
                      .insert([{ project_id: projectId, employer_id: estPrompt!.employerId, trade_type: 'labour_hire', eba_signatory: 'not_specified', estimated_project_workforce: est }])
                  } else {
                    const firstId = (existingPct as any[])[0]?.id
                    if (firstId) {
                      await (supabase as any)
                        .from('project_contractor_trades')
                        .update({ estimated_project_workforce: est })
                        .eq('id', firstId)
                    }
                  }
                } finally {
                  setEstPrompt(null)
                }
              }}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Chart modal */}
      <EmployerWorkerChart
        isOpen={chartOpen}
        onClose={() => setChartOpen(false)}
        employerId={chartEmployer?.id || null}
        employerName={chartEmployer?.name}
        projectIds={[projectId]}
        siteIds={[]}
        contextSiteId={null}
        siteOptions={siteOptions}
      />

      {/* Contractor Assignment Modal */}
      <UnifiedContractorAssignmentModal
        isOpen={showContractorAssignment}
        onClose={() => setShowContractorAssignment(false)}
        projectId={projectId}
        onSuccess={() => {
          // Refresh contractor data
          // The modal will handle query invalidation
        }}
      />
    </div>
  )
}
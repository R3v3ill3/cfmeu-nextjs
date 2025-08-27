"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect } from "react"
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import JobSitesManager from "@/components/projects/JobSitesManager"
import EditProjectDialog from "@/components/projects/EditProjectDialog"
import DeleteProjectDialog from "@/components/projects/DeleteProjectDialog"
import ContractorsSummary from "@/components/projects/ContractorsSummary"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import ContractorSiteAssignmentModal from "@/components/projects/ContractorSiteAssignmentModal"
import StageTradeAssignmentManager from "@/components/projects/StageTradeAssignmentManager"
import SiteContactsEditor from "@/components/projects/SiteContactsEditor"
import { EmployerWorkerChart } from "@/components/patchwall/EmployerWorkerChart"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

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
  const [tab, setTab] = useState(sp.get("tab") || "overview")
  const [showAssign, setShowAssign] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [showEbaForEmployerId, setShowEbaForEmployerId] = useState<string | null>(null)
  const [chartEmployer, setChartEmployer] = useState<{ id: string; name: string } | null>(null)
  const [chartOpen, setChartOpen] = useState(false)
  const [estPrompt, setEstPrompt] = useState<{ employerId: string; employerName: string } | null>(null)
  const [estValue, setEstValue] = useState<string>("")
  const [estSaving, setEstSaving] = useState(false)

  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, main_job_site_id, value, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding")
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

  const { data: patchOrganisers = [] } = useQuery({
    queryKey: ["project-patch-organisers", projectId, patchIds],
    enabled: !!projectId && patchIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("organiser_id, effective_to, profiles:organiser_id(full_name)")
        .is("effective_to", null)
        .in("patch_id", patchIds)
      const names = new Map<string, string>()
      ;((data as any[]) || []).forEach((r: any) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles
        const n = prof?.full_name as string | undefined
        if (n && r.organiser_id) names.set(r.organiser_id, n)
      })
      return Array.from(names.values())
    }
  })

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

  // Build contractor rows client-side to include: builders, head contractor and site-trade contractors
  const { data: contractorRows = [] } = useQuery({
    queryKey: ["project-contractors-v2", projectId, sortedSiteIds],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!projectId) return []
      const rows: any[] = []

      // 1) Project roles: builders and head contractor
      const { data: roles } = await supabase
        .from("project_employer_roles")
        .select("role, employer_id, employers(name)")
        .eq("project_id", projectId)

      ;(roles || []).forEach((r: any, idx: number) => {
        if (!r.employer_id) return
        rows.push({
          id: `role:${r.role}:${r.employer_id}:${idx}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          siteName: r.role === 'builder' ? 'Builder' : r.role === 'head_contractor' ? 'Head contractor' : r.role,
          siteId: null,
          tradeLabel: r.role === 'builder' ? 'Builder' : r.role === 'head_contractor' ? 'Head Contractor' : r.role,
        })
      })

      // 2) Site contractors by trade
      const { data: sct } = await (supabase as any)
        .from("site_contractor_trades")
        .select("id, job_site_id, employer_id, trade_type, job_sites(name), employers(name)")
        .in("job_site_id", sortedSiteIds)

      const tradeMap = new Map<string, string>((await import("@/constants/trades")).TRADE_OPTIONS.map((t: any) => [t.value, t.label]))

      ;(sct || []).forEach((r: any) => {
        if (!r.employer_id) return
        const tradeLabel = tradeMap.get(String(r.trade_type)) || String(r.trade_type)
        rows.push({
          id: `sct:${r.id}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          siteName: r.job_sites?.name || null,
          siteId: r.job_site_id,
          tradeLabel,
        })
      })

      // De-duplicate identical employer+site+trade rows
      const seen = new Set<string>()
      const deduped = rows.filter((r) => {
        const key = `${r.employerId}:${r.siteId || ''}:${r.tradeLabel}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return deduped
    }
  })

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project?.name || "Project"}</h1>
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
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {/* Sites tab trigger hidden; accessible via Overview 'Sites' link */}
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="wallcharts">Wallcharts</TabsTrigger>
          <TabsTrigger value="mappingsheets">Mapping Sheets</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <SiteContactsSummary projectId={projectId} siteIds={sortedSiteIds} />
                <div className="space-y-1">
                  <button type="button" className="font-medium text-left text-primary hover:underline" onClick={() => setTab("sites")}>
                    Sites
                  </button>
                  <div className="text-muted-foreground">{(sites as any[]).length}</div>
                  <div className="text-muted-foreground truncate">
                    {(sites as any[]).map((s) => s.name).join(', ') || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Contractors</div>
                  <div className="text-muted-foreground">{(contractorSummary as any[]).length}</div>
                  <div className="text-muted-foreground truncate">
                    {(contractorNames as string[]).join(', ') || '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Total workers</div>
                  <div className="text-muted-foreground">{workerTotals?.totalWorkers ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Total members</div>
                  <div className="text-muted-foreground">{workerTotals?.totalMembers ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Total leaders</div>
                  <div className="text-muted-foreground">{workerTotals?.totalLeaders ?? 0}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">EBA coverage</div>
                  <div className="text-muted-foreground">{ebaStats ? `${ebaStats.ebaCount} eba: ${ebaStats.employerCount} employers` : "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Last site visit</div>
                  <div className="text-muted-foreground">{lastVisit || "—"}</div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Patch</div>
                  <div className="text-muted-foreground truncate">
                    {(projectPatches as any[]).length > 0 ? `${(projectPatches as any[])[0]?.name}${(projectPatches as any[]).length > 1 ? ` +${(projectPatches as any[]).length - 1}` : ''}` : '—'}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="font-medium">Organiser{(patchOrganisers as any[]).length === 1 ? '' : 's'}</div>
                  <div className="text-muted-foreground truncate">
                    {(patchOrganisers as any[]).slice(0, 4).join(', ') || '—'}
                  </div>
                </div>
              </div>

              {/* Per-site bars */}
              {(sites as any[]).length > 0 && (
                <div className="mt-4 space-y-3">
                  {(sites as any[]).map((s: any) => {
                    const sid = String(s.id)
                    const mem = (siteMembershipTotals as Record<string, { members: number; total: number }>)[sid] || { members: 0, total: 0 }
                    const pct = mem.total > 0 ? (mem.members / mem.total) * 100 : 0
                    const eba = ebaBySite.get(sid) || { active: 0, total: 0 }
                    return (
                      <div key={sid} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">{s.name} — Members</div>
                          <GradientBar percent={pct} baseRgb={memberRedRgb} heightClass="h-2.5" />
                          <div className="mt-1 text-[11px] text-muted-foreground">{mem.members}/{mem.total}</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground mb-1">{s.name} — EBA</div>
                          <EbaBlocks active={eba.active} total={eba.total} heightClass="h-2.5" />
                          <div className="mt-1 text-[11px] text-muted-foreground">{eba.active}/{eba.total} employers</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappingsheets">
          {project && (
            <div className="space-y-4">
              <div className="no-print flex items-center justify-between">
                <div className="text-sm text-muted-foreground">Printable CFMEU mapping sheets</div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        setTab('overview')
                        const params = new URLSearchParams(sp.toString())
                        params.delete('tab')
                        const qs = params.toString()
                        router.replace(qs ? `${pathname}?${qs}` : pathname)
                      } catch {}
                    }}
                  >
                    Close Mapping Sheets
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      try {
                        const url = `/projects/${project.id}/print?print=1`
                        const newWin = window.open(url, "_blank")
                        if (!newWin) {
                          window.location.href = url
                        }
                      } catch {
                        try { window.location.href = `/projects/${project.id}/print?print=1` } catch {}
                      }
                    }}
                  >
                    Print
                  </Button>
                </div>
              </div>
              <div className="grid gap-6">
                {(() => {
                  const Comp = require("@/components/projects/mapping/MappingSheetPage1").MappingSheetPage1;
                  return <Comp projectId={project.id} />
                })()}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sites">
          {project && (
            <div className="space-y-4">
              <JobSitesManager projectId={project.id} projectName={project.name} />
              <SiteContactsEditor projectId={project.id} siteIds={sortedSiteIds} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="contractors">
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm text-muted-foreground">Assign contractors to sites and review EBA status.</div>
            <Button onClick={() => setShowAssign(true)}>Assign contractors to sites</Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Contractors</CardTitle>
            </CardHeader>
            <CardContent>
              <ContractorsSummary
                rows={contractorRows as any}
                ebaEmployers={ebaEmployers}
                projectId={projectId}
                groupBySite={true}
                membershipByEmployerSite={membershipByEmployerSite as any}
                ebaCategoryByEmployer={finalEbaCategoryByEmployer as any}
                onEmployerClick={async (id) => {
                  try {
                    const { data: pct } = await (supabase as any)
                      .from("project_contractor_trades")
                      .select("id, estimated_project_workforce")
                      .eq("project_id", projectId)
                      .eq("employer_id", id)
                      .limit(10)
                    const hasEstimate = (pct || []).some((r: any) => typeof r.estimated_project_workforce === 'number' && r.estimated_project_workforce > 0)
                    if (!hasEstimate) {
                      const { data: emp } = await supabase.from('employers').select('name').eq('id', id).maybeSingle()
                      setEstPrompt({ employerId: id, employerName: emp?.name || 'Employer' })
                      setEstValue("")
                    } else {
                      setSelectedEmployerId(id)
                    }
                  } catch {
                    setSelectedEmployerId(id)
                  }
                }}
                onEbaClick={async (id) => {
                  // Try open FWC URL in new tab; otherwise show Employer modal at EBA tab
                  const { data } = await supabase
                    .from("company_eba_records")
                    .select("fwc_document_url")
                    .eq("employer_id", id)
                    .maybeSingle()
                  const url = data?.fwc_document_url
                  if (url) {
                    try { window.open(url, '_blank') } catch {}
                  } else {
                    toast.error("No FWC URL on record for this employer.")
                  }
                }}
              />
            </CardContent>
          </Card>
          <div className="mt-4">
            <StageTradeAssignmentManager projectId={projectId} />
          </div>
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

      <ContractorSiteAssignmentModal
        projectId={projectId}
      />

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
    </div>
  )
}
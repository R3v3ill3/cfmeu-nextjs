"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"

type ProjectWithRoles = {
  id: string
  name: string
  main_job_site_id: string | null
  project_employer_roles?: Array<{
    role: string
    employer_id: string
    employers?: { name: string | null } | null
  }>
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

  // Worker totals and members across these sites
  const { data: totals } = useQuery({
    queryKey: ["project-worker-totals", projectId, siteIds],
    enabled: siteIds.length > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
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
      return {
        totalWorkers: workerIds.length,
        totalMembers: Object.values(workerMap).filter((w) => w.isMember).length,
      }
    }
  })

  // Engaged contractors (by site trades) and project-level estimated workforce
  const { data: contractorAndEst } = useQuery({
    queryKey: ["project-contractors-estimate", projectId, siteIds],
    enabled: true,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Contractors via site_contractor_trades
      const { data: sct } = await (supabase as any)
        .from("site_contractor_trades")
        .select("employer_id, job_site_id")
        .in("job_site_id", siteIds.length > 0 ? siteIds : ["-"])

      const employerIds = Array.from(new Set(((sct || []).map((r: any) => r.employer_id).filter(Boolean)))) as string[]

      // Estimated workforce via project_contractor_trades
      const { data: pct } = await (supabase as any)
        .from("project_contractor_trades")
        .select("employer_id, estimated_project_workforce")
        .eq("project_id", projectId)

      const estimatedTotal = (pct || []).reduce((sum: number, r: any) => sum + (Number(r.estimated_project_workforce) || 0), 0)
      const estByEmployer: Record<string, number> = {}
      ;(pct || []).forEach((r: any) => {
        const eid = r.employer_id as string
        const v = Number(r.estimated_project_workforce) || 0
        if (!estByEmployer[eid]) estByEmployer[eid] = 0
        estByEmployer[eid] += v
      })

      return { employerIds, estimatedTotal, estByEmployer }
    }
  })

  // EBA active employers among engaged contractors
  const { data: ebaActive } = useQuery({
    queryKey: ["project-eba-active", projectId, contractorAndEst?.employerIds || []],
    enabled: (contractorAndEst?.employerIds?.length || 0) > 0,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const ids = contractorAndEst!.employerIds
      const { data } = await supabase
        .from("company_eba_records")
        .select("employer_id, fwc_certified_date, eba_lodged_fwc, date_vote_occurred, date_eba_signed")
        .in("employer_id", ids)
      // Reduce to set with active EBA (certified within recent window)
      const active = new Set<string>()
      const today = new Date()
      const withinYears = (d: string | null | undefined, years: number) => {
        if (!d) return false
        const dt = new Date(d)
        if (isNaN(dt.getTime())) return false
        const cutoff = new Date(today)
        cutoff.setFullYear(cutoff.getFullYear() - years)
        return dt >= cutoff
      }
      ;(data || []).forEach((r: any) => {
        if (withinYears(r.fwc_certified_date, 4)) active.add(r.employer_id as string)
      })
      return { activeCount: active.size, total: ids.length }
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
      return { workerId: d.worker_id as string, name: `${d.workers?.first_name || ''} ${d.workers?.surname || ''}`.trim() }
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

function CompactStatBar({ label, value, of, onClick }: { label: string; value: number; of: number; onClick?: () => void }) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span>{value}/{of} ({pct}%)</span>
      </div>
      <Progress value={of > 0 ? (value / of) * 100 : 0} className="h-1.5" />
    </button>
  )
}

function EbaPercentBar({ active, total, onClick }: { active: number; total: number; onClick?: () => void }) {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0
  return (
    <button type="button" onClick={onClick} className="w-full text-left">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>EBA</span>
        <span>{active}/{total} ({pct}%)</span>
      </div>
      <Progress value={total > 0 ? (active / total) * 100 : 0} className="h-1.5" />
    </button>
  )
}

function ProjectListCard({ p, onOpenEmployer, onOpenWorker }: { p: ProjectWithRoles; onOpenEmployer: (id: string) => void; onOpenWorker: (id: string) => void }) {
  const { totals, contractorAndEst, ebaActive, delegate } = useProjectStats(p.id)

  const builderNames = useMemo(() => {
    const builders = (p.project_employer_roles || []).filter((r) => r.role === 'builder')
    return builders.map((r) => ({ id: r.employer_id, name: r.employers?.name || r.employer_id }))
  }, [p.project_employer_roles])

  const head = useMemo(() => {
    const hc = (p.project_employer_roles || []).find((r) => r.role === 'head_contractor')
    return hc ? { id: hc.employer_id, name: hc.employers?.name || hc.employer_id } : null
  }, [p.project_employer_roles])

  // Prefer first builder as "project manager" analogue; show head contractor too if different
  const primary = builderNames[0] || head
  const secondary = head && primary && head.id !== primary.id ? head : null

  const handleOpenWalls = () => {
    const siteId = p.main_job_site_id
    const href = siteId ? `/patch/walls?projectId=${p.id}&siteId=${siteId}` : `/patch/walls?projectId=${p.id}`
    window.location.href = href
  }

  return (
    <Card className="transition-colors hover:bg-accent/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium truncate">
          <Link href={`/projects/${p.id}`} className="hover:underline">
            {p.name}
          </Link>
        </CardTitle>
        <div className="mt-1 flex items-center gap-2 text-sm">
          {primary && (
            <button type="button" className="text-primary hover:underline truncate" onClick={() => onOpenEmployer(primary.id)} title={primary.name}>
              {primary.name}
            </button>
          )}
          {secondary && (
            <>
              <span className="text-muted-foreground">·</span>
              <button type="button" className="text-primary hover:underline truncate" onClick={() => onOpenEmployer(secondary.id)} title={secondary.name}>
                {secondary.name}
              </button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        <div className="space-y-2">
          <CompactStatBar
            label="Members vs Est. Workers"
            value={totals?.totalMembers || 0}
            of={contractorAndEst?.estimatedTotal || 0}
            onClick={handleOpenWalls}
          />
          <EbaPercentBar
            active={ebaActive?.activeCount || 0}
            total={ebaActive?.total || (contractorAndEst?.employerIds.length || 0)}
            onClick={() => { window.location.href = `/projects/${p.id}?tab=contractors` }}
          />
        </div>
        <div className="pt-1 text-xs text-muted-foreground flex items-center justify-between">
          {delegate?.name ? (
            <button type="button" className="text-primary hover:underline truncate" onClick={() => onOpenWorker(delegate.workerId)} title={delegate.name}>
              {delegate.name}
            </button>
          ) : (
            <span className="truncate">No delegate recorded</span>
          )}
          {(totals?.totalWorkers || 0) > 0 && (
            <Badge variant="secondary" className="text-[10px]">{totals?.totalWorkers} workers</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProjectsPage() {
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isEmployerOpen, setIsEmployerOpen] = useState(false)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [isWorkerOpen, setIsWorkerOpen] = useState(false)

  const { data: projects = [], isLoading } = useQuery<ProjectWithRoles[]>({
    queryKey: ["projects-list"],
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(`
          id,
          name,
          main_job_site_id,
          project_employer_roles!left(
            role,
            employer_id,
            employers(name)
          )
        `)
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data as any) || []
    }
  })

  if (isLoading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Projects</h1>
        <p className="text-sm text-muted-foreground">Loading projects…</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Projects</h1>
      {(projects as any[]).length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(projects as any[])
            .filter((p: any) => (q ? String(p.name || "").toLowerCase().includes(q) : true))
            .map((p: any) => (
              <ProjectListCard
                key={p.id}
                p={p}
                onOpenEmployer={(id) => { setSelectedEmployerId(id); setIsEmployerOpen(true) }}
                onOpenWorker={(id) => { setSelectedWorkerId(id); setIsWorkerOpen(true) }}
              />
            ))}
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


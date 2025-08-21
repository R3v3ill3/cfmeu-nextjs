"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { WorkerDetailModal } from "@/components/workers/WorkerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

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

  // Engaged contractors (by site trades) and project-level estimated workforce
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

function CompactStatBar({ label, value, of, onClick }: { label: string; value: number; of: number; onClick?: () => void }) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0
  return (
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
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
    <button type="button" onClick={onClick} className="w-full text-left rounded border border-dashed border-muted-foreground/30 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-2 py-1 transition">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>EBA</span>
        <span>{active}/{total} ({pct}%)</span>
      </div>
      <Progress value={total > 0 ? (active / total) * 100 : 0} className="h-1.5" />
    </button>
  )
}

function ProjectListCard({ p, onOpenEmployer, onOpenWorker }: { p: ProjectWithRoles; onOpenEmployer: (id: string) => void; onOpenWorker: (id: string) => void }) {
  const { sites, totals, contractorAndEst, ebaActive, delegate } = useProjectStats(p.id)
  const queryClient = useQueryClient()
  const siteIds = useMemo(() => (sites as any[]).map((s: any) => String(s.id)), [sites])

  const [estOpen, setEstOpen] = useState(false)
  const [estRows, setEstRows] = useState<Array<{ employerId: string; employerName: string; assigned: number; estimated: number; value: string }>>([])
  const [saving, setSaving] = useState(false)

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

  const handleMembersClick = async () => {
    const assignedByEmployer = totals?.assignedByEmployer || {}
    const estByEmployer = contractorAndEst?.estByEmployer || {}
    const needing: Array<{ employerId: string; assigned: number; estimated: number }> = []
    Object.entries(assignedByEmployer).forEach(([eid, assigned]) => {
      const est = estByEmployer[eid] || 0
      if ((est === 0 || assigned > est) && assigned > 0) {
        needing.push({ employerId: eid, assigned, estimated: est })
      }
    })
    if (needing.length === 0) {
      const siteId = p.main_job_site_id
      const href = siteId ? `/patch/walls?projectId=${p.id}&siteId=${siteId}` : `/patch/walls?projectId=${p.id}`
      window.location.href = href
      return
    }

    // Load employer names for display
    try {
      const ids = needing.map(n => n.employerId)
      const { data } = await supabase.from('employers').select('id, name').in('id', ids)
      const nameMap = new Map<string, string>((data || []).map((r: any) => [r.id as string, r.name as string]))
      setEstRows(needing.map(n => ({
        employerId: n.employerId,
        employerName: nameMap.get(n.employerId) || n.employerId,
        assigned: n.assigned,
        estimated: n.estimated,
        value: String(n.assigned),
      })))
    } catch {
      setEstRows(needing.map(n => ({ employerId: n.employerId, employerName: n.employerId, assigned: n.assigned, estimated: n.estimated, value: String(n.assigned) })))
    }
    setEstOpen(true)
  }

  return (
    <div>
    <Card className="transition-colors hover:bg-accent/40">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="text-base font-medium truncate">
          <Link href={`/projects/${p.id}`} className="hover:underline inline-block rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1">
            {p.name}
          </Link>
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
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 pt-0 space-y-2">
        <div className="space-y-2">
          <CompactStatBar
            label="Members vs Est. Workers"
            value={totals?.totalMembers || 0}
            of={contractorAndEst?.estimatedTotal || 0}
            onClick={handleMembersClick}
          />
          <EbaPercentBar
            active={ebaActive?.activeCount || 0}
            total={ebaActive?.total || (contractorAndEst?.employerIds.length || 0)}
            onClick={() => { window.location.href = `/projects/${p.id}?tab=contractors` }}
          />
        </div>
        <div className="pt-1 text-xs text-muted-foreground flex items-center justify-between">
          {delegate?.name ? (
            <button type="button" className="text-primary hover:underline truncate rounded border border-dashed border-transparent hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 px-1" onClick={() => onOpenWorker(delegate.workerId)} title={delegate.name}>
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

    <Dialog open={estOpen} onOpenChange={(v: boolean) => setEstOpen(v)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Estimated workers on this project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Assigned workers exceed the current estimate or no estimate exists. Update the estimated workers for these employers. Values are prefilled with currently assigned workers.</p>
          <div className="space-y-2 max-h-80 overflow-auto pr-1">
            {estRows.map((row, idx) => (
              <div key={row.employerId} className="grid grid-cols-5 items-center gap-2 border rounded p-2">
                <div className="col-span-3 truncate" title={row.employerName}>{row.employerName}</div>
                <div className="text-xs text-muted-foreground text-right">Assigned: {row.assigned}</div>
                <Input
                  type="number"
                  min={0}
                  value={row.value}
                  onChange={(e) => {
                    const v = e.target.value
                    setEstRows(prev => prev.map((r, i) => i === idx ? { ...r, value: v } : r))
                  }}
                />
              </div>
            ))}
            {estRows.length === 0 && (
              <div className="text-sm text-muted-foreground">Nothing to update.</div>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEstOpen(false)}>Cancel</Button>
            <Button disabled={saving || estRows.length === 0} onClick={async () => {
              try {
                setSaving(true)
                // Save each employer's estimate
                for (const row of estRows) {
                  const est = Number(row.value)
                  if (!Number.isFinite(est) || est < 0) continue
                  const { data: existingPct, error: existingErr } = await (supabase as any)
                    .from('project_contractor_trades')
                    .select('id, trade_type')
                    .eq('project_id', p.id)
                    .eq('employer_id', row.employerId)
                  if (existingErr) continue
                  if (!existingPct || existingPct.length === 0) {
                    let trades: string[] = []
                    if (siteIds.length > 0) {
                      const { data: sct } = await (supabase as any)
                        .from('site_contractor_trades')
                        .select('trade_type')
                        .in('job_site_id', siteIds)
                        .eq('employer_id', row.employerId)
                      trades = Array.from(new Set(((sct || []) as any[]).map((r: any) => String(r.trade_type))))
                    }
                    const rowsToInsert = (trades.length > 0 ? trades : ['labour_hire']).map((t: string) => ({
                      project_id: p.id,
                      employer_id: row.employerId,
                      trade_type: t,
                      eba_signatory: 'not_specified',
                      estimated_project_workforce: est,
                    }))
                    await (supabase as any)
                      .from('project_contractor_trades')
                      .insert(rowsToInsert)
                  } else {
                    await (supabase as any)
                      .from('project_contractor_trades')
                      .update({ estimated_project_workforce: est })
                      .eq('project_id', p.id)
                      .eq('employer_id', row.employerId)
                  }
                }
                // Refresh stats for this project card
                queryClient.invalidateQueries({ queryKey: ["project-contractors-estimate", p.id, siteIds] })
                queryClient.invalidateQueries({ queryKey: ["project-worker-totals", p.id, siteIds] })
              } finally {
                setSaving(false)
                setEstOpen(false)
              }
            }}>{saving ? 'Saving…' : 'Confirm and Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </div>
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


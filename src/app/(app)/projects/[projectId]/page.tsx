"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState, useEffect } from "react"
import { useParams, useSearchParams } from "next/navigation"
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
import { EmployerWorkerChart } from "@/components/patchwall/EmployerWorkerChart"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export default function ProjectDetailPage() {
  const params = useParams()
  const sp = useSearchParams()
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
        .select("id, name, main_job_site_id, value, proposed_start_date, proposed_finish_date, roe_email")
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
        .select("visit_date")
        .eq("project_id", projectId)
        .order("visit_date", { ascending: false })
        .limit(1)
      return (data && data[0]?.visit_date) ? new Date(data[0].visit_date).toLocaleDateString() : "—"
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{project?.name || "Project"}</h1>
        {project && (
          <div className="flex items-center gap-2">
            <EditProjectDialog project={project} />
            <DeleteProjectDialog projectId={project.id} projectName={project.name} />
          </div>
        )}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sites">Sites</TabsTrigger>
          <TabsTrigger value="contractors">Contractors</TabsTrigger>
          <TabsTrigger value="wallcharts">Wallcharts</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <CardTitle>Project Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="space-y-1">
                  <div className="font-medium">Sites</div>
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
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites">
          {project && (
            <JobSitesManager projectId={project.id} projectName={project.name} />
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
                showSiteColumn={true}
                ebaEmployers={ebaEmployers}
                projectId={projectId}
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

          {project && (
            <Dialog open={showAssign} onOpenChange={(v: boolean) => setShowAssign(v)}>
              <DialogContent className="max-w-[95vw] w-[1100px]">
                <DialogHeader>
                  <DialogTitle>Assign contractors to sites</DialogTitle>
                </DialogHeader>
                <ContractorSiteAssignmentModal projectId={project.id} />
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>

        <TabsContent value="wallcharts">
          <Card>
            <CardHeader>
              <CardTitle>Wallcharts</CardTitle>
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
        employerId={selectedEmployerId || showEbaForEmployerId}
        isOpen={!!selectedEmployerId || !!showEbaForEmployerId}
        onClose={() => { setSelectedEmployerId(null); setShowEbaForEmployerId(null) }}
        initialTab={showEbaForEmployerId ? "eba" : "overview"}
      />

      {chartEmployer && (
        <EmployerWorkerChart
          isOpen={chartOpen}
          onClose={() => setChartOpen(false)}
          employerId={chartEmployer.id}
          employerName={chartEmployer.name}
          projectIds={[projectId]}
          siteIds={[]}
          contextSiteId={null}
          siteOptions={siteOptions}
        />
      )}

      <Dialog open={!!estPrompt} onOpenChange={(v: boolean) => { if (!v) setEstPrompt(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estimated workers on this project</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Enter an estimated number of workers for {estPrompt?.employerName} on this project.</p>
            <Input type="number" min={0} value={estValue} onChange={(e) => setEstValue(e.target.value)} placeholder="e.g. 25" />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { if (estPrompt) { setSelectedEmployerId(estPrompt.employerId) } setEstPrompt(null) }}>Skip</Button>
              <Button disabled={!estValue || estSaving} onClick={async () => {
                if (!estPrompt) return
                try {
                  setEstSaving(true)
                  const est = Number(estValue)
                  if (!Number.isFinite(est) || est < 0) throw new Error('Invalid number')
                  // Ensure there is at least one project_contractor_trades row for this employer on this project.
                  const { data: existingPct, error: existingErr } = await (supabase as any)
                    .from('project_contractor_trades')
                    .select('id, trade_type')
                    .eq('project_id', projectId)
                    .eq('employer_id', estPrompt.employerId)

                  if (existingErr) throw existingErr

                  if (!existingPct || existingPct.length === 0) {
                    // Insert a single employer-level estimate row
                    await (supabase as any)
                      .from('project_contractor_trades')
                      .insert([{ project_id: projectId, employer_id: estPrompt.employerId, trade_type: 'labour_hire', eba_signatory: 'not_specified', estimated_project_workforce: est }])
                  } else {
                    // Zero existing rows to avoid double counting, then set one row to the estimate
                    await (supabase as any)
                      .from('project_contractor_trades')
                      .update({ estimated_project_workforce: 0 })
                      .eq('project_id', projectId)
                      .eq('employer_id', estPrompt.employerId)
                    const firstId = (existingPct as any[])[0]?.id
                    if (firstId) {
                      await (supabase as any)
                        .from('project_contractor_trades')
                        .update({ estimated_project_workforce: est })
                        .eq('id', firstId)
                    }
                  }
                  setSelectedEmployerId(estPrompt.employerId)
                } catch (e) {
                  console.error(e)
                  setSelectedEmployerId(estPrompt.employerId)
                } finally {
                  setEstSaving(false)
                  setEstPrompt(null)
                }
              }}>{estSaving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
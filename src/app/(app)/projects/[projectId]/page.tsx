"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import JobSitesManager from "@/components/projects/JobSitesManager"
import EditProjectDialog from "@/components/projects/EditProjectDialog"
import DeleteProjectDialog from "@/components/projects/DeleteProjectDialog"
import ContractorsSummary from "@/components/projects/ContractorsSummary"
import { Button } from "@/components/ui/button"
import ContractorSiteAssignmentModal from "@/components/projects/ContractorSiteAssignmentModal"
import { EmployerWorkerChart } from "@/components/patchwall/EmployerWorkerChart"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"

export default function ProjectDetailPage() {
  const params = useParams()
  const projectId = params?.projectId as string
  const [tab, setTab] = useState("overview")
  const [showAssign, setShowAssign] = useState(false)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [showEbaForEmployerId, setShowEbaForEmployerId] = useState<string | null>(null)
  const [chartEmployer, setChartEmployer] = useState<{ id: string; name: string } | null>(null)
  const [chartOpen, setChartOpen] = useState(false)

  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    enabled: !!projectId,
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

  const { data: contractorSummary = [] } = useQuery({
    queryKey: ["project-contractor-employers", projectId, (sites as any[]).length],
    enabled: !!projectId && (sites as any[]).length > 0,
    queryFn: async () => {
      const siteIds = (sites as any[]).map((s) => s.id)
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
    queryKey: ["project-worker-totals", projectId],
    enabled: !!projectId && (sites as any[]).length > 0,
    queryFn: async () => {
      const siteIds = (sites as any[]).map((s) => s.id)
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

  const { data: ebaStats } = useQuery({
    queryKey: ["project-eba-stats", projectId, contractorSummary],
    enabled: !!projectId && Array.isArray(contractorSummary),
    queryFn: async () => {
      const employerIds = contractorSummary as string[]
      if (!employerIds || employerIds.length === 0) return { ebaCount: 0, employerCount: 0 }
      const { data } = await supabase
        .from("company_eba_records")
        .select("employer_id")
        .in("employer_id", employerIds)
      const ebaEmployers = new Set((data || []).map((r: any) => r.employer_id))
      return { ebaCount: ebaEmployers.size, employerCount: employerIds.length }
    }
  })

  const { data: lastVisit } = useQuery({
    queryKey: ["project-last-visit", projectId],
    enabled: !!projectId,
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
    queryKey: ["project-contractor-names", contractorSummary],
    enabled: Array.isArray(contractorSummary) && (contractorSummary as string[]).length > 0,
    queryFn: async () => {
      const ids = contractorSummary as string[]
      const { data } = await supabase
        .from("employers")
        .select("id, name")
        .in("id", ids)
      return (data || []).map((e: any) => e.name as string).sort((a: string, b: string) => a.localeCompare(b))
    }
  })

  const { data: contractorRows = [] } = useQuery({
    queryKey: ["project-contractors", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      // Expect view or tables to derive summary; fallback to simple join via RPC or manual queries if needed
      const { data, error } = await (supabase as any)
        .rpc('get_project_contractors_summary', { p_project_id: projectId })
      if (error) {
        // Fallback: empty list; UI still functions
        return []
      }
      return data as any[]
    }
  })

  const ebaEmployers = useMemo(() => new Set<string>(), [])

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
                onEmployerClick={(id) => setSelectedEmployerId(id)}
                onEbaClick={(id) => setShowEbaForEmployerId(id)}
                projectId={projectId}
              />
            </CardContent>
          </Card>

          {project && (
            <ContractorSiteAssignmentModal projectId={project.id} />
          )}
        </TabsContent>

        <TabsContent value="wallcharts">
          <Card>
            <CardHeader>
              <CardTitle>Wallcharts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(sites as any[]).map((s) => (
                  <div key={s.id} className="flex items-center justify-between">
                    <div className="font-medium">{s.name}</div>
                    <Button
                      size="sm"
                      onClick={() => {
                        // In project context, open the chart once an employer is picked in contractors view
                        // Here we open a blank chart requires employer selection elsewhere
                        setChartEmployer({ id: "", name: "" })
                        setChartOpen(true)
                      }}
                      disabled
                    >
                      Open chart
                    </Button>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">Open wallcharts via contractor rows or the Patch/Walls page for employer-specific views.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={!!selectedEmployerId}
        onClose={() => setSelectedEmployerId(null)}
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
    </div>
  )
}


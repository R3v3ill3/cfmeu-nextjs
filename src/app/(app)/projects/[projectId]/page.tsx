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
              <p className="text-sm text-muted-foreground">Manage sites, contractors, and view wallcharts using the tabs above.</p>
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


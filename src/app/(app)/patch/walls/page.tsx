"use client"
export const dynamic = 'force-dynamic'

import { useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { EmployerWorkerChart } from "@/components/patchwall/EmployerWorkerChart"

export default function WallsPage() {
  const params = useSearchParams()
  const projectId = params.get("projectId")
  const siteId = params.get("siteId")

  const [selectedEmployer, setSelectedEmployer] = useState<{ id: string; name: string } | null>(null)
  const [open, setOpen] = useState(false)

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

  const { data: employers = [] } = useQuery({
    queryKey: ["wall-employers", projectId, siteId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return []
      let q = supabase
        .from("v_project_workers")
        .select("employer_id, employers(name)")
        .eq("project_id", projectId)
      if (siteId) q = q.eq("job_site_id", siteId)
      const { data, error } = await q
      if (error) throw error
      const map = new Map<string, string>()
      ;(data || []).forEach((row: any) => {
        const id = row.employer_id as string
        const name = row.employers?.name || id
        if (id) map.set(id, name)
      })
      return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
    }
  })

  const siteOptions = useMemo(() => (sites as any[]).map(s => ({ id: s.id as string, name: s.name as string })), [sites])

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Walls</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Project</div>
              <div className="text-sm">{projectId || "Select a project from Projects page"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Site</div>
              <Select defaultValue={siteId || undefined}>
                <SelectTrigger>
                  <SelectValue placeholder="All sites" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {(sites as any[]).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Employer</div>
              <Select onValueChange={(val) => {
                const emp = (employers as any[]).find(e => e.id === val)
                setSelectedEmployer(emp || null)
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  {(employers as any[]).map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end">
            <Button disabled={!selectedEmployer} onClick={() => setOpen(true)}>Open wallchart</Button>
          </div>
        </CardContent>
      </Card>

      {selectedEmployer && (
        <EmployerWorkerChart
          isOpen={open}
          onClose={() => setOpen(false)}
          employerId={selectedEmployer.id}
          employerName={selectedEmployer.name}
          projectIds={projectId ? [projectId] : []}
          siteIds={siteId ? [siteId] : []}
          contextSiteId={siteId || null}
          siteOptions={siteOptions}
        />
      )}
    </div>
  )
}


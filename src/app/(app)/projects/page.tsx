"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import JobSitesManager from "@/components/projects/JobSitesManager"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import EditProjectDialog from "@/components/projects/EditProjectDialog"
import DeleteProjectDialog from "@/components/projects/DeleteProjectDialog"

export default function ProjectsPage() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, main_job_site_id")
        .order("created_at", { ascending: false })
      if (error) throw error
      return data || []
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
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">No projects found.</p>
      ) : (
        <div className="space-y-6">
          {projects.map((p: any) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.name}
                    </Link>
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Link href={`/projects/${p.id}`}>
                      <Button variant="secondary" size="sm">Open</Button>
                    </Link>
                    <EditProjectDialog project={p} triggerText="Edit" />
                    <DeleteProjectDialog projectId={p.id} projectName={p.name} />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <JobSitesManager projectId={p.id} projectName={p.name} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


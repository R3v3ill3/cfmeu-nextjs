"use client"
import { useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import ScopeUserDialog from "@/components/admin/ScopeUserDialog"
import { Badge } from "@/components/ui/badge"

type UserRow = { id: string; full_name: string | null; email: string | null; role: string | null; scoped_sites?: string[] | null; scoped_employers?: string[] | null }

export function OrganiserScopeManager() {
  const qc = useQueryClient()
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data: users = [] } = useQuery({
    queryKey: ["organiser-scope-users"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, full_name, email, role, scoped_sites, scoped_employers")
        .in("role", ["organiser", "lead_organiser"]) // scope managers only
        .order("full_name")
      if (error) throw error
      return (data || []) as UserRow[]
    }
  })

  const { data: employers = [] } = useQuery({
    queryKey: ["organiser-scope-employers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("employers")
        .select("id, name")
        .order("name")
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    }
  })

  const { data: jobSites = [] } = useQuery({
    queryKey: ["organiser-scope-sites"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_sites")
        .select("id, name, location, project_id")
        .order("name")
      if (error) throw error
      return (data || []) as { id: string; name: string; location?: string; project_id?: string }[]
    }
  })

  const { data: projects = [] } = useQuery({
    queryKey: ["organiser-scope-projects"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projects")
        .select("id, name")
        .order("name")
      if (error) throw error
      return (data || []) as { id: string; name: string }[]
    }
  })

  const projectSitesMap = useMemo(() => {
    const map: Record<string, { id: string; name: string }[]> = {}
    ;(jobSites as any[]).forEach((s: any) => {
      const pid = s.project_id || ""
      if (!pid) return
      if (!map[pid]) map[pid] = []
      map[pid].push({ id: s.id, name: s.name })
    })
    return map
  }, [jobSites])

  const updateScope = useMutation({
    mutationFn: async ({ userId, scopedSites, scopedEmployers }: { userId: string; scopedSites: string[]; scopedEmployers: string[] }) => {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ scoped_sites: scopedSites, scoped_employers: scopedEmployers })
        .eq("id", userId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["organiser-scope-users"] })
    }
  })

  const openDialog = (user: UserRow) => {
    setSelectedUser(user)
    setDialogOpen(true)
  }

  const displayName = (u: UserRow) => u.full_name || u.email || u.id

  const organisers = useMemo(() => (users as UserRow[]).filter(u => u.role === "organiser" || u.role === "lead_organiser"), [users])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organiser Scoping</CardTitle>
        <CardDescription>Assign organisers to projects, job sites, and employers by scoping their access. This drives what appears in their patch.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organiser</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Sites</TableHead>
                <TableHead>Employers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {organisers.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{displayName(u)}</TableCell>
                  <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                  <TableCell>{u.scoped_sites?.length || 0}</TableCell>
                  <TableCell>{u.scoped_employers?.length || 0}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="outline" onClick={() => openDialog(u)}>Edit scope</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {selectedUser && (
          <ScopeUserDialog
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            user={selectedUser as any}
            employers={employers}
            jobSites={jobSites as any}
            projects={projects as any}
            projectSitesMap={projectSitesMap}
            onSave={({ userId, scopedSites, scopedEmployers }) => updateScope.mutate({ userId, scopedSites, scopedEmployers })}
          />
        )}
      </CardContent>
    </Card>
  )
}

export default OrganiserScopeManager


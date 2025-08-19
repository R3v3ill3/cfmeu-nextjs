"use client"
export const dynamic = 'force-dynamic'

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import SiteVisitForm from "@/components/siteVisits/SiteVisitForm"

export default function SiteVisitsPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["site-visits"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("site_visit")
        .select("id, visit_date, notes, projects(name), job_sites(name), employers(name), profiles(full_name)")
        .order("visit_date", { ascending: false })
        .limit(200)
      if (error) throw error
      return data || []
    }
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Site Visits</h1>
        <Button onClick={() => { setEditing(null); setOpen(true) }}>New Visit</Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent Visits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Organiser</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Site</TableHead>
                  <TableHead>Employer</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows as any[]).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{new Date(r.visit_date).toLocaleDateString()}</TableCell>
                    <TableCell>{r.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{r.projects?.name || "—"}</TableCell>
                    <TableCell>{r.job_sites?.name || "—"}</TableCell>
                    <TableCell>{r.employers?.name || "—"}</TableCell>
                    <TableCell className="max-w-[380px] truncate">{r.notes || ""}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">{isFetching ? "Loading…" : "No site visits yet."}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SiteVisitForm open={open} onOpenChange={(v) => { setOpen(v); if (!v) refetch() }} initial={editing ?? {}} />
    </div>
  )
}


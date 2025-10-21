"use client"
export const dynamic = 'force-dynamic'

import { useState, useEffect } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { EnhancedSiteVisitForm } from "@/components/siteVisits/EnhancedSiteVisitForm"
import { useSearchParams } from "next/navigation"
import { format } from "date-fns"

export default function SiteVisitsPage() {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const status = (sp.get("status") || "")
  const projectId = sp.get("projectId")
  const openForm = sp.get("openForm")

  // Handle geofencing notification
  useEffect(() => {
    if (openForm === "true") {
      try {
        const pendingVisit = sessionStorage.getItem("pendingSiteVisit")
        if (pendingVisit) {
          const data = JSON.parse(pendingVisit)
          setEditing(data)
          setOpen(true)
          sessionStorage.removeItem("pendingSiteVisit")
        }
      } catch (error) {
        console.error("Error parsing pending site visit:", error)
      }
    }
  }, [openForm])

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["site-visits"],
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("site_visit")
          .select("id, date, notes, job_sites(name,full_address,location,projects(name)), employers(name), profiles(full_name)")
          .order("date", { ascending: false })
          .limit(200)
        if (error) {
          console.warn('site_visit query failed:', error);
          return [];
        }
        
        let list = (data || []) as any[]
      if (status === "stale") {
        const cutoff = Date.now() - 1000*60*60*24*7
        list = list.filter((r) => {
          const t = new Date(r.date).getTime()
          return isFinite(t) && t < cutoff
        })
      }
      if (q) {
        const s = q
        list = list.filter((r) => {
          const hay = [r.profiles?.full_name, r.job_sites?.projects?.name, r.job_sites?.name, r.employers?.name, r.notes]
            .map((v: any) => String(v || "").toLowerCase())
          return hay.some((h: string) => h.includes(s))
        })
      }
      return list
      } catch (err) {
        console.warn('Failed to query site visits:', err);
        return [];
      }
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
                    <TableCell className="whitespace-nowrap">{format(new Date(r.date), "dd/MM/yyyy")}</TableCell>
                    <TableCell>{r.profiles?.full_name || "—"}</TableCell>
                    <TableCell>{r.job_sites?.projects?.name || "—"}</TableCell>
                    <TableCell>
                      <div className="leading-tight">
                        <div>{r.job_sites?.name || "—"}</div>
                        {r.job_sites && (r.job_sites.full_address || r.job_sites.location) && (
                          <div className="text-xs text-muted-foreground truncate max-w-[260px]">{r.job_sites.full_address || r.job_sites.location}</div>
                        )}
                      </div>
                    </TableCell>
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

      <EnhancedSiteVisitForm open={open} onOpenChange={(v) => { setOpen(v); if (!v) refetch() }} initial={editing ?? (projectId ? { project_id: projectId } : {})} />
    </div>
  )
}


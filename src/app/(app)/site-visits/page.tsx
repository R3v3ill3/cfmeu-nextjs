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

  // Fetch user scope for patch-based filtering
  const { data: userScope } = useQuery({
    queryKey: ["site-visits-user-scope"],
    queryFn: async () => {
      try {
        const { data: auth } = await supabase.auth.getUser()
        const userId = auth?.user?.id || null
        if (!userId) return null

        const { data: prof } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", userId)
          .single()
        const role = prof?.role || null

        // Admins see everything
        if (role === "admin") {
          return { role, userId, patchIds: null as string[] | null }
        }

        // Get patch assignments for organisers and lead organisers
        const patchIdSet = new Set<string>()
        
        if (role === "lead_organiser") {
          // Get direct patch assignments
          const { data: direct } = await supabase
            .from("lead_organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("lead_organiser_id", userId)
          direct?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
          
          // Get team members' patches
          const today = new Date().toISOString().slice(0, 10)
          const { data: links } = await supabase
            .from("role_hierarchy")
            .select("child_user_id")
            .eq("parent_user_id", userId)
            .eq("is_active", true)
            .or(`end_date.is.null,end_date.gte.${today}`)
          
          const childIds = Array.from(new Set(links?.map((r: any) => r.child_user_id).filter(Boolean) || []))
          if (childIds.length > 0) {
            const { data: team } = await supabase
              .from("organiser_patch_assignments")
              .select("patch_id")
              .is("effective_to", null)
              .in("organiser_id", childIds)
            team?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
          }
        } else if (role === "organiser") {
          // Get organiser's direct patch assignments
          const { data } = await supabase
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("organiser_id", userId)
          data?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
        }

        return { role, userId, patchIds: Array.from(patchIdSet) }
      } catch (err) {
        console.warn("Failed to get user scope:", err)
        return null
      }
    }
  })

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["site-visits", userScope?.role, (userScope?.patchIds || []).join(",")],
    queryFn: async () => {
      try {
        // Get accessible job site IDs based on patches
        let allowedSiteIds: Set<string> | null = null
        
        if (userScope?.role !== "admin" && userScope?.patchIds && userScope.patchIds.length > 0) {
          // Query patch sites to get allowed job sites
          const { data: patchSites } = await supabase
            .from("v_patch_sites_current")
            .select("job_site_id")
            .in("patch_id", userScope.patchIds)
          
          allowedSiteIds = new Set(patchSites?.map((r: any) => r.job_site_id).filter(Boolean) || [])
          
          // If no sites found in patches, return empty array
          if (allowedSiteIds.size === 0) {
            return []
          }
        }

        // Build query for site visits
        // Simplified query to avoid nested relationship issues with RLS
        let query = supabase
          .from("site_visit")
          .select("id, created_at, job_site_id, employer_id, job_sites(id,name,full_address,location), employers(id,name)")
          .order("created_at", { ascending: false })
          .limit(200)

        // Apply site filtering for non-admins
        if (allowedSiteIds && allowedSiteIds.size > 0) {
          query = query.in("job_site_id", Array.from(allowedSiteIds))
        }

        const { data, error } = await query
        if (error) {
          console.error('site_visit query failed:', error);
          // Return empty array instead of failing - allows page to load
          return [];
        }
        
        let list = (data || []) as any[]
        
        // Fetch project names separately to avoid RLS issues with nested queries
        const siteIds = Array.from(new Set(list.map((r: any) => r.job_site_id).filter(Boolean)))
        const projectMap: Record<string, string> = {}
        if (siteIds.length > 0) {
          const { data: sites } = await supabase
            .from("job_sites")
            .select("id, project_id, projects(id,name)")
            .in("id", siteIds)
          
          sites?.forEach((s: any) => {
            if (s.projects?.name) {
              projectMap[s.id] = s.projects.name
            }
          })
        }
        
        // Enrich list with project names
        list = list.map((r: any) => ({
          ...r,
          job_sites: {
            ...r.job_sites,
            projects: projectMap[r.job_site_id] ? { name: projectMap[r.job_site_id] } : null
          }
        }))
        
        // Apply status filter
        if (status === "stale") {
          const cutoff = Date.now() - 1000*60*60*24*7
          list = list.filter((r) => {
            const t = new Date(r.created_at).getTime()
            return isFinite(t) && t < cutoff
          })
        }
        
        // Apply search filter
        if (q) {
          const s = q
          list = list.filter((r) => {
            const hay = [
              r.job_sites?.projects?.name, 
              r.job_sites?.name, 
              r.employers?.name, 
              r.objective
            ]
              .map((v: any) => String(v || "").toLowerCase())
            return hay.some((h: string) => h.includes(s))
          })
        }
        
        return list
      } catch (err) {
        console.warn('Failed to query site visits:', err);
        return [];
      }
    },
    enabled: !!userScope
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
                    <TableCell className="whitespace-nowrap">{format(new Date(r.created_at), "dd/MM/yyyy")}</TableCell>
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


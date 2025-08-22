"use client"

import { useEffect, useMemo, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"

type SiteVisit = {
  id?: string
  date: string
  organiser_id: string | null
  project_id: string | null
  job_site_id: string | null
  employer_id: string | null
  notes: string | null
  actions_taken: string | null
}

export function SiteVisitForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<SiteVisit> }) {
  const qc = useQueryClient()
  const [visitDate, setVisitDate] = useState<string>(() => (initial as any)?.date || new Date().toISOString().slice(0, 10))
  const [organiserId, setOrganiserId] = useState<string | null>(initial?.organiser_id || null)
  const [projectId, setProjectId] = useState<string | null>(initial?.project_id || null)
  const [siteId, setSiteId] = useState<string | null>(initial?.job_site_id || null)
  const [employerId, setEmployerId] = useState<string | null>(initial?.employer_id || null)
  const [notes, setNotes] = useState<string>(initial?.notes || "")
  const [actions, setActions] = useState<string>(initial?.actions_taken || "")
  const [selectedEmployerIds, setSelectedEmployerIds] = useState<string[]>(initial?.employer_id ? [initial.employer_id] : [])

  const isEditing = Boolean(initial?.id)

  useEffect(() => {
    if (open && initial) {
      setVisitDate((initial as any).date || new Date().toISOString().slice(0, 10))
      setOrganiserId(initial.organiser_id || null)
      setProjectId(initial.project_id || null)
      setSiteId(initial.job_site_id || null)
      setEmployerId(initial.employer_id || null)
      setNotes(initial.notes || "")
      setActions(initial.actions_taken || "")
      setSelectedEmployerIds(initial?.employer_id ? [initial.employer_id] : [])
    }
  }, [open, initial])

  const { data: organisers = [] } = useQuery({
    queryKey: ["sv-organisers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name").order("full_name")
      if (error) throw error
      return data || []
    }
  })

  // Determine user role and accessible patch IDs
  const { data: userScope } = useQuery({
    queryKey: ["sv-user-scope"],
    queryFn: async () => {
      let userId: string | null = null
      let role: string | null = null
      try {
        const { data: auth } = await supabase.auth.getUser()
        userId = (auth as any)?.user?.id || null
        if (userId) {
          const { data: prof } = await (supabase as any)
            .from("profiles")
            .select("role")
            .eq("id", userId)
            .single()
          role = (prof as any)?.role || null
        }
      } catch {}

      // Admins can see all projects
      if (role === "admin") {
        return { role, patchIds: null as string[] | null }
      }

      // Collect patch IDs based on role
      const patchIdSet = new Set<string>()
      try {
        if (role === "lead_organiser") {
          const [direct, team] = await Promise.all([
            (supabase as any)
              .from("lead_organiser_patch_assignments")
              .select("patch_id")
              .is("effective_to", null)
              .eq("lead_organiser_id", userId),
            (supabase as any)
              .from("organiser_patch_assignments")
              .select("patch_id")
              .is("effective_to", null)
          ])
          ;(((direct as any)?.data as any[]) || []).forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
          ;(((team as any)?.data as any[]) || []).forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
        } else if (role === "organiser") {
          const { data } = await (supabase as any)
            .from("organiser_patch_assignments")
            .select("patch_id")
            .is("effective_to", null)
            .eq("organiser_id", userId)
          ;((data as any[]) || []).forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
        }
      } catch {}

      return { role, patchIds: Array.from(patchIdSet) }
    }
  })

  // Projects scoped to user's viewable patches
  const { data: projects = [] } = useQuery({
    queryKey: ["sv-projects", userScope?.role, (userScope?.patchIds || []).join(",")],
    queryFn: async () => {
      // Admin: all projects
      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        const { data, error } = await supabase.from("projects").select("id,name").order("name")
        if (error) throw error
        return data || []
      }
      const patchIds = userScope?.patchIds || []
      if (patchIds.length === 0) return []

      // Sites in accessible patches
      const { data: patchSites, error: psErr } = await (supabase as any)
        .from("v_patch_sites_current")
        .select("job_site_id, patch_id")
        .in("patch_id", patchIds)
      if (psErr) throw psErr
      const jobSiteIds = Array.from(new Set(((patchSites as any[]) || []).map((r: any) => r.job_site_id).filter(Boolean)))
      if (jobSiteIds.length === 0) return []

      // Projects linked to those sites
      const { data: siteRows, error: jsErr } = await (supabase as any)
        .from("job_sites")
        .select("id, project_id, projects(id,name)")
        .in("id", jobSiteIds)
      if (jsErr) throw jsErr
      const byProject: Record<string, { id: string; name: string | null }> = {}
      ;(((siteRows as any[]) || [])).forEach((s: any) => {
        const p = s.projects
        if (p?.id && !byProject[p.id]) byProject[p.id] = { id: p.id, name: p.name || p.id }
      })
      return Object.values(byProject).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")))
    }
  })

  // Sites for selected project (scoped to patches if not admin)
  const { data: sites = [] } = useQuery({
    queryKey: ["sv-sites", projectId, userScope?.role, (userScope?.patchIds || []).join(",")],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return []
      // Admin: all sites for project
      if (userScope?.role === "admin" || userScope?.patchIds === null) {
        const { data, error } = await supabase.from("job_sites").select("id,name,full_address,location").eq("project_id", projectId).order("name")
        if (error) throw error
        return data || []
      }
      // Else, restrict to sites within user's patches
      const patchIds = userScope?.patchIds || []
      if (patchIds.length === 0) return []
      const { data: patchSites, error: psErr } = await (supabase as any)
        .from("v_patch_sites_current")
        .select("job_site_id, patch_id")
        .in("patch_id", patchIds)
      if (psErr) throw psErr
      const allowedSiteIds = new Set(((patchSites as any[]) || []).map((r: any) => r.job_site_id))
      const { data: projSites, error } = await supabase.from("job_sites").select("id,name,full_address,location").eq("project_id", projectId).order("name")
      if (error) throw error
      return ((projSites as any[]) || []).filter((s: any) => allowedSiteIds.has(s.id))
    }
  })

  // Employers attached to the selected site
  const { data: siteEmployers = [] } = useQuery({
    queryKey: ["sv-site-employers", siteId],
    enabled: !!siteId && !isEditing,
    queryFn: async () => {
      if (!siteId) return []
      const { data, error } = await (supabase as any)
        .from("site_contractor_trades")
        .select("employer_id, employers(id,name)")
        .eq("job_site_id", siteId)
      if (error) throw error
      const map: Record<string, { id: string; name: string }> = {}
      ;(((data as any[]) || [])).forEach((row: any) => {
        const e = row.employers
        if (e?.id) map[e.id] = { id: e.id, name: e.name || e.id }
      })
      return Object.values(map).sort((a, b) => a.name.localeCompare(b.name))
    }
  })

  // Fallback: all employers list for edit mode
  const { data: allEmployers = [] } = useQuery({
    queryKey: ["sv-all-employers"],
    enabled: isEditing,
    queryFn: async () => {
      const { data, error } = await supabase.from("employers").select("id,name").order("name")
      if (error) throw error
      return data || []
    }
  })

  // Pre-select single site if only one available
  useEffect(() => {
    if (!isEditing && projectId && Array.isArray(sites) && sites.length === 1 && !siteId) {
      setSiteId((sites as any[])[0].id)
    }
  }, [isEditing, projectId, sites, siteId])

  const selectedSite = useMemo(() => (sites as any[]).find((s: any) => s.id === siteId) || null, [sites, siteId])

  const upsert = useMutation({
    mutationFn: async () => {
      // Build base payload
      const base = {
        date: visitDate,
        organiser_id: organiserId,
        project_id: projectId,
        job_site_id: siteId,
        notes: notes || null,
        actions_taken: actions || null,
      }

      if (isEditing && initial?.id) {
        // Preserve single-employer edit behavior
        const payload = { ...base, employer_id: employerId }
        const { error } = await supabase.from("site_visit").update(payload).eq("id", initial.id)
        if (error) throw error
        return
      }

      // Creating new visit(s): insert one row per selected employer; if none selected, create a general visit without employer
      const employerIds = (selectedEmployerIds || []).filter(Boolean)
      const rows = employerIds.length > 0
        ? employerIds.map((eid: string) => ({ ...base, employer_id: eid }))
        : [{ ...base, employer_id: null as string | null }]

      const { error } = await (supabase as any).from("site_visit").insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      toast.success("Saved site visit")
      qc.invalidateQueries({ queryKey: ["site-visits"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error((e as Error).message)
  })

  const saveDisabled = useMemo(() => {
    if (!visitDate) return true
    // For new records, require project and site selection
    if (!isEditing) return !(projectId && siteId)
    return false
  }, [visitDate, isEditing, projectId, siteId])

  const allSelected = useMemo(() => {
    const total = (siteEmployers as any[]).length
    if (total === 0) return false
    return selectedEmployerIds.length === total
  }, [siteEmployers, selectedEmployerIds])

  const toggleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) setSelectedEmployerIds(((siteEmployers as any[]) || []).map((e: any) => e.id))
    else setSelectedEmployerIds([])
  }

  const toggleEmployer = (employerId: string, checked: boolean | "indeterminate") => {
    setSelectedEmployerIds((prev) => {
      const set = new Set(prev)
      if (checked) set.add(employerId)
      else set.delete(employerId)
      return Array.from(set)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Edit Site Visit" : "New Site Visit"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Date</Label>
              <Input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </div>
            <div>
              <Label>Organiser</Label>
              <Select value={organiserId || undefined} onValueChange={(v: string) => setOrganiserId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organiser" />
                </SelectTrigger>
                <SelectContent>
                  {(organisers as any[]).map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.full_name || o.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Project</Label>
              <Select value={projectId || undefined} onValueChange={(v: string) => { setProjectId(v); setSiteId(null); setSelectedEmployerIds([]) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects as any[]).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={siteId || undefined} onValueChange={(v: string) => { setSiteId(v); setSelectedEmployerIds([]) }} disabled={!projectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {(sites as any[]).map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedSite && (
            <div className="text-sm text-muted-foreground">
              <div className="font-medium">{selectedSite.name}</div>
              <div>{selectedSite.full_address || selectedSite.location || ""}</div>
            </div>
          )}

          {isEditing ? (
            <div>
              <Label>Employer</Label>
              <Select value={employerId || undefined} onValueChange={(v: string) => setEmployerId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employer" />
                </SelectTrigger>
                <SelectContent>
                  {(allEmployers as any[]).map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <Label>Employers at this site</Label>
              {!siteId ? (
                <div className="text-sm text-muted-foreground mt-1">Select a site to view employers.</div>
              ) : (Array.isArray(siteEmployers) && siteEmployers.length > 0 ? (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center gap-2">
                    <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} id="sv-select-all-employers" />
                    <label htmlFor="sv-select-all-employers" className="text-sm">Select all</label>
                  </div>
                  <div className="max-h-48 overflow-auto border rounded p-2 space-y-2">
                    {(siteEmployers as any[]).map((e: any) => {
                      const checked = selectedEmployerIds.includes(e.id)
                      return (
                        <div key={e.id} className="flex items-center gap-2">
                          <Checkbox checked={checked} onCheckedChange={(v) => toggleEmployer(e.id, v)} id={`emp-${e.id}`} />
                          <label htmlFor={`emp-${e.id}`} className="text-sm">{e.name}</label>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground mt-1">No employers linked to this site.</div>
              ))}
            </div>
          )}

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Visit notes" className="min-h-[80px]" />
          </div>

          <div>
            <Label>Actions Taken</Label>
            <Textarea value={actions} onChange={(e) => setActions(e.target.value)} placeholder="Actions taken during the visit" className="min-h-[80px]" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={() => upsert.mutate()} disabled={saveDisabled || upsert.isPending}>{upsert.isPending ? "Saving..." : "Save"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default SiteVisitForm


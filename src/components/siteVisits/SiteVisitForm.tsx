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

type SiteVisit = {
  id?: string
  visit_date: string
  organiser_id: string | null
  project_id: string | null
  job_site_id: string | null
  employer_id: string | null
  notes: string | null
  actions_taken: string | null
}

export function SiteVisitForm({ open, onOpenChange, initial }: { open: boolean; onOpenChange: (v: boolean) => void; initial?: Partial<SiteVisit> }) {
  const qc = useQueryClient()
  const [visitDate, setVisitDate] = useState<string>(() => initial?.visit_date || new Date().toISOString().slice(0, 10))
  const [organiserId, setOrganiserId] = useState<string | null>(initial?.organiser_id || null)
  const [projectId, setProjectId] = useState<string | null>(initial?.project_id || null)
  const [siteId, setSiteId] = useState<string | null>(initial?.job_site_id || null)
  const [employerId, setEmployerId] = useState<string | null>(initial?.employer_id || null)
  const [notes, setNotes] = useState<string>(initial?.notes || "")
  const [actions, setActions] = useState<string>(initial?.actions_taken || "")

  useEffect(() => {
    if (open && initial) {
      setVisitDate(initial.visit_date || new Date().toISOString().slice(0, 10))
      setOrganiserId(initial.organiser_id || null)
      setProjectId(initial.project_id || null)
      setSiteId(initial.job_site_id || null)
      setEmployerId(initial.employer_id || null)
      setNotes(initial.notes || "")
      setActions(initial.actions_taken || "")
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

  const { data: projects = [] } = useQuery({
    queryKey: ["sv-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id,name").order("name")
      if (error) throw error
      return data || []
    }
  })

  const { data: sites = [] } = useQuery({
    queryKey: ["sv-sites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sites").select("id,name").eq("project_id", projectId).order("name")
      if (error) throw error
      return data || []
    }
  })

  const { data: employers = [] } = useQuery({
    queryKey: ["sv-employers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("employers").select("id,name").order("name")
      if (error) throw error
      return data || []
    }
  })

  const upsert = useMutation({
    mutationFn: async () => {
      const payload = {
        visit_date: visitDate,
        organiser_id: organiserId,
        project_id: projectId,
        job_site_id: siteId,
        employer_id: employerId,
        notes: notes || null,
        actions_taken: actions || null,
      }
      if (initial?.id) {
        const { error } = await supabase.from("site_visits").update(payload).eq("id", initial.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from("site_visits").insert(payload)
        if (error) throw error
      }
    },
    onSuccess: () => {
      toast.success("Saved site visit")
      qc.invalidateQueries({ queryKey: ["site-visits"] })
      onOpenChange(false)
    },
    onError: (e) => toast.error((e as Error).message)
  })

  const saveDisabled = !visitDate

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
              <Select value={projectId || undefined} onValueChange={(v: string) => { setProjectId(v); setSiteId(null) }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {(projects as any[]).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Site</Label>
              <Select value={siteId || undefined} onValueChange={(v: string) => setSiteId(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select site" />
                </SelectTrigger>
                <SelectContent>
                  {(sites as any[]).map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Employer</Label>
            <Select value={employerId || undefined} onValueChange={(v: string) => setEmployerId(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select employer" />
              </SelectTrigger>
              <SelectContent>
                {(employers as any[]).map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

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


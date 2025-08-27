"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import DateInput from "@/components/ui/date-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MappingSiteContactsTable } from "@/components/projects/mapping/MappingSiteContactsTable"

type ProjectRow = {
  id: string;
  name: string;
  value: number | null;
  proposed_start_date: string | null;
  proposed_finish_date: string | null;
  roe_email: string | null;
  project_type: string | null;
  state_funding: number;
  federal_funding: number;
  builder_id: string | null;
  main_job_site_id: string | null;
}

export function MappingSheetMobile({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRow | null>(null)
  const [address, setAddress] = useState<string>("")
  const [builderName, setBuilderName] = useState<string>("—")
  const [organisers, setOrganisers] = useState<string>("—")
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, value, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, builder_id, main_job_site_id")
        .eq("id", projectId)
        .maybeSingle()
      if (data) setProject(data as any)

      const siteId = (data as any)?.main_job_site_id as string | null
      if (siteId) {
        const { data: site } = await (supabase as any).from("job_sites").select("full_address, location").eq("id", siteId).maybeSingle()
        setAddress((site as any)?.full_address || (site as any)?.location || "")
      }
      const builderId = (data as any)?.builder_id as string | null
      if (builderId) {
        const { data: b } = await supabase.from("employers").select("name").eq("id", builderId).maybeSingle()
        setBuilderName(((b as any)?.name as string) || builderId)
      } else {
        setBuilderName("—")
      }

      const { data: sites } = await (supabase as any).from("job_sites").select("id").eq("project_id", projectId)
      const siteIds = ((sites as any[]) || []).map((s: any) => s.id)
      if (siteIds.length > 0) {
        const { data: pjs } = await (supabase as any).from("patch_job_sites").select("patch_id").in("job_site_id", siteIds)
        const patchIds = Array.from(new Set(((pjs as any[]) || []).map((r: any) => r.patch_id)))
        if (patchIds.length > 0) {
          const { data: orgs } = await (supabase as any)
            .from("organiser_patch_assignments")
            .select("profiles:organiser_id(full_name)")
            .is("effective_to", null)
            .in("patch_id", patchIds)
          const names = Array.from(new Set(((orgs as any[]) || []).map((r: any) => {
            const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles; return p?.full_name as string | undefined
          }).filter(Boolean)))
          setOrganisers(names.join(", ") || "—")
        }
      }
    }
    load()
  }, [projectId])

  const scheduleUpdate = (patch: Partial<ProjectRow>) => {
    setProject((prev) => prev ? { ...prev, ...patch } : prev)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => persist(patch), 500)
  }

  const persist = async (patch: Partial<ProjectRow>) => {
    if (!project) return
    setSaving(true)
    try {
      const base: any = { ...patch }
      const { error } = await supabase.from("projects").update(base).eq("id", project.id)
      if (error) throw error
    } finally {
      setSaving(false)
    }
  }

  const saveAddress = async (val: string) => {
    setAddress(val)
    if (!project?.main_job_site_id) return
    setSaving(true)
    try {
      const { error } = await (supabase as any)
        .from("job_sites")
        .update({ full_address: val, location: val })
        .eq("id", project.main_job_site_id)
      if (error) throw error
    } finally {
      setSaving(false)
    }
  }

  return (
    <Accordion type="single" collapsible defaultValue="section-1" className="w-full">
      <AccordionItem value="section-1">
        <AccordionTrigger>Project details</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium">Project Name</label>
              <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.name || ""} onChange={(e) => scheduleUpdate({ name: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Address</label>
              <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={address} onChange={(e) => saveAddress(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium">Government or Private</label>
              <Select value={project?.project_type || ""} onValueChange={(v) => scheduleUpdate({ project_type: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="mixed">Mixed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="section-2">
        <AccordionTrigger>Funding</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium">Project Value (AUD)</label>
              <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project ? String(project.value ?? "") : ""} onChange={(e) => scheduleUpdate({ value: e.target.value ? Number(e.target.value) : null })} />
            </div>
            <div>
              <label className="text-xs font-medium">State Funding (AUD)</label>
              <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(project?.state_funding ?? 0)} onChange={(e) => scheduleUpdate({ state_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
            </div>
            <div>
              <label className="text-xs font-medium">Federal Funding (AUD)</label>
              <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(project?.federal_funding ?? 0)} onChange={(e) => scheduleUpdate({ federal_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="section-3">
        <AccordionTrigger>Timeline</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium">Proposed start date</label>
              <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.proposed_start_date || ""} onChange={(e) => scheduleUpdate({ proposed_start_date: e.target.value })} />
            </div>
            <div>
              <label className="text-xs font-medium">Proposed finish date</label>
              <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.proposed_finish_date || ""} onChange={(e) => scheduleUpdate({ proposed_finish_date: e.target.value })} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="section-4">
        <AccordionTrigger>Contacts</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-medium mb-1">Organiser(s)</div>
              <div className="p-2 border rounded bg-muted/20">{organisers || "—"}</div>
            </div>
            <MappingSiteContactsTable projectId={projectId} mainSiteId={project?.main_job_site_id || null} />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="section-5">
        <AccordionTrigger>ROE & Builder</AccordionTrigger>
        <AccordionContent>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="text-xs font-medium">Builder</label>
              <div className="mt-1 p-2 border rounded bg-muted/20">{builderName}</div>
            </div>
            <div>
              <label className="text-xs font-medium">Preferred email for ROE</label>
              <Input type="email" className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.roe_email || ""} onChange={(e) => scheduleUpdate({ roe_email: e.target.value })} />
            </div>
          </div>
          <div className="text-[11px] text-muted-foreground mt-2" aria-live="polite">{saving ? "Saving…" : "All changes saved"}</div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}


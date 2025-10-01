"use client"

import { useEffect, useRef, useState } from "react"
import { supabase } from "@/integrations/supabase/client"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import DateInput from "@/components/ui/date-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MappingSiteContactsTable } from "@/components/projects/mapping/MappingSiteContactsTable"
import { useProjectOrganisers } from "@/hooks/useProjectOrganisers"
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"

type ProjectRow = {
  id: string;
  name: string;
  value: number | null;
  tier: string | null;
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
  const [builderId, setBuilderId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const organisers = useProjectOrganisers(projectId).label
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isEmployerDetailOpen, setIsEmployerDetailOpen] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, value, tier, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, builder_id, main_job_site_id")
        .eq("id", projectId)
        .maybeSingle()
      if (data) setProject(data as any)

      const siteId = (data as any)?.main_job_site_id as string | null
      if (siteId) {
        const { data: site } = await (supabase as any).from("job_sites").select("full_address, location").eq("id", siteId).maybeSingle()
        setAddress((site as any)?.full_address || (site as any)?.location || "")
      }
      const builderIdVal = (data as any)?.builder_id as string | null
      setBuilderId(builderIdVal)
      if (builderIdVal) {
        const { data: b } = await supabase.from("employers").select("name").eq("id", builderIdVal).maybeSingle()
        setBuilderName(((b as any)?.name as string) || builderIdVal)
      } else {
        setBuilderName("—")
      }

      // organiser label now provided by hook
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
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="section-1">
        <AccordionTrigger>Project Details</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            {/* Project Header with Tier */}
            <div className="border-b border-gray-200 pb-3">
              <h3 className="text-lg font-semibold mb-2">{project?.name}</h3>
              <div className="flex items-center gap-2">
                <ProjectTierBadge tier={project?.tier || null} size="sm" />
                {project?.value && (
                  <span className="text-sm text-muted-foreground">
                    ${(project.value / 1000000).toFixed(1)}M
                  </span>
                )}
              </div>
            </div>
            
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
              {builderId ? (
                <button
                  onClick={() => {
                    setSelectedEmployerId(builderId);
                    setIsEmployerDetailOpen(true);
                  }}
                  className="rounded-none border-0 border-b border-black px-0 w-full text-left underline hover:text-primary"
                >
                  {builderName}
                </button>
              ) : (
                <div className="rounded-none border-0 border-b border-black px-0 text-gray-400">
                  {builderName}
                </div>
              )}
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

    {/* Employer Detail Modal */}
    <EmployerDetailModal
      employerId={selectedEmployerId}
      isOpen={isEmployerDetailOpen}
      onClose={() => setIsEmployerDetailOpen(false)}
      initialTab="overview"
    />
  </>
  )
}


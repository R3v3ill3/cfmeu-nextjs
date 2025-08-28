"use client"

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import Image from "next/image";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DateInput from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MappingSiteContactsTable } from "./MappingSiteContactsTable";
import { useProjectOrganisers } from "@/hooks/useProjectOrganisers";
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { useQuery } from "@tanstack/react-query";

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
};

export function MappingSheetPage1({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [address, setAddress] = useState<string>("");
  const [builderName, setBuilderName] = useState<string>("—");
  const [builderHasEba, setBuilderHasEba] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const organisers = useProjectOrganisers(projectId).label;

  const { data: projectData } = useQuery({
    queryKey: ["project-mapping", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name, value, tier, proposed_start_date, proposed_finish_date, roe_email, project_type, state_funding, federal_funding, builder_id, main_job_site_id")
        .eq("id", projectId)
        .maybeSingle();
      return data;
    }
  });

  useEffect(() => {
    if (projectData) setProject(projectData as any);

    const loadRelatedData = async () => {
      const siteId = (projectData as any)?.main_job_site_id as string | null;
      if (siteId) {
        const { data: site } = await (supabase as any).from("job_sites").select("full_address, location").eq("id", siteId).maybeSingle();
        setAddress((site as any)?.full_address || (site as any)?.location || "");
      }
      const builderId = (projectData as any)?.builder_id as string | null;
      if (builderId) {
        const { data: b } = await supabase
          .from("employers")
          .select("name, enterprise_agreement_status")
          .eq("id", builderId)
          .maybeSingle();
        setBuilderName(((b as any)?.name as string) || builderId);
        const status = (b as any)?.enterprise_agreement_status as string | null;
        setBuilderHasEba(status ? status !== "no_eba" : null);
      } else {
        setBuilderName("—");
        setBuilderHasEba(null);
      }
    };

    loadRelatedData();
  }, [projectData]);

  const scheduleUpdate = (patch: Partial<ProjectRow>) => {
    setProject((prev) => prev ? { ...prev, ...patch } : prev);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => persist(patch), 500);
  };

  const persist = async (patch: Partial<ProjectRow>) => {
    if (!project) return;
    setSaving(true);
    try {
      const base: any = { ...patch };
      const { error } = await supabase.from("projects").update(base).eq("id", project.id);
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message || "Failed to save project");
    } finally {
      setSaving(false);
    }
  };

  const saveAddress = async (val: string) => {
    setAddress(val);
    if (!project?.main_job_site_id) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("job_sites")
        .update({ full_address: val, location: val })
        .eq("id", project.main_job_site_id);
      if (error) throw error;
    } catch (e: any) {
      toast.error(e?.message || "Failed to save address");
    } finally {
      setSaving(false);
    }
  };

  const currency = (n: number | null | undefined) => (n ?? 0).toString();

  return (
    <div className="print-border p-4">
      {/* Paper-style header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/cfmeu-logo.png" alt="CFMEU" width={120} height={40} className="object-contain" />
          <div>
            <div className="text-xl font-black tracking-tight">Mapping Sheets</div>
            <div className="text-xs text-muted-foreground leading-snug">Organiser: {organisers || "—"}</div>
          </div>
        </div>
        <div className="text-right text-xs">
          <div>Form MS-01</div>
          <div className="text-muted-foreground">Rev {new Date().getFullYear()}</div>
        </div>
      </div>
      {/* Project Header with Tier */}
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h2 className="text-2xl font-bold mb-2">{project?.name}</h2>
        <div className="flex items-center gap-3">
          <ProjectTierBadge tier={project?.tier} size="md" />
          {project?.value && (
            <span className="text-lg text-muted-foreground">
              ${(project.value / 1000000).toFixed(1)}M
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Project Name - top line */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Project Name</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.name || ""} onChange={(e) => scheduleUpdate({ name: e.target.value })} placeholder="" />
        </div>

        {/* Address - second line */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Address</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={address} onChange={(e) => saveAddress(e.target.value)} placeholder="" />
        </div>

        {/* Builder (read-only, styled like underlined input) */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Builder</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={builderName} readOnly disabled />
        </div>

        {/* Proposed dates side by side */}
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <div>
            <label className="text-sm font-semibold">Proposed start date</label>
            <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.proposed_start_date || ""} onChange={(e) => scheduleUpdate({ proposed_start_date: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-semibold">Proposed finish date</label>
            <DateInput className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.proposed_finish_date || ""} onChange={(e) => scheduleUpdate({ proposed_finish_date: e.target.value })} />
          </div>
        </div>

        {/* Project Value */}
        <div className="md:col-span-2">
          <label className="text-sm font-semibold">Project Value (AUD)</label>
          <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project ? String(project.value ?? "") : ""} onChange={(e) => scheduleUpdate({ value: e.target.value ? Number(e.target.value) : null })} placeholder="" />
        </div>

        {/* Funding Type + EBA side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:col-span-2">
          <div>
            <label className="text-sm font-semibold">Funding Type</label>
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
          <div>
            <label className="text-sm font-semibold">EBA with CFMEU</label>
            <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={
              builderName === "—" ? "—" : (builderHasEba === null ? "—" : (builderHasEba ? "Yes" : "No"))
            } readOnly disabled />
          </div>
        </div>

        {/* State and Federal funding side by side */}
        <div className="grid grid-cols-2 gap-3 md:col-span-2">
          <div>
            <label className="text-sm font-semibold">State Funding (AUD)</label>
            <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(project?.state_funding ?? 0)} onChange={(e) => scheduleUpdate({ state_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
          </div>
          <div>
            <label className="text-sm font-semibold">Federal Funding (AUD)</label>
            <Input className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={String(project?.federal_funding ?? 0)} onChange={(e) => scheduleUpdate({ federal_funding: Number(e.target.value.replace(/[^0-9.]/g, "")) })} />
          </div>
        </div>

        {/* EBA (moved beside Funding Type above) */}

        {/* Organiser (kept for screen, hidden on print) */}
        <div className="no-print md:col-span-2">
          <label className="text-sm font-semibold">Organiser</label>
          <div className="mt-1 p-2 border rounded bg-muted/20 print-border">{organisers || "—"}</div>
        </div>

        {/* Preferred email for ROE (kept for screen, hidden on print) */}
        <div className="no-print md:col-span-2">
          <label className="text-sm font-semibold">Preferred email for ROE</label>
          <Input type="email" className="rounded-none border-0 border-b border-black focus-visible:ring-0 px-0" value={project?.roe_email || ""} onChange={(e) => scheduleUpdate({ roe_email: e.target.value })} placeholder="" />
        </div>
      </div>

      <MappingSiteContactsTable projectId={projectId} mainSiteId={project?.main_job_site_id || null} />

      <div className="text-sm text-muted-foreground mt-2" aria-live="polite">{saving ? "Saving…" : "All changes saved"}</div>
    </div>
  );
}


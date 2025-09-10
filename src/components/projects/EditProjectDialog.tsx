
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import DateInput from "@/components/ui/date-input";

import { JVSelector } from "@/components/projects/JVSelector";
import { MultiEmployerPicker } from "@/components/projects/MultiEmployerPicker";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProjectTierBadge } from "@/components/ui/ProjectTierBadge"
import { calculateProjectTier } from "@/components/projects/types"

type EditableProject = {
  id: string;
  name: string;
  value: number | null;
  organising_universe?: 'active' | 'potential' | 'excluded' | null;
  stage_class?: 'future' | 'pre_construction' | 'construction' | 'archived' | null;
  proposed_start_date: string | null;
  proposed_finish_date: string | null;
  roe_email: string | null;
};
type JVStatus = "yes" | "no" | "unsure";

export function EditProjectDialog({
  project,
  triggerText = "Edit",
}: {
  project: EditableProject;
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(project.name || "");
  const [value, setValue] = useState(project.value ? String(project.value) : "");
  const [start, setStart] = useState(project.proposed_start_date || "");
  const [finish, setFinish] = useState(project.proposed_finish_date || "");
  const [roeEmail, setRoeEmail] = useState(project.roe_email || "");
  const [organisingUniverse, setOrganisingUniverse] = useState<'active' | 'potential' | 'excluded'>((project as any).organising_universe || 'potential');
  const [stageClass, setStageClass] = useState<'future' | 'pre_construction' | 'construction' | 'archived'>((project as any).stage_class || 'pre_construction');
  const [projectType, setProjectType] = useState<string>("");
  const [stateFunding, setStateFunding] = useState<string>("");
  const [federalFunding, setFederalFunding] = useState<string>("");
  // Roles & JV states
  const [builderIds, setBuilderIds] = useState<string[]>([]);
  const [headContractorId, setHeadContractorId] = useState<string>("");
  const [jvStatus, setJvStatus] = useState<JVStatus>("no");
  const [jvLabel, setJvLabel] = useState<string>("");
  const [loadingRelations, setLoadingRelations] = useState<boolean>(false);

  // Patch assignment state
  const [selectedPatchId, setSelectedPatchId] = useState<string>("");
  const [patchSaving, setPatchSaving] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const resetForm = () => {
    setName(project.name || "");
    setValue(project.value ? String(project.value) : "");
    setStart(project.proposed_start_date || "");
    setFinish(project.proposed_finish_date || "");
    setRoeEmail(project.roe_email || "");
    setOrganisingUniverse(((project as any).organising_universe as any) || 'potential');
    setStageClass(((project as any).stage_class as any) || 'pre_construction');
    setProjectType("");
    setStateFunding("");
    setFederalFunding("");
    // Reset relational states; they'll be loaded via loadRelations
    setBuilderIds([]);
    setHeadContractorId("");
    setJvStatus("no");
    setJvLabel("");
    setSelectedPatchId("");
  };

  const loadRelations = async () => {
    setLoadingRelations(true);
    try {
      // Load from project_assignments instead of legacy project_employer_roles
      const { data: assignments, error: assignmentsErr } = await supabase
        .from("project_assignments")
        .select("assignment_type, employer_id, contractor_role_types(code)")
        .eq("project_id", project.id)
        .eq("assignment_type", "contractor_role");
      if (assignmentsErr) throw assignmentsErr;

      const builders = (assignments || [])
        .filter((a: any) => a.contractor_role_types?.code === "builder")
        .map((a: any) => a.employer_id)
        .filter(Boolean) as string[];
      setBuilderIds(builders);

      const head = (assignments || []).find((a: any) => a.contractor_role_types?.code === "head_contractor");
      setHeadContractorId((head?.employer_id as string) || "");

      const { data: jv, error: jvErr } = await supabase
        .from("project_builder_jv")
        .select("status, label")
        .eq("project_id", project.id)
        .maybeSingle();
      if (jvErr && (jvErr as any).code !== "PGRST116") throw jvErr; // ignore not found
      if (jv) {
        setJvStatus((jv.status as JVStatus) || "no");
        setJvLabel(jv.label || "");
      } else {
        setJvStatus("no");
        setJvLabel("");
      }
    } catch (e) {
      toast.error("Failed to load roles/JV: " + (e as Error).message);
    } finally {
      setLoadingRelations(false);
    }
  };

  useEffect(() => {
    if (jvStatus === "no" && builderIds[0] && !headContractorId) {
      setHeadContractorId(builderIds[0]);
    }
  }, [jvStatus, builderIds, headContractorId]);

  // Sites for this project (to apply patch links)
  const [siteIds, setSiteIds] = useState<string[]>([]);
  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await (supabase as any)
        .from("job_sites")
        .select("id")
        .eq("project_id", project.id);
      setSiteIds(((data as any[]) || []).map((r: any) => String(r.id)));
    };
    if (open) fetchSites();
  }, [open, project.id]);

  // Current patches on this project via its sites
  const [projectPatches, setProjectPatches] = useState<Array<{ id: string; name: string }>>([]);
  const [organiserNames, setOrganiserNames] = useState<string[]>([]);
  useEffect(() => {
    const loadPatchesAndOrganisers = async () => {
      if (siteIds.length === 0) { setProjectPatches([]); setOrganiserNames([]); return; }
      const { data: pjs } = await (supabase as any)
        .from("patch_job_sites")
        .select("patch_id, patches:patch_id(id,name)")
        .in("job_site_id", siteIds);
      const byId = new Map<string, { id: string; name: string }>();
      ;((pjs as any[]) || []).forEach((r: any) => {
        const patch = Array.isArray(r.patches) ? r.patches[0] : r.patches;
        if (patch?.id) byId.set(patch.id, { id: patch.id, name: patch.name });
      });
      const patches = Array.from(byId.values());
      setProjectPatches(patches);
      const patchIds = patches.map(p => p.id);
      if (patchIds.length === 0) { setOrganiserNames([]); return; }
      const { data: orgs } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("organiser_id, effective_to, profiles:organiser_id(full_name)")
        .is("effective_to", null)
        .in("patch_id", patchIds);
      const names = new Map<string, string>();
      ;((orgs as any[]) || []).forEach((r: any) => {
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const n = prof?.full_name as string | undefined;
        if (n && r.organiser_id) names.set(r.organiser_id, n);
      });
      setOrganiserNames(Array.from(names.values()));
    };
    if (open) loadPatchesAndOrganisers();
  }, [open, siteIds]);

  // All patches and labels for selection UI
  const [allPatches, setAllPatches] = useState<Array<{ id: string; name: string }>>([]);
  const [patchOptionLabels, setPatchOptionLabels] = useState<Record<string, string>>({});
  useEffect(() => {
    const loadOptions = async () => {
      const { data: pts } = await (supabase as any)
        .from("patches")
        .select("id,name")
        .order("name");
      setAllPatches(((pts as any[]) || []) as any);
      const labels = new Map<string, string>();
      const { data: orgs } = await (supabase as any)
        .from("organiser_patch_assignments")
        .select("patch_id, organiser_id, profiles:organiser_id(full_name)")
        .is("effective_to", null);
      ;((orgs as any[]) || []).forEach((r: any) => {
        const pid = r.patch_id as string;
        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        const name = (prof?.full_name as string) || r.organiser_id;
        if (!labels.has(pid)) labels.set(pid, name);
      });
      const { data: pending } = await (supabase as any)
        .from("pending_users")
        .select("id,full_name,assigned_patch_ids,status,role")
        .in("status", ["draft", "invited"]);
      ;((pending as any[]) || []).forEach((pu: any) => {
        const name = (pu.full_name as string) || (pu.email as string) || pu.id;
        ;(pu.assigned_patch_ids || []).forEach((pid: string) => {
          if (!labels.has(pid)) labels.set(pid, `${name}${pu.role === 'lead_organiser' ? ' (lead)' : ''}`);
        });
      });
      setPatchOptionLabels(Object.fromEntries(labels.entries()));
    };
    if (open) loadOptions();
  }, [open]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      // 1) Update base project fields (keep legacy builder_id in sync)
      const payload = {
        name: name.trim(),
        value: value ? parseFloat(value) : null,
        proposed_start_date: start || null,
        proposed_finish_date: finish || null,
        roe_email: roeEmail ? roeEmail.trim() : null,
        organising_universe: organisingUniverse,
        stage_class: stageClass,
        project_type: projectType || null,
        state_funding: stateFunding ? Number(stateFunding.replace(/[^0-9.]/g, "")) : 0,
        federal_funding: federalFunding ? Number(federalFunding.replace(/[^0-9.]/g, "")) : 0,
        builder_id: builderIds[0] || null,
      } as const;

      const { error: updErr } = await supabase
        .from("projects")
        .update(payload)
        .eq("id", project.id);
      if (updErr) throw updErr;

      // 2) Upsert JV metadata
      const jvPayload: any = {
        project_id: project.id,
        status: jvStatus,
        label: jvStatus === "yes" ? (jvLabel.trim() || null) : null,
      };
      const { error: jvError } = await (supabase as any)
        .from("project_builder_jv")
        .upsert(jvPayload, { onConflict: "project_id" });
      if (jvError) throw jvError;

      // 3) Use RPC functions to manage contractor roles (handles new assignment system)
      // First remove existing contractor role assignments
      const { error: delErr } = await supabase
        .from("project_assignments")
        .delete()
        .eq("project_id", project.id)
        .eq("assignment_type", "contractor_role");
      if (delErr) throw delErr;

      // Add builders using the RPC function
      for (const builderId of builderIds) {
        const { error: builderErr } = await supabase.rpc('assign_contractor_role', {
          p_project_id: project.id,
          p_employer_id: builderId,
          p_role_code: 'builder',
          p_company_name: 'Builder', // Will be looked up from employer
          p_is_primary: true
        });
        if (builderErr) console.warn('Failed to assign builder:', builderErr);
      }

      // Add head contractor using the RPC function  
      if (headContractorId) {
        const { error: headErr } = await supabase.rpc('assign_contractor_role', {
          p_project_id: project.id,
          p_employer_id: headContractorId,
          p_role_code: 'head_contractor', 
          p_company_name: 'Head Contractor', // Will be looked up from employer
          p_is_primary: true
        });
        if (headErr) throw headErr;
      }
    },
    onSuccess: () => {
      toast.success("Project updated");
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", project.id] });
      queryClient.invalidateQueries({ queryKey: ["project-roles", project.id] });
      setOpen(false);
    },
    onError: (err) => {
      toast.error("Failed to update project: " + (err as Error).message);
    },
  });

  const isDisabled = useMemo(() => !name.trim() || updateMutation.isPending || loadingRelations, [name, updateMutation.isPending, loadingRelations]);

  // Calculate tier based on current value
  const calculatedTier = useMemo(() => {
    if (!value) return null
    const numValue = parseFloat(value)
    return calculateProjectTier(numValue)
  }, [value])

  return (
    <Dialog
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        if (v) {
          resetForm();
          loadRelations();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">{triggerText}</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-y-auto pr-4 space-y-4">
          <div>
            <Label htmlFor="proj_name">Project Name</Label>
            <Input id="proj_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Stage</Label>
              <Select value={stageClass} onValueChange={(v: any) => setStageClass(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="future">Future</SelectItem>
                  <SelectItem value="pre_construction">Pre-construction</SelectItem>
                  <SelectItem value="construction">Construction</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Organising universe</Label>
              <Select value={organisingUniverse} onValueChange={(v: any) => setOrganisingUniverse(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select universe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="potential">Potential</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Project Value with Tier Preview */}
          <div className="space-y-2">
            <Label htmlFor="value">Project Value (AUD)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="value"
                type="number"
                placeholder="Enter project value"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              {calculatedTier && (
                <ProjectTierBadge tier={calculatedTier} size="sm" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Tier 1: $500M+ | Tier 2: $100M-$500M | Tier 3: &lt;$100M
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj_start">Proposed Start</Label>
              <DateInput id="proj_start" value={start || ""} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="proj_finish">Proposed Finish</Label>
              <DateInput id="proj_finish" value={finish || ""} onChange={(e) => setFinish(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="proj_roe">ROE Email</Label>
            <Input
              id="proj_roe"
              type="email"
              value={roeEmail}
              onChange={(e) => setRoeEmail(e.target.value)}
              placeholder="rightofentry@example.com"
            />
          </div>
          <div>
            <Label>Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger className="mt-1 w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj_state">State funding (AUD)</Label>
              <Input id="proj_state" value={stateFunding} onChange={(e) => setStateFunding(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="proj_fed">Federal funding (AUD)</Label>
              <Input id="proj_fed" value={federalFunding} onChange={(e) => setFederalFunding(e.target.value)} placeholder="0" />
            </div>
          </div>

          <JVSelector
            status={jvStatus}
            label={jvLabel}
            onChangeStatus={setJvStatus}
            onChangeLabel={setJvLabel}
          />

          {/* Patch & organiser info with assign capability */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Patch</div>
            <div className="text-sm text-muted-foreground">
              {projectPatches.length > 0 ? `${projectPatches[0]?.name}${projectPatches.length > 1 ? ` +${projectPatches.length - 1}` : ''}` : 'No patch assigned'}
            </div>
            <div className="text-sm font-medium">Organiser{organiserNames.length === 1 ? '' : 's'}</div>
            <div className="text-sm text-muted-foreground truncate">{organiserNames.slice(0, 4).join(', ') || '—'}</div>
            <div>
              <Label>Assign patch</Label>
              <Select value={selectedPatchId} onValueChange={(v: string) => setSelectedPatchId(v)}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select a patch" />
                </SelectTrigger>
                <SelectContent>
                  {(allPatches as any[]).map((pt: any) => {
                    const left = (patchOptionLabels as Record<string, string>)[pt.id];
                    return (
                      <SelectItem key={pt.id} value={pt.id}>
                        <span className="inline-flex items-center gap-2">
                          <span className="text-muted-foreground w-40 text-left truncate">{left || '—'}</span>
                          <span className="text-foreground">{pt.name}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2 mt-2">
                <Button variant="outline" onClick={() => setSelectedPatchId("")}>Clear</Button>
                <Button disabled={!selectedPatchId || siteIds.length === 0 || patchSaving} onClick={async () => {
                  try {
                    setPatchSaving(true);
                    for (const sid of siteIds) {
                      try {
                        await (supabase as any).rpc('upsert_patch_site', { p_patch: selectedPatchId, p_site: sid });
                      } catch (e) {
                        await (supabase as any).from('patch_job_sites').insert({ patch_id: selectedPatchId, job_site_id: sid });
                      }
                    }
                    // refresh local and external queries
                    queryClient.invalidateQueries({ queryKey: ["project-patches", project.id] });
                    queryClient.invalidateQueries({ queryKey: ["project-patch-organisers", project.id] });
                    // reload local display
                    setSelectedPatchId("");
                    toast.success("Patch assigned to project sites");
                    // reload patches/organisers locally
                    const { data: pjs2 } = await (supabase as any)
                      .from("patch_job_sites")
                      .select("patch_id, patches:patch_id(id,name)")
                      .in("job_site_id", siteIds);
                    const byId2 = new Map<string, { id: string; name: string }>();
                    ;((pjs2 as any[]) || []).forEach((r: any) => {
                      const patch = Array.isArray(r.patches) ? r.patches[0] : r.patches;
                      if (patch?.id) byId2.set(patch.id, { id: patch.id, name: patch.name });
                    });
                    const patches2 = Array.from(byId2.values());
                    setProjectPatches(patches2);
                    const patchIds2 = patches2.map(p => p.id);
                    if (patchIds2.length > 0) {
                      const { data: orgs2 } = await (supabase as any)
                        .from("organiser_patch_assignments")
                        .select("organiser_id, effective_to, profiles:organiser_id(full_name)")
                        .is("effective_to", null)
                        .in("patch_id", patchIds2);
                      const names2 = new Map<string, string>();
                      ;((orgs2 as any[]) || []).forEach((r: any) => {
                        const prof = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
                        const n = prof?.full_name as string | undefined;
                        if (n && r.organiser_id) names2.set(r.organiser_id, n);
                      });
                      setOrganiserNames(Array.from(names2.values()));
                    } else {
                      setOrganiserNames([]);
                    }
                  } finally {
                    setPatchSaving(false);
                  }
                }}>{patchSaving ? "Saving..." : "Save patch"}</Button>
              </div>
              {siteIds.length === 0 && (
                <div className="text-xs text-amber-600 mt-1">Create at least one job site to link a patch.</div>
              )}
            </div>
          </div>

          <MultiEmployerPicker
            label="Builder(s)"
            selectedIds={builderIds}
            onChange={(ids) => setBuilderIds(ids)}
            prioritizedTag="builder"
            triggerText={builderIds.length > 0 ? "Change builder(s)" : "Add builder"}
          />

          <SingleEmployerDialogPicker
            label="Head contractor (optional)"
            selectedId={headContractorId}
            onChange={(id) => setHeadContractorId(id)}
            prioritizedTag="head_contractor"
            triggerText={headContractorId ? "Change head contractor" : "Add head contractor"}
          />

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={updateMutation.isPending}>
              Cancel
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={isDisabled}>
              {updateMutation.isPending ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default EditProjectDialog;

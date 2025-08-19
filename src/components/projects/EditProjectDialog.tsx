
import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

import { JVSelector } from "@/components/projects/JVSelector";
import { MultiEmployerPicker } from "@/components/projects/MultiEmployerPicker";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";

type EditableProject = {
  id: string;
  name: string;
  value: number | null;
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
  // Roles & JV states
  const [builderIds, setBuilderIds] = useState<string[]>([]);
  const [headContractorId, setHeadContractorId] = useState<string>("");
  const [jvStatus, setJvStatus] = useState<JVStatus>("no");
  const [jvLabel, setJvLabel] = useState<string>("");
  const [loadingRelations, setLoadingRelations] = useState<boolean>(false);

  const queryClient = useQueryClient();

  const resetForm = () => {
    setName(project.name || "");
    setValue(project.value ? String(project.value) : "");
    setStart(project.proposed_start_date || "");
    setFinish(project.proposed_finish_date || "");
    setRoeEmail(project.roe_email || "");
    // Reset relational states; they'll be loaded via loadRelations
    setBuilderIds([]);
    setHeadContractorId("");
    setJvStatus("no");
    setJvLabel("");
  };

  const loadRelations = async () => {
    setLoadingRelations(true);
    try {
      const { data: roles, error: rolesErr } = await supabase
        .from("project_employer_roles")
        .select("role, employer_id")
        .eq("project_id", project.id);
      if (rolesErr) throw rolesErr;

      const builders = (roles || [])
        .filter((r: any) => r.role === "builder")
        .map((r: any) => r.employer_id)
        .filter(Boolean) as string[];
      setBuilderIds(builders);

      const head = (roles || []).find((r: any) => r.role === "head_contractor");
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

  const updateMutation = useMutation({
    mutationFn: async () => {
      // 1) Update base project fields (keep legacy builder_id in sync)
      const payload = {
        name: name.trim(),
        value: value ? parseFloat(value) : null,
        proposed_start_date: start || null,
        proposed_finish_date: finish || null,
        roe_email: roeEmail ? roeEmail.trim() : null,
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

      // 3) Replace builder/head_contractor roles atomically (best-effort)
      const { error: delErr } = await supabase
        .from("project_employer_roles")
        .delete()
        .eq("project_id", project.id)
        .in("role", ["builder", "head_contractor"] as any);
      if (delErr) throw delErr;

      if (builderIds.length > 0) {
        const builderRows = builderIds.map((id) => ({
          project_id: project.id,
          employer_id: id,
          role: "builder",
        }));
        const { error: insBuildersErr } = await (supabase as any)
          .from("project_employer_roles")
          .insert(builderRows);
        if (insBuildersErr) throw insBuildersErr;
      }

      if (headContractorId) {
        const { error: insHeadErr } = await (supabase as any)
          .from("project_employer_roles")
          .insert({
            project_id: project.id,
            employer_id: headContractorId,
            role: "head_contractor",
          });
        if (insHeadErr) throw insHeadErr;
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

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
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
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="proj_name">Project Name</Label>
            <Input id="proj_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <Label htmlFor="proj_value">Project Value (AUD)</Label>
            <Input
              id="proj_value"
              type="number"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="e.g., 5000000"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj_start">Proposed Start</Label>
              <Input id="proj_start" type="date" value={start || ""} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="proj_finish">Proposed Finish</Label>
              <Input id="proj_finish" type="date" value={finish || ""} onChange={(e) => setFinish(e.target.value)} />
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

          <JVSelector
            status={jvStatus}
            label={jvLabel}
            onChangeStatus={setJvStatus}
            onChangeLabel={setJvLabel}
          />

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

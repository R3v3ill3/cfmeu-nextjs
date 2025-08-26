import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DateInput from "@/components/ui/date-input";
import { toast } from "sonner";
import { JVSelector } from "@/components/projects/JVSelector";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function CreateProjectDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [value, setValue] = useState("");
  const [start, setStart] = useState("");
  const [finish, setFinish] = useState("");
  const [roeEmail, setRoeEmail] = useState("");
  const [projectType, setProjectType] = useState<string>("");
  const [stateFunding, setStateFunding] = useState<string>("");
  const [federalFunding, setFederalFunding] = useState<string>("");
  const [builderId, setBuilderId] = useState<string>("");
  const [jvStatus, setJvStatus] = useState<"yes" | "no" | "unsure">("no");
  const [jvLabel, setJvLabel] = useState<string>("");

  const canSubmit = useMemo(() => name.trim() && address.trim(), [name, address]);

  const qc = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: name.trim(),
        value: value ? Number(value) : null,
        proposed_start_date: start || null,
        proposed_finish_date: finish || null,
        roe_email: roeEmail || null,
        project_type: projectType || null,
        state_funding: stateFunding ? Number(stateFunding.replace(/[^0-9.]/g, "")) : 0,
        federal_funding: federalFunding ? Number(federalFunding.replace(/[^0-9.]/g, "")) : 0,
        builder_id: builderId || null,
      };
      const { data: proj, error: projErr } = await supabase
        .from("projects")
        .insert(payload)
        .select("id")
        .single();
      if (projErr) throw projErr;
      const projectId = (proj as any).id as string;

      // create main job site with address
      const { data: site, error: siteErr } = await supabase
        .from("job_sites")
        .insert({ project_id: projectId, name: name.trim(), is_main_site: true, location: address, full_address: address })
        .select("id")
        .single();
      if (siteErr) throw siteErr;
      const siteId = (site as any).id as string;
      const { error: linkErr } = await supabase
        .from("projects")
        .update({ main_job_site_id: siteId })
        .eq("id", projectId);
      if (linkErr) throw linkErr;

      if (builderId) {
        await (supabase as any)
          .from("project_employer_roles")
          .insert({ project_id: projectId, employer_id: builderId, role: "builder", start_date: new Date().toISOString().split('T')[0] });
      }

      if (jvStatus) {
        await (supabase as any)
          .from("project_builder_jv")
          .upsert({ project_id: projectId, status: jvStatus, label: jvStatus === 'yes' ? (jvLabel || null) : null }, { onConflict: "project_id" });
      }

      return projectId;
    },
    onSuccess: (id) => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["projects-list"] });
      try { window.location.href = `/projects/${id}` } catch {}
      setOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to create project'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="cp_name">Project Name</Label>
            <Input id="cp_name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          </div>
          <div>
            <Label htmlFor="cp_addr">Main Job Site Address</Label>
            <Input id="cp_addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full address" />
          </div>
          <div>
            <Label htmlFor="cp_value">Project Value (AUD)</Label>
            <Input id="cp_value" type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g., 5000000" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label>Proposed Start</Label>
              <DateInput value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Proposed Finish</Label>
              <DateInput value={finish} onChange={(e) => setFinish(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="cp_roe">ROE Email</Label>
            <Input id="cp_roe" type="email" value={roeEmail} onChange={(e) => setRoeEmail(e.target.value)} placeholder="rightofentry@example.com" />
          </div>
          <div>
            <Label>Project Type</Label>
            <Select value={projectType} onValueChange={setProjectType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="government">Government</SelectItem>
                <SelectItem value="private">Private</SelectItem>
                <SelectItem value="mixed">Mixed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cp_state">State funding (AUD)</Label>
              <Input id="cp_state" value={stateFunding} onChange={(e) => setStateFunding(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label htmlFor="cp_fed">Federal funding (AUD)</Label>
              <Input id="cp_fed" value={federalFunding} onChange={(e) => setFederalFunding(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div>
            <Label>Builder (optional)</Label>
            <SingleEmployerDialogPicker value={builderId} onChange={setBuilderId} />
          </div>
          <JVSelector status={jvStatus} label={jvLabel} onChangeStatus={setJvStatus} onChangeLabel={setJvLabel} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={!canSubmit || createMutation.isPending} onClick={() => createMutation.mutate()}>Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
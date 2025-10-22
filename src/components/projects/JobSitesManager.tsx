import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GoogleAddressInput, GoogleAddress, AddressValidationError } from "./GoogleAddressInput";

export default function JobSitesManager({ projectId, projectName, focusSiteId }: { projectId: string; projectName: string; focusSiteId?: string; }) {
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["project-detail", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, main_job_site_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sites = [], isFetching } = useQuery({
    queryKey: ["project-sites", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .select("id, name, location, full_address, is_main_site")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const hasMain = useMemo(() => !!(project?.main_job_site_id || sites.find((s: any) => s.is_main_site)), [project, sites]);

  const createMainMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("job_sites")
        .insert({ project_id: projectId, name: projectName, is_main_site: true, location: projectName })
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as any).id as string;
      const { error: upErr } = await supabase
        .from("projects")
        .update({ main_job_site_id: newId })
        .eq("id", projectId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Main job site created");
      queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const setMainMutation = useMutation({
    mutationFn: async (siteId: string) => {
      // Clear flags then set
      const { error: clearErr } = await supabase
        .from("job_sites")
        .update({ is_main_site: false })
        .eq("project_id", projectId);
      if (clearErr) throw clearErr;
      const { error: setErr } = await supabase
        .from("job_sites")
        .update({ is_main_site: true })
        .eq("id", siteId);
      if (setErr) throw setErr;
      const { error: projErr } = await supabase
        .from("projects")
        .update({ main_job_site_id: siteId })
        .eq("id", projectId);
      if (projErr) throw projErr;
    },
    onSuccess: () => {
      toast.success("Main site updated");
      queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const saveSiteMutation = useMutation({
    mutationFn: async ({ id, name, address }: { id: string; name: string; address?: GoogleAddress }) => {
      const updates: any = { name };
      if (address?.formatted) {
        updates.location = address.formatted;
        updates.full_address = address.formatted;
        // Add coordinates if available for patch matching
        if (address.lat && address.lng) {
          updates.latitude = address.lat;
          updates.longitude = address.lng;
        }
      }
      const { error } = await supabase
        .from("job_sites")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site updated");
      queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteSiteMutation = useMutation({
    mutationFn: async (siteId: string) => {
      // If deleting main, clear project pointer first
      if (project?.main_job_site_id === siteId) {
        const { error: projErr } = await supabase
          .from("projects")
          .update({ main_job_site_id: null })
          .eq("id", projectId);
        if (projErr) throw projErr;
      }
      const { error } = await supabase
        .from("job_sites")
        .delete()
        .eq("id", siteId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site deleted");
      queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const [editStates, setEditStates] = useState<Record<string, { name: string; address?: GoogleAddress }>>({});
  const [newSite, setNewSite] = useState<{ name: string; address?: GoogleAddress }>({ name: "" });

  const addSiteMutation = useMutation({
    mutationFn: async () => {
      if (!newSite.name) throw new Error("Site name is required");
      const payload: any = { project_id: projectId, name: newSite.name, is_main_site: false };
      payload.location = newSite.address?.formatted || newSite.name;
      if (newSite.address?.formatted) {
        payload.full_address = newSite.address.formatted;
        // Add coordinates if available for patch matching
        if (newSite.address.lat && newSite.address.lng) {
          payload.latitude = newSite.address.lat;
          payload.longitude = newSite.address.lng;
        }
      }
      const { error } = await supabase.from("job_sites").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site added");
      setNewSite({ name: "" });
      queryClient.invalidateQueries({ queryKey: ["project-sites", projectId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  useEffect(() => {
    if (!focusSiteId) return;
    const el = document.getElementById(`site-${focusSiteId}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-ring");
      setTimeout(() => el.classList.remove("ring-2", "ring-ring"), 1200);
    }
  }, [focusSiteId, sites]);

  return (
    <div className="space-y-6">
      {!hasMain && (
        <Card>
          <CardHeader>
            <CardTitle>Set up your main job site</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              No main job site found. Create one using the project name and then add the site address.
            </p>
            <Button onClick={() => createMainMutation.mutate()} disabled={createMainMutation.isPending}>
              {createMainMutation.isPending ? "Creating..." : `Create Main Site: ${projectName}`}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Job Sites</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Address</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sites.map((s: any) => {
                const edit = (editStates[s.id] || ({ name: s.name } as { name: string; address?: GoogleAddress }));
                return (
                  <TableRow key={s.id} id={`site-${s.id}`}>
                    <TableCell className="align-top">
                      <div className="space-y-2">
                        <Input
                          value={edit.name}
                          onChange={(e) => setEditStates((prev) => ({ ...prev, [s.id]: { ...edit, name: e.target.value } }))}
                        />
                        {s.is_main_site && <Badge variant="secondary">Main</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="align-top w-[420px]">
                      <GoogleAddressInput
                        value={edit.address?.formatted ?? s.full_address ?? s.location ?? ""}
                        onChange={(addr, error) => {
                          setEditStates((prev) => ({ ...prev, [s.id]: { ...edit, address: addr } }));
                          // If this was selected from Google (has place details and is valid), auto-save immediately
                          if (!error && addr.place_id && typeof addr.lat === 'number' && typeof addr.lng === 'number') {
                            saveSiteMutation.mutate({ id: s.id, name: edit.name, address: addr });
                          }
                        }}
                        requireSelection={false}
                        showLabel={false}
                      />
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-2">
                        <Button size="sm" onClick={() => saveSiteMutation.mutate({ id: s.id, name: edit.name, address: edit.address })}
                          disabled={saveSiteMutation.isPending}>
                          Save
                        </Button>
                        {!s.is_main_site && (
                          <Button size="sm" variant="outline" onClick={() => setMainMutation.mutate(s.id)} disabled={setMainMutation.isPending}>
                            Make Main
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => deleteSiteMutation.mutate(s.id)} disabled={deleteSiteMutation.isPending}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {sites.length === 0 && !isFetching && (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-sm text-muted-foreground">No sites yet.</TableCell>
                </TableRow>
              )}
              <TableRow>
                <TableCell className="align-top">
                  <div className="space-y-2">
                    <Label>New site name</Label>
                    <Input value={newSite.name} onChange={(e) => setNewSite((p) => ({ ...p, name: e.target.value }))} placeholder="e.g., Tower A" />
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <GoogleAddressInput
                    value={newSite.address?.formatted}
                    onChange={(addr, error) => setNewSite((p) => ({ ...p, address: addr }))}
                    requireSelection={false}
                    showLabel={false}
                  />
                </TableCell>
                <TableCell className="align-top">
                  <Button onClick={() => addSiteMutation.mutate()} disabled={addSiteMutation.isPending}>Add Site</Button>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

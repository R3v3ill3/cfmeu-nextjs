import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type SiteContactRole = "project_manager" | "site_manager" | "site_delegate" | "site_hsr";

type Site = { id: string; name: string };

type ContactRow = {
  id?: string;
  job_site_id: string;
  role: SiteContactRole;
  name: string;
  email: string | null;
  phone: string | null;
  _dirty?: boolean;
};

export default function SiteContactsEditor({ projectId, siteIds }: { projectId: string; siteIds: string[] }) {
  const queryClient = useQueryClient();

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["project-sites-for-contacts", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase.from("job_sites").select("id,name").eq("project_id", projectId).order("created_at", { ascending: true });
      if (error) throw error;
      return (data as any[])?.map((s: any) => ({ id: String(s.id), name: String(s.name) })) || [];
    }
  });

  const { data: contacts = [], isFetching } = useQuery<ContactRow[]>({
    queryKey: ["site-contacts", siteIds.join(",")],
    enabled: siteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_contacts")
        .select("id, job_site_id, role, name, email, phone")
        .in("job_site_id", siteIds);
      if (error) throw error;
      return ((data as any[]) || []).map((r: any) => ({
        id: String(r.id),
        job_site_id: String(r.job_site_id),
        role: r.role as SiteContactRole,
        name: r.name as string,
        email: r.email as string | null,
        phone: r.phone as string | null,
      }));
    }
  });

  const [rows, setRows] = useState<ContactRow[]>([]);
  useEffect(() => { setRows(contacts as any); }, [contacts]);

  const roleOptions: Array<{ value: SiteContactRole; label: string }> = useMemo(() => ([
    { value: "project_manager", label: "Project Manager" },
    { value: "site_manager", label: "Site Manager" },
    { value: "site_delegate", label: "Site Delegate" },
    { value: "site_hsr", label: "Site HSR" },
  ]), []);

  const addRow = () => {
    const defaultSite = sites[0]?.id || (siteIds[0] || "");
    setRows([...(rows || []), { job_site_id: defaultSite, role: "project_manager", name: "", email: null, phone: null, _dirty: true }]);
  };

  const updateRow = (idx: number, patch: Partial<ContactRow>) => {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], ...patch, _dirty: true };
    setRows(copy);
  };

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("site_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contact removed");
      queryClient.invalidateQueries({ queryKey: ["site-contacts"] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to remove contact'),
  });

  const saveMutation = useMutation({
    mutationFn: async (row: ContactRow) => {
      if (!row.name?.trim()) throw new Error("Name required");
      if (!row.job_site_id) throw new Error("Site required");
      if (!row.role) throw new Error("Role required");
      if (row.id) {
        const { error } = await supabase
          .from("site_contacts")
          .update({ job_site_id: row.job_site_id, role: row.role, name: row.name.trim(), email: row.email || null, phone: row.phone || null })
          .eq("id", row.id);
        if (error) throw error;
        return row.id;
      } else {
        const { data, error } = await supabase
          .from("site_contacts")
          .insert({ job_site_id: row.job_site_id, role: row.role, name: row.name.trim(), email: row.email || null, phone: row.phone || null })
          .select("id")
          .single();
        if (error) throw error;
        return (data as any).id as string;
      }
    },
    onSuccess: (id) => {
      toast.success("Contact saved");
      queryClient.invalidateQueries({ queryKey: ["site-contacts"] });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, _dirty: false } : r)));
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to save contact'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Site Contacts</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3">
          <Button size="sm" onClick={addRow}><Plus className="h-4 w-4 mr-1" /> Add contact</Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Site</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="w-64">Email</TableHead>
                <TableHead className="w-40">Phone</TableHead>
                <TableHead className="w-28 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(rows || []).map((r, idx) => (
                <TableRow key={r.id || `new-${idx}`}>
                  <TableCell>
                    <Select value={r.job_site_id} onValueChange={(v: string) => updateRow(idx, { job_site_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select site" />
                      </SelectTrigger>
                      <SelectContent>
                        {(sites as any[]).map((s: any) => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={r.role} onValueChange={(v: SiteContactRole) => updateRow(idx, { role: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {roleOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input value={r.name} onChange={(e) => updateRow(idx, { name: e.target.value })} placeholder="Full name" />
                  </TableCell>
                  <TableCell>
                    <Input type="email" value={r.email || ""} onChange={(e) => updateRow(idx, { email: e.target.value || null })} placeholder="Email" />
                  </TableCell>
                  <TableCell>
                    <Input value={r.phone || ""} onChange={(e) => updateRow(idx, { phone: e.target.value || null })} placeholder="Phone" />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={async () => {
                        const id = await saveMutation.mutateAsync(r);
                        setRows((prev) => prev.map((row, i) => i === idx ? { ...row, id, _dirty: false } : row));
                      }} disabled={saveMutation.isPending || !r._dirty}>
                        <Save className="h-4 w-4 mr-1" /> Save
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => {
                        if (r.id) removeMutation.mutate(r.id);
                        setRows((prev) => prev.filter((_, i) => i !== idx));
                      }}>
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(rows || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-sm text-muted-foreground">No contacts yet.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
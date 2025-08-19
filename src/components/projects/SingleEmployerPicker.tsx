
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// import type { Database } from "@/integrations/supabase/types";

type Employer = { id: string; name: string };
type RoleTag = "builder" | "head_contractor";
 type EmployerType = "builder" | "principal_contractor" | "large_contractor" | "small_contractor" | "individual";

export function SingleEmployerPicker({
  label,
  selectedId,
  onChange,
  prioritizedTag,
}: {
  label: string;
  selectedId: string;
  onChange: (id: string) => void;
  prioritizedTag?: RoleTag;
}) {
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [tags, setTags] = useState<Record<string, RoleTag[]>>({});
  const [openAdd, setOpenAdd] = useState(false);
  const [newEmployer, setNewEmployer] = useState<{ name: string; employer_type: EmployerType | "" }>({ name: "", employer_type: "" });
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: emps } = await supabase.from("employers").select("id, name").order("name");
      setEmployers((emps ?? []) as Employer[]);

      const { data: tagRows } = await (supabase as any)
        .from("employer_role_tags")
        .select("employer_id, tag");
      const map: Record<string, RoleTag[]> = {};
      (tagRows ?? []).forEach((r: any) => {
        const arr = map[r.employer_id] ?? [];
        if (!arr.includes(r.tag)) arr.push(r.tag);
        map[r.employer_id] = arr;
      });
      setTags(map);
    };
    load();
  }, []);

  const sorted = useMemo(() => {
    const list = [...employers];
    if (!prioritizedTag) return list.sort((a, b) => a.name.localeCompare(b.name));
    return list.sort((a, b) => {
      const aHas = (tags[a.id] ?? []).includes(prioritizedTag);
      const bHas = (tags[b.id] ?? []).includes(prioritizedTag);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [employers, tags, prioritizedTag]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((e) => e.name.toLowerCase().includes(q));
  }, [sorted, search]);

  const createEmployer = async () => {
    if (!newEmployer.name || !newEmployer.employer_type) return;
    const { data, error } = await supabase
      .from("employers")
      .insert({
        name: newEmployer.name,
        employer_type: newEmployer.employer_type,
      })
      .select("id, name")
      .single();
    if (!error && data) {
      const emp = data as Employer;
      setEmployers((prev) => [...prev, emp]);
      onChange(emp.id);
      setOpenAdd(false);
      setNewEmployer({ name: "", employer_type: "" });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        placeholder="Search employers..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex gap-2">
        <Select value={selectedId} onValueChange={onChange}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select employer" />
          </SelectTrigger>
          <SelectContent>
            {filtered.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setOpenAdd(true)}>
          Add
        </Button>
      </div>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add employer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="ne_name">Employer name</Label>
              <Input
                id="ne_name"
                value={newEmployer.name}
                onChange={(e) => setNewEmployer((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="ne_type">Employer type</Label>
              <Select
                value={newEmployer.employer_type}
                onValueChange={(v: string) => setNewEmployer((p) => ({ ...p, employer_type: v as EmployerType }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select employer type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">Builder</SelectItem>
                  <SelectItem value="principal_contractor">Principal Contractor</SelectItem>
                  <SelectItem value="large_contractor">Large Contractor</SelectItem>
                  <SelectItem value="small_contractor">Small Contractor</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={createEmployer}>Create and select</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

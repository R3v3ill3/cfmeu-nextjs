
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
// import type { Database } from "@/integrations/supabase/types";

type Employer = { id: string; name: string };
type RoleTag = "builder" | "head_contractor";
 type EmployerType = "builder" | "principal_contractor" | "large_contractor" | "small_contractor" | "individual";

export function MultiEmployerPicker({
  label,
  selectedIds,
  onChange,
  prioritizedTag,
  triggerText = "Add",
}: {
  label: string;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  prioritizedTag?: RoleTag;
  triggerText?: string;
}) {
  const [open, setOpen] = useState(false);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [tags, setTags] = useState<Record<string, RoleTag[]>>({});
  const [search, setSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newEmployer, setNewEmployer] = useState<{ name: string; employer_type: EmployerType | "" }>({ name: "", employer_type: "" });

  useEffect(() => {
    const load = async () => {
      const { data: emps, error } = await supabase.from("employers").select("id, name").order("name", { ascending: true });
      if (!error && emps) setEmployers(emps as Employer[]);

      // Query employer_capabilities for contractor roles
      const { data: capRows } = await (supabase as any)
        .from("employer_capabilities")
        .select("employer_id, contractor_role_types!inner(code)")
        .eq("capability_type", "contractor_role")
        .in("contractor_role_types.code", ["builder", "head_contractor"]);
      
      const map: Record<string, RoleTag[]> = {};
      (capRows ?? []).forEach((r: any) => {
        const tag = r.contractor_role_types.code as RoleTag;
        const arr = map[r.employer_id] ?? [];
        if (!arr.includes(tag)) arr.push(tag);
        map[r.employer_id] = arr;
      });
      setTags(map);
    };
    load();
  }, []);

  const prioritized = useMemo(() => {
    const list = [...employers];
    if (!prioritizedTag) return list;
    return list.sort((a, b) => {
      const aHas = (tags[a.id] ?? []).includes(prioritizedTag);
      const bHas = (tags[b.id] ?? []).includes(prioritizedTag);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [employers, tags, prioritizedTag]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return prioritized;
    return prioritized.filter((e) => e.name.toLowerCase().includes(s));
  }, [prioritized, search]);

  const selectedEmployers = selectedIds
    .map((id) => employers.find((e) => e.id === id))
    .filter(Boolean) as Employer[];

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

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
      setEmployers((prev) => [...prev, data as Employer]);
      onChange([...selectedIds, (data as Employer).id]);
      setShowQuickAdd(false);
      setNewEmployer({ name: "", employer_type: "" });
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap gap-2">
        {selectedEmployers.map((e) => (
          <Badge key={e.id} variant="secondary" className="flex items-center gap-1">
            {e.name}
            <button onClick={() => toggleSelect(e.id)} aria-label="Remove" className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              {triggerText}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Select employers</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employers..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="max-h-72 overflow-auto rounded border p-2 space-y-1">
                {filtered.map((e) => {
                  const isSelected = selectedIds.includes(e.id);
                  const highlight =
                    prioritizedTag && (tags[e.id] ?? []).includes(prioritizedTag);
                  return (
                    <button
                      key={e.id}
                      onClick={() => toggleSelect(e.id)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-accent transition ${
                        isSelected ? "bg-accent" : ""
                      } ${highlight ? "font-semibold" : ""}`}
                    >
                      {e.name} {highlight ? <span className="text-muted-foreground">(prioritised)</span> : null}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">
                    No employers match your search.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button onClick={() => setOpen(false)} className="flex-1">
                  Done
                </Button>
                <Button variant="outline" onClick={() => setShowQuickAdd((v) => !v)}>
                  {showQuickAdd ? "Cancel" : "Add employer"}
                </Button>
              </div>

              {showQuickAdd && (
                <div className="rounded border p-3 space-y-3">
                  <div>
                    <Label htmlFor="new_emp_name">Employer name</Label>
                    <Input
                      id="new_emp_name"
                      value={newEmployer.name}
                      onChange={(e) => setNewEmployer((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., ABC Construction Pty Ltd"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_emp_type">Employer type</Label>
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
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

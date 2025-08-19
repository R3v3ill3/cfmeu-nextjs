
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

// Single selection dialog picker matching the MultiEmployerPicker UX
// Shows a trigger button that opens a dialog with a search bar and a list of employers
// Allows quick-add of a new employer inline

type Employer = { id: string; name: string };
type RoleTag = "builder" | "head_contractor";
type EmployerType = "builder" | "principal_contractor" | "large_contractor" | "small_contractor" | "individual";

export function SingleEmployerDialogPicker({
  label,
  selectedId,
  onChange,
  prioritizedTag,
  triggerText = "Add",
}: {
  label: string;
  selectedId: string;
  onChange: (id: string) => void;
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

  const prioritized = useMemo(() => {
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
    const s = search.trim().toLowerCase();
    if (!s) return prioritized;
    return prioritized.filter((e) => e.name.toLowerCase().includes(s));
  }, [prioritized, search]);

  const selectedEmployer = employers.find((e) => e.id === selectedId) || null;

  const handlePick = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  const createEmployer = async () => {
    if (!newEmployer.name || !newEmployer.employer_type) return;
    const { data, error } = await supabase
      .from("employers")
      .insert({ name: newEmployer.name, employer_type: newEmployer.employer_type })
      .select("id, name")
      .single();
    if (!error && data) {
      const emp = data as Employer;
      setEmployers((prev) => [...prev, emp]);
      onChange(emp.id);
      setShowQuickAdd(false);
      setNewEmployer({ name: "", employer_type: "" });
      setOpen(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-2">
        {selectedEmployer ? (
          <Badge variant="secondary" className="flex items-center gap-1">
            {selectedEmployer.name}
            <button onClick={() => onChange("")} aria-label="Clear" className="ml-1 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ) : null}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              {triggerText}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Select employer</DialogTitle>
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
                  const highlight = prioritizedTag && (tags[e.id] ?? []).includes(prioritizedTag);
                  return (
                    <button
                      key={e.id}
                      onClick={() => handlePick(e.id)}
                      className={`w-full text-left px-3 py-2 rounded hover:bg-accent transition ${highlight ? "font-semibold" : ""}`}
                    >
                      {e.name} {highlight ? <span className="text-muted-foreground">(prioritised)</span> : null}
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">No employers match your search.</div>
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
                    <Label htmlFor="new_emp_name_se">Employer name</Label>
                    <Input
                      id="new_emp_name_se"
                      value={newEmployer.name}
                      onChange={(e) => setNewEmployer((p) => ({ ...p, name: e.target.value }))}
                      placeholder="e.g., ABC Construction Pty Ltd"
                    />
                  </div>
                  <div>
                    <Label htmlFor="new_emp_type_se">Employer type</Label>
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

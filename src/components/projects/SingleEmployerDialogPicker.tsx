
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { normalizeEmployerName } from "@/lib/employers/normalize";
import { useAliasTelemetry } from "@/hooks/useAliasTelemetry";
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
  hideLabel = false,
  compactTrigger = false,
}: {
  label: string;
  selectedId: string;
  onChange: (id: string) => void;
  prioritizedTag?: RoleTag;
  triggerText?: string;
  hideLabel?: boolean;
  compactTrigger?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [tags, setTags] = useState<Record<string, RoleTag[]>>({});
  const [search, setSearch] = useState("");
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [newEmployer, setNewEmployer] = useState<{ name: string; employer_type: EmployerType | "" }>({ name: "", employer_type: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actorId, setActorId] = useState<string | null>(null);
  const aliasTelemetry = useAliasTelemetry({ scope: "manual_single_employer_dialog_picker", actorId });

  useEffect(() => {
    const load = async () => {
      const { data: emps } = await supabase.from("employers").select("id, name").order("name");
      setEmployers((emps ?? []) as Employer[]);

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

  useEffect(() => {
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setActorId(data.user?.id ?? null);
      })
      .catch(() => {
        setActorId(null);
      });
  }, []);

  const persistAlias = useCallback(
    async (employerId: string, alias: string) => {
      const normalized = normalizeEmployerName(alias);
      const collectedAt = new Date().toISOString();
      const collectedBy = actorId;
      const notes = "Created via SingleEmployerDialogPicker";

      const insertPayload = {
        alias,
        alias_normalized: normalized.normalized,
        employer_id: employerId,
        source_system: "manual_single_employer_dialog_picker",
        source_identifier: employerId,
        collected_at: collectedAt,
        collected_by: collectedBy,
        is_authoritative: false,
        notes,
      } as const;

      const { error: aliasError } = await supabase
        .from("employer_aliases")
        .upsert(insertPayload, { onConflict: "employer_id,alias_normalized" });

      if (aliasError) {
        aliasTelemetry.logFailure({
          employerId,
          alias,
          normalized: normalized.normalized,
          sourceSystem: "manual_single_employer_dialog_picker",
          sourceIdentifier: employerId,
          projectId: null,
          csvRole: null,
          collectedBy,
          notes,
          error: new Error(aliasError.message),
        });
        toast({
          title: "Alias not saved",
          description: aliasError.message,
          variant: "destructive",
        });
        return;
      }

      aliasTelemetry.logInsert({
        employerId,
        alias,
        normalized: normalized.normalized,
        sourceSystem: "manual_single_employer_dialog_picker",
        sourceIdentifier: employerId,
        projectId: null,
        csvRole: null,
        collectedBy,
        notes,
      });

      const { data: conflicts, error: conflictError } = await supabase
        .from("employer_aliases")
        .select("employer_id, employer:employer_id ( name )")
        .eq("alias_normalized", normalized.normalized)
        .neq("employer_id", employerId);

      if (conflictError) {
        aliasTelemetry.logFailure({
          employerId,
          alias,
          normalized: normalized.normalized,
          sourceSystem: "manual_single_employer_dialog_picker",
          sourceIdentifier: employerId,
          projectId: null,
          csvRole: null,
          collectedBy,
          notes,
          error: new Error(conflictError.message),
        });
        toast({
          title: "Alias check failed",
          description: conflictError.message,
          variant: "destructive",
        });
        return;
      }

      if (conflicts && conflicts.length > 0) {
        aliasTelemetry.logConflict({
          employerId,
          alias,
          normalized: normalized.normalized,
          sourceSystem: "manual_single_employer_dialog_picker",
          sourceIdentifier: employerId,
          projectId: null,
          csvRole: null,
          collectedBy,
          notes,
          conflictReason: "Alias already exists for other employers",
          conflictingEmployers: conflicts.map((conflict) => ({
            employerId: conflict.employer_id,
            employerName: (conflict as any).employer?.name ?? null,
          })),
        });

        const names = conflicts
          .map((conflict) => (conflict as any).employer?.name)
          .filter(Boolean)
          .join(", ");

        toast({
          title: "Alias already recorded",
          description: names
            ? `${alias} is already associated with ${names}. Consider reviewing duplicates.`
            : `${alias} is already associated with another employer.`,
          variant: "destructive",
        });
      }
    },
    [actorId, aliasTelemetry, toast]
  );

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
    
    try {
      const { data, error } = await supabase
        .from("employers")
        .insert({ name: newEmployer.name, employer_type: newEmployer.employer_type })
        .select("id, name")
        .single();
      
      if (error) {
        console.error("Error creating employer:", error);
        alert(`Failed to create employer: ${error.message}`);
        return;
      }
      
      if (data) {
        const emp = data as Employer;
        setEmployers((prev) => [...prev, emp]);
        onChange(emp.id);
        setShowQuickAdd(false);
        setNewEmployer({ name: "", employer_type: "" });
        setOpen(false);
        
        // Invalidate employer-related queries to refresh lists across the app
        queryClient.invalidateQueries({ queryKey: ['employers-server-side'] });
        queryClient.invalidateQueries({ queryKey: ['employers'] });
        queryClient.invalidateQueries({ queryKey: ['employers-list'] });
        
        // Force a materialized view refresh for new employers
        try {
          await fetch('/api/admin/refresh-views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scope: 'employers' })
          });
          console.log("Materialized view refresh triggered");
        } catch (err) {
          console.warn("Could not trigger view refresh:", err);
        }
        
        console.log("Employer created successfully:", emp);

        await persistAlias(emp.id, newEmployer.name);
      }
    } catch (err: any) {
      console.error("Unexpected error creating employer:", err);
      alert(`Unexpected error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-2">
      {!hideLabel && <Label>{label}</Label>}
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
            <Button size={compactTrigger ? "xs" as any : "sm"} variant="outline">
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

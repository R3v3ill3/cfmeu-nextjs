
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { normalizeEmployerName } from "@/lib/employers/normalize";
import { useAliasTelemetry } from "@/hooks/useAliasTelemetry";
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
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [actorId, setActorId] = useState<string | null>(null);
  const aliasTelemetry = useAliasTelemetry({ scope: "manual_single_employer_picker", actorId });

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
      const supabaseClient = supabase;
      const normalized = normalizeEmployerName(alias);
      const collectedBy = actorId;
      const collectedAt = new Date().toISOString();
      const notes = "Created via SingleEmployerPicker";

      const insertPayload = {
        alias,
        alias_normalized: normalized.normalized,
        employer_id: employerId,
        source_system: "manual_single_employer_picker",
        source_identifier: employerId,
        collected_at: collectedAt,
        collected_by: collectedBy,
        is_authoritative: true,
        notes,
      } as const;

      const { error: aliasError } = await supabaseClient
        .from("employer_aliases")
        .upsert(insertPayload, { onConflict: "employer_id,alias_normalized" });

      if (aliasError) {
        aliasTelemetry.logFailure({
          employerId,
          alias,
          normalized: normalized.normalized,
          sourceSystem: "manual_single_employer_picker",
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
        sourceSystem: "manual_single_employer_picker",
        sourceIdentifier: employerId,
        projectId: null,
        csvRole: null,
        collectedBy,
        notes,
      });

      const { data: conflicts, error: conflictError } = await supabaseClient
        .from("employer_aliases")
        .select("employer_id, employer:employer_id ( name )")
        .eq("alias_normalized", normalized.normalized)
        .neq("employer_id", employerId);

      if (conflictError) {
        aliasTelemetry.logFailure({
          employerId,
          alias,
          normalized: normalized.normalized,
          sourceSystem: "manual_single_employer_picker",
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
          sourceSystem: "manual_single_employer_picker",
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
    
    try {
      const { data, error } = await supabase
        .from("employers")
        .insert({
          name: newEmployer.name,
          employer_type: newEmployer.employer_type,
        })
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
        setOpenAdd(false);
        setNewEmployer({ name: "", employer_type: "" });
        
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
        } catch (err) {
          console.warn("Could not trigger view refresh:", err);
        }

        await persistAlias(emp.id, newEmployer.name);
      }
    } catch (err: any) {
      console.error("Unexpected error creating employer:", err);
      alert(`Unexpected error: ${err.message}`);
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

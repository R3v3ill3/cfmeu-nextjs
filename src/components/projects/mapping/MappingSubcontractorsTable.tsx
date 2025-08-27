"use client"

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type Stage = "early_works" | "structure" | "finishing" | "other";

const TRADES: Record<Stage, Array<{ value: string; label: string }>> = {
  early_works: [
    { value: "demolition", label: "Demo" },
    { value: "piling", label: "Piling" },
    { value: "excavations", label: "Excavations" },
    { value: "scaffolding", label: "Scaffold" },
    { value: "cleaning", label: "Cleaners" },
    { value: "traffic_control", label: "Traffic Control" },
    { value: "labour_hire", label: "Labour Hire" },
  ],
  structure: [
    { value: "steel_fixing", label: "Steel fixer" },
    { value: "tower_crane", label: "Tower Crane" },
    { value: "concreting", label: "Concreters" },
    { value: "post_tensioning", label: "Stressor" },
    { value: "form_work", label: "Formwork" },
    { value: "steel_fixing_dup", label: "Steel Fixers" },
    { value: "bricklaying", label: "Bricklayer" },
    { value: "structural_steel", label: "Structural Steel" },
  ],
  finishing: [
    { value: "facade", label: "Facade" },
    { value: "carpentry", label: "Carpenter" },
    { value: "plastering", label: "Plasterer" },
    { value: "painting", label: "Painters" },
    { value: "tiling", label: "Tiling" },
    { value: "kitchens", label: "Kitchens" },
    { value: "flooring", label: "Flooring" },
    { value: "landscaping", label: "Landscaping" },
    { value: "final_clean", label: "Final Clean" },
  ],
  other: [],
};

type Row = {
  key: string; // stage|trade value
  stage: Stage;
  trade_value: string;
  trade_label: string;
  employer_id: string | null;
  employer_name: string | null;
  eba: boolean | null;
  id?: string; // project_contractor_trades row id if exists
};

function scaffoldRows(): Row[] {
  const rows: Row[] = [];
  (Object.keys(TRADES) as Stage[]).forEach((st) => {
    TRADES[st].forEach((t) => {
      rows.push({ key: `${st}|${t.value}`, stage: st, trade_value: t.value, trade_label: t.label, employer_id: null, employer_name: null, eba: null });
    });
  });
  return rows;
}

export function MappingSubcontractorsTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>(scaffoldRows());
  const [otherRows, setOtherRows] = useState<Row[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("project_contractor_trades")
        .select("id, employer_id, stage, trade_type, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);
      const byKey = new Map<string, Row>();
      scaffoldRows().forEach((r) => byKey.set(r.key, { ...r }));
      (data || []).forEach((r: any) => {
        const st = (r.stage as Stage) || ("other" as Stage);
        const key = `${st}|${String(r.trade_type)}`;
        const base = byKey.get(key);
        const eba = r.employers?.enterprise_agreement_status ?? null;
        if (base) {
          base.id = r.id as string;
          base.employer_id = r.employer_id as string;
          base.employer_name = r.employers?.name || r.employer_id;
          base.eba = eba;
        } else {
          // Treat as other/custom trade
          byKey.set(key, {
            key,
            stage: st,
            trade_value: String(r.trade_type),
            trade_label: String(r.trade_type),
            id: r.id as string,
            employer_id: r.employer_id as string,
            employer_name: r.employers?.name || r.employer_id,
            eba,
          });
        }
      });
      const merged = Array.from(byKey.values());
      const std = merged.filter((r) => TRADES[r.stage]?.some((t) => t.value === r.trade_value));
      const others = merged.filter((r) => !(TRADES[r.stage]?.some((t) => t.value === r.trade_value)) || r.stage === "other");
      setRows(std);
      setOtherRows(others);
    };
    load();
  }, [projectId]);

  const upsertRow = async (r: Row) => {
    try {
      if (!r.employer_id) return;
      const payload: any = {
        project_id: projectId,
        employer_id: r.employer_id,
        stage: r.stage,
        trade_type: r.trade_value,
      };
      if (r.id) {
        const { error } = await (supabase as any).from("project_contractor_trades").update(payload).eq("id", r.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("project_contractor_trades")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        r.id = (data as any).id as string;
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to save contractor row");
    }
  };

  const setEmployer = (key: string, employerId: string, employerName: string) => {
    const list = [...rows, ...otherRows];
    const idx = list.findIndex((x) => x.key === key);
    const row = { ...list[idx], employer_id: employerId, employer_name: employerName } as Row;
    list[idx] = row;
    const std = list.filter((r) => TRADES[r.stage]?.some((t) => t.value === r.trade_value));
    const others = list.filter((r) => !(TRADES[r.stage]?.some((t) => t.value === r.trade_value)) || r.stage === "other");
    setRows(std);
    setOtherRows(others);
    upsertRow(row);
  };

  const setEba = async (row: Row, val: boolean | null) => {
    try {
      const eid = row.employer_id;
      if (!eid) return;
      const { error } = await supabase.from("employers").update({ enterprise_agreement_status: val }).eq("id", eid);
      if (error) throw error;
      const list = [...rows, ...otherRows].map((r) => (r.key === row.key ? { ...r, eba: val } : r));
      const std = list.filter((r) => TRADES[r.stage]?.some((t) => t.value === r.trade_value));
      const others = list.filter((r) => !(TRADES[r.stage]?.some((t) => t.value === r.trade_value)) || r.stage === "other");
      setRows(std);
      setOtherRows(others);
    } catch (e: any) {
      toast.error(e?.message || "Failed to update EBA status");
    }
  };

  const addOther = () => {
    const value = `other_${Date.now()}`;
    const key = `other|${value}`;
    setOtherRows([ ...otherRows, { key, stage: "other", trade_value: value, trade_label: "Other", employer_id: null, employer_name: null, eba: null } ]);
  };

  const ebaSelect = (row: Row) => (
    <Select value={row.eba === null ? "unknown" : row.eba ? "yes" : "no"} onValueChange={(v) => setEba(row, v === "unknown" ? null : v === "yes") }>
      <SelectTrigger>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">Yes</SelectItem>
        <SelectItem value="no">No</SelectItem>
        <SelectItem value="unknown">Unknown</SelectItem>
      </SelectContent>
    </Select>
  );

  const companyCell = (row: Row) => (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate">{row.employer_name || "—"}</span>
      <SingleEmployerDialogPicker
        label="Company"
        selectedId={row.employer_id || ""}
        onChange={(id: string) => {
          // fetch name
          supabase.from("employers").select("id,name").eq("id", id).maybeSingle().then(({ data }) => {
            const name = (data as any)?.name || id;
            setEmployer(row.key, id, name);
          });
        }}
        triggerText={row.employer_id ? "Change" : "Select"}
      />
    </div>
  );

  const renderSection = (title: string, list: Row[]) => (
    <>
      <tr><td colSpan={4} className="font-semibold pt-3">{title}</td></tr>
      {list.map((r) => (
        <TableRow key={r.key}>
          <TableCell className="w-40 capitalize">{r.stage === "other" ? "Other" : r.stage.replace("_", " ")}</TableCell>
          <TableCell className="w-56">{r.trade_label}</TableCell>
          <TableCell>{companyCell(r)}</TableCell>
          <TableCell className="w-40">{ebaSelect(r)}</TableCell>
        </TableRow>
      ))}
    </>
  );

  const byStage = useMemo(() => {
    const group: Record<Stage, Row[]> = { early_works: [], structure: [], finishing: [], other: [] };
    rows.forEach((r) => group[r.stage].push(r));
    return group;
  }, [rows]);

  return (
    <div className="mt-6">
      <div className="font-semibold mb-2 uppercase tracking-wide text-sm">Subcontractors</div>
      <div className="overflow-x-auto">
        <Table className="print-table print-border">
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">Stage</TableHead>
              <TableHead className="w-56">Trade</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="w-40">EBA (Y/N)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {renderSection("Early works", byStage.early_works)}
            {renderSection("Structure", byStage.structure)}
            {renderSection("Finishing", byStage.finishing)}
            {otherRows.length > 0 && renderSection("Other", otherRows)}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="outline" onClick={addOther}>Add Other</Button>
      </div>
    </div>
  );
}


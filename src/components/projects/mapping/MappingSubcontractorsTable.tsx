"use client"

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { toast } from "sonner";
import { TRADE_OPTIONS } from "@/constants/trades";

type Stage = "early_works" | "structure" | "finishing" | "other";

// Fallback stage for known trades when no historical data exists
const FALLBACK_STAGE_BY_TRADE: Record<string, Stage> = {
  demolition: "early_works",
  piling: "early_works",
  excavations: "early_works",
  scaffolding: "early_works",
  cleaning: "early_works",
  traffic_control: "early_works",
  labour_hire: "early_works",
  steel_fixing: "structure",
  tower_crane: "structure",
  concreting: "structure",
  post_tensioning: "structure",
  form_work: "structure",
  bricklaying: "structure",
  structural_steel: "structure",
  facade: "finishing",
  carpentry: "finishing",
  plastering: "finishing",
  painting: "finishing",
  tiling: "finishing",
  kitchens: "finishing",
  flooring: "finishing",
  landscaping: "finishing",
  final_clean: "finishing",
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

function startCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MappingSubcontractorsTable({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [otherRows, setOtherRows] = useState<Row[]>([]);
  const [allowedTradeValues, setAllowedTradeValues] = useState<Set<string>>(new Set());
  const [labelByTrade, setLabelByTrade] = useState<Record<string, string>>({});
  const [stageByTrade, setStageByTrade] = useState<Record<string, Stage>>({});

  useEffect(() => {
    const load = async () => {
      // 1) Load enum values via RPC and build labels
      const { data: enumVals } = await (supabase as any).rpc("get_trade_type_enum");
      const enums: string[] = (enumVals ?? []).map((v: any) => String(v));
      const allowedSet = new Set(enums);
      const labelsMap: Record<string, string> = {};
      const tradeOptionsMap: Record<string, string> = {};
      TRADE_OPTIONS.forEach((t) => { tradeOptionsMap[t.value] = t.label; });
      enums.forEach((v) => { labelsMap[v] = tradeOptionsMap[v] || startCase(v); });
      setAllowedTradeValues(allowedSet);
      setLabelByTrade(labelsMap);

      // 2) Build stage-by-trade from existing assignments on this project (project and sites)
      const { data: pct } = await (supabase as any)
        .from("project_contractor_trades")
        .select("stage, trade_type")
        .eq("project_id", projectId);

      const { data: sites } = await (supabase as any)
        .from("job_sites")
        .select("id")
        .eq("project_id", projectId);
      const siteIds = ((sites as any[]) || []).map((s: any) => s.id);
      let sct: any[] = [];
      if (siteIds.length > 0) {
        const res = await (supabase as any)
          .from("site_contractor_trades")
          .select("stage, trade_type")
          .in("job_site_id", siteIds);
        sct = (res.data as any[]) || [];
      }

      const counts: Record<string, Record<Stage, number>> = {};
      const bump = (t: string, st?: string | null) => {
        const stage = (st as Stage) || null;
        const map = counts[t] || { early_works: 0, structure: 0, finishing: 0, other: 0 };
        if (stage && ["early_works","structure","finishing","other"].includes(stage)) {
          map[stage as Stage] += 1;
        }
        counts[t] = map;
      };
      (pct || []).forEach((r: any) => bump(String(r.trade_type), r.stage));
      (sct || []).forEach((r: any) => bump(String(r.trade_type), r.stage));

      const stageMap: Record<string, Stage> = {};
      enums.forEach((t) => {
        const c = counts[t] || { early_works: 0, structure: 0, finishing: 0, other: 0 };
        const sorted = (Object.keys(c) as Stage[]).sort((a, b) => c[b] - c[a]);
        const top = sorted[0];
        stageMap[t] = (c[top] > 0 ? top : (FALLBACK_STAGE_BY_TRADE[t] ?? "other"));
      });
      setStageByTrade(stageMap);

      // 3) Now load full project rows with employer data
      const { data } = await (supabase as any)
        .from("project_contractor_trades")
        .select("id, employer_id, stage, trade_type, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      // Start with a scaffold of all enum trades
      const byKey = new Map<string, Row>();
      enums.forEach((t) => {
        const st = stageMap[t] || "other";
        const label = labelsMap[t] || startCase(t);
        const key = `${st}|${t}`;
        byKey.set(key, { key, stage: st, trade_value: t, trade_label: label, employer_id: null, employer_name: null, eba: null });
      });

      // Overlay existing project assignments
      (data || []).forEach((r: any) => {
        const t = String(r.trade_type);
        const displayStage: Stage = stageMap[t] || (r.stage as Stage) || "other";
        const key = `${displayStage}|${t}`;
        const base = byKey.get(key);
        const eba = r.employers?.enterprise_agreement_status ?? null;
        if (base) {
          base.id = r.id as string;
          base.employer_id = r.employer_id as string;
          base.employer_name = r.employers?.name || r.employer_id;
          base.eba = eba;
        } else {
          // Unknown trade or stage combo; add to others
          byKey.set(key, {
            key,
            stage: displayStage,
            trade_value: t,
            trade_label: labelsMap[t] || t,
            id: r.id as string,
            employer_id: r.employer_id as string,
            employer_name: r.employers?.name || r.employer_id,
            eba,
          });
        }
      });

      const merged = Array.from(byKey.values());
      const std = merged.filter((r) => allowedSet.has(r.trade_value) && r.stage !== "other");
      const others = merged.filter((r) => r.stage === "other" || !allowedSet.has(r.trade_value));
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
    const std = list.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
    const others = list.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
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
      const std = list.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
      const others = list.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
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
      <SingleEmployerDialogPicker
        label=""
        selectedId={row.employer_id || ""}
        onChange={(id: string) => {
          if (!id) {
            setEmployer(row.key, "", "");
            return;
          }
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
      <tr><td colSpan={3} className="font-semibold pt-3">{title}</td></tr>
      {list.map((r) => (
        <TableRow key={r.key}>
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


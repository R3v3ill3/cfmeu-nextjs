"use client"

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { toast } from "sonner";
import { TRADE_OPTIONS } from "@/constants/trades";
import { ManageTradeCompanyDialog } from "@/components/projects/mapping/ManageTradeCompanyDialog";
import { AddEmployerToTradeDialog } from "@/components/projects/mapping/AddEmployerToTradeDialog";

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
  isSkeleton?: boolean; // true for the base scaffold row per trade
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
  const [manageOpen, setManageOpen] = useState(false);
  const [manageMode, setManageMode] = useState<"existing" | "empty">("empty");
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ stage: Stage; trade_value: string; trade_label: string; action: "replace" | "add_new" }>({ stage: "other", trade_value: "", trade_label: "", action: "replace" });

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

      // Build arrays instead of a single row per trade to support multiples
      const scaffold: Row[] = [];
      enums.forEach((t) => {
        const st = stageMap[t] || "other";
        const label = labelsMap[t] || startCase(t);
        const key = `${st}|${t}|base`;
        scaffold.push({ key, isSkeleton: true, stage: st, trade_value: t, trade_label: label, employer_id: null, employer_name: null, eba: null });
      });

      const stdRows: Row[] = [...scaffold];
      const unknownOrOther: Row[] = [];

      (data || []).forEach((r: any) => {
        const t = String(r.trade_type);
        const persistedStage: Stage = (r.stage as Stage) || (stageMap[t] as Stage) || "other";
        const eba = r.employers?.enterprise_agreement_status ?? null;

        if (allowedSet.has(t) && persistedStage !== "other") {
          // Try to fill an empty skeleton row first; otherwise add a new row
          const firstIndex = stdRows.findIndex((row) => row.trade_value === t && row.isSkeleton && row.employer_id === null);
          if (firstIndex >= 0) {
            stdRows[firstIndex] = {
              ...stdRows[firstIndex],
              id: r.id as string,
              stage: persistedStage,
              employer_id: r.employer_id as string,
              employer_name: r.employers?.name || r.employer_id,
              eba,
            };
          } else {
            stdRows.push({
              key: `${persistedStage}|${t}|${r.id}`,
              isSkeleton: false,
              stage: persistedStage,
              trade_value: t,
              trade_label: labelsMap[t] || t,
              id: r.id as string,
              employer_id: r.employer_id as string,
              employer_name: r.employers?.name || r.employer_id,
              eba,
            });
          }
        } else {
          // Unknown trade or stage other
          unknownOrOther.push({
            key: `${persistedStage}|${t}|${r.id}`,
            isSkeleton: false,
            stage: persistedStage,
            trade_value: t,
            trade_label: labelsMap[t] || t,
            id: r.id as string,
            employer_id: r.employer_id as string,
            employer_name: r.employers?.name || r.employer_id,
            eba,
          });
        }
      });

      setRows(stdRows);
      setOtherRows(unknownOrOther);
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

  const setEmployer = async (key: string, employerId: string, employerName: string) => {
    let list = [...rows, ...otherRows];
    const idx = list.findIndex((x) => x.key === key);
    if (idx < 0) return;
    const current = list[idx];

    if (!employerId) {
      // Clearing company: delete mapping if persisted and row is not a pure skeleton; otherwise clear fields only
      try {
        if (current.id) {
          await (supabase as any).from("project_contractor_trades").delete().eq("id", current.id);
        }
      } catch (e: any) {
        toast.error(e?.message || "Failed to remove contractor mapping");
      }

      if (current.isSkeleton) {
        list[idx] = { ...current, id: undefined, employer_id: null, employer_name: null, eba: null };
      } else {
        list.splice(idx, 1);
      }
    } else {
      // Selecting or changing company: persist
      const updated: Row = { ...current, employer_id: employerId, employer_name: employerName };
      list[idx] = updated;
      await upsertRow(updated);
      // After upsert, try to fetch EBA status
      try {
        const { data: e } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle();
        list[idx] = { ...updated, eba: ((e as any)?.enterprise_agreement_status ?? null) as boolean | null };
      } catch {}
    }

    const std = list.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
    const others = list.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
    setRows(std);
    setOtherRows(others);
  };

  const setEmployerWithOptionalStage = async (key: string, employerId: string, employerName: string, maybeStage?: Stage) => {
    let list = [...rows, ...otherRows];
    const idx = list.findIndex((x) => x.key === key);
    if (idx < 0) return;
    const current = list[idx];
    if (!employerId) {
      // Delegate to base clearing logic
      return await setEmployer(key, "", "");
    }
    const updated: Row = { ...current, employer_id: employerId, employer_name: employerName, stage: maybeStage || current.stage };
    list[idx] = updated;
    await upsertRow(updated);
    try {
      const { data: e } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle();
      list[idx] = { ...updated, eba: ((e as any)?.enterprise_agreement_status ?? null) as boolean | null };
    } catch {}
    const std = list.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
    const others = list.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
    setRows(std);
    setOtherRows(others);
  };

  // Stage selection is now handled within AddEmployerToTradeDialog when adding/replacing

  const addOther = () => {
    const trade_value = `other_${Date.now()}`;
    const trade_label = "Other";
    setActiveRow(null);
    setAddDefaults({ stage: "other", trade_value, trade_label, action: "add_new" });
    setAddOpen(true);
  };

  const ebaCell = (row: Row) => {
    if (!row.employer_id) return <span className="text-muted-foreground">—</span>;
    const text = row.eba === null ? "Unknown" : row.eba ? "Yes" : "No";
    return (
      <button
        className="underline text-left"
        onClick={() => { try { window.location.href = `/employers/${row.employer_id}` } catch {} }}
        title="Open employer to edit EBA status"
      >
        {text}
      </button>
    );
  };

  const companyCell = (row: Row) => (
    <div className="flex items-center justify-between gap-2">
      <div className="font-medium text-base truncate">
        {row.employer_name || <span className="text-muted-foreground">—</span>}
      </div>
      <div className="shrink-0">
        <Button size="sm" variant="outline" onClick={() => { setActiveRow(row); setManageMode(row.employer_id ? "existing" : "empty"); setManageOpen(true); }}>
          Manage
        </Button>
      </div>
    </div>
  );

  const addAdditionalRow = (row: Row) => {
    setActiveRow(row);
    setAddDefaults({ stage: row.stage, trade_value: row.trade_value, trade_label: row.trade_label, action: "add_new" });
    setAddOpen(true);
  };

  // Stage selector removed from inline table rows

  const renderSection = (title: string, list: Row[]) => (
    <>
      <tr><td colSpan={3} className="font-semibold pt-3">{title}</td></tr>
      {list.map((r) => (
        <TableRow key={r.key}>
          <TableCell className={"w-56 " + (r.employer_id ? "bg-muted/20" : "")}>
            <div className="flex items-center justify-between gap-2">
              <div>{r.trade_label}</div>
            </div>
          </TableCell>
          <TableCell>
            <div className="flex items-center justify-between gap-2">
              {companyCell(r)}
              {r.employer_id ? (
                <Button size="sm" variant="outline" onClick={() => addAdditionalRow(r)}>Add</Button>
              ) : null}
            </div>
          </TableCell>
          <TableCell className="w-40">{ebaCell(r)}</TableCell>
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

      {/* Manage dialog */}
      <ManageTradeCompanyDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        mode={manageMode}
        onRemove={activeRow && activeRow.employer_id ? () => {
          if (!activeRow) return;
          setEmployer(activeRow.key, "", "");
        } : undefined}
        onChange={activeRow ? () => {
          setAddDefaults({ stage: activeRow.stage, trade_value: activeRow.trade_value, trade_label: activeRow.trade_label, action: "replace" });
          setManageOpen(false);
          setAddOpen(true);
        } : undefined}
        onAdd={() => {
          if (activeRow) {
            setAddDefaults({ stage: activeRow.stage, trade_value: activeRow.trade_value, trade_label: activeRow.trade_label, action: activeRow.employer_id ? "add_new" : "replace" });
          }
          setManageOpen(false);
          setAddOpen(true);
        }}
      />

      {/* Add/Replace dialog */}
      <AddEmployerToTradeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStage={addDefaults.stage}
        defaultTradeValue={addDefaults.trade_value}
        defaultTradeLabel={addDefaults.trade_label}
        onSubmit={({ stage, employerId, employerName }) => {
          if (addDefaults.action === "replace" && activeRow) {
            // Replace on existing row (or fill empty skeleton). Allow stage to update.
            setEmployerWithOptionalStage(activeRow.key, employerId, employerName, stage);
          } else if (addDefaults.action === "add_new") {
            // Create a new row and persist
            const newRow: Row = {
              key: `${stage}|${addDefaults.trade_value}|extra|${Date.now()}`,
              isSkeleton: false,
              stage,
              trade_value: addDefaults.trade_value,
              trade_label: addDefaults.trade_label || labelByTrade[addDefaults.trade_value] || startCase(addDefaults.trade_value),
              employer_id: employerId,
              employer_name: employerName,
              eba: null,
            };
            // Update local rows and persist
            const list = [...rows, newRow, ...otherRows];
            const std = list.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
            const others = list.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
            setRows(std);
            setOtherRows(others);
            upsertRow(newRow).then(async () => {
              try {
                const { data: e } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle();
                newRow.eba = ((e as any)?.enterprise_agreement_status ?? null) as boolean | null;
                // trigger state update
                const merged = [...rows, ...otherRows];
                const std2 = merged.filter((r) => allowedTradeValues.has(r.trade_value) && r.stage !== "other");
                const others2 = merged.filter((r) => r.stage === "other" || !allowedTradeValues.has(r.trade_value));
                setRows(std2);
                setOtherRows(others2);
              } catch {}
            });
          }
        }}
      />
    </div>
  );
}


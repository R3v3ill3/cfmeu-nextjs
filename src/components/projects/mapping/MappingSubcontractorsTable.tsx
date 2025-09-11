"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { toast } from "sonner";
import { ManageTradeCompanyDialog } from "@/components/projects/mapping/ManageTradeCompanyDialog";
import { AddEmployerToTradeDialog } from "@/components/projects/mapping/AddEmployerToTradeDialog";
import { getTradeOptionsByStage, getStageLabel, getTradeLabel, getAllStages, type TradeStage } from "@/utils/tradeUtils";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";

type Row = {
  key: string; // stage|trade value
  stage: TradeStage;
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
  const [rowsByTrade, setRowsByTrade] = useState<Record<string, Row[]>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ stage: TradeStage; trade_value: string; trade_label: string; action: "replace" | "add_new" }>({ stage: "other", trade_value: "", trade_label: "", action: "replace" });
  
  // Get unified mapping data which includes trade contractors
  const { data: mappingData, isLoading } = useMappingSheetData(projectId);

  useEffect(() => {
    if (!mappingData) return;
    
    // 1. Get all trades grouped by the canonical stages
    const tradesByStage = getTradeOptionsByStage();
    
    // 2. Convert trade contractors from unified data to Row format
    const assignments: Row[] = mappingData.tradeContractors.map((tc) => ({
      key: `${tc.stage}|${tc.tradeType}|${tc.id}`,
      stage: tc.stage,
      trade_value: tc.tradeType,
      trade_label: tc.tradeLabel,
      employer_id: tc.employerId,
      employer_name: tc.employerName,
      id: tc.id.startsWith('project_trade:') ? tc.id.replace('project_trade:', '') : tc.id,
      eba: tc.ebaStatus ?? null,
      isSkeleton: false,
    }));

    // 3. Build the rows, ensuring at least one (skeleton) row per trade
    const newRowsByTrade: Record<string, Row[]> = {};
    
    getAllStages().forEach(stage => {
      tradesByStage[stage].forEach(trade => {
        const tradeAssignments = assignments.filter(a => a.trade_value === trade.value);
        if (tradeAssignments.length > 0) {
          newRowsByTrade[trade.value] = tradeAssignments;
        } else {
          // Add a skeleton row if no assignments exist for this trade
          newRowsByTrade[trade.value] = [{
            key: `${stage}|${trade.value}|skeleton`,
            stage,
            trade_value: trade.value,
            trade_label: trade.label,
            employer_id: null,
            employer_name: null,
            eba: null,
            isSkeleton: true,
          }];
        }
      });
    });
    
    setRowsByTrade(newRowsByTrade);
  }, [mappingData]);

  const upsertRow = async (r: Row, stage: TradeStage, employerId: string, employerName: string) => {
    try {
      if (!employerId) return;
      const payload: any = {
        project_id: projectId,
        employer_id: employerId,
        stage: stage,
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
      
      // Refresh local state with new/updated info
      const { data: emp } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle();
      const newRow: Row = { ...r, id: r.id, stage, employer_id: employerId, employer_name: employerName, isSkeleton: false, eba: (emp as any)?.enterprise_agreement_status ?? null };

      setRowsByTrade(prev => {
        const newRows = { ...prev };
        const tradeRows = newRows[r.trade_value] || [];
        const rowIndex = tradeRows.findIndex(row => row.key === r.key);
        if (rowIndex !== -1) {
          tradeRows[rowIndex] = newRow;
        } else {
          tradeRows.push(newRow);
          // If we're adding a new row, remove the skeleton if it exists
          const skelIndex = tradeRows.findIndex(row => row.isSkeleton);
          if (skelIndex !== -1) tradeRows.splice(skelIndex, 1);
        }
        newRows[r.trade_value] = tradeRows;
        return newRows;
      });
    } catch (e: any) {
      toast.error(e?.message || "Failed to save contractor row");
    }
  };

  const removeRow = async (row: Row) => {
    if (!row.id) return;
    try {
      await (supabase as any).from("project_contractor_trades").delete().eq("id", row.id);
      setRowsByTrade(prev => {
        const newRows = { ...prev };
        const tradeRows = (newRows[row.trade_value] || []).filter(r => r.key !== row.key);
        // If this was the last assigned row for this trade, add a skeleton back
        if (tradeRows.length === 0) {
          tradeRows.push({
            key: `${row.stage}|${row.trade_value}|skeleton`,
            stage: row.stage,
            trade_value: row.trade_value,
            trade_label: getTradeLabel(row.trade_value),
            employer_id: null, employer_name: null, eba: null, isSkeleton: true,
          });
        }
        newRows[row.trade_value] = tradeRows;
        return newRows;
      });
      toast.success("Removed assignment");
    } catch (e: any) {
      toast.error(e.message || "Failed to remove assignment");
    }
  }

  const handleAddOrChange = (row: Row, action: "replace" | "add_new") => {
    setActiveRow(row);
    setAddDefaults({ stage: row.stage, trade_value: row.trade_value, trade_label: row.trade_label, action });
    setAddOpen(true);
  }

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
        <Button size="sm" variant="outline" onClick={() => { setActiveRow(row); setManageOpen(true); }}>
          {row.employer_id ? 'Manage' : 'Assign'}
        </Button>
      </div>
    </div>
  );

  const renderSection = (title: string, stage: TradeStage) => {
    const tradesForStage = getTradeOptionsByStage()[stage] || [];
    
    if (isLoading) {
      return (
        <>
          <tr><td colSpan={3} className="font-semibold pt-3">{title}</td></tr>
          <TableRow>
            <TableCell colSpan={3} className="text-center py-4 text-muted-foreground">
              Loading {title.toLowerCase()} assignments...
            </TableCell>
          </TableRow>
        </>
      );
    }
    
    return (
      <>
        <tr><td colSpan={3} className="font-semibold pt-3">{title}</td></tr>
        {tradesForStage.map(trade => {
          const assignments = rowsByTrade[trade.value] || [];
          return assignments.map((row, index) => (
            <TableRow key={row.key}>
              <TableCell className={"w-56 " + (row.employer_id ? "bg-muted/20" : "")}>
                {index === 0 ? row.trade_label : ''}
              </TableCell>
              <TableCell>
                {companyCell(row)}
              </TableCell>
              <TableCell className="w-40">{ebaCell(row)}</TableCell>
            </TableRow>
          ));
        })}
      </>
    )
  };

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
            {getAllStages().map(stage => renderSection(getStageLabel(stage), stage))}
          </TableBody>
        </Table>
      </div>
      <div className="flex justify-end mt-2">
        <Button size="sm" variant="outline" onClick={() => handleAddOrChange({
          key: `other|other_${Date.now()}|skeleton`,
          stage: 'other',
          trade_value: `other_${Date.now()}`,
          trade_label: 'Other (custom)',
          employer_id: null, employer_name: null, eba: null, isSkeleton: true,
        }, "add_new")}>Add Other</Button>
      </div>

      {/* Manage dialog */}
      <ManageTradeCompanyDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        mode={activeRow?.employer_id ? "existing" : "empty"}
        onRemove={activeRow && activeRow.employer_id ? () => removeRow(activeRow) : undefined}
        onChange={activeRow ? () => handleAddOrChange(activeRow, 'replace') : undefined}
        onAdd={() => activeRow && handleAddOrChange(activeRow, 'add_new')}
      />

      {/* Add/Replace dialog */}
      <AddEmployerToTradeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStage={addDefaults.stage}
        defaultTradeValue={addDefaults.trade_value}
        defaultTradeLabel={addDefaults.trade_label}
        onSubmit={({ stage, employerId, employerName }) => {
          if (activeRow) {
            upsertRow(activeRow, stage, employerId, employerName);
          }
        }}
      />
    </div>
  );
}


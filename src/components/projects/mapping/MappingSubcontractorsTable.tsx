"use client"

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { SingleEmployerDialogPicker } from "@/components/projects/SingleEmployerDialogPicker";
import { toast } from "sonner";
import { ManageTradeCompanyDialog } from "@/components/projects/mapping/ManageTradeCompanyDialog";
import { AddEmployerToTradeDialog } from "@/components/projects/mapping/AddEmployerToTradeDialog";
import { AutoMatchIndicator } from "@/components/projects/mapping/AutoMatchIndicator";
import { AutoMatchActionsDialog } from "@/components/projects/mapping/AutoMatchActionsDialog";
import { ComplianceIndicator } from "@/components/projects/compliance/ComplianceIndicator";
import { useEmployerCompliance } from "@/components/projects/compliance/hooks/useEmployerCompliance";
import { getTradeOptionsByStage, getStageLabel, getTradeLabel, getAllStages, type TradeStage } from "@/utils/tradeUtils";
import { useMappingSheetData } from "@/hooks/useMappingSheetData";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal";
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusSelectSimple } from "@/components/ui/StatusSelect";
import { TradeStatus } from "@/components/ui/StatusBadge";

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
  // Auto-match tracking fields
  dataSource?: 'manual' | 'bci_import' | 'other_import';
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review';
  matchConfidence?: number;
  matchedAt?: string;
  confirmedAt?: string;
  matchNotes?: string;
  // Status tracking fields
  status?: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
};

function startCase(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function MappingSubcontractorsTable({ projectId }: { projectId: string }) {
  // Fetch key trades dynamically from database (replaces hard-coded list)
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet();
  const [rowsByTrade, setRowsByTrade] = useState<Record<string, Row[]>>({});
  const [manageOpen, setManageOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addDefaults, setAddDefaults] = useState<{ stage: TradeStage; trade_value: string; trade_label: string; action: "replace" | "add_new" }>({ stage: "other", trade_value: "", trade_label: "", action: "replace" });
  const [showKeyContractorsOnly, setShowKeyContractorsOnly] = useState(true);
  
  // Auto-match actions dialog state
  const [autoMatchOpen, setAutoMatchOpen] = useState(false);
  const [autoMatchRow, setAutoMatchRow] = useState<Row | null>(null);
  
  // Employer detail modal state
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null);
  const [isEmployerDetailOpen, setIsEmployerDetailOpen] = useState(false);
  
  // Status filtering state
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  
  // Get unified mapping data which includes trade contractors
  const { data: mappingData, isLoading } = useMappingSheetData(projectId);
  
  // Get compliance data
  const { data: complianceData = [] } = useEmployerCompliance(projectId);

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
      id: tc.id, // Keep full ID with prefix for table identification
      eba: tc.ebaStatus ?? null,
      isSkeleton: false,
      // Auto-match tracking fields
      dataSource: tc.dataSource,
      matchStatus: tc.matchStatus,
      matchConfidence: tc.matchConfidence,
      matchedAt: tc.matchedAt,
      confirmedAt: tc.confirmedAt,
      matchNotes: tc.matchNotes,
      // Status tracking fields
      status: tc.status,
      statusUpdatedAt: tc.statusUpdatedAt,
      statusUpdatedBy: tc.statusUpdatedBy,
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
      
      // First, get the trade_type_id from trade_types table
      const { data: tradeType } = await supabase
        .from("trade_types")
        .select("id")
        .eq("code", r.trade_value)
        .single();
        
      if (!tradeType) {
        toast.error(`Trade type "${r.trade_value}" not found`);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const payload: any = {
        project_id: projectId,
        employer_id: employerId,
        assignment_type: 'trade_work',
        trade_type_id: (tradeType as any).id,
        status: r.status || 'active',  // Include current status or default to active
        status_updated_at: new Date().toISOString(),
        status_updated_by: user.id,
        source: 'manual',
        match_status: 'confirmed',
        match_confidence: 1.0,
        confirmed_at: new Date().toISOString(),
      };

      if (r.id && r.id.startsWith('assignment_trade:')) {
        // Update existing assignment
        const assignmentId = r.id.replace('assignment_trade:', '');
        const { error } = await (supabase as any)
          .from("project_assignments")
          .update(payload)
          .eq("id", assignmentId);
        if (error) throw error;
      } else {
        // Create new assignment
        const { data, error } = await supabase
          .from("project_assignments")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        r.id = `assignment_trade:${(data as any).id}`;
      }
      
      // Refresh local state with new/updated info
      const { data: emp } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle();
      const newRow: Row = { 
        ...r, 
        id: r.id, 
        stage, 
        employer_id: employerId, 
        employer_name: employerName, 
        isSkeleton: false, 
        eba: (emp as any)?.enterprise_agreement_status ?? null,
        status: r.status || 'active',
        statusUpdatedAt: new Date().toISOString(),
        statusUpdatedBy: user.id,
        dataSource: 'manual',
        matchStatus: 'confirmed',
        matchConfidence: 1.0,
        confirmedAt: new Date().toISOString(),
      };

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

  const updateStatus = async (row: Row, newStatus: TradeStatus) => {
    if (!row.id) return;
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      
      // Determine which table to update based on ID prefix
      if (row.id.startsWith('assignment_trade:')) {
        const assignmentId = row.id.replace('assignment_trade:', '');
        await (supabase as any)
          .from('project_assignments')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user.id,
          })
          .eq('id', assignmentId);
      } else if (row.id.startsWith('project_trade:')) {
        const tradeId = row.id.replace('project_trade:', '');
        await (supabase as any)
          .from('project_contractor_trades')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user.id,
          })
          .eq('id', tradeId);
      } else {
        // Fallback - try project_assignments first
        await (supabase as any)
          .from('project_assignments')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user.id,
          })
          .eq('id', row.id);
      }
      
      // Update local state
      setRowsByTrade(prev => {
        const newRows = { ...prev };
        const tradeRows = newRows[row.trade_value] || [];
        const index = tradeRows.findIndex(r => r.id === row.id);
        if (index >= 0) {
          tradeRows[index] = {
            ...tradeRows[index],
            status: newStatus,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: user.id,
          };
        }
        newRows[row.trade_value] = tradeRows;
        return newRows;
      });
      
      toast.success('Status updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status');
    }
  };

  const removeRow = async (row: Row) => {
    if (!row.id) return;
    try {
      if (row.id.startsWith('assignment_trade:')) {
        // Remove from project_assignments table
        const assignmentId = row.id.replace('assignment_trade:', '');
        await supabase.from("project_assignments").delete().eq("id", assignmentId);
      } else if (row.id.startsWith('project_trade:')) {
        // Remove from legacy project_contractor_trades table
        const legacyId = row.id.replace('project_trade:', '');
        await supabase.from("project_contractor_trades").delete().eq("id", legacyId);
      } else {
        // Fallback for other formats
        await supabase.from("project_contractor_trades").delete().eq("id", row.id);
      }
      
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

  const handleAutoMatchAction = (action: 'confirmed' | 'removed' | 'changed') => {
    // Refresh the data after any auto-match action
    // The hook will automatically refetch
    setAutoMatchOpen(false);
    setAutoMatchRow(null);
  };

  const companyCell = (row: Row) => (
    <div className="flex items-center justify-between gap-2">
      <div className="flex-1 min-w-0 space-y-1">
        {row.employer_id ? (
          <button
            onClick={() => {
              setSelectedEmployerId(row.employer_id!);
              setIsEmployerDetailOpen(true);
            }}
            className={`font-medium text-base truncate underline hover:text-primary text-left ${
              row.matchStatus === 'auto_matched' 
                ? 'italic text-gray-500' 
                : ''
            }`}
          >
            {row.employer_name || "—"}
          </button>
        ) : (
          <div className="font-medium text-base truncate text-muted-foreground">
            {row.employer_name || "—"}
          </div>
        )}
        {/* Show auto-match indicator if applicable */}
        {row.employer_id && (
          <AutoMatchIndicator
            matchStatus={row.matchStatus}
            dataSource={row.dataSource}
            matchConfidence={row.matchConfidence}
            matchNotes={row.matchNotes}
            className="text-xs"
          />
        )}
      </div>
      <div className="shrink-0 flex gap-1">
        {/* Show Review button for auto-matched assignments */}
        {row.matchStatus === 'auto_matched' && row.employer_id && (
          <Button 
            size="sm" 
            variant="outline" 
            className="text-yellow-600 border-yellow-300 hover:bg-yellow-50"
            onClick={() => { 
              setAutoMatchRow(row);
              setAutoMatchOpen(true);
            }}
          >
            Review
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => { setActiveRow(row); setManageOpen(true); }}>
          {row.employer_id ? 'Manage' : 'Assign'}
        </Button>
      </div>
    </div>
  );

  const renderSection = (title: string, stage: TradeStage) => {
    let tradesForStage = getTradeOptionsByStage()[stage] || [];
    
    // Apply key contractors filter
    if (showKeyContractorsOnly) {
      tradesForStage = tradesForStage.filter(trade => KEY_CONTRACTOR_TRADES.has(trade.value));
    }
    
    // Don't render section if no trades after filtering
    if (tradesForStage.length === 0) {
      return null;
    }
    
    if (isLoading) {
      return (
        <>
          <tr><td colSpan={4} className="font-semibold pt-3">{title}</td></tr>
          <TableRow>
            <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
              Loading {title.toLowerCase()} assignments...
            </TableCell>
          </TableRow>
        </>
      );
    }
    
    return (
      <>
        <tr><td colSpan={5} className="font-semibold pt-3">{title}</td></tr>
        {tradesForStage.map(trade => {
          const assignments = filteredRowsByTrade[trade.value] || [];
          if (assignments.length === 0) return null;
          return assignments.map((row, index) => (
            <TableRow key={row.key}>
              <TableCell className={"w-56 " + (row.employer_id ? "bg-muted/20" : "")}>
                {index === 0 ? row.trade_label : ''}
              </TableCell>
              <TableCell>
                {companyCell(row)}
              </TableCell>
              <TableCell className="w-36">
                {row.isSkeleton || !row.employer_id ? (
                  <StatusBadge status="unknown" showLabel={false} size="sm" />
                ) : (
                  <StatusSelectSimple
                    value={(row.status as TradeStatus) || 'active'}
                    onChange={(status) => updateStatus(row, status)}
                    size="sm"
                  />
                )}
              </TableCell>
              <TableCell className="w-40">{ebaCell(row)}</TableCell>
              <TableCell className="w-20 text-center">
                {row.employer_id && (
                  <ComplianceIndicator
                    projectId={projectId}
                    employerId={row.employer_id}
                    complianceData={complianceData}
                  />
                )}
              </TableCell>
            </TableRow>
          ));
        })}
      </>
    )
  };

  // Calculate status counts for filtering
  const statusCounts = Object.values(rowsByTrade).flat().reduce((acc, row) => {
    if (row.isSkeleton || !row.employer_id) return acc;
    const status = row.status || 'active';
    acc.total++;
    if (status === 'active' || status === 'planned' || status === 'tendering' || status === 'not_yet_tendered' || status === 'unknown') {
      acc.active++;
    }
    if (status === 'completed') {
      acc.completed++;
    }
    return acc;
  }, { total: 0, active: 0, completed: 0 });

  // Apply status filter
  const filteredRowsByTrade = Object.entries(rowsByTrade).reduce((acc, [trade, rows]) => {
    if (statusFilter === 'all') {
      acc[trade] = rows;
    } else if (statusFilter === 'active') {
      acc[trade] = rows.filter(r => {
        if (r.isSkeleton || !r.employer_id) return true; // Keep skeleton rows
        const status = r.status || 'active';
        return ['active', 'planned', 'tendering', 'not_yet_tendered', 'unknown', 'on_hold'].includes(status);
      });
    } else if (statusFilter === 'completed') {
      acc[trade] = rows.filter(r => {
        if (r.isSkeleton || !r.employer_id) return false; // Hide skeleton rows
        return r.status === 'completed';
      });
    }
    // Only include trade if it has rows
    if (acc[trade].length > 0) {
      return acc;
    }
    return acc;
  }, {} as Record<string, Row[]>);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold uppercase tracking-wide text-sm">Subcontractors</div>
        <div className="flex items-center gap-4 no-print">
          {/* Status Filter */}
          <div className="flex items-center gap-1">
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
            >
              All ({statusCounts.total})
            </Button>
            <Button
              variant={statusFilter === 'active' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('active')}
            >
              Active ({statusCounts.active})
            </Button>
            <Button
              variant={statusFilter === 'completed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('completed')}
            >
              Completed ({statusCounts.completed})
            </Button>
          </div>
          
          {/* Key Contractors Filter */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="key-contractors-filter"
              checked={showKeyContractorsOnly}
              onCheckedChange={(checked) => setShowKeyContractorsOnly(checked === true)}
            />
            <Label htmlFor="key-contractors-filter" className="text-sm font-medium cursor-pointer">
              Key contractors only
            </Label>
          </div>
        </div>
      </div>
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">
          Loading subcontractors...
        </div>
      ) : (
        <div className="overflow-x-auto">
          <Table className="print-table print-border">
            <TableHeader>
              <TableRow>
                <TableHead className="w-56">Trade</TableHead>
                <TableHead>Company</TableHead>
                <TableHead className="w-36">Status</TableHead>
                <TableHead className="w-40">EBA (Y/N)</TableHead>
                <TableHead className="w-20 text-center">Compliance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {getAllStages().map(stage => renderSection(getStageLabel(stage), stage))}
            </TableBody>
          </Table>
        </div>
      )}
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

      {/* Auto-match actions dialog */}
      {autoMatchRow && (
        <AutoMatchActionsDialog
          open={autoMatchOpen}
          onOpenChange={setAutoMatchOpen}
          assignmentId={autoMatchRow.id || ''}
          assignmentTable="project_contractor_trades"
          employerName={autoMatchRow.employer_name || ''}
          tradeOrRole={autoMatchRow.trade_label}
          matchConfidence={autoMatchRow.matchConfidence}
          matchNotes={autoMatchRow.matchNotes}
          onAction={handleAutoMatchAction}
        />
      )}

      {/* Employer Detail Modal */}
      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isEmployerDetailOpen}
        onClose={() => setIsEmployerDetailOpen(false)}
        initialTab="overview"
      />
    </div>
  );
}


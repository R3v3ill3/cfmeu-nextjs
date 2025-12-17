"use client"

import React, { useState, useMemo, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Filter, Building2, AlertCircle, CheckCircle } from "lucide-react"
import { useMappingSheetData } from "@/hooks/useMappingSheetData"
import { useEmployerCompliance } from "@/components/projects/compliance/hooks/useEmployerCompliance"
import { useKeyContractorTradesSet } from "@/hooks/useKeyContractorTrades"
import { StatusBadge, TradeStatus } from "@/components/ui/StatusBadge"
import { StatusSelectSimple } from "@/components/ui/StatusSelect"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { AutoMatchIndicator } from "@/components/projects/mapping/AutoMatchIndicator"
import { ComplianceIndicator } from "@/components/projects/compliance/ComplianceIndicator"
import { ManageTradeCompanyDialog } from "@/components/projects/mapping/ManageTradeCompanyDialog"
import { AddEmployerToTradeDialog } from "@/components/projects/mapping/AddEmployerToTradeDialog"
import { AutoMatchActionsDialog } from "@/components/projects/mapping/AutoMatchActionsDialog"
import { getTradeOptionsByStage, getStageLabel, getTradeLabel, getAllStages, type TradeStage } from "@/utils/tradeUtils"
import { supabase } from "@/integrations/supabase/client"
import { toast } from "sonner"

type Row = {
  key: string
  stage: TradeStage
  trade_value: string
  trade_label: string
  employer_id: string | null
  employer_name: string | null
  eba: boolean | null
  id?: string
  isSkeleton?: boolean
  estimatedWorkforce?: number | null
  estimatedFullTimeWorkers?: number | null
  estimatedCasualWorkers?: number | null
  estimatedAbnWorkers?: number | null
  membershipChecked?: boolean | null
  estimatedMembers?: number | null
  calculatedTotalWorkers?: number | null
  membershipPercentage?: number | null
  dataSource?: 'manual' | 'bci_import' | 'other_import'
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review'
  matchConfidence?: number
  matchedAt?: string
  confirmedAt?: string
  matchNotes?: string
  status?: string
  statusUpdatedAt?: string
  statusUpdatedBy?: string
}

interface MappingSubcontractorsMobileViewProps {
  projectId: string
}

// Helper function to update worker breakdown data
const updateWorkerBreakdown = async (
  row: Row,
  projectId: string,
  field: 'estimatedFullTimeWorkers' | 'estimatedCasualWorkers' | 'estimatedAbnWorkers' | 'estimatedMembers' | 'membershipChecked',
  value: number | boolean | null
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    const updateData: any = {
      worker_breakdown_updated_at: new Date().toISOString(),
      worker_breakdown_updated_by: user.id,
    }

    const fieldMap = {
      estimatedFullTimeWorkers: 'estimated_full_time_workers',
      estimatedCasualWorkers: 'estimated_casual_workers',
      estimatedAbnWorkers: 'estimated_abn_workers',
      estimatedMembers: 'estimated_members',
      membershipChecked: 'membership_checked',
    }

    updateData[fieldMap[field]] = value

    if (row.id && row.id.startsWith('assignment_trade:')) {
      const assignmentId = row.id.replace('assignment_trade:', '')
      const { error } = await supabase
        .from("project_assignments")
        .update(updateData)
        .eq("id", assignmentId)
      if (error) throw error
    } else if (row.id && row.id.startsWith('project_trade:')) {
      const tradeId = row.id.replace('project_trade:', '')
      const { error } = await supabase
        .from("project_contractor_trades")
        .update(updateData)
        .eq("id", tradeId)
      if (error) throw error
    } else {
      toast.error("Cannot update worker breakdown for unassigned row")
      return
    }

    toast.success("Updated")
  } catch (error: any) {
    console.error("Error updating worker breakdown:", error)
    toast.error(error.message || "Failed to update")
  }
}

export function MappingSubcontractorsMobileView({ projectId }: MappingSubcontractorsMobileViewProps) {
  const { tradeSet: KEY_CONTRACTOR_TRADES } = useKeyContractorTradesSet()
  const { data: mappingData, isLoading } = useMappingSheetData(projectId)
  const { data: complianceData = [] } = useEmployerCompliance(projectId)

  const [rowsByTrade, setRowsByTrade] = useState<Record<string, Row[]>>({})
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [showKeyContractorsOnly, setShowKeyContractorsOnly] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'assigned_only' | 'unassigned_only'>('all')

  // Dialog states
  const [manageOpen, setManageOpen] = useState(false)
  const [activeRow, setActiveRow] = useState<Row | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addDefaults, setAddDefaults] = useState<{ stage: TradeStage; trade_value: string; trade_label: string; action: "replace" | "add_new" }>({ stage: "other", trade_value: "", trade_label: "", action: "replace" })
  const [autoMatchOpen, setAutoMatchOpen] = useState(false)
  const [autoMatchRow, setAutoMatchRow] = useState<Row | null>(null)
  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isEmployerDetailOpen, setIsEmployerDetailOpen] = useState(false)

  // Build rows from mapping data
  useEffect(() => {
    if (!mappingData) return

    const tradesByStage = getTradeOptionsByStage()

    const assignments: Row[] = mappingData.tradeContractors.map((tc) => ({
      key: `${tc.stage}|${tc.tradeType}|${tc.id}`,
      stage: tc.stage,
      trade_value: tc.tradeType,
      trade_label: tc.tradeLabel,
      employer_id: tc.employerId,
      employer_name: tc.employerName,
      id: tc.id,
      eba: tc.ebaStatus ?? null,
      isSkeleton: false,
      estimatedWorkforce: tc.estimatedWorkforce,
      estimatedFullTimeWorkers: tc.estimatedFullTimeWorkers,
      estimatedCasualWorkers: tc.estimatedCasualWorkers,
      estimatedAbnWorkers: tc.estimatedAbnWorkers,
      membershipChecked: tc.membershipChecked,
      estimatedMembers: tc.estimatedMembers,
      calculatedTotalWorkers: tc.calculatedTotalWorkers,
      membershipPercentage: tc.membershipPercentage,
      dataSource: tc.dataSource,
      matchStatus: tc.matchStatus,
      matchConfidence: tc.matchConfidence,
      matchedAt: tc.matchedAt,
      confirmedAt: tc.confirmedAt,
      matchNotes: tc.matchNotes,
      status: tc.status,
      statusUpdatedAt: tc.statusUpdatedAt,
      statusUpdatedBy: tc.statusUpdatedBy,
    }))

    const newRowsByTrade: Record<string, Row[]> = {}

    getAllStages().forEach(stage => {
      tradesByStage[stage].forEach(trade => {
        const tradeAssignments = assignments.filter(a => a.trade_value === trade.value)
        if (tradeAssignments.length > 0) {
          newRowsByTrade[trade.value] = tradeAssignments
        } else {
          newRowsByTrade[trade.value] = [{
            key: `${stage}|${trade.value}|skeleton`,
            stage,
            trade_value: trade.value,
            trade_label: trade.label,
            employer_id: null,
            employer_name: null,
            eba: null,
            isSkeleton: true,
          }]
        }
      })
    })

    setRowsByTrade(newRowsByTrade)
  }, [mappingData])

  // Apply filters
  const filteredRowsByTrade = useMemo(() => {
    return Object.entries(rowsByTrade).reduce((acc, [trade, rows]) => {
      let filteredRows = rows

      // Apply key contractors filter
      if (showKeyContractorsOnly && !KEY_CONTRACTOR_TRADES.has(trade)) {
        return acc
      }

      // Apply status filter
      if (statusFilter === 'active') {
        filteredRows = rows.filter(r => {
          if (r.isSkeleton || !r.employer_id) return true
          const status = r.status || 'active'
          return ['active', 'planned', 'tendering', 'not_yet_tendered', 'unknown', 'on_hold'].includes(status)
        })
      } else if (statusFilter === 'completed') {
        filteredRows = rows.filter(r => {
          if (r.isSkeleton || !r.employer_id) return false
          return r.status === 'completed'
        })
      }

      // Apply assignment filter
      if (assignmentFilter !== 'all') {
        filteredRows = filteredRows.filter(r => {
          if (assignmentFilter === 'assigned_only') {
            return !r.isSkeleton && r.employer_id !== null
          } else if (assignmentFilter === 'unassigned_only') {
            return r.isSkeleton && r.employer_id === null
          }
          return true
        })
      }

      if (filteredRows.length > 0) {
        acc[trade] = filteredRows
      }
      return acc
    }, {} as Record<string, Row[]>)
  }, [rowsByTrade, showKeyContractorsOnly, statusFilter, assignmentFilter, KEY_CONTRACTOR_TRADES])

  // Status counts
  const statusCounts = useMemo(() => {
    return Object.values(rowsByTrade).flat().reduce((acc, row) => {
      if (row.isSkeleton || !row.employer_id) return acc
      const status = row.status || 'active'
      acc.total++
      if (['active', 'planned', 'tendering', 'not_yet_tendered', 'unknown'].includes(status)) {
        acc.active++
      }
      if (status === 'completed') {
        acc.completed++
      }
      return acc
    }, { total: 0, active: 0, completed: 0 })
  }, [rowsByTrade])

  const toggleCard = (key: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const updateStatus = async (row: Row, newStatus: TradeStatus) => {
    if (!row.id) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      if (row.id.startsWith('assignment_trade:')) {
        const assignmentId = row.id.replace('assignment_trade:', '')
        await (supabase as any)
          .from('project_assignments')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user.id,
          })
          .eq('id', assignmentId)
      } else if (row.id.startsWith('project_trade:')) {
        const tradeId = row.id.replace('project_trade:', '')
        await (supabase as any)
          .from('project_contractor_trades')
          .update({
            status: newStatus,
            status_updated_at: new Date().toISOString(),
            status_updated_by: user.id,
          })
          .eq('id', tradeId)
      }

      setRowsByTrade(prev => {
        const newRows = { ...prev }
        const tradeRows = newRows[row.trade_value] || []
        const index = tradeRows.findIndex(r => r.id === row.id)
        if (index >= 0) {
          tradeRows[index] = {
            ...tradeRows[index],
            status: newStatus,
            statusUpdatedAt: new Date().toISOString(),
            statusUpdatedBy: user.id,
          }
        }
        newRows[row.trade_value] = tradeRows
        return newRows
      })

      toast.success('Status updated')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update status')
    }
  }

  const handleAddOrChange = (row: Row, action: "replace" | "add_new") => {
    setActiveRow(row)
    setAddDefaults({ stage: row.stage, trade_value: row.trade_value, trade_label: row.trade_label, action })
    setAddOpen(true)
  }

  const removeRow = async (row: Row) => {
    if (!row.id) return
    try {
      if (row.id.startsWith('assignment_trade:')) {
        const assignmentId = row.id.replace('assignment_trade:', '')
        await supabase.from("project_assignments").delete().eq("id", assignmentId)
      } else if (row.id.startsWith('project_trade:')) {
        const legacyId = row.id.replace('project_trade:', '')
        await supabase.from("project_contractor_trades").delete().eq("id", legacyId)
      }

      setRowsByTrade(prev => {
        const newRows = { ...prev }
        const tradeRows = (newRows[row.trade_value] || []).filter(r => r.key !== row.key)
        if (tradeRows.length === 0) {
          tradeRows.push({
            key: `${row.stage}|${row.trade_value}|skeleton`,
            stage: row.stage,
            trade_value: row.trade_value,
            trade_label: getTradeLabel(row.trade_value),
            employer_id: null, employer_name: null, eba: null, isSkeleton: true,
          })
        }
        newRows[row.trade_value] = tradeRows
        return newRows
      })
      toast.success("Removed assignment")
    } catch (e: any) {
      toast.error(e.message || "Failed to remove assignment")
    }
  }

  const upsertRow = async (r: Row, stage: TradeStage, employerId: string, employerName: string) => {
    try {
      if (!employerId) return

      const { data: tradeType } = await supabase
        .from("trade_types")
        .select("id")
        .eq("code", r.trade_value)
        .single()

      if (!tradeType) {
        toast.error(`Trade type "${r.trade_value}" not found`)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const payload: any = {
        project_id: projectId,
        employer_id: employerId,
        assignment_type: 'trade_work',
        trade_type_id: (tradeType as any).id,
        status: r.status || 'active',
        status_updated_at: new Date().toISOString(),
        status_updated_by: user.id,
        source: 'manual',
        match_status: 'confirmed',
        match_confidence: 1.0,
        confirmed_at: new Date().toISOString(),
      }

      if (r.id && r.id.startsWith('assignment_trade:')) {
        const assignmentId = r.id.replace('assignment_trade:', '')
        const { error } = await (supabase as any)
          .from("project_assignments")
          .update(payload)
          .eq("id", assignmentId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from("project_assignments")
          .insert(payload)
          .select("id")
          .single()
        if (error) throw error
        r.id = `assignment_trade:${(data as any).id}`
      }

      const { data: emp } = await supabase.from("employers").select("enterprise_agreement_status").eq("id", employerId).maybeSingle()
      const newRow: Row = {
        ...r,
        id: r.id,
        stage,
        employer_id: employerId,
        employer_name: employerName,
        isSkeleton: false,
        eba: (emp as any)?.enterprise_agreement_status ?? null,
        status: r.status || 'active',
        dataSource: 'manual',
        matchStatus: 'confirmed',
      }

      setRowsByTrade(prev => {
        const newRows = { ...prev }
        const tradeRows = newRows[r.trade_value] || []
        const rowIndex = tradeRows.findIndex(row => row.key === r.key)
        if (rowIndex !== -1) {
          tradeRows[rowIndex] = newRow
        } else {
          tradeRows.push(newRow)
          const skelIndex = tradeRows.findIndex(row => row.isSkeleton)
          if (skelIndex !== -1) tradeRows.splice(skelIndex, 1)
        }
        newRows[r.trade_value] = tradeRows
        return newRows
      })
    } catch (e: any) {
      toast.error(e?.message || "Failed to save contractor")
    }
  }

  const handleAutoMatchAction = () => {
    setAutoMatchOpen(false)
    setAutoMatchRow(null)
  }

  // Group rows by stage for display
  const rowsByStage = useMemo(() => {
    const grouped: Record<TradeStage, Row[]> = {
      pre_construction: [],
      structure: [],
      trades: [],
      other: [],
    }

    Object.entries(filteredRowsByTrade).forEach(([trade, rows]) => {
      rows.forEach(row => {
        if (grouped[row.stage]) {
          grouped[row.stage].push(row)
        } else {
          // Fallback to 'other' if stage is not recognized
          grouped.other.push(row)
        }
      })
    })

    return grouped
  }, [filteredRowsByTrade])

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading subcontractors...
      </div>
    )
  }

  const renderContractorCard = (row: Row) => {
    const isExpanded = expandedCards.has(row.key)
    const hasEba = row.eba === true
    const noEba = row.eba === false

    return (
      <Card
        key={row.key}
        className={`mb-3 ${hasEba ? 'border-l-4 border-l-green-500' : noEba ? 'border-l-4 border-l-red-400' : ''}`}
      >
        <CardContent className="p-4">
          {/* Main row - always visible */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-muted-foreground">{row.trade_label}</div>
              {row.employer_id ? (
                <button
                  onClick={() => {
                    setSelectedEmployerId(row.employer_id!)
                    setIsEmployerDetailOpen(true)
                  }}
                  className={`font-medium text-base truncate underline hover:text-primary text-left block w-full ${row.matchStatus === 'auto_matched' ? 'italic text-gray-500' : ''
                    }`}
                >
                  {row.employer_name || "—"}
                </button>
              ) : (
                <div className="text-muted-foreground">Not assigned</div>
              )}

              {/* Auto-match indicator */}
              {row.employer_id && (
                <AutoMatchIndicator
                  matchStatus={row.matchStatus}
                  dataSource={row.dataSource}
                  matchConfidence={row.matchConfidence}
                  matchNotes={row.matchNotes}
                  className="text-xs mt-1"
                />
              )}
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* EBA Badge */}
              {row.employer_id && (
                <Badge
                  variant={hasEba ? 'default' : noEba ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {hasEba ? 'EBA' : noEba ? 'No EBA' : 'Unknown'}
                </Badge>
              )}

              {/* Status */}
              {row.employer_id && !row.isSkeleton && (
                <StatusSelectSimple
                  value={(row.status as TradeStatus) || 'active'}
                  onChange={(status) => updateStatus(row, status)}
                  size="sm"
                />
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            {row.matchStatus === 'auto_matched' && row.employer_id && (
              <Button
                size="sm"
                variant="outline"
                className="text-yellow-600 border-yellow-300 min-h-[44px] flex-1"
                onClick={() => {
                  setAutoMatchRow(row)
                  setAutoMatchOpen(true)
                }}
              >
                Review Match
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="min-h-[44px] flex-1"
              onClick={() => { setActiveRow(row); setManageOpen(true) }}
            >
              {row.employer_id ? 'Manage' : 'Assign'}
            </Button>
            {row.employer_id && (
              <Button
                size="sm"
                variant="ghost"
                className="min-h-[44px] px-3"
                onClick={() => toggleCard(row.key)}
              >
                {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
          </div>

          {/* Expandable details */}
          {isExpanded && row.employer_id && (
            <div className="mt-4 pt-4 border-t space-y-4">
              {/* Worker breakdown */}
              <div>
                <div className="text-sm font-medium mb-2">Worker Breakdown</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Full-time</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.estimatedFullTimeWorkers || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null
                        updateWorkerBreakdown(row, projectId, 'estimatedFullTimeWorkers', value)
                      }}
                      className="h-10 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Casual</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.estimatedCasualWorkers || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null
                        updateWorkerBreakdown(row, projectId, 'estimatedCasualWorkers', value)
                      }}
                      className="h-10 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">ABN</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.estimatedAbnWorkers || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null
                        updateWorkerBreakdown(row, projectId, 'estimatedAbnWorkers', value)
                      }}
                      className="h-10 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Est.</Label>
                    <div className="h-10 flex items-center text-sm font-medium">
                      {row.calculatedTotalWorkers || row.estimatedWorkforce || '—'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Membership */}
              <div>
                <div className="text-sm font-medium mb-2">Membership</div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={row.membershipChecked || false}
                      onCheckedChange={(checked) => {
                        updateWorkerBreakdown(row, projectId, 'membershipChecked', checked)
                      }}
                      className="h-5 w-5"
                    />
                    <Label className="text-sm">Checked</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Est. Members:</Label>
                    <Input
                      type="number"
                      min="0"
                      value={row.estimatedMembers || ''}
                      onChange={(e) => {
                        const value = e.target.value ? parseInt(e.target.value) : null
                        updateWorkerBreakdown(row, projectId, 'estimatedMembers', value)
                      }}
                      className="h-8 w-16 text-sm"
                      placeholder="0"
                    />
                  </div>
                  {row.membershipPercentage !== null && row.membershipPercentage > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {row.membershipPercentage.toFixed(1)}%
                    </Badge>
                  )}
                </div>
              </div>

              {/* Compliance */}
              <div>
                <div className="text-sm font-medium mb-2">Compliance</div>
                <ComplianceIndicator
                  projectId={projectId}
                  employerId={row.employer_id}
                  complianceData={complianceData}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="mt-4 max-w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="font-semibold uppercase tracking-wide text-sm">Subcontractors</div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[44px] gap-2"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* Collapsible filters */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="mb-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              {/* Status filter */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Status</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setStatusFilter('all')}
                  >
                    All ({statusCounts.total})
                  </Button>
                  <Button
                    variant={statusFilter === 'active' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setStatusFilter('active')}
                  >
                    Active ({statusCounts.active})
                  </Button>
                  <Button
                    variant={statusFilter === 'completed' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setStatusFilter('completed')}
                  >
                    Done ({statusCounts.completed})
                  </Button>
                </div>
              </div>

              {/* Assignment filter */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Assignment</Label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={assignmentFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setAssignmentFilter('all')}
                  >
                    All
                  </Button>
                  <Button
                    variant={assignmentFilter === 'assigned_only' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setAssignmentFilter('assigned_only')}
                  >
                    Assigned
                  </Button>
                  <Button
                    variant={assignmentFilter === 'unassigned_only' ? 'default' : 'outline'}
                    size="sm"
                    className="min-h-[44px]"
                    onClick={() => setAssignmentFilter('unassigned_only')}
                  >
                    Unassigned
                  </Button>
                </div>
              </div>

              {/* Key contractors toggle */}
              <div className="flex items-center gap-3">
                <Checkbox
                  id="key-contractors-mobile"
                  checked={showKeyContractorsOnly}
                  onCheckedChange={(checked) => setShowKeyContractorsOnly(checked === true)}
                  className="h-5 w-5"
                />
                <Label htmlFor="key-contractors-mobile" className="text-sm cursor-pointer">
                  Key contractors only
                </Label>
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      {/* Contractor cards by stage */}
      {getAllStages().map(stage => {
        const stageRows = rowsByStage[stage]
        if (!stageRows || stageRows.length === 0) return null

        return (
          <div key={stage} className="mb-6">
            <div className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-3">
              {getStageLabel(stage)}
            </div>
            {stageRows.map(row => renderContractorCard(row))}
          </div>
        )
      })}

      {/* Add Other button */}
      <div className="flex justify-end mt-4">
        <Button
          size="sm"
          variant="outline"
          className="min-h-[44px]"
          onClick={() => handleAddOrChange({
            key: `other|other_${Date.now()}|skeleton`,
            stage: 'other',
            trade_value: `other_${Date.now()}`,
            trade_label: 'Other (custom)',
            employer_id: null, employer_name: null, eba: null, isSkeleton: true,
          }, "add_new")}
        >
          Add Other
        </Button>
      </div>

      {/* Dialogs */}
      <ManageTradeCompanyDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        mode={activeRow?.employer_id ? "existing" : "empty"}
        onRemove={activeRow && activeRow.employer_id ? () => removeRow(activeRow) : undefined}
        onChange={activeRow ? () => handleAddOrChange(activeRow, 'replace') : undefined}
        onAdd={() => activeRow && handleAddOrChange(activeRow, 'add_new')}
      />

      <AddEmployerToTradeDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        defaultStage={addDefaults.stage}
        defaultTradeValue={addDefaults.trade_value}
        defaultTradeLabel={addDefaults.trade_label}
        onSubmit={({ stage, employerId, employerName }) => {
          if (activeRow) {
            upsertRow(activeRow, stage, employerId, employerName)
          }
        }}
      />

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

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isEmployerDetailOpen}
        onClose={() => setIsEmployerDetailOpen(false)}
        initialTab="overview"
      />
    </div>
  )
}

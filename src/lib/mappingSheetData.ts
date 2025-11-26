import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/types/database"
import { getTradeLabel, getTradeStage } from "@/utils/tradeUtils"

export interface ContractorRole {
  id: string;
  employerId: string;
  employerName: string;
  role: 'builder' | 'head_contractor' | 'project_manager' | 'site_manager' | 'other';
  roleLabel: string;
  ebaStatus?: boolean | null;
  source: 'project_employer_roles' | 'legacy_builder_id' | 'project_assignments' | 'v_unified_project_contractors';
  dataSource?: 'manual' | 'bci_import' | 'other_import';
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review' | string;
  matchConfidence?: number;
  matchedAt?: string;
  confirmedAt?: string;
  matchNotes?: string;
}

export interface TradeContractor {
  id: string;
  employerId: string;
  employerName: string;
  tradeType: string;
  tradeLabel: string;
  stage: 'early_works' | 'structure' | 'finishing' | 'other';
  estimatedWorkforce?: number | null;
  estimatedFullTimeWorkers?: number | null;
  estimatedCasualWorkers?: number | null;
  estimatedAbnWorkers?: number | null;
  membershipChecked?: boolean | null;
  estimatedMembers?: number | null;
  workerBreakdownUpdatedAt?: string | null;
  workerBreakdownUpdatedBy?: string | null;
  calculatedTotalWorkers?: number | null;
  membershipPercentage?: number | null;
  ebaStatus?: boolean | null;
  source: 'project_contractor_trades' | 'site_contractor_trades';
  dataSource?: 'manual' | 'bci_import' | 'other_import';
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review' | string;
  matchConfidence?: number;
  matchedAt?: string;
  confirmedAt?: string;
  matchNotes?: string;
  status?: string;
  statusUpdatedAt?: string;
  statusUpdatedBy?: string;
}

export interface MappingSheetData {
  contractorRoles: ContractorRole[];
  tradeContractors: TradeContractor[];
  projectInfo: {
    id: string;
    name: string;
    builderName?: string;
    builderHasEba?: boolean | null;
    legacyBuilderId?: string | null;
  };
}

type Client = SupabaseClient<Database>

/**
 * Shared loader for mapping sheet data that can be used by both client hooks
 * and server-side API routes to ensure consistent aggregation logic.
 */
export async function fetchMappingSheetData(
  supabase: Client,
  projectId: string
): Promise<MappingSheetData> {
  const tradeContractors: TradeContractor[] = []

  // 1. Fetch project info via RPC helper first and fallback if needed
  let project: { id: string; name: string; builder_id: string | null; main_job_site_id: string | null } | null = null
  let mainJobSiteId: string | null = null

  try {
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('get_project_for_scan_review', { p_project_id: projectId })

    if (!rpcError && rpcData && !rpcData.error) {
      project = {
        id: rpcData.id,
        name: rpcData.name,
        builder_id: rpcData.builder_id || null,
        main_job_site_id: rpcData.main_job_site_id || null,
      }
      mainJobSiteId = rpcData.main_job_site_id || null
    } else {
      const { data: directData, error: directError } = await supabase
        .from('projects')
        .select('id, name, builder_id, main_job_site_id')
        .eq('id', projectId)
        .single()

      if (directError) {
        console.warn('[fetchMappingSheetData] Failed to fetch project via fallback:', directError)
        throw new Error('Project not found')
      }

      project = directData
      mainJobSiteId = directData?.main_job_site_id || null
    }
  } catch (error) {
    console.error('[fetchMappingSheetData] Error fetching project:', error)
    throw new Error('Project not found')
  }

  if (!project) {
    throw new Error('Project not found')
  }

  let projectInfo: MappingSheetData['projectInfo'] = {
    id: project.id,
    name: project.name,
    legacyBuilderId: project.builder_id,
  }

  // 2. Contractor roles from project_assignments
  const { data: roleAssignments, error: rolesError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      employer_id,
      source,
      match_status,
      match_confidence,
      matched_at,
      confirmed_at,
      match_notes,
      employers(name, enterprise_agreement_status),
      contractor_role_types(code, name)
    `)
    .eq('project_id', projectId)
    .eq('assignment_type', 'contractor_role')

  if (rolesError) {
    throw rolesError
  }

  const contractorRoles: ContractorRole[] = (roleAssignments || []).map((assignment: any) => {
    const roleCode = assignment.contractor_role_types?.code || 'other'
    const roleLabel = assignment.contractor_role_types?.name || 'Other'

    return {
      id: `role_assignment:${assignment.id}`,
      employerId: assignment.employer_id,
      employerName: assignment.employers?.name || assignment.employer_id,
      role: roleCode,
      roleLabel,
      ebaStatus: assignment.employers?.enterprise_agreement_status !== 'no_eba',
      source: 'project_employer_roles',
      dataSource: assignment.source,
      matchStatus: assignment.match_status,
      matchConfidence: assignment.match_confidence,
      matchedAt: assignment.matched_at,
      confirmedAt: assignment.confirmed_at,
      matchNotes: assignment.match_notes,
    }
  })

  const builder = contractorRoles.find(r => r.role === 'builder')
  if (builder) {
    projectInfo = {
      ...projectInfo,
      builderName: builder.employerName,
      builderHasEba: builder.ebaStatus,
    }
  }

  // 3. Trade contractors from new assignment system
  const { data: tradeAssignments, error: tradeAssignmentsError } = await supabase
    .from('project_assignments')
    .select(`
      id,
      employer_id,
      estimated_workers,
      estimated_full_time_workers,
      estimated_casual_workers,
      estimated_abn_workers,
      membership_checked,
      estimated_members,
      worker_breakdown_updated_at,
      worker_breakdown_updated_by,
      status,
      status_updated_at,
      status_updated_by,
      source,
      match_status,
      match_confidence,
      matched_at,
      confirmed_at,
      match_notes,
      employers(name, enterprise_agreement_status),
      trade_types(code, name)
    `)
    .eq('project_id', projectId)
    .eq('assignment_type', 'trade_work')

  if (tradeAssignmentsError) {
    throw tradeAssignmentsError
  }

  ;(tradeAssignments || []).forEach((assignment: any) => {
    if (!assignment.employer_id || !assignment.trade_types?.code) return
    const tradeType = assignment.trade_types.code
    const tradeLabel = getTradeLabel(tradeType)
    const stage = getTradeStage(tradeType)
    const breakdownTotal =
      (assignment.estimated_full_time_workers || 0) +
      (assignment.estimated_casual_workers || 0) +
      (assignment.estimated_abn_workers || 0)
    const calculatedTotalWorkers = breakdownTotal > 0 ? breakdownTotal : (assignment.estimated_workers || null)
    const membershipPercentage =
      calculatedTotalWorkers && calculatedTotalWorkers > 0
        ? Math.round(((assignment.estimated_members || 0) * 100) / calculatedTotalWorkers * 100) / 100
        : null

    tradeContractors.push({
      id: `assignment_trade:${assignment.id}`,
      employerId: assignment.employer_id,
      employerName: assignment.employers?.name || assignment.employer_id,
      tradeType,
      tradeLabel,
      stage,
      estimatedWorkforce: assignment.estimated_workers,
      estimatedFullTimeWorkers: assignment.estimated_full_time_workers,
      estimatedCasualWorkers: assignment.estimated_casual_workers,
      estimatedAbnWorkers: assignment.estimated_abn_workers,
      membershipChecked: assignment.membership_checked,
      estimatedMembers: assignment.estimated_members,
      workerBreakdownUpdatedAt: assignment.worker_breakdown_updated_at,
      workerBreakdownUpdatedBy: assignment.worker_breakdown_updated_by,
      calculatedTotalWorkers,
      membershipPercentage,
      ebaStatus: assignment.employers?.enterprise_agreement_status !== 'no_eba',
      source: 'project_contractor_trades',
      dataSource: assignment.source,
      matchStatus: assignment.match_status,
      matchConfidence: assignment.match_confidence,
      matchedAt: assignment.matched_at,
      confirmedAt: assignment.confirmed_at,
      matchNotes: assignment.match_notes,
      status: assignment.status,
      statusUpdatedAt: assignment.status_updated_at,
      statusUpdatedBy: assignment.status_updated_by,
    })
  })

  // 4. Legacy project_contractor_trades, avoid duplicates
  const { data: legacyTrades } = await supabase
    .from('project_contractor_trades')
    .select(`
      id,
      employer_id,
      trade_type,
      stage,
      estimated_project_workforce,
      estimated_full_time_workers,
      estimated_casual_workers,
      estimated_abn_workers,
      membership_checked,
      estimated_members,
      worker_breakdown_updated_at,
      worker_breakdown_updated_by,
      status,
      status_updated_at,
      status_updated_by,
      source,
      match_status,
      match_confidence,
      matched_at,
      confirmed_at,
      match_notes,
      employers(name, enterprise_agreement_status)
    `)
    .eq('project_id', projectId)

  ;(legacyTrades || []).forEach((legacy: any) => {
    if (!legacy.employer_id) return
    const exists = tradeContractors.find(
      tc => tc.employerId === legacy.employer_id && tc.tradeType === legacy.trade_type
    )
    if (exists) return

    const tradeLabel = getTradeLabel(legacy.trade_type)
    const stage = legacy.stage || getTradeStage(legacy.trade_type)
    const breakdownTotal =
      (legacy.estimated_full_time_workers || 0) +
      (legacy.estimated_casual_workers || 0) +
      (legacy.estimated_abn_workers || 0)
    const calculatedTotalWorkers = breakdownTotal > 0 ? breakdownTotal : (legacy.estimated_project_workforce || null)
    const membershipPercentage =
      calculatedTotalWorkers && calculatedTotalWorkers > 0
        ? Math.round(((legacy.estimated_members || 0) * 100) / calculatedTotalWorkers * 100) / 100
        : null

    tradeContractors.push({
      id: `project_trade:${legacy.id}`,
      employerId: legacy.employer_id,
      employerName: legacy.employers?.name || legacy.employer_id,
      tradeType: legacy.trade_type,
      tradeLabel,
      stage,
      estimatedWorkforce: legacy.estimated_project_workforce,
      estimatedFullTimeWorkers: legacy.estimated_full_time_workers,
      estimatedCasualWorkers: legacy.estimated_casual_workers,
      estimatedAbnWorkers: legacy.estimated_abn_workers,
      membershipChecked: legacy.membership_checked,
      estimatedMembers: legacy.estimated_members,
      workerBreakdownUpdatedAt: legacy.worker_breakdown_updated_at,
      workerBreakdownUpdatedBy: legacy.worker_breakdown_updated_by,
      calculatedTotalWorkers,
      membershipPercentage,
      ebaStatus: legacy.employers?.enterprise_agreement_status !== 'no_eba',
      source: 'project_contractor_trades',
      dataSource: legacy.source,
      matchStatus: legacy.match_status,
      matchConfidence: legacy.match_confidence,
      matchedAt: legacy.matched_at,
      confirmedAt: legacy.confirmed_at,
      matchNotes: legacy.match_notes,
      status: legacy.status,
      statusUpdatedAt: legacy.status_updated_at,
      statusUpdatedBy: legacy.status_updated_by,
    })
  })

  // 5. site_contractor_trades for main job site
  if (mainJobSiteId) {
    const { data: siteTrades } = await supabase
      .from('site_contractor_trades')
      .select('id, employer_id, trade_type, employers(name, enterprise_agreement_status)')
      .eq('job_site_id', mainJobSiteId)

    ;(siteTrades || []).forEach((siteTrade: any) => {
      if (!siteTrade.employer_id) return
      const exists = tradeContractors.find(
        tc => tc.employerId === siteTrade.employer_id && tc.tradeType === siteTrade.trade_type
      )
      if (exists) return

      const tradeLabel = getTradeLabel(siteTrade.trade_type)
      const stage = getTradeStage(siteTrade.trade_type)

      tradeContractors.push({
        id: `site_trade:${siteTrade.id}`,
        employerId: siteTrade.employer_id,
        employerName: siteTrade.employers?.name || siteTrade.employer_id,
        tradeType: siteTrade.trade_type,
        tradeLabel,
        stage,
        ebaStatus: siteTrade.employers?.enterprise_agreement_status !== 'no_eba',
        source: 'site_contractor_trades',
      })
    })
  }

  return {
    contractorRoles: contractorRoles.sort((a, b) => {
      const rolePriority: Record<string, number> = { builder: 1, head_contractor: 2, project_manager: 3 }
      const aPriority = rolePriority[a.role] || 4
      const bPriority = rolePriority[b.role] || 4
      return aPriority - bPriority
    }),
    tradeContractors: tradeContractors.sort((a, b) => {
      const stagePriority: Record<TradeContractor['stage'], number> = {
        early_works: 1,
        structure: 2,
        finishing: 3,
        other: 4,
      }
      const aPriority = stagePriority[a.stage]
      const bPriority = stagePriority[b.stage]
      if (aPriority !== bPriority) return aPriority - bPriority
      return a.tradeLabel.localeCompare(b.tradeLabel)
    }),
    projectInfo,
  }
}


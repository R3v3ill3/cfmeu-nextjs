import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTradeLabel, getTradeStage } from "@/utils/tradeUtils";

export interface ContractorRole {
  id: string;
  employerId: string;
  employerName: string;
  role: 'builder' | 'head_contractor' | 'project_manager' | 'site_manager' | 'other';
  roleLabel: string;
  ebaStatus?: boolean | null;
  source: 'project_employer_roles' | 'legacy_builder_id' | 'project_assignments' | 'v_unified_project_contractors';
  // Auto-match tracking fields
  dataSource?: 'manual' | 'bci_import' | 'other_import';
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review';
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
  ebaStatus?: boolean | null;
  source: 'project_contractor_trades' | 'site_contractor_trades';
  // Auto-match tracking fields
  dataSource?: 'manual' | 'bci_import' | 'other_import';
  matchStatus?: 'auto_matched' | 'confirmed' | 'needs_review';
  matchConfidence?: number;
  matchedAt?: string;
  confirmedAt?: string;
  matchNotes?: string;
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

/**
 * Specialized hook for mapping sheets that combines all contractor data sources
 * while preserving the required stage structure and trade labels
 */
export function useMappingSheetData(projectId: string) {
  return useQuery({
    queryKey: ["mapping-sheet-data", projectId],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<MappingSheetData> => {
      if (!projectId) throw new Error("Project ID required");

      const tradeContractors: TradeContractor[] = [];

      // 1. Get project basic info
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, builder_id") // Keep builder_id for legacy info if needed
        .eq("id", projectId)
        .single();

      if (!project) throw new Error("Project not found");

      let projectInfo: any = {
        id: project.id,
        name: project.name,
        legacyBuilderId: project.builder_id,
      };

      // 2. Get all contractor roles from project_assignments
      const { data: roleAssignments, error: rolesError } = await supabase
        .from("project_assignments")
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
        .eq('assignment_type', 'contractor_role');

      if (rolesError) throw rolesError;

      const contractorRoles: ContractorRole[] = (roleAssignments || []).map((r: any) => {
        const roleCode = r.contractor_role_types?.code || 'other';
        const roleLabel = r.contractor_role_types?.name || 'Other';
        
        return {
          id: `role_assignment:${r.id}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          role: roleCode as any,
          roleLabel,
          ebaStatus: r.employers?.enterprise_agreement_status !== 'no_eba',
          source: 'project_employer_roles',
          dataSource: r.source,
          matchStatus: r.match_status,
          matchConfidence: r.match_confidence,
          matchedAt: r.matched_at,
          confirmedAt: r.confirmed_at,
          matchNotes: r.match_notes,
        };
      });

      // Populate projectInfo with builder info from the unified roles
      const builder = contractorRoles.find(r => r.role === 'builder');
      if (builder) {
        projectInfo = {
          ...projectInfo,
          builderName: builder.employerName,
          builderHasEba: builder.ebaStatus,
        };
      }

      // 3. Get trade contractors from project_assignments (the new system)
      const { data: tradeAssignments, error: tradeAssignmentsError } = await supabase
        .from("project_assignments")
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
          trade_types(code, name)
        `)
        .eq("project_id", projectId)
        .eq("assignment_type", "trade_work");

      if (tradeAssignmentsError) throw tradeAssignmentsError;

      (tradeAssignments || []).forEach((t: any) => {
        if (!t.employer_id || !t.trade_types?.code) return;

        const tradeType = t.trade_types.code; // Use code instead of name
        const tradeLabel = getTradeLabel(tradeType);
        const stage = getTradeStage(tradeType);

        tradeContractors.push({
          id: `assignment_trade:${t.id}`,
          employerId: t.employer_id,
          employerName: t.employers?.name || t.employer_id,
          tradeType,
          tradeLabel,
          stage,
          ebaStatus: t.employers?.enterprise_agreement_status !== 'no_eba',
          source: 'project_contractor_trades', // Consider this the same source type for UI
          dataSource: t.source,
          matchStatus: t.match_status,
          matchConfidence: t.match_confidence,
          matchedAt: t.matched_at,
          confirmedAt: t.confirmed_at,
          matchNotes: t.match_notes,
        });
      });


      // 4. Get trade contractors from project_contractor_trades (legacy)
      const { data: projectTrades } = await supabase
        .from("project_contractor_trades")
        .select("id, employer_id, trade_type, stage, estimated_project_workforce, source, match_status, match_confidence, matched_at, confirmed_at, match_notes, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      (projectTrades || []).forEach((t: any) => {
        if (!t.employer_id) return;
        
        // Avoid duplicates from the new trade assignment system
        const existing = tradeContractors.find(tc => tc.employerId === t.employer_id && tc.tradeType === t.trade_type);
        if (existing) return;

        const tradeLabel = getTradeLabel(t.trade_type);
        const stage = t.stage || getTradeStage(t.trade_type);

        tradeContractors.push({
          id: `project_trade:${t.id}`,
          employerId: t.employer_id,
          employerName: t.employers?.name || t.employer_id,
          tradeType: t.trade_type,
          tradeLabel,
          stage,
          estimatedWorkforce: t.estimated_project_workforce,
          ebaStatus: t.employers?.enterprise_agreement_status !== 'no_eba',
          source: 'project_contractor_trades',
          dataSource: t.source,
          matchStatus: t.match_status,
          matchConfidence: t.match_confidence,
          matchedAt: t.matched_at,
          confirmedAt: t.confirmed_at,
          matchNotes: t.match_notes
        });
      });

      // 5. Get trade contractors from site_contractor_trades (legacy, if main site exists)
      const { data: mainSite } = await supabase
        .from("projects")
        .select("main_job_site_id")
        .eq("id", projectId)
        .single();

      if (mainSite?.main_job_site_id) {
        const { data: siteTrades } = await supabase
          .from("site_contractor_trades")
          .select("id, employer_id, trade_type, employers(name, enterprise_agreement_status)")
          .eq("job_site_id", mainSite.main_job_site_id);

        (siteTrades || []).forEach((st: any) => {
          if (!st.employer_id) return;

          // Avoid duplicates from project_contractor_trades
          const existingTrade = tradeContractors.find(tc => 
            tc.employerId === st.employer_id && tc.tradeType === st.trade_type
          );
          if (existingTrade) return;

          const tradeLabel = getTradeLabel(st.trade_type);
          const stage = getTradeStage(st.trade_type);

          tradeContractors.push({
            id: `site_trade:${st.id}`,
            employerId: st.employer_id,
            employerName: st.employers?.name || st.employer_id,
            tradeType: st.trade_type,
            tradeLabel,
            stage,
            ebaStatus: st.employers?.enterprise_agreement_status !== 'no_eba',
            source: 'site_contractor_trades'
          });
        });
      }

      return {
        contractorRoles: contractorRoles.sort((a, b) => {
          // Sort by role priority: builder, head_contractor, project_manager, others
          const rolePriority = { builder: 1, head_contractor: 2, project_manager: 3 };
          const aPriority = rolePriority[a.role as keyof typeof rolePriority] || 4;
          const bPriority = rolePriority[b.role as keyof typeof rolePriority] || 4;
          return aPriority - bPriority;
        }),
        tradeContractors: tradeContractors.sort((a, b) => {
          // Sort by stage priority, then by trade label
          const stagePriority = { early_works: 1, structure: 2, finishing: 3, other: 4 };
          const aPriority = stagePriority[a.stage];
          const bPriority = stagePriority[b.stage];
          if (aPriority !== bPriority) return aPriority - bPriority;
          return a.tradeLabel.localeCompare(b.tradeLabel);
        }),
        projectInfo
      };
    },
  });
}

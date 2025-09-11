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
  source: 'project_employer_roles' | 'legacy_builder_id' | 'project_assignments';
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

      const contractorRoles: ContractorRole[] = [];
      const tradeContractors: TradeContractor[] = [];

      // 1. Get project basic info including legacy builder_id
      const { data: project } = await supabase
        .from("projects")
        .select("id, name, builder_id")
        .eq("id", projectId)
        .single();

      if (!project) throw new Error("Project not found");

      let projectInfo: any = {
        id: project.id,
        name: project.name,
        legacyBuilderId: project.builder_id,
      };

      // 2. Get contractor roles from project_employer_roles (new system)
      const { data: roles } = await supabase
        .from("project_employer_roles")
        .select("id, role, employer_id, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      (roles || []).forEach((r: any) => {
        if (!r.employer_id) return;
        
        const roleLabel = r.role === 'builder' ? 'Builder' : 
                         r.role === 'head_contractor' ? 'Head Contractor' :
                         r.role === 'project_manager' ? 'Project Manager' :
                         r.role === 'site_manager' ? 'Site Manager' : 
                         r.role;

        contractorRoles.push({
          id: `role:${r.id}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          role: r.role,
          roleLabel,
          ebaStatus: r.employers?.enterprise_agreement_status !== 'no_eba',
          source: 'project_employer_roles'
        });
      });

      // 3. Get contractor roles from project_assignments (newer assignment system)
      const { data: assignments } = await supabase
        .from("project_assignments")
        .select("id, assignment_type, employer_id, role_details, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId)
        .eq("assignment_type", "contractor_role");

      (assignments || []).forEach((a: any) => {
        if (!a.employer_id) return;
        
        // Avoid duplicates from project_employer_roles
        const existingRole = contractorRoles.find(r => r.employerId === a.employer_id);
        if (existingRole) return;

        const roleDetails = a.role_details || {};
        const role = roleDetails.role_code || 'other';
        const roleLabel = roleDetails.company_name || 
                         (role === 'builder' ? 'Builder' : 
                          role === 'head_contractor' ? 'Head Contractor' :
                          role === 'project_manager' ? 'Project Manager' :
                          role === 'site_manager' ? 'Site Manager' : 
                          'Contractor');

        contractorRoles.push({
          id: `assignment:${a.id}`,
          employerId: a.employer_id,
          employerName: a.employers?.name || a.employer_id,
          role: role as any,
          roleLabel,
          ebaStatus: a.employers?.enterprise_agreement_status !== 'no_eba',
          source: 'project_assignments'
        });
      });

      // 4. Handle legacy builder_id if not covered by new systems
      if (project.builder_id) {
        const hasBuilderRole = contractorRoles.some(r => 
          r.employerId === project.builder_id && 
          (r.role === 'builder' || r.roleLabel.toLowerCase().includes('builder'))
        );

        if (!hasBuilderRole) {
          // Get builder info from legacy system
          const { data: builder } = await supabase
            .from("employers")
            .select("name, enterprise_agreement_status")
            .eq("id", project.builder_id)
            .single();

          if (builder) {
            contractorRoles.push({
              id: `legacy:${project.builder_id}`,
              employerId: project.builder_id,
              employerName: builder.name || project.builder_id,
              role: 'builder',
              roleLabel: 'Builder',
              ebaStatus: builder.enterprise_agreement_status !== 'no_eba',
              source: 'legacy_builder_id'
            });

            projectInfo = {
              ...projectInfo,
              builderName: builder.name,
              builderHasEba: builder.enterprise_agreement_status !== 'no_eba'
            };
          }
        }
      }

      // 5. Get trade contractors from project_contractor_trades
      const { data: projectTrades } = await supabase
        .from("project_contractor_trades")
        .select("id, employer_id, trade_type, stage, estimated_project_workforce, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      (projectTrades || []).forEach((t: any) => {
        if (!t.employer_id) return;

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
          source: 'project_contractor_trades'
        });
      });

      // 6. Get trade contractors from site_contractor_trades (if main site exists)
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

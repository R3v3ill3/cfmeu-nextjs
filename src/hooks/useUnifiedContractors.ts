import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTradeLabel, getTradeStage } from "@/utils/tradeUtils";

export interface UnifiedContractorRow {
  id: string;
  employerId: string;
  employerName: string;
  siteName?: string | null;
  siteId?: string | null;
  tradeType: string;
  tradeLabel: string;
  tradeStage: 'early_works' | 'structure' | 'finishing' | 'other';
  source: 'project_role' | 'site_contractor' | 'project_contractor';
  estimatedWorkforce?: number | null;
  ebaStatus?: boolean | null;
}

/**
 * Unified hook to get all contractor information for a project
 * Combines data from project_employer_roles, site_contractor_trades, and project_contractor_trades
 */
export function useUnifiedContractors(projectId: string, siteIds: string[] = []) {
  return useQuery({
    queryKey: ["unified-contractors", projectId, siteIds],
    enabled: !!projectId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!projectId) return [];
      
      const rows: UnifiedContractorRow[] = [];

      // 1) Project roles: builders and head contractors
      const { data: roles } = await supabase
        .from("project_employer_roles")
        .select("role, employer_id, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      (roles || []).forEach((r: any, idx: number) => {
        if (!r.employer_id) return;
        const tradeType = r.role === 'builder' ? 'general_construction' : 'general_construction'; // Map roles to trade types
        rows.push({
          id: `role:${r.role}:${r.employer_id}:${idx}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          siteName: r.role === 'builder' ? 'Builder' : r.role === 'head_contractor' ? 'Head Contractor' : r.role,
          siteId: null,
          tradeType,
          tradeLabel: r.role === 'builder' ? 'Builder' : r.role === 'head_contractor' ? 'Head Contractor' : r.role,
          tradeStage: 'other',
          source: 'project_role',
          ebaStatus: r.employers?.enterprise_agreement_status !== 'no_eba',
        });
      });

      // 2) Site contractors by trade (if site IDs provided)
      if (siteIds.length > 0) {
        const { data: siteContractors } = await supabase
          .from("site_contractor_trades")
          .select("id, job_site_id, employer_id, trade_type, eba_status, job_sites(name), employers(name, enterprise_agreement_status)")
          .in("job_site_id", siteIds);

        (siteContractors || []).forEach((r: any) => {
          if (!r.employer_id) return;
          const tradeLabel = getTradeLabel(r.trade_type);
          const tradeStage = getTradeStage(r.trade_type);
          rows.push({
            id: `site:${r.id}`,
            employerId: r.employer_id,
            employerName: r.employers?.name || r.employer_id,
            siteName: r.job_sites?.name || null,
            siteId: r.job_site_id,
            tradeType: r.trade_type,
            tradeLabel,
            tradeStage,
            source: 'site_contractor',
            ebaStatus: r.eba_status ?? (r.employers?.enterprise_agreement_status !== 'no_eba'),
          });
        });
      }

      // 3) Project contractors by trade and stage
      const { data: projectContractors } = await supabase
        .from("project_contractor_trades")
        .select("id, employer_id, trade_type, stage, estimated_project_workforce, employers(name, enterprise_agreement_status)")
        .eq("project_id", projectId);

      (projectContractors || []).forEach((r: any) => {
        if (!r.employer_id) return;
        const tradeLabel = getTradeLabel(r.trade_type);
        const tradeStage = r.stage || getTradeStage(r.trade_type);
        rows.push({
          id: `project:${r.id}`,
          employerId: r.employer_id,
          employerName: r.employers?.name || r.employer_id,
          siteName: null,
          siteId: null,
          tradeType: r.trade_type,
          tradeLabel,
          tradeStage,
          source: 'project_contractor',
          estimatedWorkforce: r.estimated_project_workforce,
          ebaStatus: r.employers?.enterprise_agreement_status !== 'no_eba',
        });
      });

      // 4) De-duplicate by employer+site+trade combination
      const seen = new Set<string>();
      const deduped = rows.filter((r) => {
        const key = `${r.employerId}:${r.siteId || ''}:${r.tradeType}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      return deduped;
    },
  });
}

/**
 * Get contractors grouped by site
 */
export function useContractorsBySite(projectId: string, siteIds: string[] = []) {
  const { data: contractors = [], ...rest } = useUnifiedContractors(projectId, siteIds);
  
  const groupedBySite = contractors.reduce((groups, contractor) => {
    const siteKey = contractor.siteId || '__project__';
    const siteName = contractor.siteName || 'Project';
    
    if (!groups[siteKey]) {
      groups[siteKey] = {
        siteId: contractor.siteId,
        siteName,
        contractors: [],
      };
    }
    
    groups[siteKey].contractors.push(contractor);
    return groups;
  }, {} as Record<string, { siteId: string | null; siteName: string; contractors: UnifiedContractorRow[] }>);

  return {
    ...rest,
    data: Object.values(groupedBySite),
  };
}

/**
 * Get contractors grouped by trade stage
 */
export function useContractorsByStage(projectId: string, siteIds: string[] = []) {
  const { data: contractors = [], ...rest } = useUnifiedContractors(projectId, siteIds);
  
  const groupedByStage = contractors.reduce((groups, contractor) => {
    const stage = contractor.tradeStage;
    
    if (!groups[stage]) {
      groups[stage] = [];
    }
    
    groups[stage].push(contractor);
    return groups;
  }, {} as Record<string, UnifiedContractorRow[]>);

  return {
    ...rest,
    data: groupedByStage,
  };
}

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { getTradeLabel } from '@/utils/tradeUtils';

export interface EbaEmployer {
  id: string;
  name: string;
  eba_status: 'yes' | 'no' | 'pending' | null;
  project_count: number;
  projects: Array<{
    id: string;
    name: string;
  }>;
  trades: Array<{
    tradeType: string;
    projectName: string;
  }>;
  roles: Array<{
    roleType: 'builder' | 'head_contractor' | 'project_manager';
    projectName: string;
  }>;
  isKeyContractor: boolean;
  aliases?: Array<{
    alias: string;
    confidence: number;
  }>;
  lastUpdated?: string;
}

export interface EbaFilterOptions {
  searchTerm?: string;
  ebaStatus?: 'all' | 'yes' | 'pending' | 'no';
  showOnlyKeyContractors?: boolean;
  tradeType?: string;
  projectId?: string;
  roleTypes?: Array<'builder' | 'head_contractor' | 'project_manager'>;
  excludeEmployerIds?: string[];
  sortBy?: 'name' | 'projects' | 'eba_status' | 'last_updated';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface EbaSearchResult {
  employers: EbaEmployer[];
  totalCount: number;
  hasMore: boolean;
  searchTime: number;
}

/**
 * Core EBA employer filtering logic
 * Can be used across multiple components for consistent behavior
 */
export class EbaEmployerFilter {
  private supabase = getSupabaseBrowserClient();
  private keyContractorTrades: Set<string> = new Set();

  constructor(keyContractorTrades: string[] = []) {
    this.keyContractorTrades = new Set(keyContractorTrades);
  }

  /**
   * Fetch EBA employers from database with base filters
   */
  async fetchEmployers(baseFilters: Partial<EbaFilterOptions> = {}): Promise<EbaEmployer[]> {
    let query = this.supabase
      .from('employers_search_optimized')
      .select(`
        id,
        name,
        enterprise_agreement_status,
        company_eba_records!left(id, employer_id),
        project_assignments!inner(
          assignment_type,
          projects!inner(id, name),
          contractor_role_types(code, name)
        ),
        employer_aliases!left(alias, confidence_score)
      `);

    // Apply trade type filter
    if (baseFilters.tradeType) {
      const tradeEmployerIds = await this.getEmployerIdsByTrade(baseFilters.tradeType);
      if (tradeEmployerIds.length > 0) {
        query = query.in('id', tradeEmployerIds);
      }
    }

    // Apply project filter
    if (baseFilters.projectId) {
      const projectEmployerIds = await this.getEmployerIdsByProject(baseFilters.projectId);
      if (projectEmployerIds.length > 0) {
        query = query.in('id', projectEmployerIds);
      }
    }

    // Apply exclusion filter
    if (baseFilters.excludeEmployerIds && baseFilters.excludeEmployerIds.length > 0) {
      query = query.not('id', 'in', `(${baseFilters.excludeEmployerIds.join(',')})`);
    }

    // Apply limit
    if (baseFilters.limit) {
      query = query.limit(baseFilters.limit);
    }

    const { data: employersData, error } = await query;

    if (error) throw error;

    return await this.transformEmployerData(employersData || []);
  }

  /**
   * Filter employers based on search and filter criteria
   */
  filterEmployers(employers: EbaEmployer[], filters: EbaFilterOptions): EbaEmployer[] {
    let filtered = [...employers];

    // Apply search filter
    if (filters.searchTerm && filters.searchTerm.trim()) {
      const searchLower = filters.searchTerm.toLowerCase().trim();
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchLower) ||
        emp.aliases?.some(alias => alias.alias.toLowerCase().includes(searchLower)) ||
        emp.projects.some(p => p.name.toLowerCase().includes(searchLower)) ||
        emp.trades.some(t => t.tradeType.toLowerCase().includes(searchLower))
      );
    }

    // Apply EBA status filter
    if (filters.ebaStatus && filters.ebaStatus !== 'all') {
      filtered = filtered.filter(emp => emp.eba_status === filters.ebaStatus);
    }

    // Apply key contractor filter
    if (filters.showOnlyKeyContractors) {
      filtered = filtered.filter(emp => emp.isKeyContractor);
    }

    // Apply role type filter
    if (filters.roleTypes && filters.roleTypes.length > 0) {
      filtered = filtered.filter(emp =>
        emp.roles.some(role => filters.roleTypes!.includes(role.roleType))
      );
    }

    // Apply additional trade type filter (if different from base filter)
    if (filters.tradeType) {
      filtered = filtered.filter(emp =>
        emp.trades.some(trade => trade.tradeType === filters.tradeType)
      );
    }

    // Sort results
    filtered = this.sortEmployers(filtered, filters.sortBy, filters.sortOrder);

    return filtered;
  }

  /**
   * Search EBA employers with performance timing
   */
  async searchEmployers(filters: EbaFilterOptions): Promise<EbaSearchResult> {
    const startTime = Date.now();

    try {
      // Fetch base data
      const baseEmployers = await this.fetchEmployers({
        tradeType: filters.tradeType,
        projectId: filters.projectId,
        excludeEmployerIds: filters.excludeEmployerIds,
        limit: filters.limit || 500 // Reasonable limit for performance
      });

      // Apply client-side filters
      const filteredEmployers = this.filterEmployers(baseEmployers, filters);

      const searchTime = Date.now() - startTime;

      return {
        employers: filteredEmployers,
        totalCount: filteredEmployers.length,
        hasMore: filters.limit ? filteredEmployers.length >= filters.limit : false,
        searchTime
      };
    } catch (error) {
      console.error('EBA employer search failed:', error);
      throw error;
    }
  }

  /**
   * Get employers who have worked on a specific trade
   */
  private async getEmployerIdsByTrade(tradeType: string): Promise<string[]> {
    try {
      const [projectTrades, siteTrades] = await Promise.all([
        this.supabase
          .from('project_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType),
        this.supabase
          .from('site_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType)
      ]);

      const employerIds = [
        ...(projectTrades?.data || []).map(t => t.employer_id),
        ...(siteTrades?.data || []).map(t => t.employer_id)
      ];

      // Remove duplicates
      return Array.from(new Set(employerIds));
    } catch (error) {
      console.error('Error fetching employer IDs by trade:', error);
      return [];
    }
  }

  /**
   * Get employers who have worked on a specific project
   */
  private async getEmployerIdsByProject(projectId: string): Promise<string[]> {
    try {
      const { data } = await this.supabase
        .from('project_assignments')
        .select('employer_id')
        .eq('project_id', projectId);

      return (data || []).map(pa => pa.employer_id);
    } catch (error) {
      console.error('Error fetching employer IDs by project:', error);
      return [];
    }
  }

  /**
   * Transform raw employer data to EbaEmployer format
   */
  private async transformEmployerData(employersData: any[]): Promise<EbaEmployer[]> {
    const transformed = await Promise.all(
      employersData.map(async (emp: any) => {
        const uniqueProjects = Array.from(
          new Map(
            emp.project_assignments
              ?.map((pa: any) => [pa.projects.id, pa.projects])
              .filter(([id, project]: any) => id && project)
          ).values()
        );

        const projects = uniqueProjects.map((project: any) => ({
          id: project.id,
          name: project.name
        }));

        const roleAssignments = emp.project_assignments?.filter((pa: any) =>
          pa.assignment_type === 'contractor_role' && pa.contractor_role_types
        ) || [];

        const roles = roleAssignments.map((ra: any) => ({
          roleType: ra.contractor_role_types.code as 'builder' | 'head_contractor' | 'project_manager',
          projectName: ra.projects.name
        }));

        // Get trade assignments
        const { data: tradeAssignments } = await this.supabase
          .from('project_contractor_trades')
          .select('trade_type, projects!inner(name)')
          .eq('employer_id', emp.id);

        const { data: siteTradeAssignments } = await this.supabase
          .from('site_contractor_trades')
          .select('trade_type, job_sites!inner(projects!inner(name))')
          .eq('employer_id', emp.id);

        const allTradeAssignments = [
          ...(tradeAssignments || []).map((t: any) => ({
            tradeType: t.trade_type,
            projectName: t.projects.name
          })),
          ...(siteTradeAssignments || []).map((t: any) => ({
            tradeType: t.trade_type,
            projectName: t.job_sites.projects.name
          }))
        ];

        const hasEbaRecord = emp.company_eba_records?.length > 0;
        let ebaStatus: 'yes' | 'no' | 'pending' | null = null;

        if (hasEbaRecord) {
          ebaStatus = 'yes';
        } else if (emp.enterprise_agreement_status === true || emp.enterprise_agreement_status === 'active') {
          ebaStatus = 'yes';
        } else if (emp.enterprise_agreement_status === false || emp.enterprise_agreement_status === 'no') {
          ebaStatus = 'no';
        } else {
          ebaStatus = null;
        }

        const hasKeyRole = roles.some(r => ['builder', 'project_manager'].includes(r.roleType));
        const hasKeyTrade = allTradeAssignments.some(t => this.keyContractorTrades.has(t.tradeType));

        return {
          id: emp.id,
          name: emp.name,
          eba_status: ebaStatus,
          project_count: projects.length,
          projects: projects,
          trades: allTradeAssignments,
          roles: roles,
          isKeyContractor: hasKeyRole || hasKeyTrade,
          aliases: emp.employer_aliases?.map((alias: any) => ({
            alias: alias.alias,
            confidence: alias.confidence_score
          })) || [],
          lastUpdated: new Date().toISOString()
        };
      })
    );

    return transformed;
  }

  /**
   * Sort employers based on specified criteria
   */
  private sortEmployers(
    employers: EbaEmployer[],
    sortBy?: string,
    sortOrder: 'asc' | 'desc' = 'asc'
  ): EbaEmployer[] {
    if (!sortBy) return employers;

    return [...employers].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'projects':
          comparison = b.project_count - a.project_count;
          break;
        case 'eba_status':
          const statusOrder = { 'yes': 0, 'pending': 1, null: 2, 'no': 3 };
          const aStatus = statusOrder[a.eba_status || 'no'] ?? 4;
          const bStatus = statusOrder[b.eba_status || 'no'] ?? 4;
          comparison = aStatus - bStatus;
          break;
        case 'last_updated':
          comparison = new Date(b.lastUpdated || 0).getTime() - new Date(a.lastUpdated || 0).getTime();
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  /**
   * Get search suggestions based on partial input
   */
  async getSearchSuggestions(partialTerm: string, limit: number = 5): Promise<string[]> {
    if (!partialTerm || partialTerm.length < 2) return [];

    try {
      const { data } = await this.supabase
        .from('employers_search_optimized')
        .select('name')
        .ilike('name', `%${partialTerm}%`)
        .limit(limit);

      return (data || []).map(e => e.name);
    } catch (error) {
      console.error('Error fetching search suggestions:', error);
      return [];
    }
  }

  /**
   * Get trade-specific employer statistics
   */
  async getTradeStatistics(tradeType: string): Promise<{
    totalEmployers: number;
    ebaVerifiedCount: number;
    keyContractorCount: number;
    averageProjectCount: number;
  }> {
    try {
      const result = await this.searchEmployers({
        tradeType,
        limit: 1000
      });

      const employers = result.employers;
      const ebaVerifiedCount = employers.filter(emp => emp.eba_status === 'yes').length;
      const keyContractorCount = employers.filter(emp => emp.isKeyContractor).length;
      const averageProjectCount = employers.length > 0
        ? employers.reduce((sum, emp) => sum + emp.project_count, 0) / employers.length
        : 0;

      return {
        totalEmployers: employers.length,
        ebaVerifiedCount,
        keyContractorCount,
        averageProjectCount: Math.round(averageProjectCount * 10) / 10
      };
    } catch (error) {
      console.error('Error fetching trade statistics:', error);
      return {
        totalEmployers: 0,
        ebaVerifiedCount: 0,
        keyContractorCount: 0,
        averageProjectCount: 0
      };
    }
  }
}

/**
 * Create a singleton instance of the EBA employer filter
 */
export function createEbaEmployerFilter(keyContractorTrades: string[] = []): EbaEmployerFilter {
  return new EbaEmployerFilter(keyContractorTrades);
}

/**
 * Utility functions for common filtering scenarios
 */
export const EbaFilterUtils = {
  /**
   * Create filters for quick list by trade
   */
  createQuickListFilters(tradeType: string, excludeIds: string[] = []): EbaFilterOptions {
    return {
      tradeType,
      excludeEmployerIds: excludeIds,
      sortBy: 'eba_status',
      sortOrder: 'asc',
      ebaStatus: 'all'
    };
  },

  /**
   * Create filters for EBA-verified employers only
   */
  createEbaVerifiedFilters(tradeType?: string): EbaFilterOptions {
    return {
      tradeType,
      ebaStatus: 'yes',
      sortBy: 'name',
      sortOrder: 'asc'
    };
  },

  /**
   * Create filters for key contractors only
   */
  createKeyContractorFilters(tradeType?: string): EbaFilterOptions {
    return {
      tradeType,
      showOnlyKeyContractors: true,
      sortBy: 'projects',
      sortOrder: 'desc'
    };
  },

  /**
   * Create search filters with debounced search term
   */
  createSearchFilters(searchTerm: string, additionalFilters: Partial<EbaFilterOptions> = {}): EbaFilterOptions {
    return {
      searchTerm,
      sortBy: 'name',
      sortOrder: 'asc',
      ...additionalFilters
    };
  }
};
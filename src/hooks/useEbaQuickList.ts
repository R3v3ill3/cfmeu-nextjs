import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { debounce } from 'lodash';

interface EbaEmployer {
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

interface EbaQuickListFilters {
  searchTerm?: string;
  ebaStatus?: 'all' | 'yes' | 'pending' | 'no';
  showOnlyKeyContractors?: boolean;
  sortBy?: 'name' | 'projects' | 'eba_status';
  tradeType?: string;
  projectId?: string;
  excludeEmployerIds?: string[];
}

interface PaginationOptions {
  page: number;
  pageSize: number;
}

const KEY_CONTRACTOR_TRADES = new Set([
  'demolition', 'earthworks', 'piling', 'scaffolding',
  'structural_steel', 'concreting', 'form_work', 'bricklaying'
]);

// Base query key factory
const getEbaEmployersQueryKey = (filters: EbaQuickListFilters) => [
  'eba-employers',
  filters.tradeType,
  filters.projectId,
  filters.excludeEmployerIds
];

// Transform raw employer data from database
const transformEmployerData = async (employerData: any[], supabase: any): Promise<EbaEmployer[]> => {
  const transformed = await Promise.all(
    employerData.map(async (emp: any) => {
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
      const { data: tradeAssignments } = await supabase
        .from('project_contractor_trades')
        .select('trade_type, projects!inner(name)')
        .eq('employer_id', emp.id);

      const { data: siteTradeAssignments } = await supabase
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
      const hasKeyTrade = allTradeAssignments.some(t => KEY_CONTRACTOR_TRADES.has(t.tradeType));

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
};

/**
 * Hook to fetch EBA employers with trade-based filtering
 */
export function useEbaEmployersByTrade(
  tradeType?: string,
  projectId?: string,
  excludeEmployerIds: string[] = []
) {
  const supabase = getSupabaseBrowserClient();

  return useQuery({
    queryKey: getEbaEmployersQueryKey({
      tradeType,
      projectId,
      excludeEmployerIds
    }),
    queryFn: async () => {
      let query = supabase
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

      // Filter by trade type if specified
      if (tradeType) {
        const { data: tradeEmployers } = await supabase
          .from('project_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType);

        const { data: siteTradeEmployers } = await supabase
          .from('site_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType);

        const tradeEmployerIds = [
          ...(tradeEmployers || []).map(t => t.employer_id),
          ...(siteTradeEmployers || []).map(t => t.employer_id)
        ];

        if (tradeEmployerIds.length > 0) {
          query = query.in('id', tradeEmployerIds);
        }
      }

      // Filter by project if specified
      if (projectId) {
        const { data: projectEmployers } = await supabase
          .from('project_assignments')
          .select('employer_id')
          .eq('project_id', projectId);

        if (projectEmployers && projectEmployers.length > 0) {
          const projectEmployerIds = projectEmployers.map(pe => pe.employer_id);
          query = query.in('id', projectEmployerIds);
        }
      }

      // Exclude specified employer IDs
      if (excludeEmployerIds.length > 0) {
        query = query.not('id', 'in', `(${excludeEmployerIds.join(',')})`);
      }

      const { data: employersData, error } = await query;

      if (error) throw error;

      return await transformEmployerData(employersData || [], supabase);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: true
  });
}

/**
 * Hook for searching within EBA employers with debouncing
 */
export function useEbaEmployerSearch(
  employers: EbaEmployer[],
  initialFilters: Partial<EbaQuickListFilters> = {}
) {
  const [filters, setFilters] = useState<EbaQuickListFilters>({
    searchTerm: '',
    ebaStatus: 'all',
    showOnlyKeyContractors: false,
    sortBy: 'name',
    ...initialFilters
  });

  const debouncedSetSearchTerm = useMemo(
    () => debounce((term: string) => {
      setFilters(prev => ({ ...prev, searchTerm: term }));
    }, 300),
    []
  );

  const filteredEmployers = useMemo(() => {
    let filtered = employers;

    // Apply search filter
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.name.toLowerCase().includes(searchLower) ||
        emp.aliases?.some(alias => alias.alias.toLowerCase().includes(searchLower)) ||
        emp.projects.some(p => p.name.toLowerCase().includes(searchLower))
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

    // Apply trade type filter
    if (filters.tradeType) {
      filtered = filtered.filter(emp =>
        emp.trades.some(trade => trade.tradeType === filters.tradeType)
      );
    }

    // Sort employers
    return [...filtered].sort((a, b) => {
      switch (filters.sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'projects':
          return b.project_count - a.project_count;
        case 'eba_status':
          const statusOrder = { 'yes': 0, 'pending': 1, null: 2, 'no': 3 };
          const aStatus = statusOrder[a.eba_status || 'no'] ?? 4;
          const bStatus = statusOrder[b.eba_status || 'no'] ?? 4;
          return aStatus - bStatus;
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [employers, filters]);

  const updateFilter = useCallback((key: keyof EbaQuickListFilters, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    debouncedSetSearchTerm(term);
  }, [debouncedSetSearchTerm]);

  const resetFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      ebaStatus: 'all',
      showOnlyKeyContractors: false,
      sortBy: 'name',
      ...initialFilters
    });
  }, [initialFilters]);

  return {
    filters,
    filteredEmployers,
    updateFilter,
    setSearchTerm,
    resetFilters,
    totalCount: employers.length,
    filteredCount: filteredEmployers.length
  };
}

/**
 * Hook for managing batch selection of EBA employers
 */
export function useEbaBatchSelection() {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = useCallback((employerId: string) => {
    setSelectedIds(prev => {
      const updated = new Set(prev);
      if (updated.has(employerId)) {
        updated.delete(employerId);
      } else {
        updated.add(employerId);
      }
      return updated;
    });
  }, []);

  const selectAll = useCallback((employerIds: string[]) => {
    setSelectedIds(new Set(employerIds));
  }, []);

  const selectNone = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((employerId: string) => {
    return selectedIds.has(employerId);
  }, [selectedIds]);

  const getSelectedEmployers = useCallback((employers: EbaEmployer[]) => {
    return employers.filter(emp => selectedIds.has(emp.id));
  }, [selectedIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    toggleSelection,
    selectAll,
    selectNone,
    isSelected,
    getSelectedEmployers,
    clearSelection,
    hasSelection: selectedIds.size > 0
  };
}

/**
 * Hook for EBA performance optimization and caching
 */
export function useEbaPerformanceOptimization() {
  const queryClient = useQueryClient();

  const preloadEmployersByTrade = useCallback((tradeType: string) => {
    queryClient.prefetchQuery({
      queryKey: getEbaEmployersQueryKey({ tradeType }),
      queryFn: async () => {
        const supabase = getSupabaseBrowserClient();

        // Simplified prefetch query
        const { data } = await supabase
          .from('project_contractor_trades')
          .select('employer_id')
          .eq('trade_type', tradeType)
          .limit(10);

        return data || [];
      },
      staleTime: 10 * 60 * 1000 // 10 minutes
    });
  }, [queryClient]);

  const invalidateEmployersCache = useCallback((filters?: Partial<EbaQuickListFilters>) => {
    if (filters) {
      queryClient.invalidateQueries({
        queryKey: getEbaEmployersQueryKey(filters)
      });
    } else {
      queryClient.invalidateQueries({
        queryKey: ['eba-employers']
      });
    }
  }, [queryClient]);

  const getCachedEmployers = useCallback((filters: EbaQuickListFilters) => {
    return queryClient.getQueryData<EbaEmployer[]>(
      getEbaEmployersQueryKey(filters)
    );
  }, [queryClient]);

  return {
    preloadEmployersByTrade,
    invalidateEmployersCache,
    getCachedEmployers
  };
}

/**
 * Hook for paginated EBA employer results
 */
export function useEbaPagination(
  employers: EbaEmployer[],
  initialPageSize: number = 20
) {
  const [pagination, setPagination] = useState<PaginationOptions>({
    page: 1,
    pageSize: initialPageSize
  });

  const paginatedEmployers = useMemo(() => {
    const startIndex = (pagination.page - 1) * pagination.pageSize;
    const endIndex = startIndex + pagination.pageSize;
    return employers.slice(startIndex, endIndex);
  }, [employers, pagination]);

  const totalPages = Math.ceil(employers.length / pagination.pageSize);
  const hasNextPage = pagination.page < totalPages;
  const hasPreviousPage = pagination.page > 1;

  const goToPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page: Math.max(1, Math.min(page, totalPages)) }));
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      goToPage(pagination.page + 1);
    }
  }, [hasNextPage, pagination.page, goToPage]);

  const previousPage = useCallback(() => {
    if (hasPreviousPage) {
      goToPage(pagination.page - 1);
    }
  }, [hasPreviousPage, pagination.page, goToPage]);

  const setPageSize = useCallback((newPageSize: number) => {
    setPagination(prev => ({
      ...prev,
      pageSize: newPageSize,
      page: 1 // Reset to first page when changing page size
    }));
  }, []);

  return {
    pagination,
    paginatedEmployers,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,
    currentPageItems: paginatedEmployers.length,
    totalItems: employers.length
  };
}
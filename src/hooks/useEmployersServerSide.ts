import { useQuery } from '@tanstack/react-query';

// Types matching the API endpoint
export interface EmployersParams {
  page: number;
  pageSize: number;
  sort: 'name' | 'estimated' | 'eba_recency' | 'project_count';
  dir: 'asc' | 'desc';
  q?: string;
  engaged?: boolean;
  eba?: 'all' | 'active' | 'lodged' | 'pending' | 'no';
  type?: 'all' | 'builder' | 'principal_contractor' | 'large_contractor' | 'small_contractor' | 'individual';
  categoryType?: 'contractor_role' | 'trade' | 'all';
  categoryCode?: string;
  projectTier?: 'all' | 'tier_1' | 'tier_2' | 'tier_3';
  enhanced?: boolean;
}

export interface EmployerRecord {
  id: string;
  name: string;
  abn: string | null;
  employer_type: string;
  website: string | null;
  email: string | null;
  phone: string | null;
  estimated_worker_count: number | null;
  incolink_id: string | null;
  enterprise_agreement_status: boolean | null;
  eba_status_source: string | null;
  eba_status_updated_at: string | null;
  eba_status_notes: string | null;
  company_eba_records: any[];
  worker_placements: { id: string }[];
  project_assignments: { id: string }[];
  // Enhanced data
  projects?: Array<{
    id: string;
    name: string;
    roles?: string[];
    trades?: string[];
  }>;
  organisers?: Array<{
    id: string;
    name: string;
    patch_name?: string;
  }>;
  roles?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>;
  trades?: Array<{ code: string; name: string; manual: boolean; derived: boolean }>;
}

export interface EmployersResponse {
  employers: EmployerRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  debug?: {
    queryTime: number;
    cacheHit: boolean;
    appliedFilters: Record<string, any>;
  };
}

/**
 * Server-side hook for fetching employers with optimized database queries
 * This replaces client-side filtering/sorting with server-side processing
 */
export function useEmployersServerSide(params: EmployersParams) {
  return useQuery<EmployersResponse>({
    queryKey: ['employers-server-side', params],
    queryFn: async () => {
      // Build URL parameters, only including non-default values to keep URLs clean
      const searchParams = new URLSearchParams();
      
      searchParams.set('page', params.page.toString());
      searchParams.set('pageSize', params.pageSize.toString());
      searchParams.set('sort', params.sort);
      searchParams.set('dir', params.dir);
      
      if (params.q) {
        searchParams.set('q', params.q);
      }
      
      if (params.engaged !== undefined) {
        searchParams.set('engaged', params.engaged ? '1' : '0');
      }
      
      if (params.eba && params.eba !== 'all') {
        searchParams.set('eba', params.eba);
      }
      
      if (params.type && params.type !== 'all') {
        searchParams.set('type', params.type);
      }

      if (params.categoryType && params.categoryType !== 'all') {
        searchParams.set('categoryType', params.categoryType);
      }

      if (params.categoryCode) {
        searchParams.set('categoryCode', params.categoryCode);
      }

      if (params.projectTier && params.projectTier !== 'all') {
        searchParams.set('projectTier', params.projectTier);
      }
      
      if (params.enhanced) {
        searchParams.set('enhanced', 'true');
      }

      const url = `/api/employers?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch employers: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Log performance metrics for monitoring
      if (data.debug) {
        if (data.debug.queryTime > 1000) {
          console.warn('⚠️ Slow query detected:', data.debug);
        }
      }

      return data;
    },
    
    // Balanced caching for performance vs freshness
    staleTime: 30 * 1000, // 30 seconds - data is fresh (reduced from 2 minutes)
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in memory (reduced from 10 minutes)
    
    // Retry failed requests
    retry: (failureCount, error) => {
      // Don't retry 4xx errors (client errors)
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      // Retry up to 2 times for server errors
      return failureCount < 2;
    },
    
    // Background refetch to keep data fresh
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    
    // Enable this for real-time updates in the future
    refetchInterval: false, // Could be set to 5 minutes for auto-refresh
  });
}

/**
 * Compatibility layer - provides the same interface as the original client-side hook
 * This allows for easy migration without changing the component logic
 */
export function useEmployersServerSideCompatible(params: EmployersParams) {
  const query = useEmployersServerSide(params);
  
  return {
    // Transform to match existing client-side hook interface
    data: query.data?.employers || [],
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    
    // Additional server-side specific data
    pagination: query.data?.pagination,
    debug: query.data?.debug,
    
    // Computed values that components expect
    totalCount: query.data?.pagination?.totalCount || 0,
    totalPages: query.data?.pagination?.totalPages || 0,
    currentPage: query.data?.pagination?.page || 1,
  };
}

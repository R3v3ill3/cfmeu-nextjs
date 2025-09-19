import { useQuery } from '@tanstack/react-query';

// Types matching the API endpoint
export interface WorkersParams {
  page: number;
  pageSize: number;
  sort: 'name' | 'member_number' | 'placements';
  dir: 'asc' | 'desc';
  q?: string;
  membership?: 'all' | 'member' | 'non_member';
  tier?: string;
  employerId?: string;
  incolink?: 'all' | 'with' | 'without';
}

export interface WorkerRecord {
  id: string;
  first_name: string;
  surname: string;
  nickname: string | null;
  email: string | null;
  mobile_phone: string | null;
  member_number: string | null;
  union_membership_status: string | null;
  incolink_member_id: string | null;
  has_incolink_id: boolean;
  has_active_eba: boolean;
  has_active_project: boolean;
  active_project_names: string[];
  active_project_count: number;
  employer_names: string[];
  job_titles: string[];
  job_site_names: string[];
  worker_placements: {
    job_title: string | null;
    job_sites: { name: string | null } | null;
  }[];
  organisers: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export interface WorkersResponse {
  workers: WorkerRecord[];
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
 * Server-side hook for fetching workers with optimized database queries
 * This replaces client-side filtering/sorting with server-side processing
 */
export function useWorkersServerSide(params: WorkersParams) {
  return useQuery<WorkersResponse>({
    queryKey: ['workers-server-side', params],
    queryFn: async () => {
      // Build URL parameters, only including non-default values
      const searchParams = new URLSearchParams();
      
      searchParams.set('page', params.page.toString());
      searchParams.set('pageSize', params.pageSize.toString());
      searchParams.set('sort', params.sort);
      searchParams.set('dir', params.dir);
      
      if (params.q) {
        searchParams.set('q', params.q);
      }
      
      if (params.membership && params.membership !== 'all') {
        searchParams.set('membership', params.membership);
      }

      if (params.tier && params.tier !== 'all') {
        searchParams.set('tier', params.tier);
      }

      if (params.employerId) {
        searchParams.set('employerId', params.employerId);
      }

      if (params.incolink && params.incolink !== 'all') {
        searchParams.set('incolink', params.incolink);
      }

      const url = `/api/workers?${searchParams.toString()}`;
      console.log('🔄 Fetching workers from server:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch workers: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Log performance metrics
      if (data.debug) {
        console.log(`📊 Workers server-side query completed in ${data.debug.queryTime}ms`);
        if (data.debug.queryTime > 1000) {
          console.warn('⚠️ Slow workers query detected:', data.debug);
        }
      }

      return data;
    },
    
    // Caching configuration
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    
    // Retry configuration
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('4')) {
        return false; // Don't retry 4xx errors
      }
      return failureCount < 2;
    },
    
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/**
 * Compatibility layer - provides the same interface as the original client-side hook
 * This allows for easy migration without changing the component logic
 */
export function useWorkersServerSideCompatible(params: WorkersParams) {
  const query = useWorkersServerSide(params);
  
  return {
    // Transform to match existing client-side hook interface
    data: query.data?.workers || [],
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

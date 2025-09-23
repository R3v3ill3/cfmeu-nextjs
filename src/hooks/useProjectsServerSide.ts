import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

// Types matching the API endpoint and client expectations
export interface ProjectsParams {
  page: number;
  pageSize: number;
  sort: 'name' | 'value' | 'tier' | 'workers' | 'members' | 'delegates' | 'eba_coverage' | 'employers';
  dir: 'asc' | 'desc';
  q?: string;
  patch?: string; // Comma-separated patch IDs
  tier?: 'all' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
  universe?: 'all' | string;
  stage?: 'all' | string;
  workers?: 'all' | 'zero' | 'nonzero';
  special?: 'all' | 'noBuilderWithEmployers';
  eba?: 'all' | 'eba_active' | 'eba_inactive' | 'builder_unknown';
}

export interface ProjectRecord {
  id: string;
  name: string;
  main_job_site_id: string | null;
  value: number | null;
  tier: string | null;
  organising_universe: string | null;
  stage_class: string | null;
  builder_name: string | null;
  full_address: string | null;
  project_assignments: {
    assignment_type: string;
    employer_id: string;
    contractor_role_types?: { code: string } | null;
    trade_types?: { code: string } | null;
    employers?: { 
      name: string | null;
      enterprise_agreement_status?: boolean | null;
    } | null;
  }[];
}

export interface ProjectSummary {
  project_id: string;
  total_workers: number;
  total_members: number;
  engaged_employer_count: number;
  eba_active_employer_count: number;
  estimated_total: number;
  delegate_name: string | null;
  first_patch_name: string | null;
  organiser_names: string | null;
}

export interface ProjectsResponse {
  projects: ProjectRecord[];
  summaries: Record<string, ProjectSummary>;
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
    patchProjectCount?: number;
    patchFilteringUsed?: boolean;
    patchFilteringMethod?: string;
  };
}

/**
 * Server-side hook for fetching projects with optimized database queries
 * This replaces the complex client-side filtering/sorting with server-side processing
 */
export function useProjectsServerSide(params: ProjectsParams) {
  const { session, loading } = useAuth();
  const workerEnabled = process.env.NEXT_PUBLIC_USE_WORKER_PROJECTS === 'true';
  const workerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL || '';

  return useQuery<ProjectsResponse>({
    queryKey: ['projects-server-side', params, workerEnabled],
    enabled: !workerEnabled || (!!session && !loading),
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
      
      if (params.patch) {
        searchParams.set('patch', params.patch);
      }
      
      if (params.tier && params.tier !== 'all') {
        searchParams.set('tier', params.tier);
      }
      
      if (params.universe && params.universe !== 'all') {
        searchParams.set('universe', params.universe);
      }
      
      if (params.stage && params.stage !== 'all') {
        searchParams.set('stage', params.stage);
      }
      
      if (params.workers && params.workers !== 'all') {
        searchParams.set('workers', params.workers);
      }
      
      if (params.special && params.special !== 'all') {
        searchParams.set('special', params.special);
      }
      
      if (params.eba && params.eba !== 'all') {
        searchParams.set('eba', params.eba);
      }

      const urlPath = `?${searchParams.toString()}`;
      const useWorker = workerEnabled && workerUrl;
      const url = useWorker ? `${workerUrl.replace(/\/$/, '')}/v1/projects${urlPath}` : `/api/projects${urlPath}`;
      console.log('🔄 Fetching projects:', { url, useWorker });

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useWorker) {
        const token = session?.access_token;
        if (!token) {
          throw new Error('No auth token for worker request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { method: 'GET', headers });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch projects: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      // Attach source for debugging UI
      if (data && typeof data === 'object') {
        (data as any).debug = {
          ...(data.debug || {}),
          via: useWorker ? 'worker' : 'app_api',
        };
      }
      
      // Log performance metrics for monitoring
      if (data.debug) {
        console.log(`📊 Projects server-side query completed in ${data.debug.queryTime}ms`);
        if (data.debug.queryTime > 2000) {
          console.warn('⚠️ Slow projects query detected:', data.debug);
        }
      }

      return data;
    },
    
    // Aggressive caching for better performance (projects change less frequently)
    staleTime: 3 * 60 * 1000, // 3 minutes - data is fresh
    gcTime: 15 * 60 * 1000, // 15 minutes - keep in memory longer
    
    // Retry failed requests
    retry: (failureCount, error) => {
      // Don't retry 4xx errors (client errors)
      if (error instanceof Error && error.message.includes('4')) {
        return false;
      }
      // Retry up to 2 times for server errors
      return failureCount < 2;
    },
    
    // Disable background refetching for performance
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    
    // Enable this for real-time updates in the future
    refetchInterval: false,
  });
}

/**
 * Compatibility layer - provides the same interface as the original client-side hook
 * This allows for easy migration without changing the component logic
 */
export function useProjectsServerSideCompatible(params: ProjectsParams) {
  const query = useProjectsServerSide(params);
  const data = query.data as ProjectsResponse | undefined;
  
  return {
    // Transform to match existing client-side hook interface structure
    data: data ? {
      projects: data.projects,
      summaries: data.summaries
    } : null,
    
    // Direct access to projects array for component compatibility
    projects: data?.projects || [],
    summaries: data?.summaries || {},
    
    // Query state
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    
    // Additional server-side specific data
    pagination: data?.pagination,
    debug: data?.debug,
    
    // Computed values that components expect
    totalCount: data?.pagination?.totalCount || 0,
    totalPages: data?.pagination?.totalPages || 0,
    currentPage: data?.pagination?.page || 1,
    hasNext: data?.pagination ? 
      data.pagination.page < data.pagination.totalPages : false,
    hasPrev: data?.pagination ? 
      data.pagination.page > 1 : false,
  };
}

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';

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
  // Alias search parameters
  includeAliases?: boolean;
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical';
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
  // Optional analytics from materialized view
  _mat_view_data?: {
    project_count?: number;
    eba_recency_score?: number;
    is_engaged?: boolean;
    eba_category?: string | null;
    actual_worker_count?: number | null;
    most_recent_eba_date?: string | null;
    view_refreshed_at?: string | null;
  };
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
 * Uses Railway worker for better performance with automatic fallback to Next.js API
 */
export function useEmployersServerSide(params: EmployersParams) {
  const { session, loading } = useAuth();
  const workerEnabled = process.env.NEXT_PUBLIC_USE_WORKER_EMPLOYERS === 'true';
  const workerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL || '';

  // Include session in queryKey so query refetches when session changes
  // This ensures we use the worker when session becomes available
  const hasSession = !!session?.access_token;

  return useQuery<EmployersResponse>({
    queryKey: ['employers-server-side', params, workerEnabled, hasSession],
    // Wait for auth to finish loading before running query
    // The query will re-run if session changes (due to queryKey including hasSession)
    enabled: !loading,
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

      // Enhanced is always true for Railway worker (included in comprehensive view)
      // Kept for backward compatibility with Next.js API fallback
      if (params.enhanced) {
        searchParams.set('enhanced', 'true');
      }

      // Alias search parameters
      if (params.includeAliases) {
        searchParams.set('includeAliases', 'true');
      }

      if (params.aliasMatchMode && params.aliasMatchMode !== 'any') {
        searchParams.set('aliasMatchMode', params.aliasMatchMode);
      }

      const urlPath = `?${searchParams.toString()}`;
      const useWorker = workerEnabled && workerUrl;
      const baseHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
      const appUrl = `/api/employers${urlPath}`;

      // Helper to enrich debug info with source
      const enrichDebug = (data: any, via: 'worker' | 'worker_fallback' | 'app_api') => {
        if (data && typeof data === 'object') {
          (data as any).debug = {
            ...(data.debug || {}),
            via,
          };
        }
        return data;
      };

      // Fallback function to use Next.js API route
      const fetchApp = async (reason: string) => {
        // Only log at debug level unless it's an unexpected failure
        if (process.env.NODE_ENV === 'development' || reason.includes('failed')) {
          console.log('[useEmployersServerSide] Using app route', {
            reason,
            timestamp: new Date().toISOString()
          });
        }
        const response = await fetch(appUrl, { method: 'GET', headers: baseHeaders });
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch employers: ${response.status} ${errorText}`);
        }
        const data = await response.json();

        // Log performance metrics
        if (data.debug?.queryTime > 1000) {
          console.warn('[useEmployersServerSide] Slow query detected:', data.debug);
        }

        return enrichDebug(data, useWorker ? 'worker_fallback' : 'app_api');
      };

      // If worker is not configured, use app route silently
      if (!useWorker) {
        return fetchApp('Worker not configured');
      }

      // Get current token - session may have become available since query was enabled
      const token = session?.access_token;
      if (!token) {
        // No token available - use app route (which handles auth via cookies)
        return fetchApp('No auth token (session not available)');
      }

      const workerHeaders = { ...baseHeaders };
      workerHeaders['Authorization'] = `Bearer ${token}`;

      const workerEndpoint = `${workerUrl.replace(/\/$/, '')}/v1/employers${urlPath}`;

      try {
        const response = await fetch(workerEndpoint, { method: 'GET', headers: workerHeaders });

        if (!response.ok) {
          const errorText = await response.text();
          const status = response.status;
          // Fall back to app route for server errors or auth issues
          if (status >= 500 || status === 429 || status === 401 || status === 403) {
            return fetchApp(`Worker responded with ${status}`);
          }
          throw new Error(`Failed to fetch employers: ${status} ${errorText}`);
        }

        const data = await response.json();
        return enrichDebug(data, 'worker');
      } catch (error) {
        // Network errors - fall back to app route
        return fetchApp(`Worker request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
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

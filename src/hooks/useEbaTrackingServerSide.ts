import { useQuery } from '@tanstack/react-query';

// Types matching the API endpoint
export interface EbaTrackingParams {
  page: number;
  pageSize: number;
  sort: 'name' | 'eba_status' | 'sector';
  dir: 'asc' | 'desc';
  q?: string;
  status?: 'all' | 'certified' | 'lodged' | 'signed' | 'in_progress' | 'no_eba';
  sector?: string;
}

export interface EbaEmployerRecord {
  id: string;
  name: string;
  company_eba_records: {
    id: string;
    sector: string | null;
    contact_name: string | null;
    contact_phone: string | null;
    contact_email: string | null;
    eba_file_number: string | null;
    fwc_lodgement_number: string | null;
    fwc_matter_number: string | null;
    eba_lodged_fwc: string | null;
    date_eba_signed: string | null;
    fwc_certified_date: string | null;
    fwc_document_url: string | null;
    comments: string | null;
  }[];
}

export interface EbaTrackingResponse {
  employers: EbaEmployerRecord[];
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  sectors: string[];
  debug?: {
    queryTime: number;
    cacheHit: boolean;
    appliedFilters: Record<string, any>;
  };
}

/**
 * Server-side hook for fetching EBA tracking data with optimized database queries
 * Leverages the existing employer_list_view with pre-computed EBA categories
 */
export function useEbaTrackingServerSide(params: EbaTrackingParams) {
  return useQuery<EbaTrackingResponse>({
    queryKey: ['eba-tracking-server-side', params],
    queryFn: async () => {
      // Build URL parameters
      const searchParams = new URLSearchParams();
      
      searchParams.set('page', params.page.toString());
      searchParams.set('pageSize', params.pageSize.toString());
      searchParams.set('sort', params.sort);
      searchParams.set('dir', params.dir);
      
      if (params.q) {
        searchParams.set('q', params.q);
      }
      
      if (params.status && params.status !== 'all') {
        searchParams.set('status', params.status);
      }
      
      if (params.sector && params.sector !== 'all') {
        searchParams.set('sector', params.sector);
      }

      const url = `/api/eba-tracking?${searchParams.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch EBA tracking data: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      
      // Log performance metrics
      if (data.debug) {
        if (data.debug.queryTime > 1000) {
          console.warn('⚠️ Slow EBA tracking query detected:', data.debug);
        }
      }

      return data;
    },
    
    // Caching configuration
    staleTime: 3 * 60 * 1000, // 3 minutes (EBA data changes less frequently)
    gcTime: 15 * 60 * 1000, // 15 minutes
    
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
export function useEbaTrackingServerSideCompatible(params: EbaTrackingParams) {
  const query = useEbaTrackingServerSide(params);
  
  return {
    // Transform to match existing client-side hook interface
    data: query.data?.employers || [],
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    
    // Additional server-side specific data
    pagination: query.data?.pagination,
    sectors: query.data?.sectors || [],
    debug: query.data?.debug,
    
    // Computed values that components expect
    totalCount: query.data?.pagination?.totalCount || 0,
    totalPages: query.data?.pagination?.totalPages || 0,
    currentPage: query.data?.pagination?.page || 1,
  };
}

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Request/Response types matching the existing client-side interface
export interface EmployersRequest {
  page: number;
  pageSize: number;
  sort: 'name' | 'estimated' | 'eba_recency';
  dir: 'asc' | 'desc';
  q?: string;
  engaged?: boolean;
  eba?: 'all' | 'active' | 'lodged' | 'pending' | 'no';
  type?: 'all' | 'builder' | 'principal_contractor' | 'large_contractor' | 'small_contractor' | 'individual';
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
  company_eba_records: any[];
  worker_placements: { id: string }[];
  project_assignments: { id: string }[];
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    
    // Create server-side Supabase client
    const supabase = await createServerSupabase();
    
    // Parse parameters with exact same defaults as client-side
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 200); // Cap at 200
    const sort = (searchParams.get('sort') || 'name') as EmployersRequest['sort'];
    const dir = (searchParams.get('dir') || 'asc') as EmployersRequest['dir'];
    const q = searchParams.get('q')?.toLowerCase() || undefined;
    const engagedParam = searchParams.get('engaged');
    const engaged = engagedParam === null ? true : engagedParam === '1'; // Default to engaged=true like client
    const eba = (searchParams.get('eba') || 'all') as EmployersRequest['eba'];
    const type = (searchParams.get('type') || 'all') as EmployersRequest['type'];

    // Build query using the optimized materialized view
    let query = supabase.from('employer_list_view').select('*', { count: 'exact' });

    // Apply filters exactly like client-side logic
    
    // Text search filter - replicate the client-side haystack logic
    if (q) {
      query = query.ilike('search_text', `%${q}%`);
    }

    // Engagement filter - use pre-computed column
    if (engaged !== undefined) {
      query = query.eq('is_engaged', engaged);
    }

    // EBA status filter - use pre-computed column
    if (eba !== 'all') {
      query = query.eq('eba_category', eba);
    }

    // Employer type filter
    if (type !== 'all') {
      query = query.eq('employer_type', type);
    }

    // Apply sorting with exact same logic as client
    const sortMapping = {
      name: 'name',
      estimated: 'estimated_worker_count',
      eba_recency: 'eba_recency_score'
    };
    
    query = query.order(sortMapping[sort], { 
      ascending: dir === 'asc',
      nullsFirst: false 
    });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Employers API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch employers' },
        { status: 500 }
      );
    }

    // Transform data to match client expectations
    const employers: EmployerRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      abn: row.abn,
      employer_type: row.employer_type,
      website: row.website,
      email: row.email,
      phone: row.phone,
      estimated_worker_count: row.estimated_worker_count,
      
      // Transform to match existing client structure
      company_eba_records: row.company_eba_record ? [row.company_eba_record] : [],
      worker_placements: row.worker_placement_ids.map((id: string) => ({ id })),
      project_assignments: row.project_assignment_ids.map((id: string) => ({ id })),
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const queryTime = Date.now() - startTime;

    const response: EmployersResponse = {
      employers,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      },
      debug: {
        queryTime,
        cacheHit: false, // TODO: Implement caching in future
        appliedFilters: {
          q,
          engaged,
          eba,
          type,
          sort,
          dir
        }
      }
    };

    // Add cache headers for CDN/browser caching
    const headers = {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300', // 2min cache, 5min stale
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Employers API unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();
    
    // Quick health check - just count employers
    const { count, error } = await supabase
      .from('employer_list_view')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Employers': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

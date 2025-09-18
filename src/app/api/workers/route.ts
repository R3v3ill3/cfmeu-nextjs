import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Request/Response types matching the existing client-side interface
export interface WorkersRequest {
  page: number;
  pageSize: number;
  sort: 'name' | 'member_number' | 'placements';
  dir: 'asc' | 'desc';
  q?: string;
  membership?: 'all' | 'member' | 'non_member';
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Create server-side Supabase client
    const supabase = await createServerSupabase();
    
    // Parse parameters with defaults matching client-side
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 200); // Cap at 200
    const sort = (searchParams.get('sort') || 'name') as WorkersRequest['sort'];
    const dir = (searchParams.get('dir') || 'asc') as WorkersRequest['dir'];
    const q = searchParams.get('q')?.toLowerCase() || undefined;
    const membership = (searchParams.get('membership') || 'all') as WorkersRequest['membership'];

    // Build query using the optimized materialized view
    let query = supabase.from('worker_list_view').select('*', { count: 'exact' });

    // Apply filters
    
    // Text search filter - use pre-computed search text
    if (q) {
      query = query.ilike('search_text', `%${q}%`);
    }

    // Membership status filter
    if (membership !== 'all') {
      if (membership === 'member') {
        query = query.not('union_membership_status', 'is', null)
               .not('union_membership_status', 'eq', '')
               .neq('union_membership_status', 'non_member');
      } else if (membership === 'non_member') {
        query = query.or('union_membership_status.is.null,union_membership_status.eq.,union_membership_status.eq.non_member');
      }
    }

    // Apply sorting
    const sortMapping = {
      name: ['first_name', 'surname'],
      member_number: ['member_number'],
      placements: ['worker_placement_count']
    };
    
    if (sort === 'name') {
      query = query.order('first_name', { ascending: dir === 'asc' })
                   .order('surname', { ascending: dir === 'asc' });
    } else if (sort === 'member_number') {
      query = query.order('member_number', { 
        ascending: dir === 'asc',
        nullsFirst: dir === 'desc' 
      });
    } else if (sort === 'placements') {
      query = query.order('worker_placement_count', { 
        ascending: dir === 'asc',
        nullsFirst: false 
      });
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Workers API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch workers' },
        { status: 500 }
      );
    }

    // Transform data to match client expectations
    const workers: WorkerRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      first_name: row.first_name,
      surname: row.surname,
      nickname: row.nickname,
      email: row.email,
      mobile_phone: row.mobile_phone,
      member_number: row.member_number,
      union_membership_status: row.union_membership_status,
      
      // Transform to match existing client structure
      worker_placements: row.worker_placements_data || [],
      organisers: row.organiser_data || null,
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const queryTime = Date.now() - startTime;

    const response: WorkersResponse = {
      workers,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      },
      debug: {
        queryTime,
        cacheHit: false,
        appliedFilters: {
          q,
          membership,
          sort,
          dir
        }
      }
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Workers API unexpected error:', error);
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
    
    const { count, error } = await supabase
      .from('worker_list_view')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Workers': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

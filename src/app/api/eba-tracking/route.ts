import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Request/Response types
export interface EbaTrackingRequest {
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Create server-side Supabase client
    const supabase = await createServerSupabase();
    
    // Parse parameters
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '50'), 200);
    const sort = (searchParams.get('sort') || 'name') as EbaTrackingRequest['sort'];
    const dir = (searchParams.get('dir') || 'asc') as EbaTrackingRequest['dir'];
    const q = searchParams.get('q')?.toLowerCase() || undefined;
    const status = (searchParams.get('status') || 'all') as EbaTrackingRequest['status'];
    const sector = searchParams.get('sector') || undefined;

    // Build query using the optimized employer_list_view
    let query = supabase.from('employer_list_view').select('*', { count: 'exact' });

    // Apply filters
    
    // Text search filter
    if (q) {
      query = query.ilike('search_text', `%${q}%`);
    }

    // EBA status filter using pre-computed eba_category
    if (status !== 'all') {
      if (status === 'no_eba') {
        query = query.eq('eba_category', 'no');
      } else if (status === 'certified') {
        query = query.eq('eba_category', 'active');
      } else if (status === 'lodged') {
        query = query.eq('eba_category', 'lodged');
      } else if (status === 'signed') {
        query = query.eq('eba_category', 'pending');
      } else if (status === 'in_progress') {
        query = query.in('eba_category', ['pending', 'lodged']);
      }
    }

    // Sector filter - this requires checking the company_eba_record JSON
    if (sector && sector !== 'all') {
      query = query.filter('company_eba_record->sector', 'eq', sector);
    }

    // Apply sorting
    if (sort === 'name') {
      query = query.order('name', { ascending: dir === 'asc' });
    } else if (sort === 'eba_status') {
      query = query.order('eba_category', { ascending: dir === 'asc' });
    } else if (sort === 'sector') {
      // Sort by sector from the EBA record
      query = query.order('company_eba_record->sector', { 
        ascending: dir === 'asc',
        nullsFirst: dir === 'desc'
      });
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('EBA Tracking API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch EBA tracking data' },
        { status: 500 }
      );
    }

    // Get unique sectors for filter dropdown
    const { data: sectorsData } = await supabase
      .from('employer_list_view')
      .select('company_eba_record->sector')
      .not('company_eba_record->sector', 'is', null)
      .not('company_eba_record->sector', 'eq', '');

    const sectors = Array.from(new Set(
      (sectorsData || [])
        .map((row: any) => row.company_eba_record?.sector)
        .filter(Boolean)
    )).sort();

    // Transform data to match client expectations
    const employers: EbaEmployerRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      company_eba_records: row.company_eba_record ? [row.company_eba_record] : [],
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const queryTime = Date.now() - startTime;

    const response: EbaTrackingResponse = {
      employers,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages
      },
      sectors,
      debug: {
        queryTime,
        cacheHit: false,
        appliedFilters: {
          q,
          status,
          sector,
          sort,
          dir
        }
      }
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300', // 3min cache
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('EBA Tracking API unexpected error:', error);
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
    
    // Count employers with EBA activity
    const { count, error } = await supabase
      .from('employer_list_view')
      .select('*', { count: 'exact', head: true })
      .neq('eba_category', 'no');
    
    if (error) throw error;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Eba-Employers': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

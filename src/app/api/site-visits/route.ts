import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic'

// Request/Response types
export interface SiteVisitsRequest {
  page: number;
  pageSize: number;
  sort: 'date' | 'project' | 'employer' | 'organiser';
  dir: 'asc' | 'desc';
  q?: string;
  status?: 'all' | 'stale';
  projectId?: string;
}

export interface SiteVisitRecord {
  id: string;
  date: string; // Will map from scheduled_at or created_at
  notes: string | null; // Will map from objective
  job_sites: {
    name: string | null;
    full_address: string | null;
    location: any;
    projects: {
      name: string | null;
    } | null;
  } | null;
  employers: {
    name: string | null;
  } | null;
  profiles: {
    full_name: string | null;
  } | null;
}

export interface SiteVisitsResponse {
  visits: SiteVisitRecord[];
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
    
    const supabase = await createServerSupabase();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Site visits API failed to load profile:', profileError);
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Parse parameters
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '200'), 500); // Cap at 500
    const sort = (searchParams.get('sort') || 'date') as SiteVisitsRequest['sort'];
    const dir = (searchParams.get('dir') || 'desc') as SiteVisitsRequest['dir'];
    const q = searchParams.get('q')?.toLowerCase() || undefined;
    const status = (searchParams.get('status') || 'all') as SiteVisitsRequest['status'];
    const projectId = searchParams.get('projectId') || undefined;

    // Build query using the optimized materialized view
    let query = supabase.from('site_visit_list_view').select('*', { count: 'exact' });

    // Apply filters
    
    // Text search filter
    if (q) {
      query = query.ilike('search_text', `%${q}%`);
    }

    // Status filter (stale vs all)
    if (status === 'stale') {
      query = query.eq('is_stale', true);
    }

    // Project filter
    if (projectId) {
      query = query.eq('project_id', projectId);
    }

    // Apply sorting
    if (sort === 'date') {
      // Sort by scheduled_at first, then created_at as fallback
      query = query.order('scheduled_at', { ascending: dir === 'asc', nullsFirst: false })
                   .order('created_at', { ascending: dir === 'asc', nullsFirst: false });
    } else if (sort === 'project') {
      query = query.order('project_name', { 
        ascending: dir === 'asc',
        nullsFirst: dir === 'desc'
      });
    } else if (sort === 'employer') {
      query = query.order('employer_name', { 
        ascending: dir === 'asc',
        nullsFirst: dir === 'desc'
      });
    } else if (sort === 'organiser') {
      // Since there's no organiser data, fall back to date sorting
      query = query.order('scheduled_at', { ascending: dir === 'asc', nullsFirst: false });
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Site Visits API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch site visits' },
        { status: 500 }
      );
    }

    // Transform data to match client expectations
    const visits: SiteVisitRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      // Map scheduled_at or created_at to "date" for client compatibility
      date: row.scheduled_at || row.created_at,
      // Map objective to "notes" for client compatibility
      notes: row.objective,
      
      // Transform structured data to match client expectations
      job_sites: row.job_sites_data,
      employers: row.employers_data,
      profiles: row.profiles_data, // Will be null but maintains structure
    }));

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const queryTime = Date.now() - startTime;

    const response: SiteVisitsResponse = {
      visits,
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
          status,
          projectId,
          sort,
          dir
        }
      }
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Site Visits API unexpected error:', error);
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
      .from('site_visit_list_view')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Site-Visits': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

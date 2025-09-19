import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'

// Helper function to fetch enhanced employer data (projects, organisers, incolink IDs)
async function fetchEnhancedEmployerData(supabase: any, employerIds: string[]) {
  const enhancedData: Record<string, any> = {};

  // Initialize all employers with empty data
  employerIds.forEach(id => {
    enhancedData[id] = {
      incolink_id: null,
      projects: [],
      organisers: []
    };
  });

  try {
    // Fetch incolink IDs
    const { data: incolinkData } = await supabase
      .from('employers')
      .select('id, incolink_id')
      .in('id', employerIds)
      .not('incolink_id', 'is', null);

    (incolinkData || []).forEach((row: any) => {
      if (enhancedData[row.id]) {
        enhancedData[row.id].incolink_id = row.incolink_id;
      }
    });

    // Fetch project assignments with roles and trades
    const { data: projectData } = await supabase
      .from('project_assignments')
      .select(`
        employer_id,
        assignment_type,
        projects!inner(id, name),
        contractor_role_types(code),
        trade_types(code)
      `)
      .in('employer_id', employerIds);

    // Group by employer and project
    const projectsByEmployer: Record<string, Record<string, any>> = {};
    (projectData || []).forEach((row: any) => {
      if (!projectsByEmployer[row.employer_id]) {
        projectsByEmployer[row.employer_id] = {};
      }
      
      const projectId = row.projects.id;
      if (!projectsByEmployer[row.employer_id][projectId]) {
        projectsByEmployer[row.employer_id][projectId] = {
          id: projectId,
          name: row.projects.name,
          roles: [],
          trades: []
        };
      }

      // Add roles and trades
      if (row.assignment_type === 'contractor_role' && row.contractor_role_types) {
        const roleCode = row.contractor_role_types.code;
        if (roleCode && !projectsByEmployer[row.employer_id][projectId].roles.includes(roleCode)) {
          projectsByEmployer[row.employer_id][projectId].roles.push(roleCode);
        }
      }

      if (row.assignment_type === 'trade_work' && row.trade_types) {
        const tradeCode = row.trade_types.code;
        if (tradeCode && !projectsByEmployer[row.employer_id][projectId].trades.includes(tradeCode)) {
          projectsByEmployer[row.employer_id][projectId].trades.push(tradeCode);
        }
      }
    });

    // Convert to array format and add to enhanced data
    Object.entries(projectsByEmployer).forEach(([employerId, projects]) => {
      if (enhancedData[employerId]) {
        enhancedData[employerId].projects = Object.values(projects);
      }
    });

    // Fetch organisers for these projects
    const allProjectIds = Object.values(projectsByEmployer)
      .flatMap(projects => Object.keys(projects));

    if (allProjectIds.length > 0) {
      const { data: organiserData } = await supabase
        .from('job_sites')
        .select(`
          project_id,
          patches!inner(
            id,
            name,
            organisers(id, first_name, surname)
          )
        `)
        .in('project_id', allProjectIds);

      // Map organisers back to employers
      const organisersByProject: Record<string, any[]> = {};
      (organiserData || []).forEach((row: any) => {
        if (!organisersByProject[row.project_id]) {
          organisersByProject[row.project_id] = [];
        }
        if (row.patches && row.patches.organisers) {
          row.patches.organisers.forEach((organiser: any) => {
            const orgData = {
              id: organiser.id,
              name: `${organiser.first_name} ${organiser.surname}`.trim(),
              patch_name: row.patches.name
            };
            // Avoid duplicates
            if (!organisersByProject[row.project_id].find(o => o.id === orgData.id)) {
              organisersByProject[row.project_id].push(orgData);
            }
          });
        }
      });

      // Add organisers to enhanced data
      Object.entries(projectsByEmployer).forEach(([employerId, projects]) => {
        const uniqueOrganisers: any[] = [];
        Object.keys(projects).forEach(projectId => {
          if (organisersByProject[projectId]) {
            organisersByProject[projectId].forEach((org: any) => {
              if (!uniqueOrganisers.find(o => o.id === org.id)) {
                uniqueOrganisers.push(org);
              }
            });
          }
        });
        
        if (enhancedData[employerId]) {
          enhancedData[employerId].organisers = uniqueOrganisers;
        }
      });
    }

  } catch (error) {
    console.error('Error fetching enhanced employer data:', error);
    // Return the initialized empty data on error
  }

  return enhancedData;
}

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
  incolink_id: string | null;
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
    const searchParams = request.nextUrl.searchParams;
    
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

    // Build query using the optimized materialized view plus additional data
    let query = supabase.from('employer_list_view').select('*', { count: 'exact' });
    
    // Add parameter to control whether to include enhanced data (projects, organisers)
    const includeEnhanced = searchParams.get('enhanced') === 'true';

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

    // Fetch enhanced data if requested
    let enhancedData: Record<string, any> = {};
    if (includeEnhanced && data && data.length > 0) {
      const employerIds = data.map((row: any) => row.id);
      enhancedData = await fetchEnhancedEmployerData(supabase, employerIds);
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
      incolink_id: null, // Will be set from enhancedData if available
      
      // Transform to match existing client structure
      company_eba_records: row.company_eba_record ? [row.company_eba_record] : [],
      worker_placements: row.worker_placement_ids.map((id: string) => ({ id })),
      project_assignments: row.project_assignment_ids.map((id: string) => ({ id })),
      
      // Add enhanced data if available
      ...(includeEnhanced && enhancedData[row.id] ? enhancedData[row.id] : {}),
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

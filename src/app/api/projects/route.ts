import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// Helper function to escape ILIKE special characters (%, _, \)
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&');
}

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic'

// Request/Response types matching the existing client-side interface
export interface ProjectsRequest {
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
  created_at?: string;
  full_address: string | null;
  project_assignments: {
    assignment_type: string;
    employer_id: string;
    contractor_role_types?: { code: string } | null;
    trade_types?: { code: string } | null;
    employers?: { 
      name: string | null;
      enterprise_agreement_status?: boolean | null;
      eba_status_source?: string | null;
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

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    
    // Create server-side Supabase client
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
      .select('id, role, last_seen_projects_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Projects API failed to load profile:', profileError);
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Parse parameters with exact same defaults as client-side
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '24'), 100); // Cap at 100
    const sort = (searchParams.get('sort') || 'name') as ProjectsRequest['sort'];
    const dir = (searchParams.get('dir') || 'asc') as ProjectsRequest['dir'];
    const q = searchParams.get('q')?.toLowerCase() || undefined;
    const patchParam = searchParams.get('patch') || undefined;
    const tier = (searchParams.get('tier') || 'all') as ProjectsRequest['tier'];
    const universe = searchParams.get('universe') || 'all';
    const stage = searchParams.get('stage') || 'all';
    const workers = (searchParams.get('workers') || 'all') as ProjectsRequest['workers'];
    const special = (searchParams.get('special') || 'all') as ProjectsRequest['special'];
    const eba = (searchParams.get('eba') || 'all') as ProjectsRequest['eba'];
    const newOnlyParam = searchParams.get('newOnly');
    const newOnly = newOnlyParam === '1' || newOnlyParam === 'true';
    const sinceParam = searchParams.get('since') || undefined;

    // Parse patch IDs
    const patchIds = patchParam ? patchParam.split(',').map(s => s.trim()).filter(Boolean) : [];

    // Build query using the optimized materialized view
    let query = supabase.from('project_list_comprehensive_view').select('*', { count: 'exact' });

    // Apply patch filtering first (most selective)
    let patchProjectCount = 0;
    let patchFilteringMethod = 'none';
    if (patchIds.length > 0) {
      // Primary: Use the patch mapping view for efficient filtering
      let { data: patchProjects, error: viewError } = await supabase
        .from('patch_project_mapping_view')
        .select('project_id')
        .in('patch_id', patchIds);
      
      let usedFallback = false;
      
      // Fallback: If materialized view is empty/stale, query job_sites directly
      if (!patchProjects || patchProjects.length === 0) {
        console.warn('⚠️ patch_project_mapping_view returned no results, falling back to job_sites query');
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)
          .not('project_id', 'is', null);
          
        if (fallbackError) {
          console.error('❌ Fallback patch filtering error:', fallbackError);
          throw fallbackError;
        }
        
        patchProjects = fallbackData;
        usedFallback = true;
        
        // Background refresh is handled by the dashboard worker cron; do not block this request here
      }
      
      patchProjectCount = patchProjects?.length || 0;
      patchFilteringMethod = usedFallback ? 'fallback_job_sites' : 'materialized_view';
      
      if (patchProjectCount === 0) {
        // No projects match the patch filter (verified with fallback)
        const response: ProjectsResponse = {
          projects: [],
          summaries: {},
          pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
          debug: {
            queryTime: Date.now() - startTime,
            cacheHit: false,
            appliedFilters: { patchIds, patchProjectCount: 0 },
            patchFilteringUsed: true,
            patchFilteringMethod
          }
        };
        return NextResponse.json(response);
      }
      
      const projectIds = Array.from(new Set(patchProjects!.map(row => row.project_id)));
      query = query.in('id', projectIds);
    }

    // Apply filters exactly like client-side logic
    
    // Text search filter
    if (q) {
      query = query.ilike('search_text', `%${escapeLikePattern(q)}%`);
    }

    // Tier filter
    if (tier !== 'all') {
      query = query.eq('tier', tier);
    }

    // Universe filter
    if (universe !== 'all') {
      query = query.eq('organising_universe', universe);
    }

    // Stage filter
    if (stage !== 'all') {
      query = query.eq('stage_class', stage);
    }

    // Workers filter (using pre-computed total_workers)
    if (workers === 'zero') {
      query = query.eq('total_workers', 0);
    } else if (workers === 'nonzero') {
      query = query.gt('total_workers', 0);
    }

    // Special filter: "No Builder, Has Employers"
    if (special === 'noBuilderWithEmployers') {
      query = query.eq('has_builder', false).gt('engaged_employer_count', 0);
    }

    // EBA filter using pre-computed builder status
    if (eba !== 'all') {
      if (eba === 'eba_active') {
        // Builder/Main contractor EBA = active
        query = query.eq('has_builder', true).eq('builder_has_eba', true);
      } else if (eba === 'eba_inactive') {
        // Builder/Main Contractor known, EBA status not active
        query = query.eq('has_builder', true).eq('builder_has_eba', false);
      } else if (eba === 'builder_unknown') {
        // Builder/Main Contractor unknown
        query = query.eq('has_builder', false);
      }
    }

    // Apply "new only" filter using created_at
    if (newOnly) {
      // Determine effective since timestamp: URL param or user's last_seen_projects_at
      const effectiveSince = sinceParam || (profile as any)?.last_seen_projects_at || null;
      if (effectiveSince) {
        query = query.gt('created_at', effectiveSince);
      } else {
        // If no since available, treat as none (no filter)
      }
    }

    // Apply sorting with exact same logic as client plus created_at support
    const needsClientSorting = ["workers", "members", "delegates", "eba_coverage", "employers"].includes(sort);
    
    if (!needsClientSorting) {
      // Database-sortable fields
      if (sort === 'name') {
        query = query.order('name', { ascending: dir === 'asc' });
      } else if (sort === 'value') {
        query = query.order('value', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'tier') {
        query = query.order('tier', { ascending: dir === 'asc', nullsFirst: false });
      } else {
        // Default to created_at desc if unspecified, or allow explicit created_at sort
        query = query.order('created_at', { ascending: dir === 'asc' });
      }
    } else {
      // Pre-computed summary fields can now be sorted server-side too!
      if (sort === 'workers') {
        query = query.order('total_workers', { ascending: dir === 'asc' });
      } else if (sort === 'members') {
        query = query.order('total_members', { ascending: dir === 'asc' });
      } else if (sort === 'employers') {
        query = query.order('engaged_employer_count', { ascending: dir === 'asc' });
      } else if (sort === 'eba_coverage') {
        query = query.order('eba_coverage_percent', { ascending: dir === 'asc' });
      } else if (sort === 'delegates') {
        // Sort by whether delegate_name exists
        query = query.order('delegate_name', { ascending: dir === 'asc', nullsFirst: dir === 'desc' });
      }
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Projects API error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    // Transform data to match client expectations
    const projects: ProjectRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      main_job_site_id: row.main_job_site_id,
      value: row.value,
      tier: row.tier,
      organising_universe: row.organising_universe,
      stage_class: row.stage_class,
      created_at: row.created_at,
      full_address: row.full_address,
      
      // Transform project_assignments_data back to expected format
      project_assignments: (row.project_assignments_data || []).map((assignment: any) => ({
        ...assignment,
        employers: assignment.employers
          ? {
              ...assignment.employers,
              enterprise_agreement_status: assignment.employers.enterprise_agreement_status ?? null,
              eba_status_source: assignment.employers.eba_status_source ?? null,
            }
          : null,
      })),
    }));

    // Transform summaries to match client expectations
    const summaries: Record<string, ProjectSummary> = {};
    (data || []).forEach((row: any) => {
      summaries[row.id] = {
        project_id: row.id,
        total_workers: row.total_workers || 0,
        total_members: row.total_members || 0,
        engaged_employer_count: row.engaged_employer_count || 0,
        eba_active_employer_count: row.eba_active_employer_count || 0,
        estimated_total: row.estimated_total || 0,
        delegate_name: row.delegate_name,
        first_patch_name: row.first_patch_name,
        organiser_names: row.organiser_names,
      };
    });

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);
    const queryTime = Date.now() - startTime;

    const response: ProjectsResponse = {
      projects,
      summaries,
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
            patchIds,
            tier,
            universe,
            stage,
            workers,
            special,
            eba,
            sort,
            dir,
            newOnly,
            since: sinceParam || (profile as any)?.last_seen_projects_at || null
          },
          patchProjectCount,
          patchFilteringUsed: patchIds.length > 0,
          patchFilteringMethod
        }
    };

    // Add cache headers for CDN/browser caching
    const headers = {
      'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300', // 3min cache
      'Content-Type': 'application/json'
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Projects API unexpected error:', error);
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
      .from('project_list_comprehensive_view')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Projects': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}

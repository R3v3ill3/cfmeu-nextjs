import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

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
  sort: 'name' | 'value' | 'tier' | 'workers' | 'members' | 'delegates' | 'eba_coverage' | 'employers' | 'key_contractors_rated_value';
  dir: 'asc' | 'desc';
  q?: string;
  patch?: string; // Comma-separated patch IDs
  tier?: 'all' | 'tier1' | 'tier2' | 'tier3' | 'tier4';
  universe?: 'all' | string;
  stage?: 'all' | string;
  workers?: 'all' | 'zero' | 'nonzero';
  special?: 'all' | 'noBuilderWithEmployers';
  eba?: 'all' | 'eba_active' | 'eba_inactive' | 'builder_unknown';
  ratingStatus?: 'all' | 'rated' | 'unrated';
  auditStatus?: 'all' | 'has_audit' | 'no_audit';
  mappingStatus?: 'all' | 'no_roles' | 'no_trades' | 'bci_only' | 'has_manual';
  mappingUpdateStatus?: 'all' | 'recent' | 'recent_week' | 'stale' | 'never';
  complianceCheckStatus?: 'all' | '0-3_months' | '3-6_months' | '6-12_months' | '12_plus_never';
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
  // New computed fields for filtering
  has_project_rating?: boolean;
  has_compliance_checks?: boolean;
  mapping_status?: 'no_roles' | 'no_trades' | 'bci_only' | 'has_manual';
  mapping_last_updated?: string | null;
  last_compliance_check_date?: string | null;
  key_contractors_rated_value?: number | null;
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

// Internal handler (wrapped with rate limiting below)
async function getProjectsHandler(request: NextRequest) {
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
      // #region agent log
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:auth',message:'projects api unauthorized',data:{path:request.nextUrl.pathname,sbCookieCount:request.cookies.getAll().filter(c=>c.name.startsWith("sb-")).length,authErrorMessage:authError?.message??null,authErrorStatus:(authError as any)?.status??null},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, last_seen_projects_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Projects API failed to load profile:', profileError);
      // #region agent log
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:profile',message:'projects api failed to load profile',data:{path:request.nextUrl.pathname,userIdSuffix:user.id.slice(-6),sbCookieCount:request.cookies.getAll().filter(c=>c.name.startsWith("sb-")).length,errorMessage:profileError.message,errorCode:(profileError as any).code??null,errorHint:(profileError as any).hint??null},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
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
    const ratingStatus = (searchParams.get('ratingStatus') || 'all') as ProjectsRequest['ratingStatus'];
    const auditStatus = (searchParams.get('auditStatus') || 'all') as ProjectsRequest['auditStatus'];
    const mappingStatus = (searchParams.get('mappingStatus') || 'all') as ProjectsRequest['mappingStatus'];
    const mappingUpdateStatus = (searchParams.get('mappingUpdateStatus') || 'all') as ProjectsRequest['mappingUpdateStatus'];
    const complianceCheckStatus = (searchParams.get('complianceCheckStatus') || 'all') as ProjectsRequest['complianceCheckStatus'];
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
      // Log patch filtering for debugging
      console.log(`🔍 Projects API: Applying patch filter for ${patchIds.length} patches:`, patchIds);
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

    // IMPORTANT:
    // The status filters (ratings/audit/mapping/compliance recency) are computed via extra queries.
    // When NONE of these filters are active (the common/default case), we must NOT:
    // 1) fetch ALL matching IDs, then
    // 2) apply `.in('id', hugeList)` for pagination
    //
    // That pattern can generate extremely large requests (long URLs) and leads to runtime `TypeError: fetch failed`
    // as seen in debug logs. Instead, paginate first, then compute status fields for just the page IDs.
    const statusFiltersActive =
      ratingStatus !== 'all' ||
      auditStatus !== 'all' ||
      mappingStatus !== 'all' ||
      mappingUpdateStatus !== 'all' ||
      complianceCheckStatus !== 'all';

    const canPaginateBeforeStatusComputation = !statusFiltersActive && sort !== 'key_contractors_rated_value';

    if (canPaginateBeforeStatusComputation) {
      // Apply sorting (mirrors the later logic, but without the expensive status-filter path)
      if (sort === 'name') {
        query = query.order('name', { ascending: dir === 'asc' });
      } else if (sort === 'value') {
        query = query.order('value', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'tier') {
        query = query.order('tier', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'workers') {
        query = query.order('total_workers', { ascending: dir === 'asc' });
      } else if (sort === 'members') {
        query = query.order('total_members', { ascending: dir === 'asc' });
      } else if (sort === 'employers') {
        query = query.order('engaged_employer_count', { ascending: dir === 'asc' });
      } else if (sort === 'eba_coverage') {
        query = query.order('eba_coverage_percent', { ascending: dir === 'asc' });
      } else if (sort === 'delegates') {
        query = query.order('delegate_name', { ascending: dir === 'asc', nullsFirst: dir === 'desc' });
      } else {
        query = query.order('created_at', { ascending: dir === 'asc' });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const paginated = await query.range(from, to);

      if (paginated.error) {
        console.error('Projects API error:', paginated.error);
        // #region agent log
        if (process.env.NODE_ENV !== 'production') {
          fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:fetch_page',message:'projects api failed fetching paginated view rows (fast path)',data:{path:request.nextUrl.pathname,userIdSuffix:user.id.slice(-6),sbCookieCount:request.cookies.getAll().filter(c=>c.name.startsWith("sb-")).length,errorMessage:paginated.error.message,errorCode:(paginated.error as any).code??null},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
        return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
      }

      const data = paginated.data || [];
      const count = paginated.count || 0;
      const pageProjectIds = data.map((row: any) => row.id).filter(Boolean) as string[];

      // Compute status fields only for the projects on this page
      const [ratingData, complianceData, mappingData] = await Promise.all([
        supabase
          .from('project_compliance_assessments')
          .select('project_id')
          .in('project_id', pageProjectIds)
          .eq('is_active', true),
        supabase
          .from('employer_compliance_checks')
          .select('project_id, updated_at, cbus_check_date, incolink_check_date')
          .in('project_id', pageProjectIds)
          .eq('is_current', true),
        supabase
          .from('project_assignments')
          .select('project_id, assignment_type, source, updated_at')
          .in('project_id', pageProjectIds),
      ]);

      const projectRatings = new Set((ratingData.data || []).map((r: any) => r.project_id));
      const projectComplianceChecks = new Map<string, { hasCheck: boolean; lastDate: string | null }>();
      const projectMappingStatus = new Map<string, { status: string; lastUpdated: string | null }>();

      (complianceData.data || []).forEach((check: any) => {
        const projectId = check.project_id;
        const dates = [
          check.updated_at,
          check.cbus_check_date ? new Date(check.cbus_check_date).toISOString() : null,
          check.incolink_check_date ? new Date(check.incolink_check_date).toISOString() : null
        ].filter(Boolean) as string[];

        const lastDate = dates.length > 0 ? dates.sort().reverse()[0] : null;

        if (!projectComplianceChecks.has(projectId)) {
          projectComplianceChecks.set(projectId, { hasCheck: true, lastDate });
        } else {
          const existing = projectComplianceChecks.get(projectId)!;
          if (lastDate && (!existing.lastDate || lastDate > existing.lastDate)) {
            existing.lastDate = lastDate;
          }
        }
      });

      const mappingByProject = new Map<string, { hasRoles: boolean; hasTrades: boolean; sources: Set<string>; lastUpdated: string | null }>();
      (mappingData.data || []).forEach((assignment: any) => {
        const projectId = assignment.project_id;
        if (!mappingByProject.has(projectId)) {
          mappingByProject.set(projectId, {
            hasRoles: false,
            hasTrades: false,
            sources: new Set(),
            lastUpdated: null
          });
        }

        const proj = mappingByProject.get(projectId)!;
        if (assignment.assignment_type === 'contractor_role') {
          proj.hasRoles = true;
        } else if (assignment.assignment_type === 'trade_work') {
          proj.hasTrades = true;
        }

        if (assignment.source) {
          proj.sources.add(assignment.source);
        }

        if (assignment.updated_at) {
          if (!proj.lastUpdated || assignment.updated_at > proj.lastUpdated) {
            proj.lastUpdated = assignment.updated_at;
          }
        }
      });

      pageProjectIds.forEach((projectId) => {
        if (!mappingByProject.has(projectId)) {
          projectMappingStatus.set(projectId, { status: 'no_roles', lastUpdated: null });
        } else {
          const m = mappingByProject.get(projectId)!;
          let status: string;
          if (!m.hasRoles) {
            status = 'no_roles';
          } else if (!m.hasTrades) {
            status = 'no_trades';
          } else if (m.sources.size === 1 && m.sources.has('bci_import')) {
            status = 'bci_only';
          } else {
            status = 'has_manual';
          }
          projectMappingStatus.set(projectId, { status, lastUpdated: m.lastUpdated });
        }
      });

      const projects: ProjectRecord[] = (data || []).map((row: any) => {
        const projectId = row.id;
        const mapping = projectMappingStatus.get(projectId);
        const compliance = projectComplianceChecks.get(projectId);

        return {
          id: row.id,
          name: row.name,
          main_job_site_id: row.main_job_site_id,
          value: row.value,
          tier: row.tier,
          organising_universe: row.organising_universe,
          stage_class: row.stage_class,
          created_at: row.created_at,
          full_address: row.full_address,
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
          has_project_rating: projectRatings.has(projectId),
          has_compliance_checks: compliance?.hasCheck || false,
          mapping_status: mapping?.status as any,
          mapping_last_updated: mapping?.lastUpdated || null,
          last_compliance_check_date: compliance?.lastDate || null,
          key_contractors_rated_value: null,
        };
      });

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

      const totalPages = Math.ceil(count / pageSize);
      const queryTime = Date.now() - startTime;

      const response: ProjectsResponse = {
        projects,
        summaries,
        pagination: { page, pageSize, totalCount: count, totalPages },
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
            ratingStatus,
            auditStatus,
            mappingStatus,
            mappingUpdateStatus,
            complianceCheckStatus,
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

      const headers = {
        'Cache-Control': 'public, s-maxage=180, stale-while-revalidate=300',
        'Content-Type': 'application/json'
      };

      return NextResponse.json(response, { headers });
    }

    // Fetch all matching projects first (before pagination) to compute status fields
    // We'll apply status-based filters and then paginate
    const { data: allProjectsData, error: allProjectsError } = await query.select('id');
    
    if (allProjectsError) {
      console.error('Projects API error fetching project IDs:', allProjectsError);
      // #region agent log
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:project_ids',message:'projects api failed fetching project ids from view',data:{path:request.nextUrl.pathname,userIdSuffix:user.id.slice(-6),sbCookieCount:request.cookies.getAll().filter(c=>c.name.startsWith("sb-")).length,errorMessage:allProjectsError.message,errorCode:(allProjectsError as any).code??null},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      return NextResponse.json(
        { error: 'Failed to fetch projects' },
        { status: 500 }
      );
    }

    const allProjectIds = (allProjectsData || []).map((p: any) => p.id);
    
    if (allProjectIds.length === 0) {
      // No projects match the base filters
      const response: ProjectsResponse = {
        projects: [],
        summaries: {},
        pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
        debug: {
          queryTime: Date.now() - startTime,
          cacheHit: false,
          appliedFilters: {
            q, patchIds, tier, universe, stage, workers, special, eba,
            ratingStatus, auditStatus, mappingStatus, mappingUpdateStatus, complianceCheckStatus,
            sort, dir, newOnly, since: sinceParam || (profile as any)?.last_seen_projects_at || null
          },
          patchProjectCount,
          patchFilteringUsed: patchIds.length > 0,
          patchFilteringMethod
        }
      };
      return NextResponse.json(response);
    }

    // Fetch status data for all matching projects in parallel
    const [ratingData, complianceData, mappingData, keyContractorTrades] = await Promise.all([
      // Project-specific ratings (project_compliance_assessments)
      supabase
        .from('project_compliance_assessments')
        .select('project_id')
        .in('project_id', allProjectIds)
        .eq('is_active', true),
      
      // Compliance checks (employer_compliance_checks)
      supabase
        .from('employer_compliance_checks')
        .select('project_id, updated_at, cbus_check_date, incolink_check_date')
        .in('project_id', allProjectIds)
        .eq('is_current', true),
      
      // Mapping status (project_assignments)
      supabase
        .from('project_assignments')
        .select('project_id, assignment_type, source, updated_at')
        .in('project_id', allProjectIds),
      
      // Key contractor trades for rating value calculation
      supabase
        .from('key_contractor_trades')
        .select('trade_type')
        .eq('is_active', true)
    ]);

    // Process status data into maps for efficient lookup
    const projectRatings = new Set((ratingData.data || []).map((r: any) => r.project_id));
    const projectComplianceChecks = new Map<string, { hasCheck: boolean; lastDate: string | null }>();
    const projectMappingStatus = new Map<string, { status: string; lastUpdated: string | null }>();
    const keyContractorTradeCodes = new Set((keyContractorTrades.data || []).map((t: any) => t.trade_type));

    // Process compliance checks
    (complianceData.data || []).forEach((check: any) => {
      const projectId = check.project_id;
      const dates = [
        check.updated_at,
        check.cbus_check_date ? new Date(check.cbus_check_date).toISOString() : null,
        check.incolink_check_date ? new Date(check.incolink_check_date).toISOString() : null
      ].filter(Boolean) as string[];
      
      const lastDate = dates.length > 0 ? dates.sort().reverse()[0] : null;
      
      if (!projectComplianceChecks.has(projectId)) {
        projectComplianceChecks.set(projectId, { hasCheck: true, lastDate });
      } else {
        const existing = projectComplianceChecks.get(projectId)!;
        if (lastDate && (!existing.lastDate || lastDate > existing.lastDate)) {
          existing.lastDate = lastDate;
        }
      }
    });

    // Process mapping status
    const mappingByProject = new Map<string, { hasRoles: boolean; hasTrades: boolean; sources: Set<string>; lastUpdated: string | null }>();
    
    (mappingData.data || []).forEach((assignment: any) => {
      const projectId = assignment.project_id;
      if (!mappingByProject.has(projectId)) {
        mappingByProject.set(projectId, {
          hasRoles: false,
          hasTrades: false,
          sources: new Set(),
          lastUpdated: null
        });
      }
      
      const project = mappingByProject.get(projectId)!;
      if (assignment.assignment_type === 'contractor_role') {
        project.hasRoles = true;
      } else if (assignment.assignment_type === 'trade_work') {
        project.hasTrades = true;
      }
      
      if (assignment.source) {
        project.sources.add(assignment.source);
      }
      
      if (assignment.updated_at) {
        if (!project.lastUpdated || assignment.updated_at > project.lastUpdated) {
          project.lastUpdated = assignment.updated_at;
        }
      }
    });

    // Determine mapping status for each project
    // Projects not in mappingByProject have no assignments (no_roles)
    allProjectIds.forEach((projectId) => {
      if (!mappingByProject.has(projectId)) {
        projectMappingStatus.set(projectId, { status: 'no_roles', lastUpdated: null });
      } else {
        const data = mappingByProject.get(projectId)!;
        let status: string;
        if (!data.hasRoles) {
          status = 'no_roles';
        } else if (!data.hasTrades) {
          status = 'no_trades';
        } else if (data.sources.size === 1 && data.sources.has('bci_import')) {
          status = 'bci_only';
        } else {
          status = 'has_manual';
        }
        
        projectMappingStatus.set(projectId, { status, lastUpdated: data.lastUpdated });
      }
    });

    // Calculate key contractors rated value for each project
    // This requires checking which key contractors on each project have project-specific ratings
    const keyContractorRatedValue = new Map<string, number>();
    
    if (sort === 'key_contractors_rated_value' || ratingStatus === 'rated') {
      // Get project values first
      const { data: projectValues } = await supabase
        .from('projects')
        .select('id, value')
        .in('id', allProjectIds);
      
      const projectValueMap = new Map((projectValues || []).map((p: any) => [p.id, p.value || 0]));
      
      // Get key contractor role assignments (builder, head_contractor)
      const { data: roleAssignments } = await supabase
        .from('project_assignments')
        .select('project_id, employer_id, contractor_role_types(code)')
        .in('project_id', allProjectIds)
        .eq('assignment_type', 'contractor_role');
      
      // Get key contractor trade assignments
      const { data: tradeAssignments } = await supabase
        .from('project_assignments')
        .select('project_id, employer_id, trade_types(code)')
        .in('project_id', allProjectIds)
        .eq('assignment_type', 'trade_work');
      
      // Combine all key contractor assignments
      const keyContractorAssignments: Array<{ project_id: string; employer_id: string }> = [];
      
      (roleAssignments || []).forEach((a: any) => {
        const roleCode = a.contractor_role_types?.code;
        if (roleCode === 'builder' || roleCode === 'head_contractor') {
          keyContractorAssignments.push({ project_id: a.project_id, employer_id: a.employer_id });
        }
      });
      
      (tradeAssignments || []).forEach((a: any) => {
        const tradeCode = a.trade_types?.code;
        if (tradeCode && keyContractorTradeCodes.has(tradeCode)) {
          keyContractorAssignments.push({ project_id: a.project_id, employer_id: a.employer_id });
        }
      });

      // Get which of these employers have project-specific ratings
      const keyContractorEmployerIds = Array.from(new Set(keyContractorAssignments.map(a => a.employer_id)));
      
      if (keyContractorEmployerIds.length > 0) {
        const { data: ratedEmployers } = await supabase
          .from('project_compliance_assessments')
          .select('project_id, employer_id')
          .in('project_id', allProjectIds)
          .in('employer_id', keyContractorEmployerIds)
          .eq('is_active', true);

        const ratedSet = new Set((ratedEmployers || []).map((r: any) => `${r.project_id}:${r.employer_id}`));

        // Calculate value for each project (count each project only once)
        const projectsWithRatedKeyContractors = new Set<string>();
        
        keyContractorAssignments.forEach((assignment) => {
          const projectId = assignment.project_id;
          const employerId = assignment.employer_id;
          const key = `${projectId}:${employerId}`;
          
          if (ratedSet.has(key)) {
            projectsWithRatedKeyContractors.add(projectId);
          }
        });
        
        // Set the value for each project (only count once per project)
        projectsWithRatedKeyContractors.forEach((projectId) => {
          const projectValue = projectValueMap.get(projectId) || 0;
          keyContractorRatedValue.set(projectId, projectValue);
        });
      }
    }

    // Filter projects based on status filters
    let filteredProjectIds = allProjectIds.filter((projectId: string) => {
      // Rating status filter
      if (ratingStatus === 'rated' && !projectRatings.has(projectId)) {
        return false;
      }
      if (ratingStatus === 'unrated' && projectRatings.has(projectId)) {
        return false;
      }

      // Audit status filter
      const compliance = projectComplianceChecks.get(projectId);
      if (auditStatus === 'has_audit' && (!compliance || !compliance.hasCheck)) {
        return false;
      }
      if (auditStatus === 'no_audit' && compliance && compliance.hasCheck) {
        return false;
      }

      // Mapping status filter
      const mapping = projectMappingStatus.get(projectId);
      if (mappingStatus !== 'all') {
        if (!mapping || mapping.status !== mappingStatus) {
          return false;
        }
      }

      // Mapping update status filter
      if (mappingUpdateStatus !== 'all') {
        const mapping = projectMappingStatus.get(projectId);
        const lastUpdated = mapping?.lastUpdated ? new Date(mapping.lastUpdated) : null;
        const now = new Date();
        
        if (mappingUpdateStatus === 'never' && lastUpdated !== null) {
          return false;
        }
        if (mappingUpdateStatus === 'recent' && (!lastUpdated || (now.getTime() - lastUpdated.getTime()) > 7 * 24 * 60 * 60 * 1000)) {
          return false;
        }
        if (mappingUpdateStatus === 'recent_week' && (!lastUpdated || (now.getTime() - lastUpdated.getTime()) < 7 * 24 * 60 * 60 * 1000 || (now.getTime() - lastUpdated.getTime()) > 30 * 24 * 60 * 60 * 1000)) {
          return false;
        }
        if (mappingUpdateStatus === 'stale' && (!lastUpdated || (now.getTime() - lastUpdated.getTime()) <= 30 * 24 * 60 * 60 * 1000)) {
          return false;
        }
      }

      // Compliance check status filter
      if (complianceCheckStatus !== 'all') {
        const compliance = projectComplianceChecks.get(projectId);
        const lastDate = compliance?.lastDate ? new Date(compliance.lastDate) : null;
        const now = new Date();
        
        if (!lastDate) {
          if (complianceCheckStatus !== '12_plus_never') {
            return false;
          }
        } else {
          const monthsAgo = (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
          
          if (complianceCheckStatus === '0-3_months' && monthsAgo > 3) {
            return false;
          }
          if (complianceCheckStatus === '3-6_months' && (monthsAgo <= 3 || monthsAgo > 6)) {
            return false;
          }
          if (complianceCheckStatus === '6-12_months' && (monthsAgo <= 6 || monthsAgo > 12)) {
            return false;
          }
          if (complianceCheckStatus === '12_plus_never' && monthsAgo <= 12) {
            return false;
          }
        }
      }

      return true;
    });

    // Now fetch the actual project data with the filtered IDs
    let filteredQuery = supabase.from('project_list_comprehensive_view').select('*', { count: 'exact' });
    filteredQuery = filteredQuery.in('id', filteredProjectIds);

    // Apply sorting with exact same logic as client plus created_at support
    const needsClientSorting = ["workers", "members", "delegates", "eba_coverage", "employers", "key_contractors_rated_value"].includes(sort);
    
    if (!needsClientSorting) {
      // Database-sortable fields
      if (sort === 'name') {
        filteredQuery = filteredQuery.order('name', { ascending: dir === 'asc' });
      } else if (sort === 'value') {
        filteredQuery = filteredQuery.order('value', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'tier') {
        filteredQuery = filteredQuery.order('tier', { ascending: dir === 'asc', nullsFirst: false });
      } else {
        // Default to created_at desc if unspecified, or allow explicit created_at sort
        filteredQuery = filteredQuery.order('created_at', { ascending: dir === 'asc' });
      }
    } else {
      // Pre-computed summary fields can now be sorted server-side too!
      if (sort === 'workers') {
        filteredQuery = filteredQuery.order('total_workers', { ascending: dir === 'asc' });
      } else if (sort === 'members') {
        filteredQuery = filteredQuery.order('total_members', { ascending: dir === 'asc' });
      } else if (sort === 'employers') {
        filteredQuery = filteredQuery.order('engaged_employer_count', { ascending: dir === 'asc' });
      } else if (sort === 'eba_coverage') {
        filteredQuery = filteredQuery.order('eba_coverage_percent', { ascending: dir === 'asc' });
      } else if (sort === 'delegates') {
        // Sort by whether delegate_name exists
        filteredQuery = filteredQuery.order('delegate_name', { ascending: dir === 'asc', nullsFirst: dir === 'desc' });
      } else if (sort === 'key_contractors_rated_value') {
        // For this sort, we need to sort in memory after fetching
        // We'll handle this after fetching the data
      }
    }

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    
    // If sorting by key_contractors_rated_value, we need to fetch all and sort in memory
    let data: any[];
    let count: number;
    
    if (sort === 'key_contractors_rated_value') {
      // Fetch all matching projects
      const { data: allData, error: allError, count: allCount } = await filteredQuery;
      if (allError) {
        console.error('Projects API error:', allError);
        return NextResponse.json(
          { error: 'Failed to fetch projects' },
          { status: 500 }
        );
      }
      
      // Sort by key contractors rated value
      const sorted = (allData || []).sort((a: any, b: any) => {
        const aValue = keyContractorRatedValue.get(a.id) || 0;
        const bValue = keyContractorRatedValue.get(b.id) || 0;
        return dir === 'asc' ? aValue - bValue : bValue - aValue;
      });
      
      // Apply pagination
      data = sorted.slice(from, to + 1);
      count = allCount || 0;
    } else {
      // Normal pagination
      filteredQuery = filteredQuery.range(from, to);
      const result = await filteredQuery;
      data = result.data || [];
      count = result.count || 0;
      
      if (result.error) {
        console.error('Projects API error:', result.error);
        // #region agent log
        if (process.env.NODE_ENV !== 'production') {
          fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:fetch_page',message:'projects api failed fetching paginated view rows',data:{path:request.nextUrl.pathname,userIdSuffix:user.id.slice(-6),sbCookieCount:request.cookies.getAll().filter(c=>c.name.startsWith("sb-")).length,errorMessage:result.error.message,errorCode:(result.error as any).code??null},timestamp:Date.now()})}).catch(()=>{});
        }
        // #endregion
        return NextResponse.json(
          { error: 'Failed to fetch projects' },
          { status: 500 }
        );
      }
    }

    // Transform data to match client expectations
    const projects: ProjectRecord[] = (data || []).map((row: any) => {
      const projectId = row.id;
      const mapping = projectMappingStatus.get(projectId);
      const compliance = projectComplianceChecks.get(projectId);
      
      return {
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
        
        // Add computed status fields
        has_project_rating: projectRatings.has(projectId),
        has_compliance_checks: compliance?.hasCheck || false,
        mapping_status: mapping?.status as 'no_roles' | 'no_trades' | 'bci_only' | 'has_manual' | undefined,
        mapping_last_updated: mapping?.lastUpdated || null,
        last_compliance_check_date: compliance?.lastDate || null,
        key_contractors_rated_value: keyContractorRatedValue.get(projectId) || null,
      };
    });

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
            ratingStatus,
            auditStatus,
            mappingStatus,
            mappingUpdateStatus,
            complianceCheckStatus,
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
    // #region agent log
    if (process.env.NODE_ENV !== 'production') {
      fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run2',hypothesisId:'F',location:'src/app/api/projects/route.ts:catch',message:'projects api unexpected exception',data:{path:request.nextUrl.pathname,errorMessage:error instanceof Error?error.message:String(error)},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export rate-limited GET handler
export const GET = withRateLimit(getProjectsHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY);

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

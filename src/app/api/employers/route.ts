import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic'

// Feature flag: Use materialized view for optimized search
// Set to 'false' to rollback to old behavior instantly
const USE_MATERIALIZED_VIEW = process.env.NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW !== 'false';

// Helper function to fetch enhanced employer data (projects, organisers, incolink IDs)
type EmployerAnalyticsRow = Database['public']['Views']['employer_analytics']['Row'];
type ProjectAssignmentRow = Database['public']['Tables']['project_assignments']['Row'];

async function fetchEnhancedEmployerData(supabase: Awaited<ReturnType<typeof createServerSupabase>>, employerIds: string[]) {
  const enhancedData: Record<string, {
    incolink_id: string | null;
    projects: Array<{
      id: string;
      name: string;
      tier: string | null;
      roles: string[];
      trades: string[];
    }>;
    organisers: Array<{
      id: string;
      name: string;
      patch_name?: string;
    }>;
  }> = {};

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
        projects!inner(id, name, tier),
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
          tier: row.projects.tier,
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
  sort: 'name' | 'estimated' | 'eba_recency' | 'project_count';
  dir: 'asc' | 'desc';
  q?: string;
  engaged?: boolean;
  eba?: 'all' | 'active' | 'lodged' | 'pending' | 'no';
  type?: 'all' | 'builder' | 'principal_contractor' | 'large_contractor' | 'small_contractor' | 'individual';
  categoryType?: 'contractor_role' | 'trade' | 'all';
  categoryCode?: string;
  projectTier?: 'all' | 'tier_1' | 'tier_2' | 'tier_3';
  // New alias search parameters
  includeAliases?: boolean;
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical';
}

export interface EmployerAlias {
  id: string;
  alias: string;
  alias_normalized: string;
  is_authoritative: boolean;
  source_system: string | null;
  source_identifier: string | null;
  collected_at: string | null;
}

export interface EmployerMatchDetails {
  canonical_name: string;
  matched_alias: string | null;
  query: string;
  external_id_match: 'bci' | 'incolink' | null;
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
  incolink_last_matched?: string | null;
  // EBA status fields
  enterprise_agreement_status?: boolean | null;
  eba_status_source?: string | null;
  eba_status_updated_at?: string | null;
  eba_status_notes?: string | null;
  // Related records
  company_eba_records: any[];
  worker_placements: { id: string }[];
  project_assignments: { id: string }[];
  // Enhanced data
  projects?: Array<{
    id: string;
    name: string;
    tier?: string | null;
    roles?: string[];
    trades?: string[];
  }>;
  organisers?: Array<{
    id: string;
    name: string;
    patch_name?: string;
  }>;
  // Alias search data
  aliases?: EmployerAlias[];
  match_type?: 'canonical_name' | 'alias' | 'external_id' | 'abn';
  match_details?: EmployerMatchDetails;
  search_score?: number;
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
      console.error('Employers API failed to load profile:', profileError);
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Parse parameters with exact same defaults as client-side
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '100'), 200); // Cap at 200
    const sort = (searchParams.get('sort') || 'name') as EmployersRequest['sort'];
    const dir = (searchParams.get('dir') || 'asc') as EmployersRequest['dir'];
    const q = searchParams.get('q') || undefined;
    const engagedParam = searchParams.get('engaged');
    const engaged = engagedParam === '1'; // Changed: Show all by default (null/undefined = false)
    const eba = (searchParams.get('eba') || 'all') as EmployersRequest['eba'];
    const type = (searchParams.get('type') || 'all') as EmployersRequest['type'];
    const categoryType = (searchParams.get('categoryType') || 'all') as 'contractor_role' | 'trade' | 'all';
    const categoryCode = searchParams.get('categoryCode') || undefined;
    const projectTier = (searchParams.get('projectTier') || 'all') as 'all' | 'tier_1' | 'tier_2' | 'tier_3';
    
    // New alias search parameters
    const includeAliases = searchParams.get('includeAliases') === 'true';
    const aliasMatchMode = (searchParams.get('aliasMatchMode') || 'any') as 'any' | 'authoritative' | 'canonical';

    // Add parameter to control whether to include enhanced data (projects, organisers)
    const includeEnhanced = searchParams.get('enhanced') === 'true';

    // If there's a search query and aliases are requested, use the alias-aware search RPC
    let data: any[] | null;
    let error: any;
    let count: number | null = null;

    const useAliasSearch = q && includeAliases;
    const useMaterializedView = USE_MATERIALIZED_VIEW && !useAliasSearch;

    if (useAliasSearch) {
      // Use alias-aware search via RPC
      const offset = (page - 1) * pageSize;
      const { data: searchData, error: searchError } = await supabase.rpc(
        'search_employers_with_aliases',
        {
          p_query: q,
          p_limit: pageSize,
          p_offset: offset,
          p_include_aliases: true,
          p_alias_match_mode: aliasMatchMode,
        }
      );

      data = searchData;
      error = searchError;
      
      // For alias search, we need to manually fetch relationships for filtering
      // and get total count (RPC doesn't provide count)
      if (data && data.length > 0) {
        const employerIds = data.map((emp: any) => emp.id);
        
        // Fetch additional relationship data for filtering
        const { data: relData } = await supabase
          .from('employers')
          .select(`
            id,
            company_eba_records!left(
              id,
              status,
              nominal_expiry_date,
              fwc_certified_date,
              eba_lodged_fwc,
              date_eba_signed,
              date_vote_occurred,
              eba_data_form_received,
              date_draft_signing_sent,
              date_barg_docs_sent
            ),
            worker_placements!left(id),
            project_assignments!left(id)
          `)
          .in('id', employerIds);

        // Merge relationship data back into search results
        if (relData) {
          data = data.map((emp: any) => {
            const rel = relData.find((r: any) => r.id === emp.id);
            return {
              ...emp,
              company_eba_records: rel?.company_eba_records || [],
              worker_placements: rel?.worker_placements || [],
              project_assignments: rel?.project_assignments || [],
            };
          });
        }

        // Get approximate count (this is expensive, so we do a simpler query)
        const { count: totalCount } = await supabase
          .from('employers')
          .select('id', { count: 'exact', head: true })
          .ilike('name', `%${q}%`);
        
        count = totalCount;
      }
    } else if (useMaterializedView) {
      // ============================================================================
      // MATERIALIZED VIEW PATH - Optimized search with precomputed filters
      // ============================================================================
      console.log('🚀 Using materialized view for employer search');
      
      let matViewQuery = supabase
        .from('employers_search_optimized')
        .select(`
          id,
          name,
          abn,
          employer_type,
          website,
          email,
          phone,
          estimated_worker_count,
          incolink_id,
          bci_company_id,
          enterprise_agreement_status,
          eba_status_source,
          eba_status_updated_at,
          eba_status_notes,
          is_engaged,
          eba_category,
          eba_recency_score,
          actual_worker_count,
          project_count,
          company_eba_records_json,
          worker_placements_json,
          project_assignments_json,
          incolink_last_matched,
          most_recent_eba_date,
          view_refreshed_at
        `, { count: 'exact' });

      // Apply text search filter
      if (q) {
        matViewQuery = matViewQuery.ilike('name', `%${q}%`);
      }

      // Apply engagement filter (precomputed!)
      if (engaged === true) {
        matViewQuery = matViewQuery.eq('is_engaged', true);
      } else if (engaged === false) {
        matViewQuery = matViewQuery.eq('is_engaged', false);
      }

      // Apply EBA filter
      // 'active' and 'no' check canonical boolean status
      // 'lodged' and 'pending' check FWC workflow eba_category
      if (eba === 'active') {
        matViewQuery = matViewQuery.eq('enterprise_agreement_status', true);
      } else if (eba === 'no') {
        matViewQuery = matViewQuery.or('enterprise_agreement_status.is.null,enterprise_agreement_status.eq.false');
      } else if (eba === 'lodged' || eba === 'pending') {
        matViewQuery = matViewQuery.eq('eba_category', eba);
      }

      // Apply employer type filter
      if (type !== 'all') {
        matViewQuery = matViewQuery.eq('employer_type', type);
      }

      // Apply sorting
      if (sort === 'name') {
        matViewQuery = matViewQuery.order('name', { ascending: dir === 'asc' });
      } else if (sort === 'estimated') {
        matViewQuery = matViewQuery.order('estimated_worker_count', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'eba_recency') {
        matViewQuery = matViewQuery.order('eba_recency_score', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'project_count') {
        matViewQuery = matViewQuery.order('project_count', { ascending: dir === 'asc', nullsFirst: false });
      }

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      matViewQuery = matViewQuery.range(from, to);

      // Execute query
      const matViewResult = await matViewQuery;
      data = matViewResult.data;
      error = matViewResult.error;
      count = matViewResult.count;

      // Transform materialized view data to match expected format
      if (data && data.length > 0) {
        data = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          abn: row.abn,
          employer_type: row.employer_type,
          website: row.website,
          email: row.email,
          phone: row.phone,
          estimated_worker_count: row.estimated_worker_count,
          incolink_id: row.incolink_id,
          bci_company_id: row.bci_company_id,
          enterprise_agreement_status: row.enterprise_agreement_status,
          eba_status_source: row.eba_status_source,
          eba_status_updated_at: row.eba_status_updated_at,
          eba_status_notes: row.eba_status_notes,
          incolink_last_matched: row.incolink_last_matched,
          
          // Transform JSONB back to arrays
          company_eba_records: row.company_eba_records_json || [],
          worker_placements: row.worker_placements_json || [],
          project_assignments: row.project_assignments_json || [],
          
          // Include precomputed analytics
          _mat_view_data: {
            is_engaged: row.is_engaged,
            eba_category: row.eba_category,
            eba_recency_score: row.eba_recency_score,
            actual_worker_count: row.actual_worker_count,
            project_count: row.project_count,
            most_recent_eba_date: row.most_recent_eba_date,
            view_refreshed_at: row.view_refreshed_at
          }
        }));
      }
    } else {
      // ============================================================================
      // ANALYTICS VIEW PATH - Original implementation (fallback)
      // ============================================================================
      console.log('📊 Using analytics view for employer search');
      
      // Use employer analytics view for filtering and sorting
      let analyticsQuery = supabase
        .from('employer_analytics')
        .select(`
          employer_id,
          employer_name,
          employer_abn,
          employer_type,
          employer_website,
          employer_email,
          employer_phone,
          estimated_worker_count,
          worker_placement_count,
          project_assignment_count,
          eba_recency_score,
          eba_category,
          category_roles,
          category_trades,
          has_project_tier_1,
          has_project_tier_2,
          has_project_tier_3
        `, { count: 'exact' });

      if (q) {
        analyticsQuery = analyticsQuery.ilike('employer_name', `%${q}%`);
      }

      if (type !== 'all') {
        analyticsQuery = analyticsQuery.eq('employer_type', type);
      }

      if (categoryType !== 'all' && categoryCode) {
        if (categoryType === 'contractor_role') {
          analyticsQuery = analyticsQuery.contains('category_roles', [categoryCode]);
        } else if (categoryType === 'trade') {
          analyticsQuery = analyticsQuery.contains('category_trades', [categoryCode]);
        }
      }

      if (projectTier !== 'all') {
        if (projectTier === 'tier_1') analyticsQuery = analyticsQuery.eq('has_project_tier_1', true);
        if (projectTier === 'tier_2') analyticsQuery = analyticsQuery.eq('has_project_tier_2', true);
        if (projectTier === 'tier_3') analyticsQuery = analyticsQuery.eq('has_project_tier_3', true);
      }

      if (sort === 'name') {
        analyticsQuery = analyticsQuery.order('employer_name', { ascending: dir === 'asc' });
      } else if (sort === 'estimated') {
        analyticsQuery = analyticsQuery.order('estimated_worker_count', { ascending: dir === 'asc', nullsFirst: false });
      } else if (sort === 'project_count') {
        analyticsQuery = analyticsQuery.order('project_assignment_count', { ascending: dir === 'asc', nullsFirst: true });
      } else if (sort === 'eba_recency') {
        analyticsQuery = analyticsQuery.order('eba_recency_score', { ascending: dir === 'asc', nullsFirst: true });
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      analyticsQuery = analyticsQuery.range(from, to);

      const analyticsResult = await analyticsQuery;
      const analyticsRows = analyticsResult.data || [];
      error = analyticsResult.error;
      count = analyticsResult.count;

      if (analyticsRows.length > 0) {
        const employerIds = analyticsRows.map((row: any) => row.employer_id);
      const { data: employerRows, error: employerError } = await supabase
        .from('employers')
        .select(`
          id,
          name,
          abn,
          employer_type,
          website,
          email,
          phone,
          estimated_worker_count,
          incolink_id,
          enterprise_agreement_status,
          eba_status_source,
          eba_status_updated_at,
          eba_status_notes,
          company_eba_records!left(
              id,
              status,
              nominal_expiry_date,
              fwc_certified_date,
              eba_lodged_fwc,
              date_eba_signed,
              date_vote_occurred,
              eba_data_form_received,
              date_draft_signing_sent,
              date_barg_docs_sent
            ),
            worker_placements!left(id),
            project_assignments!left(id)
          `)
          .in('id', employerIds);

        if (employerError) {
          error = employerError;
        } else {
          const employerMap = new Map((employerRows || []).map((row: any) => [row.id, row]));
          data = analyticsRows
            .map((row: any) => {
              const base = employerMap.get(row.employer_id);
              if (!base) return null;

              return {
                ...base,
                worker_placements: base.worker_placements || [],
                project_assignments: base.project_assignments || [],
                _analytics: {
                  project_assignment_count: row.project_assignment_count,
                  worker_placement_count: row.worker_placement_count,
                  eba_recency_score: row.eba_recency_score,
                  eba_category: row.eba_category,
                  category_roles: row.category_roles,
                  category_trades: row.category_trades,
                  has_project_tier_1: row.has_project_tier_1,
                  has_project_tier_2: row.has_project_tier_2,
                  has_project_tier_3: row.has_project_tier_3
                }
              };
            })
            .filter(Boolean) as any[];
        }
      } else {
        data = [];
      }
    }

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
      // Deduplicate employer IDs before fetching enhanced data
      const uniqueEmployerIds = [...new Set(data.map((row: any) => row.id))];
      console.log(`Fetching enhanced data for ${uniqueEmployerIds.length} unique employers (from ${data.length} total rows)`);
      enhancedData = await fetchEnhancedEmployerData(supabase, uniqueEmployerIds);
    }

    // Transform data to match client expectations and apply post-filters
    let employers: EmployerRecord[] = (data || []).map((row: any) => {
      const baseEmployer: EmployerRecord = {
        id: row.id,
        name: row.name,
        abn: row.abn,
        employer_type: row.employer_type,
        website: row.website,
        email: row.email,
        phone: row.phone,
        estimated_worker_count: row.estimated_worker_count,
        incolink_id: row.incolink_id,

        // EBA status fields (CRITICAL - must be included!)
        enterprise_agreement_status: row.enterprise_agreement_status,
        eba_status_source: row.eba_status_source,
        eba_status_updated_at: row.eba_status_updated_at,
        eba_status_notes: row.eba_status_notes,
        incolink_last_matched: row.incolink_last_matched,

        // Transform to match existing client structure
        company_eba_records: row.company_eba_records || [],
        worker_placements: row.worker_placements || [],
        project_assignments: row.project_assignments || [],

        // Add enhanced data if available
        ...(includeEnhanced && enhancedData[row.id] ? enhancedData[row.id] : {}),
      };

      // Add alias search data if from RPC
      if (row.aliases !== undefined) {
        baseEmployer.aliases = Array.isArray(row.aliases) ? row.aliases : (row.aliases || []);
        baseEmployer.match_type = row.match_type;
        baseEmployer.match_details = row.match_details;
        baseEmployer.search_score = row.search_score;
      }

      return baseEmployer;
    });

    // Post-filter for engagement (SKIP if using materialized view - already precomputed)
    if (!useMaterializedView && engaged) {
      employers = employers.filter(emp =>
        (emp.project_assignments && emp.project_assignments.length > 0) ||
        (emp.worker_placements && emp.worker_placements.length > 0)
      );
    } else if (!useMaterializedView && engaged === false) {
      employers = employers.filter(emp =>
        (!emp.project_assignments || emp.project_assignments.length === 0) &&
        (!emp.worker_placements || emp.worker_placements.length === 0)
      );
    }

    // Post-filter for EBA status (SKIP if using materialized view - already precomputed)
    if (!useMaterializedView && eba !== 'all') {
      const parseDate = (value?: string | null) => {
        if (!value) return null;
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? null : date;
      };

      const withinMonths = (value: string | null | undefined, months: number) => {
        const date = parseDate(value);
        if (!date) return false;
        const cutoff = new Date();
        cutoff.setMonth(cutoff.getMonth() - months);
        return date >= cutoff;
      };

      const withinYears = (value: string | null | undefined, years: number) => withinMonths(value, years * 12);

      employers = employers.filter(emp => {
        if (eba === 'active') {
          return emp.enterprise_agreement_status === true;
        }

        if (eba === 'no') {
          return emp.enterprise_agreement_status !== true;
        }

        const records = emp.company_eba_records || [];
        const parseDate = (value?: string | null) => {
          if (!value) return null;
          const date = new Date(value);
          return Number.isNaN(date.getTime()) ? null : date;
        };
        const withinMonths = (value: string | null | undefined, months: number) => {
          const date = parseDate(value);
          if (!date) return false;
          const cutoff = new Date();
          cutoff.setMonth(cutoff.getMonth() - months);
          return date >= cutoff;
        };
        const withinYears = (value: string | null | undefined, years: number) => withinMonths(value, years * 12);

        if (eba === 'lodged') {
          return records.some((r: any) => withinYears(r.eba_lodged_fwc, 1));
        }

        if (eba === 'pending') {
          return records.some((r: any) =>
            withinMonths(r.date_eba_signed, 6) || withinMonths(r.date_vote_occurred, 6) ||
            r.eba_data_form_received || r.date_draft_signing_sent || r.date_barg_docs_sent
          );
        }

        return true;
      });
    }

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
        usedMaterializedView: useMaterializedView,
        aliasSearchUsed: !!(q && includeAliases),
        appliedFilters: {
          q,
          engaged,
          eba,
          type,
          categoryType,
          categoryCode,
          projectTier,
          sort,
          dir,
          includeAliases,
          aliasMatchMode
        }
      }
    };

    // Add cache headers for CDN/browser caching
    // Reduce cache time to help with new employer visibility
    const headers = {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60', // 30sec cache, 1min stale
      'Content-Type': 'application/json',
      'X-Employer-Count': employers.length.toString(),
      'X-Total-Rows-Processed': (data?.length || 0).toString()
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
      .from('employers')
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

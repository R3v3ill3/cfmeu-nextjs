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
  incolink_member_id: string | null;
  has_incolink_id: boolean;
  has_active_eba: boolean;
  has_active_project: boolean;
  active_project_names: string[];
  active_project_count: number;
  employer_names: string[];
  job_titles: string[];
  job_site_names: string[];
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
    const tier = searchParams.get('tier') || undefined;
    const employerId = searchParams.get('employerId') || undefined;
    const incolink = (searchParams.get('incolink') as 'with' | 'without' | null) || undefined;

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

    // Additional filters require pre-filtering worker IDs
    const filterSets: Set<string>[] = [];

    if (tier && tier !== 'all') {
      const { data: tierRows, error: tierError } = await supabase
        .from('worker_placements')
        .select('worker_id, employers:employer_id(tier)')
        .eq('employers.tier', tier);

      if (tierError) {
        console.error('Workers API tier filter error:', tierError);
      } else if (tierRows) {
        const ids = new Set<string>();
        tierRows.forEach((row: any) => {
          const id = row.worker_id as string | null;
          if (id) ids.add(id);
        });
        filterSets.push(ids);
      }
    }

    if (employerId) {
      const { data: employerRows, error: employerError } = await supabase
        .from('worker_placements')
        .select('worker_id')
        .eq('employer_id', employerId);

      if (employerError) {
        console.error('Workers API employer filter error:', employerError);
      } else if (employerRows) {
        const ids = new Set<string>();
        employerRows.forEach((row: any) => {
          const id = row.worker_id as string | null;
          if (id) ids.add(id);
        });
        filterSets.push(ids);
      }
    }

    if (incolink && incolink !== 'all') {
      const queryBuilder = supabase
        .from('workers')
        .select('id');

      let incolinkQuery;
      if (incolink === 'with') {
        incolinkQuery = queryBuilder.not('incolink_member_id', 'is', null);
      } else {
        incolinkQuery = queryBuilder.is('incolink_member_id', null);
      }

      const { data: incolinkRows, error: incolinkError } = await incolinkQuery;

      if (incolinkError) {
        console.error('Workers API incolink filter error:', incolinkError);
      } else if (incolinkRows) {
        const ids = new Set<string>();
        incolinkRows.forEach((row: any) => {
          const id = row.id as string | null;
          if (id) ids.add(id);
        });
        filterSets.push(ids);
      }
    }

    if (filterSets.length > 0) {
      let allowedWorkerIds = new Set<string>(filterSets[0]);
      for (let i = 1; i < filterSets.length; i++) {
        const nextSet = filterSets[i];
        const intersection = new Set<string>();
        allowedWorkerIds.forEach((id) => {
          if (nextSet.has(id)) {
            intersection.add(id);
          }
        });
        allowedWorkerIds = intersection;
      }

      if (allowedWorkerIds.size === 0) {
        const queryTime = Date.now() - startTime;
        const emptyResponse: WorkersResponse = {
          workers: [],
          pagination: {
            page,
            pageSize,
            totalCount: 0,
            totalPages: 0
          },
          debug: {
            queryTime,
            cacheHit: false,
            appliedFilters: {
              q,
              membership,
              sort,
              dir,
              tier,
              employerId,
              incolink
            }
          }
        };

        const headers = {
          'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
          'Content-Type': 'application/json'
        };

        return NextResponse.json(emptyResponse, { headers });
      }

      const allowedIdsArray = Array.from(allowedWorkerIds);
      query = query.in('id', allowedIdsArray);
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

    const rawWorkers = data || [];
    const workerIds = rawWorkers.map((row: any) => row.id).filter(Boolean);

    let incolinkRows: { id: string; incolink_member_id: string | null }[] = [];
    let placementRows: any[] = [];

    if (workerIds.length > 0) {
      const [incolinkQuery, placementsQuery] = await Promise.all([
        supabase
          .from('workers')
          .select('id, incolink_member_id')
          .in('id', workerIds),
        supabase
          .from('worker_placements')
          .select(`
            id,
            worker_id,
            start_date,
            end_date,
            employment_status,
            job_title,
            employers:employer_id (
              id,
              name,
              enterprise_agreement_status,
              company_eba_records (
                id,
                status,
                fwc_certified_date
              )
            ),
            job_sites:job_site_id (
              id,
              name,
              projects:project_id (
                id,
                name,
                organising_universe,
                stage_class
              )
            )
          `)
          .in('worker_id', workerIds)
      ]);

      if (incolinkQuery.error) {
        console.error('Workers API failed to load Incolink identifiers:', incolinkQuery.error);
      } else {
        incolinkRows = incolinkQuery.data || [];
      }

      if (placementsQuery.error) {
        console.error('Workers API failed to load placement data:', placementsQuery.error);
      } else {
        placementRows = placementsQuery.data || [];
      }
    }

    const incolinkMap = new Map<string, string | null>();
    incolinkRows.forEach((row) => {
      incolinkMap.set(row.id, row.incolink_member_id || null);
    });

    type WorkerAggregates = {
      hasActiveEba: boolean;
      hasActiveProject: boolean;
      activeProjectNames: Set<string>;
      employerNames: Set<string>;
      jobTitles: Set<string>;
      jobSiteNames: Set<string>;
    };

    const aggregates = new Map<string, WorkerAggregates>();
    const ensureAggregate = (workerId: string): WorkerAggregates => {
      if (!aggregates.has(workerId)) {
        aggregates.set(workerId, {
          hasActiveEba: false,
          hasActiveProject: false,
          activeProjectNames: new Set<string>(),
          employerNames: new Set<string>(),
          jobTitles: new Set<string>(),
          jobSiteNames: new Set<string>(),
        });
      }
      return aggregates.get(workerId)!;
    };

    const now = new Date();

    placementRows.forEach((placement: any) => {
      const workerId = placement.worker_id as string | null;
      if (!workerId) return;
      const agg = ensureAggregate(workerId);

      const employer = placement.employers;
      if (employer) {
        if (employer.name) {
          agg.employerNames.add(employer.name);
        }
        let hasActiveEba = employer.enterprise_agreement_status === true;
        const ebaRecords = Array.isArray(employer.company_eba_records)
          ? employer.company_eba_records
          : employer.company_eba_records
            ? [employer.company_eba_records]
            : [];
        if (!hasActiveEba) {
          hasActiveEba = ebaRecords.some((record: any) => {
            if (!record) return false;
            const status = typeof record.status === 'string' ? record.status.toLowerCase() : '';
            return status === 'active' || Boolean(record.fwc_certified_date);
          });
        }
        if (hasActiveEba) {
          agg.hasActiveEba = true;
        }
      }

      if (placement.job_title) {
        agg.jobTitles.add(placement.job_title);
      }

      const jobSite = placement.job_sites;
      if (jobSite?.name) {
        agg.jobSiteNames.add(jobSite.name);
      }

      const project = jobSite?.projects;
      const isPlacementActive = !placement.end_date || new Date(placement.end_date) >= now;
      if (project && isPlacementActive) {
        const stage = typeof project.stage_class === 'string' ? project.stage_class.toLowerCase() : '';
        const isActiveProject = project.organising_universe === 'active' && stage !== 'archived';
        if (isActiveProject) {
          agg.hasActiveProject = true;
          if (project.name) {
            agg.activeProjectNames.add(project.name);
          }
        }
      }
    });

    // Transform data to match client expectations
    const workers: WorkerRecord[] = rawWorkers.map((row: any) => {
      const extra = aggregates.get(row.id) || {
        hasActiveEba: false,
        hasActiveProject: false,
        activeProjectNames: new Set<string>(),
        employerNames: new Set<string>(),
        jobTitles: new Set<string>(),
        jobSiteNames: new Set<string>(),
      };

      const jobTitlesFromView = Array.isArray(row.job_titles) ? row.job_titles : [];
      const jobSitesFromView = Array.isArray(row.job_site_names) ? row.job_site_names : [];

      const mergedJobTitles = Array.from(
        new Set<string>([
          ...jobTitlesFromView.filter((title: any) => typeof title === 'string' && title.length > 0),
          ...Array.from(extra.jobTitles)
        ])
      );

      const mergedJobSites = Array.from(
        new Set<string>([
          ...jobSitesFromView.filter((site: any) => typeof site === 'string' && site.length > 0),
          ...Array.from(extra.jobSiteNames)
        ])
      );

      const incolinkMember = incolinkMap.get(row.id) ?? null;

      return {
        id: row.id,
        first_name: row.first_name,
        surname: row.surname,
        nickname: row.nickname,
        email: row.email,
        mobile_phone: row.mobile_phone,
        member_number: row.member_number,
        union_membership_status: row.union_membership_status,
        incolink_member_id: incolinkMember,
        has_incolink_id: Boolean(incolinkMember),
        has_active_eba: extra.hasActiveEba,
        has_active_project: extra.hasActiveProject,
        active_project_names: Array.from(extra.activeProjectNames),
        active_project_count: extra.activeProjectNames.size,
        employer_names: Array.from(extra.employerNames),
        job_titles: mergedJobTitles,
        job_site_names: mergedJobSites,
        
        // Transform to match existing client structure
        worker_placements: row.worker_placements_data || [],
        organisers: row.organiser_data || null,
      };
    });

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
          dir,
          tier,
          employerId,
          incolink
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

import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

const ALLOWED_ROLES = ['admin', 'lead_organiser'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic'

export interface AliasMetricsSummary {
  total_aliases: number;
  employers_with_aliases: number;
  authoritative_aliases: number;
  bci_aliases: number;
  incolink_aliases: number;
  fwc_aliases: number;
  eba_aliases: number;
  manual_aliases: number;
  pending_import_aliases: number;
  legacy_aliases: number;
  aliases_last_7_days: number;
  aliases_last_30_days: number;
  total_promotions: number;
  total_rejections: number;
  total_deferrals: number;
  decisions_last_7_days: number;
  decisions_last_30_days: number;
  earliest_alias_created: string | null;
  latest_alias_created: string | null;
  computed_at: string;
}

export interface CanonicalReviewMetrics {
  pending_reviews: number;
  high_priority_reviews: number;
  medium_priority_reviews: number;
  previously_deferred: number;
  promotions_last_7_days: number;
  rejections_last_7_days: number;
  deferrals_last_7_days: number;
  median_resolution_hours: number | null;
  computed_at: string;
}

export interface SourceSystemStats {
  source_system: string;
  total_aliases: number;
  authoritative_count: number;
  employer_count: number;
  earliest_collected: string | null;
  latest_collected: string | null;
  new_last_7_days: number;
  new_last_30_days: number;
  avg_aliases_per_employer: number;
}

export interface EmployerAliasCoverage {
  total_employers: number;
  employers_with_aliases: number;
  coverage_percentage: number;
  employers_with_authoritative: number;
  employers_with_external_id_no_aliases: number;
  computed_at: string;
}

export interface ConflictBacklogItem {
  alias_id: string;
  employer_id: string;
  proposed_name: string;
  current_canonical_name: string | null;
  priority: number | null;
  is_authoritative: boolean | null;
  source_system: string | null;
  collected_at: string | null;
  conflict_warnings: any;
  conflict_count: number;
  age_bucket: string;
  hours_in_queue: number;
}

export interface DailyMetric {
  metric_date: string;
  aliases_created: number;
  authoritative_created: number;
  employers_affected: number;
  promotions: number;
  rejections: number;
  deferrals: number;
  by_source_system: Record<string, number>;
}

export interface AliasMetricsResponse {
  summary: AliasMetricsSummary;
  canonicalReviews: CanonicalReviewMetrics;
  sourceSystems: SourceSystemStats[];
  coverage: EmployerAliasCoverage;
  conflictBacklog: ConflictBacklogItem[];
  dailyMetrics?: DailyMetric[];
  debug?: {
    queryTime: number;
  };
}

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const supabase = await createServerSupabase();

    // Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - admin or lead_organiser only
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Alias metrics API failed to load profile:', profileError);
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden - Admin or Lead Organiser role required' }, { status: 403 });
    }

    // Parse optional date range parameters
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const includeDailyMetrics = searchParams.get('includeDailyMetrics') === 'true';

    // Fetch all metrics in parallel
    const [
      summaryResult,
      canonicalReviewsResult,
      sourceSystemsResult,
      coverageResult,
      conflictBacklogResult,
      dailyMetricsResult,
    ] = await Promise.all([
      // Summary metrics
      supabase
        .from('alias_metrics_summary')
        .select('*')
        .single(),
      
      // Canonical review metrics
      supabase
        .from('canonical_review_metrics')
        .select('*')
        .single(),
      
      // Source system stats
      supabase
        .from('alias_source_system_stats')
        .select('*')
        .order('total_aliases', { ascending: false }),
      
      // Coverage metrics
      supabase
        .from('employer_alias_coverage')
        .select('*')
        .single(),
      
      // Conflict backlog
      supabase
        .from('alias_conflict_backlog')
        .select('*')
        .order('priority', { ascending: false })
        .order('hours_in_queue', { ascending: false })
        .limit(100),
      
      // Daily metrics (if requested)
      includeDailyMetrics && startDate && endDate
        ? supabase.rpc('get_alias_metrics_range', {
            p_start_date: startDate,
            p_end_date: endDate,
          })
        : Promise.resolve({ data: null, error: null }),
    ]);

    // Check for errors
    if (summaryResult.error) {
      console.error('Error fetching alias metrics summary:', summaryResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch alias metrics' },
        { status: 500 }
      );
    }

    if (canonicalReviewsResult.error) {
      console.error('Error fetching canonical review metrics:', canonicalReviewsResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch canonical review metrics' },
        { status: 500 }
      );
    }

    if (sourceSystemsResult.error) {
      console.error('Error fetching source system stats:', sourceSystemsResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch source system stats' },
        { status: 500 }
      );
    }

    if (coverageResult.error) {
      console.error('Error fetching coverage metrics:', coverageResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch coverage metrics' },
        { status: 500 }
      );
    }

    if (conflictBacklogResult.error) {
      console.error('Error fetching conflict backlog:', conflictBacklogResult.error);
      return NextResponse.json(
        { error: 'Failed to fetch conflict backlog' },
        { status: 500 }
      );
    }

    const queryTime = Date.now() - startTime;

    const response: AliasMetricsResponse = {
      summary: summaryResult.data as AliasMetricsSummary,
      canonicalReviews: canonicalReviewsResult.data as CanonicalReviewMetrics,
      sourceSystems: (sourceSystemsResult.data || []) as SourceSystemStats[],
      coverage: coverageResult.data as EmployerAliasCoverage,
      conflictBacklog: (conflictBacklogResult.data || []) as ConflictBacklogItem[],
      dailyMetrics: dailyMetricsResult.data as DailyMetric[] | undefined,
      debug: {
        queryTime,
      },
    };

    // Add cache headers - short cache for frequently changing metrics
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Alias metrics API unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// CSV export endpoint
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const role = profile?.role as AllowedRole | undefined;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { exportType } = body; // 'summary' | 'sourceSystems' | 'conflictBacklog' | 'dailyMetrics'

    let csvData = '';
    let filename = 'alias-metrics.csv';

    switch (exportType) {
      case 'sourceSystems': {
        const { data } = await supabase
          .from('alias_source_system_stats')
          .select('*')
          .order('total_aliases', { ascending: false });

        if (data) {
          const headers = ['Source System', 'Total Aliases', 'Authoritative', 'Employers', 'Avg per Employer', 'Last 7 Days', 'Last 30 Days'];
          csvData = headers.join(',') + '\n';
          
          data.forEach((row: any) => {
            csvData += [
              row.source_system,
              row.total_aliases,
              row.authoritative_count,
              row.employer_count,
              row.avg_aliases_per_employer,
              row.new_last_7_days,
              row.new_last_30_days,
            ].join(',') + '\n';
          });
          
          filename = 'alias-source-systems.csv';
        }
        break;
      }

      case 'conflictBacklog': {
        const { data } = await supabase
          .from('alias_conflict_backlog')
          .select('*')
          .order('priority', { ascending: false });

        if (data) {
          const headers = ['Proposed Name', 'Current Name', 'Priority', 'Source System', 'Conflicts', 'Age', 'Hours in Queue'];
          csvData = headers.join(',') + '\n';
          
          data.forEach((row: any) => {
            csvData += [
              `"${row.proposed_name}"`,
              `"${row.current_canonical_name}"`,
              row.priority,
              row.source_system || '',
              row.conflict_count,
              row.age_bucket,
              Math.round(row.hours_in_queue),
            ].join(',') + '\n';
          });
          
          filename = 'alias-conflict-backlog.csv';
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid export type' }, { status: 400 });
    }

    return new NextResponse(csvData, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    );
  }
}


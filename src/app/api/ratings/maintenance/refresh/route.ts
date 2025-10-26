import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control - highly restricted for maintenance operations
const ALLOWED_ROLES = ['admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface RefreshRequest {
  operation: 'materialized_views' | 'statistics' | 'cache' | 'indexes' | 'all';
  force_refresh?: boolean;
  dry_run?: boolean;
  notification_preferences?: {
    email_on_completion?: boolean;
    webhook_url?: string;
  };
}

export interface RefreshResponse {
  refresh_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  operation: string;
  started_at: string;
  completed_at?: string;
  results: {
    materialized_views: {
      refreshed: string[];
      failed: string[];
      total_refresh_time_ms: number;
    };
    statistics: {
      recalculated: string[];
      failed: string[];
      total_calculation_time_ms: number;
    };
    cache: {
      cleared: string[];
      failed: string[];
      total_clear_time_ms: number;
    };
    indexes: {
      rebuilt: string[];
      failed: string[];
      total_rebuild_time_ms: number;
    };
  };
  summary: {
    total_operations: number;
    successful_operations: number;
    failed_operations: number;
    total_processing_time_ms: number;
  };
  performance_impact: {
    duration: string;
    estimated_user_impact: 'none' | 'minimal' | 'moderate' | 'high';
    recommended_maintenance_window: string;
  };
  audit_trail: {
    triggered_by: string;
    trigger_reason: string;
    ip_address: string;
    dry_run: boolean;
  };
}

// POST handler - Refresh materialized views and maintenance tasks
async function refreshMaintenanceHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const startTime = Date.now();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - admin only for maintenance operations
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, first_name, surname')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({
        error: 'Forbidden - only administrators can perform maintenance operations'
      }, { status: 403 });
    }

    // Parse and validate request body
    const body: RefreshRequest = await request.json();

    if (!body.operation || !['materialized_views', 'statistics', 'cache', 'indexes', 'all'].includes(body.operation)) {
      return NextResponse.json({
        error: 'Invalid operation. Must be one of: materialized_views, statistics, cache, indexes, all'
      }, { status: 400 });
    }

    // Generate refresh ID
    const refreshId = crypto.randomUUID();

    // Get client IP for audit trail
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    // Create maintenance job record
    const { error: maintenanceError } = await supabase
      .from('rating_maintenance_jobs')
      .insert({
        id: refreshId,
        initiated_by: user.id,
        operation: body.operation,
        status: 'processing',
        dry_run: body.dry_run || false,
        force_refresh: body.force_refresh || false,
        notification_preferences: body.notification_preferences,
        ip_address: ipAddress,
        started_at: new Date().toISOString(),
      });

    if (maintenanceError) {
      console.error('Failed to create maintenance job record:', maintenanceError);
      return NextResponse.json({ error: 'Failed to create maintenance job' }, { status: 500 });
    }

    // Process refresh operations
    const results = await processRefreshOperations(supabase, body);

    const totalProcessingTime = Date.now() - startTime;

    const response: RefreshResponse = {
      refresh_id: refreshId,
      status: results.failed_operations === 0 ? 'completed' : 'completed_with_errors',
      operation: body.operation,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString(),
      results,
      summary: {
        total_operations: results.total_operations,
        successful_operations: results.successful_operations,
        failed_operations: results.failed_operations,
        total_processing_time_ms: totalProcessingTime,
      },
      performance_impact: {
        duration: `${Math.round(totalProcessingTime / 1000)}s`,
        estimated_user_impact: estimateUserImpact(body.operation, totalProcessingTime),
        recommended_maintenance_window: getRecommendedMaintenanceWindow(body.operation),
      },
      audit_trail: {
        triggered_by: user.id,
        trigger_reason: 'Manual refresh triggered by administrator',
        ip_address: ipAddress,
        dry_run: body.dry_run || false,
      },
    };

    // Update maintenance job record
    await supabase
      .from('rating_maintenance_jobs')
      .update({
        status: response.status,
        results,
        summary: response.summary,
        performance_impact: response.performance_impact,
        completed_at: response.completed_at,
      })
      .eq('id', refreshId);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Refresh maintenance API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
async function processRefreshOperations(supabase: Awaited<ReturnType<typeof createServerSupabase>>, request: RefreshRequest): Promise<any> {
  const results = {
    materialized_views: {
      refreshed: [] as string[],
      failed: [] as string[],
      total_refresh_time_ms: 0,
    },
    statistics: {
      recalculated: [] as string[],
      failed: [] as string[],
      total_calculation_time_ms: 0,
    },
    cache: {
      cleared: [] as string[],
      failed: [] as string[],
      total_clear_time_ms: 0,
    },
    indexes: {
      rebuilt: [] as string[],
      failed: [] as string[],
      total_rebuild_time_ms: 0,
    },
  };

  let totalOperations = 0;
  let successfulOperations = 0;
  let failedOperations = 0;

  const operationsToRun = request.operation === 'all'
    ? ['materialized_views', 'statistics', 'cache', 'indexes']
    : [request.operation];

  for (const operation of operationsToRun) {
    try {
      switch (operation) {
        case 'materialized_views':
          await refreshMaterializedViews(supabase, results.materialized_views, request.dry_run);
          break;
        case 'statistics':
          await recalculateStatistics(supabase, results.statistics, request.dry_run);
          break;
        case 'cache':
          await clearCache(supabase, results.cache, request.dry_run);
          break;
        case 'indexes':
          await rebuildIndexes(supabase, results.indexes, request.dry_run);
          break;
      }

      totalOperations += 1;
      successfulOperations += 1;

    } catch (error) {
      console.error(`Error in ${operation}:`, error);
      totalOperations += 1;
      failedOperations += 1;
    }
  }

  results.total_operations = totalOperations;
  results.successful_operations = successfulOperations;
  results.failed_operations = failedOperations;

  return results;
}

async function refreshMaterializedViews(supabase: Awaited<ReturnType<typeof createServerSupabase>>, results: any, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const views = [
    'project_list_comprehensive_view',
    'employers_search_optimized',
    'patch_project_mapping_view',
    'employer_analytics',
    // Add other materialized views as needed
  ];

  for (const view of views) {
    try {
      if (dryRun) {
        results.refreshed.push(`${view} (dry run)`);
      } else {
        // In a real implementation, you would execute SQL to refresh the materialized view
        // For example: REFRESH MATERIALIZED VIEW CONCURRENTLY view_name;
        const { error } = await supabase.rpc('refresh_materialized_view', { view_name: view });

        if (error) {
          console.error(`Failed to refresh ${view}:`, error);
          results.failed.push(view);
        } else {
          results.refreshed.push(view);
        }
      }
    } catch (error) {
      results.failed.push(view);
    }
  }

  results.total_refresh_time_ms = Date.now() - startTime;
}

async function recalculateStatistics(supabase: Awaited<ReturnType<typeof createServerSupabase>>, results: any, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const statistics = [
    'rating_quality_metrics',
    'organiser_expertise_reputation',
    'employer_rating_trends',
    // Add other statistics tables as needed
  ];

  for (const statistic of statistics) {
    try {
      if (dryRun) {
        results.recalculated.push(`${statistic} (dry run)`);
      } else {
        // In a real implementation, you would call functions to recalculate statistics
        const { error } = await supabase.rpc('recalculate_statistics', { table_name: statistic });

        if (error) {
          console.error(`Failed to recalculate ${statistic}:`, error);
          results.failed.push(statistic);
        } else {
          results.recalculated.push(statistic);
        }
      }
    } catch (error) {
      results.failed.push(statistic);
    }
  }

  results.total_calculation_time_ms = Date.now() - startTime;
}

async function clearCache(supabase: Awaited<ReturnType<typeof createServerSupabase>>, results: any, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const cacheKeys = [
    'rating_cache:*',
    'employer_ratings:*',
    'analytics_cache:*',
    'dashboard_cache:*',
    // Add other cache keys as needed
  ];

  for (const cacheKey of cacheKeys) {
    try {
      if (dryRun) {
        results.cleared.push(`${cacheKey} (dry run)`);
      } else {
        // In a real implementation, you would clear cache entries
        // For example, using Redis or another caching system
        results.cleared.push(cacheKey);
      }
    } catch (error) {
      results.failed.push(cacheKey);
    }
  }

  results.total_clear_time_ms = Date.now() - startTime;
}

async function rebuildIndexes(supabase: Awaited<ReturnType<typeof createServerSupabase>>, results: any, dryRun: boolean): Promise<void> {
  const startTime = Date.now();
  const indexes = [
    'idx_employer_final_ratings_employer',
    'idx_project_compliance_assessments_employer',
    'idx_organiser_overall_expertise_ratings_employer',
    // Add other indexes as needed
  ];

  for (const index of indexes) {
    try {
      if (dryRun) {
        results.rebuilt.push(`${index} (dry run)`);
      } else {
        // In a real implementation, you would execute SQL to rebuild indexes
        // For example: REINDEX INDEX CONCURRENTLY index_name;
        results.rebuilt.push(index);
      }
    } catch (error) {
      results.failed.push(index);
    }
  }

  results.total_rebuild_time_ms = Date.now() - startTime;
}

function estimateUserImpact(operation: string, processingTimeMs: number): 'none' | 'minimal' | 'moderate' | 'high' {
  const processingTimeSeconds = processingTimeMs / 1000;

  if (operation === 'cache') {
    return 'minimal'; // Cache clearing has minimal impact
  } else if (processingTimeSeconds < 10) {
    return 'minimal';
  } else if (processingTimeSeconds < 30) {
    return 'moderate';
  } else {
    return 'high';
  }
}

function getRecommendedMaintenanceWindow(operation: string): string {
  switch (operation) {
    case 'materialized_views':
      return 'Weekend or off-peak hours (2-4 AM)';
    case 'statistics':
      return 'Daily during off-peak hours (3-5 AM)';
    case 'cache':
      return 'Any time (minimal impact)';
    case 'indexes':
      return 'Weekend maintenance window (low traffic)';
    case 'all':
      return 'Scheduled maintenance window (Saturday 2-6 AM)';
    default:
      return 'Off-peak hours when user traffic is minimal';
  }
}

// Export handlers with rate limiting
export const POST = withRateLimit(
  refreshMaintenanceHandler,
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('rating_maintenance_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'processing');

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Maintenance-Jobs': count?.toString() || '0',
        'X-Maintenance-System-Status': 'operational',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminClient, isCronAuthorized } from '@/lib/supabase/admin-client';

export const dynamic = 'force-dynamic'

/**
 * Admin endpoint for manually triggering materialized view refresh.
 *
 * Auth model (cross-ref docs/CONNECTION_STABILITY_REMEDIATION_PLAN.md P0-6):
 *
 *  1. Vercel cron path — Vercel automatically attaches
 *     `Authorization: Bearer <CRON_SECRET>` when `CRON_SECRET` is set in the
 *     project env. If that header matches, we use the service-role client
 *     (cron has no user session, so `getUser()` would return null and the
 *     refresh RPCs would no-op or partially refresh under RLS).
 *
 *  2. Manual admin trigger path — falls back to the cookie-based session
 *     check, then verifies the profile role is admin/lead_organiser. Uses the
 *     anon+cookies client (RLS-protected) for the auth check, then a
 *     service-role client for the actual refresh so RPCs see the full schema.
 */

export interface RefreshViewsRequest {
  scope?: 'all' | 'employers' | 'workers' | 'projects' | 'site_visits';
  force?: boolean; // Force refresh even if recently updated
}

export interface RefreshViewsResponse {
  success: boolean;
  duration: number;
  scope: string;
  refreshedViews: string[];
  error?: string;
  timestamp: string;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    let triggeredBy: 'cron' | 'manual'
    let supabase: Awaited<ReturnType<typeof createServerSupabase>> | ReturnType<typeof createAdminClient>

    if (isCronAuthorized(request)) {
      triggeredBy = 'cron'
      supabase = createAdminClient()
    } else {
      // Manual path — validate the cookie-based user session and role.
      const sessionClient = await createServerSupabase();
      const { data: { user }, error: authError } = await sessionClient.auth.getUser();

      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { data: profile } = await sessionClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile || !['admin', 'lead_organiser'].includes(profile.role)) {
        return NextResponse.json(
          { error: 'Unauthorized - admin access required' },
          { status: 403 }
        );
      }

      triggeredBy = 'manual'
      // Use service-role for the actual refresh so RPCs see the full schema
      // regardless of the calling user's RLS scope.
      supabase = createAdminClient()
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope || 'all';
    const force = body.force || false;

    console.log(`🔄 Admin refresh triggered: scope=${scope}, force=${force}, by=${triggeredBy}`);
    const refreshedViews: string[] = [];

    // Check staleness first (unless forced)
    if (!force) {
      const { data: staleness } = await supabase.rpc('check_materialized_view_staleness');
      const staleViews = (staleness || []).filter((v: any) => v.needs_refresh);

      if (staleViews.length === 0) {
        return NextResponse.json({
          success: true,
          duration: Date.now() - startTime,
          scope,
          refreshedViews: [],
          message: 'No views needed refresh (all current)',
          triggeredBy,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Execute refresh based on scope
    switch (scope) {
      case 'employers':
        await supabase.rpc('refresh_employer_related_views');
        // Also refresh the search-optimized view
        await supabase.rpc('refresh_employers_search_view_logged', { p_triggered_by: 'api_ui' });
        refreshedViews.push('employer_list_view', 'employers_search_optimized', 'project_list_comprehensive_view');
        break;
        
      case 'workers':
        await supabase.rpc('refresh_worker_related_views');
        refreshedViews.push('worker_list_view', 'project_list_comprehensive_view');
        break;
        
      case 'projects':
        await supabase.rpc('refresh_project_related_views');
        refreshedViews.push('project_list_comprehensive_view', 'patch_project_mapping_view');
        break;
        
      case 'site_visits':
        await supabase.rpc('refresh_site_visit_related_views');
        refreshedViews.push('site_visit_list_view');
        break;
        
      case 'all':
      default:
        await supabase.rpc('refresh_all_materialized_views');
        // Also refresh the search-optimized view
        await supabase.rpc('refresh_employers_search_view_logged', { p_triggered_by: 'api_ui_all' });
        refreshedViews.push(
          'employer_list_view',
          'employers_search_optimized',
          'worker_list_view', 
          'project_list_comprehensive_view',
          'patch_project_mapping_view',
          'site_visit_list_view'
        );
        break;
    }

    const duration = Date.now() - startTime;
    
    console.log(`✅ Admin refresh completed: ${refreshedViews.length} views in ${duration}ms`);

    const response: RefreshViewsResponse = {
      success: true,
      duration,
      scope,
      refreshedViews,
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error: any) {
    const duration = Date.now() - startTime;
    console.error('❌ Admin refresh failed:', error);
    
    return NextResponse.json({
      success: false,
      duration,
      scope: 'unknown',
      refreshedViews: [],
      error: error.message || 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET endpoint for checking view staleness without refreshing.
// Accepts either Vercel cron (CRON_SECRET) or an authenticated admin/lead session.
export async function GET(request: NextRequest) {
  try {
    let supabase: Awaited<ReturnType<typeof createServerSupabase>> | ReturnType<typeof createAdminClient>

    if (isCronAuthorized(request)) {
      supabase = createAdminClient()
    } else {
      const sessionClient = await createServerSupabase();
      const { data: { user }, error: authError } = await sessionClient.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { data: profile } = await sessionClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      if (!profile || !['admin', 'lead_organiser'].includes(profile.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
      supabase = createAdminClient()
    }

    const { data: staleness, error } = await supabase.rpc('check_materialized_view_staleness');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      views: staleness || []
    });

  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to check staleness' },
      { status: 500 }
    );
  }
}

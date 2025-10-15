import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic'

/**
 * Admin endpoint for manually triggering materialized view refresh
 * This can be called by cron jobs, webhooks, or manual administration
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
    // Basic authentication check (you may want to add proper auth)
    const authHeader = request.headers.get('authorization');
    const hostname = request.nextUrl.hostname;
    const isLocalhost = hostname === 'localhost';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (!isLocalhost && !isDevelopment && !authHeader?.includes('Bearer')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const scope = body.scope || 'all';
    const force = body.force || false;

    console.log(`🔄 Admin refresh triggered: scope=${scope}, force=${force}`);

    const supabase = await createServerSupabase();
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
          timestamp: new Date().toISOString()
        });
      }
    }

    // Execute refresh based on scope
    switch (scope) {
      case 'employers':
        await supabase.rpc('refresh_employer_related_views');
        refreshedViews.push('employer_list_view', 'project_list_comprehensive_view');
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
        refreshedViews.push(
          'employer_list_view',
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

// GET endpoint for checking view staleness without refreshing
export async function GET() {
  try {
    const supabase = await createServerSupabase();
    
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

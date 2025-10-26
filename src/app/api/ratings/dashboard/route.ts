import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface DashboardResponse {
  overview: {
    total_employers: number;
    rated_employers: number;
    current_rating_distribution: {
      green: number;
      amber: number;
      red: number;
      unknown: number;
    };
    recent_changes: {
      improvements: number;
      declines: number;
      new_ratings: number;
    };
    system_health: {
      data_quality_score: number;
      last_updated: string;
      active_alerts: number;
      pending_reviews: number;
    };
  };
  top_concerns: Array<{
    employer_id: string;
    employer_name: string;
    current_rating: 'green' | 'amber' | 'red' | 'unknown';
    score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining';
    last_updated: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  top_performers: Array<{
    employer_id: string;
    employer_name: string;
    current_rating: 'green' | 'amber' | 'red' | 'unknown';
    score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining';
    last_updated: string;
  }>;
  recent_activities: Array<{
    type: 'rating_change' | 'assessment_added' | 'review_completed' | 'alert_triggered';
    employer_id: string;
    employer_name: string;
    description: string;
    timestamp: string;
    user?: string;
  }>;
  alerts: Array<{
    id: string;
    type: 'rating_change' | 'discrepancy_detected' | 'review_required' | 'expiry_warning';
    severity: 'info' | 'warning' | 'critical';
    title: string;
    message: string;
    employer_id?: string;
    employer_name?: string;
    created_at: string;
    requires_action: boolean;
  }>;
  quick_actions: {
    pending_reviews: number;
    ratings_expiring_soon: number;
    data_gaps: number;
    discrepancies_to_resolve: number;
  };
  filters?: {
    role_scope: string[];
    accessible_patches: string[];
  };
}

// GET handler - Mobile-optimized dashboard data
async function getDashboardHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20);
    const includeAlerts = searchParams.get('includeAlerts') !== 'false';
    const patchFilter = searchParams.get('patch');

    // Get dashboard data based on user role and permissions
    const overview = await getDashboardOverview(supabase, role, user.id);
    const topConcerns = await getTopConcerns(supabase, role, user.id, limit, patchFilter);
    const topPerformers = await getTopPerformers(supabase, role, user.id, limit, patchFilter);
    const recentActivities = await getRecentActivities(supabase, role, user.id, limit);
    const alerts = includeAlerts ? await getActiveAlerts(supabase, role, user.id, limit) : [];
    const quickActions = await getQuickActions(supabase, role, user.id);

    const response: DashboardResponse = {
      overview,
      top_concerns: topConcerns,
      top_performers: topPerformers,
      recent_activities: recentActivities,
      alerts,
      quick_actions,
    };

    // Add role-based filter information
    if (role === 'organiser' || role === 'lead_organiser') {
      // Get user's accessible patches for filtering
      const { data: userPatches } = await supabase
        .from('patch_assignments')
        .select('patch_id, patches(id, name)')
        .eq('user_id', user.id);

      response.filters = {
        role_scope: role === 'admin' ? ['all'] : [role],
        accessible_patches: userPatches?.map(p => p.patch_id) || [],
      };
    }

    // Add cache headers optimized for mobile
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache for mobile
      'Content-Type': 'application/json',
      'X-Mobile-Optimized': 'true',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get dashboard API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
async function getDashboardOverview(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string
): Promise<any> {
  try {
    // Get total employers
    const { count: totalEmployers, error: employersError } = await supabase
      .from('employers')
      .select('*', { count: 'exact', head: true });

    // Get current rating distribution
    const { data: currentRatings, error: ratingsError } = await supabase
      .from('employer_final_ratings')
      .select('final_rating')
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .gte('expiry_date', new Date().toISOString().split('T')[0]);

    // Get recent changes (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const { data: recentChanges, error: changesError } = await supabase
      .from('employer_rating_history')
      .select('rating_change_type')
      .gte('rating_date', thirtyDaysAgo);

    // Get system health metrics
    const { data: qualityMetrics, error: qualityError } = await supabase
      .from('rating_quality_metrics')
      .select('*')
      .order('metric_date', { ascending: false })
      .limit(1)
      .single();

    // Get active alerts and pending reviews
    const { count: activeAlerts, error: alertsError } = await supabase
      .from('rating_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('requires_response', true);

    const { count: pendingReviews, error: reviewsError } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('review_required', true)
      .eq('is_active', true);

    // Calculate distribution
    const distribution = { green: 0, amber: 0, red: 0, unknown: 0 };
    (currentRatings || []).forEach((rating: any) => {
      distribution[rating.final_rating as keyof typeof distribution] =
        (distribution[rating.final_rating as keyof typeof distribution] || 0) + 1;
    });

    // Calculate recent changes
    const changes = { improvements: 0, declines: 0, new_ratings: 0 };
    (recentChanges || []).forEach((change: any) => {
      if (change.rating_change_type === 'improvement') changes.improvements++;
      else if (change.rating_change_type === 'decline') changes.declines++;
      else if (change.rating_change_type === 'first_rating') changes.new_ratings++;
    });

    return {
      total_employers: totalEmployers || 0,
      rated_employers: currentRatings?.length || 0,
      current_rating_distribution: distribution,
      recent_changes: changes,
      system_health: {
        data_quality_score: qualityMetrics?.average_confidence_score || 0,
        last_updated: qualityMetrics?.updated_at || new Date().toISOString(),
        active_alerts: activeAlerts || 0,
        pending_reviews: pendingReviews || 0,
      },
    };

  } catch (error) {
    console.error('Error getting dashboard overview:', error);
    return {
      total_employers: 0,
      rated_employers: 0,
      current_rating_distribution: { green: 0, amber: 0, red: 0, unknown: 0 },
      recent_changes: { improvements: 0, declines: 0, new_ratings: 0 },
      system_health: {
        data_quality_score: 0,
        last_updated: new Date().toISOString(),
        active_alerts: 0,
        pending_reviews: 0,
      },
    };
  }
}

async function getTopConcerns(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string,
  limit: number,
  patchFilter?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('employer_final_ratings')
      .select(`
        *,
        employers!employer_id(name)
      `)
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .in('final_rating', ['red', 'amber'])
      .order('final_score', { ascending: true })
      .limit(limit);

    // Apply role-based filtering
    if (role !== 'admin' && patchFilter) {
      // In a real implementation, you would filter by user's accessible patches/employers
      // This is a simplified version
    }

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((item: any) => ({
      employer_id: item.employer_id,
      employer_name: item.employers?.name || 'Unknown',
      current_rating: item.final_rating,
      score: item.final_score,
      rating_trend: 'stable', // Would calculate from historical data
      last_updated: item.updated_at,
      priority: item.final_rating === 'red' ? 'high' : 'medium',
    }));

  } catch (error) {
    console.error('Error getting top concerns:', error);
    return [];
  }
}

async function getTopPerformers(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string,
  limit: number,
  patchFilter?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from('employer_final_ratings')
      .select(`
        *,
        employers!employer_id(name)
      `)
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .eq('final_rating', 'green')
      .order('final_score', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error || !data) return [];

    return data.map((item: any) => ({
      employer_id: item.employer_id,
      employer_name: item.employers?.name || 'Unknown',
      current_rating: item.final_rating,
      score: item.final_score,
      rating_trend: 'stable', // Would calculate from historical data
      last_updated: item.updated_at,
    }));

  } catch (error) {
    console.error('Error getting top performers:', error);
    return [];
  }
}

async function getRecentActivities(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string,
  limit: number
): Promise<any[]> {
  try {
    // Get recent rating changes
    const { data: ratingChanges, error: ratingError } = await supabase
      .from('employer_rating_history')
      .select(`
        *,
        employers!employer_id(name)
      `)
      .order('rating_date', { ascending: false })
      .limit(Math.ceil(limit / 2));

    // Get recent assessments
    const { data: assessments, error: assessmentError } = await supabase
      .from('project_compliance_assessments')
      .select(`
        *,
        employers!employer_id(name),
        profiles!created_by(first_name, surname)
      `)
      .order('created_at', { ascending: false })
      .limit(Math.ceil(limit / 2));

    const activities: any[] = [];

    // Process rating changes
    (ratingChanges || []).forEach((change: any) => {
      activities.push({
        type: 'rating_change',
        employer_id: change.employer_id,
        employer_name: change.employers?.name || 'Unknown',
        description: `Rating ${change.rating_change_type}: ${change.previous_rating || 'none'} → ${change.new_rating}`,
        timestamp: change.rating_date,
      });
    });

    // Process assessments
    (assessments || []).forEach((assessment: any) => {
      activities.push({
        type: 'assessment_added',
        employer_id: assessment.employer_id,
        employer_name: assessment.employers?.name || 'Unknown',
        description: `New ${assessment.assessment_type} assessment`,
        timestamp: assessment.created_at,
        user: assessment.profiles_created_by ?
          `${assessment.profiles_created_by.first_name} ${assessment.profiles_created_by.surname}`.trim() :
          undefined,
      });
    });

    // Sort by timestamp and limit
    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

  } catch (error) {
    console.error('Error getting recent activities:', error);
    return [];
  }
}

async function getActiveAlerts(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string,
  limit: number
): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('rating_alerts')
      .select('*')
      .eq('is_active', true)
      .eq('requires_response', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !data) return [];

    return data.map((alert: any) => ({
      id: alert.id,
      type: alert.alert_type,
      severity: alert.alert_level,
      title: alert.alert_title,
      message: alert.alert_message,
      employer_id: alert.employer_id,
      employer_name: alert.employer_id ? 'Employer Name' : undefined, // Would fetch from employers table
      created_at: alert.created_at,
      requires_action: alert.response_required,
    }));

  } catch (error) {
    console.error('Error getting active alerts:', error);
    return [];
  }
}

async function getQuickActions(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  role: string,
  userId: string
): Promise<any> {
  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Get ratings expiring soon
    const { count: expiringSoon, error: expiringError } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .lte('expiry_date', sevenDaysFromNow)
      .gt('expiry_date', now.toISOString().split('T')[0]);

    // Get discrepancies to resolve
    const { count: discrepancies, error: discrepancyError } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('rating_discrepancy', true)
      .eq('required_dispute_resolution', true);

    return {
      pending_reviews: 0, // Would calculate from review_required field
      ratings_expiring_soon: expiringSoon || 0,
      data_gaps: 0, // Would calculate from missing assessments
      discrepancies_to_resolve: discrepancies || 0,
    };

  } catch (error) {
    console.error('Error getting quick actions:', error);
    return {
      pending_reviews: 0,
      ratings_expiring_soon: 0,
      data_gaps: 0,
      discrepancies_to_resolve: 0,
    };
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  getDashboardHandler,
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('rating_status', 'active');

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Ratings': count?.toString() || '0',
        'X-Dashboard-Status': 'operational',
        'X-Mobile-Optimized': 'true',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
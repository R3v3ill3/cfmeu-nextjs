import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

// TypeScript types for the alerts response
export interface RatingAlert {
  id: string;
  type: "info" | "warning" | "error";
  title: string;
  message: string;
  employer_id: string;
  employer_name: string;
  timestamp: string;
  acknowledged: boolean;
}

// GET handler - Get rating alerts
async function getAlertsHandler(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const supabase = await createServerSupabase();

    // Parse query parameters
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const acknowledged = searchParams.get('acknowledged');
    const alertType = searchParams.get('type');
    const employerId = searchParams.get('employer_id');

    // Build query
    let query = supabase
      .from('rating_alerts')
      .select(`
        *,
        employers!employer_id(name)
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    // Apply filters
    if (acknowledged !== null) {
      query = query.eq('acknowledged', acknowledged === 'true');
    }

    if (alertType) {
      query = query.eq('alert_level', alertType);
    }

    if (employerId) {
      query = query.eq('employer_id', employerId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error getting rating alerts:', error);
      throw error;
    }

    // Transform data to match expected format
    const alerts: RatingAlert[] = (data || []).map((alert: any) => {
      // Map alert_level to type
      let alertType: "info" | "warning" | "error" = "info";
      if (alert.alert_level === 'critical' || alert.alert_level === 'error') {
        alertType = "error";
      } else if (alert.alert_level === 'warning') {
        alertType = "warning";
      }

      return {
        id: alert.id,
        type: alertType,
        title: alert.alert_title || 'Rating Alert',
        message: alert.alert_message || 'An alert has been generated for this rating.',
        employer_id: alert.employer_id || '',
        employer_name: alert.employers?.name || 'Unknown Employer',
        timestamp: alert.created_at,
        acknowledged: alert.acknowledged || false,
      };
    });

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // 1min cache for alerts
      'Content-Type': 'application/json',
    };

    return NextResponse.json(alerts, { headers });

  } catch (error) {
    console.error('Get rating alerts API error:', error);

    // Return appropriate error response
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to fetch rating alerts', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST handler - Create a new rating alert (for future use)
async function createAlertHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const body = await request.json();

    // Validate required fields
    const { employer_id, alert_title, alert_message, alert_level } = body;
    if (!employer_id || !alert_title || !alert_message || !alert_level) {
      return NextResponse.json(
        { error: 'Missing required fields: employer_id, alert_title, alert_message, alert_level' },
        { status: 400 }
      );
    }

    // Create the alert
    const { data, error } = await supabase
      .from('rating_alerts')
      .insert({
        employer_id,
        alert_title,
        alert_message,
        alert_level,
        alert_type: 'system_generated', // Default type
        is_active: true,
        acknowledged: false,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating rating alert:', error);
      throw error;
    }

    return NextResponse.json(data, { status: 201 });

  } catch (error) {
    console.error('Create rating alert API error:', error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to create rating alert', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  getAlertsHandler,
  RATE_LIMIT_PRESETS.RELAXED
);

export const POST = withRateLimit(
  createAlertHandler,
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('rating_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Alerts': count?.toString() || '0',
        'X-Alerts-Status': 'operational',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}



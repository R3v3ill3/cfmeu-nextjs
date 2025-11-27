import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { TrafficLightRating, ConfidenceLevel } from '@/types/rating';

export const dynamic = 'force-dynamic';

// TypeScript types for the stats response
export interface RatingStatsResponse {
  total_employers: number;
  rating_distribution: Record<TrafficLightRating, number>;
  confidence_distribution: Record<string, number>;
  recent_updates: number;
  discrepancies_count: number;
}

// GET handler - Get rating statistics
async function getStatsHandler(request: NextRequest) {
  try {
    const supabase = await createServerSupabase();

    // Get total employers count
    const { count: totalEmployers, error: employersError } = await supabase
      .from('employers')
      .select('*', { count: 'exact', head: true });

    if (employersError) {
      console.error('Error getting total employers:', employersError);
      throw employersError;
    }

    // Get rating distribution from employer_final_ratings
    // Use head: true with count to avoid fetching all rows (only need count per rating)
    // This avoids potential stack depth issues with large result sets
    const { data: currentRatings, error: ratingsError } = await supabase
      .from('employer_final_ratings')
      .select('final_rating', { count: 'exact' })
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .gte('expiry_date', new Date().toISOString().split('T')[0])
      .limit(10000); // Add reasonable limit to prevent runaway queries

    if (ratingsError) {
      console.error('Error getting ratings distribution:', ratingsError);
      throw ratingsError;
    }

    // Get recent updates (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: recentUpdates, error: recentError } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .gte('updated_at', sevenDaysAgo);

    if (recentError) {
      console.error('Error getting recent updates:', recentError);
      throw recentError;
    }

    // Get discrepancies count
    const { count: discrepanciesCount, error: discrepanciesError } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)
      .eq('rating_discrepancy', true);

    if (discrepanciesError) {
      console.error('Error getting discrepancies count:', discrepanciesError);
      throw discrepanciesError;
    }

    // Calculate rating distribution
    const ratingDistribution: Record<TrafficLightRating, number> = {
      red: 0,
      amber: 0,
      yellow: 0,
      green: 0,
    };

    // Calculate confidence distribution (placeholder for future implementation)
    const confidenceDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      very_high: 0,
    };

    // Process ratings data
    (currentRatings || []).forEach((rating: any) => {
      const ratingValue = rating.final_rating as TrafficLightRating;

      if (ratingValue && ratingDistribution.hasOwnProperty(ratingValue)) {
        ratingDistribution[ratingValue]++;
      }
    });

    const stats: RatingStatsResponse = {
      total_employers: totalEmployers || 0,
      rating_distribution: ratingDistribution,
      confidence_distribution: confidenceDistribution,
      recent_updates: recentUpdates || 0,
      discrepancies_count: discrepanciesCount || 0,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      'Content-Type': 'application/json',
    };

    return NextResponse.json(stats, { headers });

  } catch (error) {
    console.error('Get rating stats API error:', error);
    
    const errorObj = error as any;
    const errorMessage = errorObj?.message || String(error);
    
    // Handle iOS Safari refresh token issues gracefully (JAVASCRIPT-NEXTJS-Q)
    // This occurs when ITP blocks refresh token cookies
    if (errorMessage?.includes('Refresh Token Not Found') || errorMessage?.includes('Invalid Refresh Token')) {
      console.warn('[ratings/stats] Session expired - refresh token not found (likely iOS Safari ITP)');
      return NextResponse.json(
        { error: 'session_expired', message: 'Your session has expired. Please sign in again.' },
        { status: 401 }
      );
    }
    
    // Check for timeout or stack depth errors
    if (errorObj?.code === '57014') {
      console.error('Query timeout detected - consider optimizing employer_final_ratings queries');
      return NextResponse.json(
        { error: 'Query timeout - please try again', message: 'Database query took too long' },
        { status: 504 }
      );
    }
    if (errorObj?.code === '54001') {
      console.error('Stack depth limit exceeded - check for recursive queries');
      return NextResponse.json(
        { error: 'Query too complex', message: 'Database query exceeded stack depth limit' },
        { status: 500 }
      );
    }

    // Return appropriate error response
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to fetch rating statistics', message: error.message || 'Unknown error' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error', message: String(error) || 'Unknown error' },
      { status: 500 }
    );
  }
}

// Export handler with rate limiting
export const GET = withRateLimit(
  getStatsHandler,
  RATE_LIMIT_PRESETS.RELAXED
);

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Active-Ratings': count?.toString() || '0',
        'X-Stats-Status': 'operational',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}



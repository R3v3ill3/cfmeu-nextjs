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
    const { data: currentRatings, error: ratingsError } = await supabase
      .from('employer_final_ratings')
      .select('final_rating')
      .eq('is_active', true)
      .eq('rating_status', 'active')
      .gte('expiry_date', new Date().toISOString().split('T')[0]);

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

    // Return appropriate error response
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Failed to fetch rating statistics', message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
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



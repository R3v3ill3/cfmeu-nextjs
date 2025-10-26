import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';

export const dynamic = 'force-dynamic';

// TypeScript interface for the expected frontend format
export interface EmployerRatingResponse {
  rating_history: Array<{
    id: string;
    rating: 'green' | 'yellow' | 'amber' | 'red';
    confidence: 'very_high' | 'high' | 'medium' | 'low';
    calculated_at: string;
    source?: string;
  }>;
  project_data_rating: {
    id: string;
    rating: 'green' | 'yellow' | 'amber' | 'red';
    confidence: 'very_high' | 'high' | 'medium' | 'low';
    calculated_at: string;
    score?: number;
    projects_included?: number;
    latest_project_date?: string;
    data_quality?: 'high' | 'medium' | 'low' | 'very_low';
  } | null;
  organiser_expertise_rating: {
    id: string;
    rating: 'green' | 'yellow' | 'amber' | 'red';
    confidence: 'very_high' | 'high' | 'medium' | 'low';
    calculated_at: string;
    score?: number;
    assessments_included?: number;
    latest_expertise_date?: string;
    expertise_confidence?: 'high' | 'medium' | 'low' | 'very_low';
  } | null;
}

// Transform the real ratings data to match the expected frontend format
function transformRatingsData(realData: any): EmployerRatingResponse {
  // Transform rating history
  const rating_history = (realData.ratings || []).map((rating: any) => ({
    id: rating.id,
    rating: rating.final_rating,
    confidence: rating.overall_confidence,
    calculated_at: rating.rating_date,
    source: 'final_rating'
  }));

  // Transform project data rating
  const project_data_rating = realData.current_rating ? {
    id: realData.current_rating.id,
    rating: realData.current_rating.project_based_rating || realData.current_rating.final_rating,
    confidence: realData.current_rating.project_data_quality || realData.current_rating.overall_confidence,
    calculated_at: realData.current_rating.rating_date,
    score: realData.current_rating.project_based_score,
    projects_included: realData.current_rating.projects_included,
    latest_project_date: realData.current_rating.latest_project_date,
    data_quality: realData.current_rating.project_data_quality
  } : null;

  // Transform organiser expertise rating
  const organiser_expertise_rating = realData.current_rating ? {
    id: realData.current_rating.id,
    rating: realData.current_rating.expertise_based_rating || realData.current_rating.final_rating,
    confidence: realData.current_rating.expertise_confidence || realData.current_rating.overall_confidence,
    calculated_at: realData.current_rating.rating_date,
    score: realData.current_rating.expertise_based_score,
    assessments_included: realData.current_rating.expertise_assessments_included,
    latest_expertise_date: realData.current_rating.latest_expertise_date,
    expertise_confidence: realData.current_rating.expertise_confidence
  } : null;

  return {
    rating_history,
    project_data_rating,
    organiser_expertise_rating
  };
}

export async function GET(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    console.log('Employer rating adapter called with employerId:', employerId);

    // Set system context for feature flag checking (bypass role restrictions)
    featureFlags.setUserContext({
      userId: 'rating-adapter-system',
      role: 'admin',
      environment: process.env.NODE_ENV || 'development'
    });

    // Check if rating system is enabled
    if (!featureFlags.isEnabled('RATING_SYSTEM_ENABLED')) {
      console.log('Rating system is disabled - returning empty data');
      const emptyResponse: EmployerRatingResponse = {
        rating_history: [],
        project_data_rating: null,
        organiser_expertise_rating: null
      };
      return NextResponse.json(emptyResponse, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Content-Type': 'application/json',
          'X-Data-Source': 'feature-flags-disabled',
          'X-Status': 'rating-system-disabled',
          'X-Employer-ID': employerId,
          'X-Timestamp': new Date().toISOString()
        }
      });
    }

    // Try to call the real ratings endpoint
    try {
      // Make an internal API call to the real endpoint
      const realEndpointUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'}/api/employers/${employerId}/ratings`;

      const response = await fetch(realEndpointUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          // Forward any relevant headers from the original request
          'User-Agent': request.headers.get('User-Agent') || '',
        },
      });

      if (response.ok) {
        const realData = await response.json();
        const transformedData = transformRatingsData(realData);

        console.log('Successfully retrieved and transformed rating data for employer:', employerId);

        return NextResponse.json(transformedData, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            'Content-Type': 'application/json',
            'X-Data-Source': 'real-database-transformed',
            'X-Status': 'success',
            'X-Employer-ID': employerId,
            'X-Timestamp': new Date().toISOString(),
            'X-Real-Endpoint-Status': response.status.toString()
          }
        });
      } else {
        console.warn(`Real ratings endpoint returned ${response.status} for employer ${employerId}`);
        throw new Error(`Real endpoint returned status ${response.status}`);
      }
    } catch (fetchError) {
      console.warn('Failed to fetch from real endpoint, falling back to direct database query:', fetchError);

      // Fallback: Direct database query
      const supabase = await createServerSupabase();

      const { data: ratings, error: ratingsError } = await supabase
        .from('employer_final_ratings')
        .select('*')
        .eq('employer_id', employerId)
        .eq('is_active', true)
        .order('rating_date', { ascending: false })
        .limit(10);

      if (ratingsError) {
        console.error('Database query failed:', ratingsError);
        throw ratingsError;
      }

      const mockRealData = {
        ratings: ratings || [],
        current_rating: ratings && ratings.length > 0 ? ratings[0] : null
      };

      const transformedData = transformRatingsData(mockRealData);

      return NextResponse.json(transformedData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Content-Type': 'application/json',
          'X-Data-Source': 'direct-database-query',
          'X-Status': 'fallback-success',
          'X-Employer-ID': employerId,
          'X-Timestamp': new Date().toISOString()
        }
      });
    }

  } catch (error) {
    console.error('Employer rating adapter error:', error);

    // Return empty data structure as graceful fallback
    const emptyResponse: EmployerRatingResponse = {
      rating_history: [],
      project_data_rating: null,
      organiser_expertise_rating: null
    };

    return NextResponse.json(emptyResponse, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'Content-Type': 'application/json',
        'X-Data-Source': 'error-fallback',
        'X-Status': 'error-handled-gracefully',
        'X-Error': error instanceof Error ? error.message : 'Unknown error',
        'X-Timestamp': new Date().toISOString()
      }
    });
  }
}

export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    // Check if rating system is enabled
    const ratingEnabled = featureFlags.isEnabled('RATING_SYSTEM_ENABLED');

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Adapter-Status': 'healthy',
        'X-Mode': 'full-database-integration',
        'X-Rating-System-Enabled': ratingEnabled.toString(),
        'X-Employer-ID': employerId,
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { createServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// Final robust implementation with proper error handling
async function getEmployerRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;

    console.log('Employer rating adapter called with employerId:', employerId);

    // Try to connect to Supabase with proper error handling
    let supabase;
    try {
      supabase = await createServerSupabase();
      console.log('Supabase client created successfully');
    } catch (supabaseError) {
      console.error('Failed to create Supabase client:', supabaseError);

      // Return fallback data when Supabase is unavailable
      const fallbackResponse = {
        rating_history: [],
        project_data_rating: null,
        organiser_expertise_rating: null
      };

      return NextResponse.json(fallbackResponse, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'Content-Type': 'application/json',
          'X-Fallback-Data': 'true',
          'X-Error': 'supabase-connection-failed',
          'X-Error-Details': supabaseError instanceof Error ? supabaseError.message : 'Unknown error'
        }
      });
    }

    // Validate employer exists with error handling
    try {
      const { data: employer, error: employerError } = await supabase
        .from('employers')
        .select('id, name')
        .eq('id', employerId)
        .single();

      if (employerError || !employer) {
        console.log('Employer not found or error:', employerError);

        // Return empty structure instead of 404 to prevent frontend crashes
        const emptyResponse = {
          rating_history: [],
          project_data_rating: null,
          organiser_expertise_rating: null
        };

        return NextResponse.json(emptyResponse, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            'Content-Type': 'application/json',
            'X-Fallback-Data': 'true',
            'X-Reason': 'employer-not-found',
          }
        });
      }

      console.log('Employer found:', employer);

      // Try to query ratings with comprehensive error handling
      const { data: ratings, error: ratingsError } = await supabase
        .from('employer_final_ratings')
        .select('*')
        .eq('employer_id', employerId)
        .eq('is_active', true)
        .order('rating_date', { ascending: false })
        .limit(10);

      if (ratingsError) {
        console.error('Ratings query error:', ratingsError);

        // Return empty structure on database error
        const emptyResponse = {
          rating_history: [],
          project_data_rating: null,
          organiser_expertise_rating: null
        };

        return NextResponse.json(emptyResponse, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
            'Content-Type': 'application/json',
            'X-Fallback-Data': 'true',
            'X-Error': 'database-query-error',
            'X-Error-Details': ratingsError.message
          }
        });
      }

      console.log('Ratings found:', ratings?.length || 0);

      // Transform the data to match expected format
      const responseData = {
        rating_history: [],
        project_data_rating: null,
        organiser_expertise_rating: null
      };

      if (ratings && ratings.length > 0) {
        const currentRating = ratings[0];

        if (currentRating.project_based_rating && currentRating.project_based_rating !== 'unknown') {
          responseData.project_data_rating = {
            rating: currentRating.project_based_rating,
            confidence: mapDataQualityToConfidence(currentRating.project_data_quality || 'medium'),
            calculated_at: currentRating.latest_project_date || currentRating.updated_at
          };
        }

        if (currentRating.expertise_based_rating && currentRating.expertise_based_rating !== 'unknown') {
          responseData.organiser_expertise_rating = {
            rating: currentRating.expertise_based_rating,
            confidence: currentRating.expertise_confidence || 'medium',
            calculated_at: currentRating.latest_expertise_date || currentRating.updated_at
          };
        }

        // Add rating history
        responseData.rating_history = ratings
          .filter(rating => rating.final_rating && rating.final_rating !== 'unknown')
          .map(rating => ({
            rating: rating.final_rating,
            confidence: rating.overall_confidence || 'medium',
            calculated_at: rating.rating_date
          }));
      }

      return NextResponse.json(responseData, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'Content-Type': 'application/json',
          'X-Data-Source': 'database',
        }
      });

    } catch (queryError) {
      console.error('Error in database operations:', queryError);

      // Return empty structure to prevent frontend crashes
      const fallbackResponse = {
        rating_history: [],
        project_data_rating: null,
        organiser_expertise_rating: null
      };

      return NextResponse.json(fallbackResponse, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
          'Content-Type': 'application/json',
          'X-Fallback-Data': 'true',
          'X-Error': 'query-exception',
          'X-Error-Details': queryError instanceof Error ? queryError.message : 'Unknown error'
        }
      });
    }

  } catch (error) {
    console.error('Employer rating adapter unexpected error:', error);

    // Always return a valid structure to prevent frontend crashes
    const fallbackResponse = {
      rating_history: [],
      project_data_rating: null,
      organiser_expertise_rating: null
    };

    return NextResponse.json(fallbackResponse, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json',
        'X-Fallback-Data': 'true',
        'X-Error': 'internal-server-error',
        'X-Error-Details': error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
}

// Helper function to map data quality to confidence level
function mapDataQualityToConfidence(dataQuality: string): 'low' | 'medium' | 'high' | 'very_high' {
  switch (dataQuality) {
    case 'very_low':
      return 'low';
    case 'low':
      return 'medium';
    case 'medium':
      return 'high';
    case 'high':
      return 'very_high';
    default:
      return 'medium';
  }
}

// Export handler with rate limiting
export const GET = withRateLimit(
  (request, context) => getEmployerRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Adapter-Status': 'healthy',
        'X-Debug': 'minimal-head',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
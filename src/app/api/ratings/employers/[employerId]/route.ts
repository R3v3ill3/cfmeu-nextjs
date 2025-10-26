import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// Expected response format for frontend (EmployerRatingData)
interface SimpleEmployerRatingData {
  project_data_rating?: {
    rating: 'green' | 'amber' | 'yellow' | 'red'
    confidence: 'low' | 'medium' | 'high' | 'very_high'
    calculated_at: string
  }
  organiser_expertise_rating?: {
    rating: 'green' | 'amber' | 'yellow' | 'red'
    confidence: 'low' | 'medium' | 'high' | 'very_high'
    calculated_at: string
  }
  rating_history: Array<{
    rating: 'green' | 'amber' | 'yellow' | 'red'
    confidence: 'low' | 'medium' | 'high' | 'very_high'
    calculated_at: string
  }>
}

// Complex response from existing endpoint
interface ComplexFinalRatingResponse {
  id: string;
  employer_id: string;
  rating_date: string;
  final_rating: 'green' | 'amber' | 'red' | 'unknown';
  final_score: number | null;
  project_based_rating: 'green' | 'amber' | 'red' | 'unknown' | null;
  project_based_score: number | null;
  project_data_quality: 'high' | 'medium' | 'low' | 'very_low';
  projects_included: number;
  latest_project_date: string | null;
  expertise_based_rating: 'green' | 'amber' | 'red' | 'unknown' | null;
  expertise_based_score: number | null;
  expertise_confidence: 'high' | 'medium' | 'low' | 'very_low';
  expertise_assessments_included: number;
  latest_expertise_date: string | null;
  overall_confidence: 'high' | 'medium' | 'low' | 'very_low';
  data_completeness_score: number;
  rating_status: 'active' | 'under_review' | 'disputed' | 'superseded' | 'archived';
  is_active: boolean;
  created_at: string;
  updated_at: string;
  calculated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  next_review_date: string | null;
  expiry_date: string | null;
  data_age_days?: number;
  days_until_expiry?: number;
  needs_review?: boolean;
}

interface ComplexRatingsListResponse {
  ratings: ComplexFinalRatingResponse[];
  current_rating: ComplexFinalRatingResponse | null;
  pagination: {
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  };
  summary: {
    total_ratings: number;
    current_rating_score: number | null;
    rating_trend: 'improving' | 'stable' | 'declining' | 'unknown';
    last_updated: string | null;
    next_review_due: string | null;
  };
}

// Helper function to transform complex data to simple format
function transformComplexToSimple(complexData: ComplexRatingsListResponse): SimpleEmployerRatingData {
  const simpleData: SimpleEmployerRatingData = {
    rating_history: []
  };

  // Get current rating (most recent active rating)
  const currentRating = complexData.current_rating;

  if (currentRating) {
    // Transform project data rating
    if (currentRating.project_based_rating && currentRating.project_based_rating !== 'unknown') {
      simpleData.project_data_rating = {
        rating: currentRating.project_based_rating as 'green' | 'amber' | 'yellow' | 'red',
        confidence: mapDataQualityToConfidence(currentRating.project_data_quality),
        calculated_at: currentRating.latest_project_date || currentRating.updated_at
      };
    }

    // Transform expertise rating
    if (currentRating.expertise_based_rating && currentRating.expertise_based_rating !== 'unknown') {
      simpleData.organiser_expertise_rating = {
        rating: currentRating.expertise_based_rating as 'green' | 'amber' | 'yellow' | 'red',
        confidence: currentRating.expertise_confidence,
        calculated_at: currentRating.latest_expertise_date || currentRating.updated_at
      };
    }
  }

  // Transform rating history (last 10 ratings for performance)
  const recentRatings = complexData.ratings
    .slice(0, 10)
    .filter(rating => rating.is_active && rating.final_rating !== 'unknown');

  simpleData.rating_history = recentRatings.map(rating => ({
    rating: rating.final_rating as 'green' | 'amber' | 'yellow' | 'red',
    confidence: rating.overall_confidence,
    calculated_at: rating.rating_date
  }));

  return simpleData;
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

// GET handler - Adapter endpoint for frontend compatibility
async function getEmployerRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 });
    }

    const role = profile.role as AllowedRole;
    if (!role || !ROLE_SET.has(role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Call existing endpoint internally
    const existingEndpointUrl = `${request.nextUrl.origin}/api/employers/${employerId}/ratings?pageSize=1&includeInactive=false&status=active`;

    try {
      const response = await fetch(existingEndpointUrl, {
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json',
        },
        cache: 'no-store', // Ensure fresh data
      });

      if (!response.ok) {
        console.error('Existing endpoint error:', response.status, response.statusText);

        // If existing endpoint fails, return empty but valid structure
        const emptyResponse: SimpleEmployerRatingData = {
          rating_history: []
        };

        return NextResponse.json(emptyResponse, {
          status: 200,
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            'Content-Type': 'application/json',
            'X-Fallback-Data': 'true',
          }
        });
      }

      const complexData: ComplexRatingsListResponse = await response.json();

      // Transform complex data to simple format
      const simpleData = transformComplexToSimple(complexData);

      // Add cache headers
      const headers = {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
        'Content-Type': 'application/json',
        'X-Data-Source': 'existing-endpoint',
      };

      return NextResponse.json(simpleData, { headers });

    } catch (fetchError) {
      console.error('Error calling existing endpoint:', fetchError);

      // Return empty structure to prevent frontend crashes
      const emptyResponse: SimpleEmployerRatingData = {
        rating_history: []
      };

      return NextResponse.json(emptyResponse, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300', // Shorter cache for fallback
          'Content-Type': 'application/json',
          'X-Fallback-Data': 'true',
          'X-Error': 'existing-endpoint-unavailable',
        }
      });
    }

  } catch (error) {
    console.error('Employer rating adapter API unexpected error:', error);

    // Always return a valid structure to prevent frontend crashes
    const fallbackResponse: SimpleEmployerRatingData = {
      rating_history: []
    };

    return NextResponse.json(fallbackResponse, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        'Content-Type': 'application/json',
        'X-Fallback-Data': 'true',
        'X-Error': 'internal-server-error',
      }
    });
  }
}

// Export handler with rate limiting
export const GET = withRateLimit(
  (request, context) => getEmployerRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    const { data: employer, error } = await supabase
      .from('employers')
      .select('id')
      .eq('id', employerId)
      .single();

    if (error || !employer) {
      return new NextResponse(null, { status: 404 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Adapter-Status': 'healthy',
        'X-Endpoint-Path': '/api/ratings/employers/[employerId]',
        'X-Target-Endpoint': '/api/employers/[employerId]/ratings',
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
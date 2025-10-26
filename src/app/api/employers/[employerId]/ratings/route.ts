import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface FinalRatingResponse {
  id: string;
  employer_id: string;
  rating_date: string;
  final_rating: 'green' | 'amber' | 'red' | 'unknown';
  final_score: number | null;

  // Component ratings
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

  eba_status: 'green' | 'amber' | 'red' | 'unknown' | null;

  // Discrepancy information
  rating_discrepancy: boolean;
  discrepancy_level: number;
  reconciliation_method: string | null;
  required_dispute_resolution: boolean;

  // Quality indicators
  overall_confidence: 'high' | 'medium' | 'low' | 'very_low';
  data_completeness_score: number;
  rating_stability_score: number | null;

  // Status information
  rating_status: 'active' | 'under_review' | 'disputed' | 'superseded' | 'archived';
  review_required: boolean;
  review_reason: string | null;
  next_review_date: string | null;
  expiry_date: string | null;

  // Weighting information
  project_weight: number;
  expertise_weight: number;
  eba_weight: number;
  calculation_method_id: string | null;
  custom_adjustment: number;
  adjustment_reason: string | null;

  // Audit information
  calculated_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;

  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;

  // Additional calculated fields
  data_age_days?: number;
  days_until_expiry?: number;
  needs_review?: boolean;
}

export interface RatingsListResponse {
  ratings: FinalRatingResponse[];
  current_rating: FinalRatingResponse | null;
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

export interface RatingCalculationRequest {
  calculation_date?: string;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  calculation_method?: string;
  force_recalculate?: boolean;
  notes?: string;
}

export interface RatingCalculationResponse {
  rating_id: string;
  calculation_result: {
    final_rating: 'green' | 'amber' | 'red' | 'unknown';
    final_score: number;
    overall_confidence: 'high' | 'medium' | 'low' | 'very_low';
    data_completeness: number;
    discrepancy_detected: boolean;
    reconciliation_needed: boolean;
  };
  components: {
    project_data: any;
    expertise_data: any;
    eba_data: any;
  };
  calculation_details: {
    calculation_method: string;
    weights_used: {
      project: number;
      expertise: number;
      eba: number;
    };
    algorithm_type: string;
    calculation_timestamp: string;
  };
  warnings: string[];
  recommendations: string[];
}

// Validation helpers
function validateWeight(weight: number | undefined): boolean {
  if (weight === undefined) return true;
  return weight >= 0 && weight <= 1;
}

function validateWeights(project: number, expertise: number, eba: number): boolean {
  const total = project + expertise + eba;
  return total > 0 && total <= 2; // Allow some flexibility in weighting
}

// GET handler - Get final ratings for an employer
async function getFinalRatingsHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
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

    // Parse query parameters
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '10'), 50);
    const sortBy = searchParams.get('sortBy') || 'rating_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const status = searchParams.get('status');
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Build query
    let query = supabase
      .from('employer_final_ratings')
      .select(`
        *,
        profiles!calculated_by(id, first_name, surname),
        profiles!approved_by(id, first_name, surname),
        profiles!created_by(id, first_name, surname),
        profiles!updated_by(id, first_name, surname),
        rating_calculation_methods!calculation_method_id(method_name, algorithm_type)
      `, { count: 'exact' });

    // Apply filters
    query = query.eq('employer_id', employerId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    if (status) {
      query = query.eq('rating_status', status);
    }

    if (dateFrom) {
      query = query.gte('rating_date', dateFrom);
    }

    if (dateTo) {
      query = query.lte('rating_date', dateTo);
    }

    // Apply sorting
    const validSortFields = ['rating_date', 'final_score', 'overall_confidence', 'created_at', 'updated_at'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'rating_date';
    const sortDirection = sortOrder === 'asc' ? true : false;
    query = query.order(sortField, { ascending: sortDirection });

    // Apply pagination
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    // Execute query
    const { data, error, count } = await query;

    if (error) {
      console.error('Final ratings API error:', error);
      return NextResponse.json({ error: 'Failed to fetch final ratings' }, { status: 500 });
    }

    // Transform data for response
    const ratings: FinalRatingResponse[] = (data || []).map((row: any) => {
      const now = new Date();
      const expiryDate = row.expiry_date ? new Date(row.expiry_date) : null;
      const dataAge = row.updated_at ? Math.floor((now.getTime() - new Date(row.updated_at).getTime()) / (1000 * 60 * 60 * 24)) : null;
      const daysUntilExpiry = expiryDate ? Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;

      return {
        id: row.id,
        employer_id: row.employer_id,
        rating_date: row.rating_date,
        final_rating: row.final_rating,
        final_score: row.final_score,

        // Component ratings
        project_based_rating: row.project_based_rating,
        project_based_score: row.project_based_score,
        project_data_quality: row.project_data_quality,
        projects_included: row.projects_included,
        latest_project_date: row.latest_project_date,

        expertise_based_rating: row.expertise_based_rating,
        expertise_based_score: row.expertise_based_score,
        expertise_confidence: row.expertise_confidence,
        expertise_assessments_included: row.expertise_assessments_included,
        latest_expertise_date: row.latest_expertise_date,

        eba_status: row.eba_status,

        // Discrepancy information
        rating_discrepancy: row.rating_discrepancy,
        discrepancy_level: row.discrepancy_level,
        reconciliation_method: row.reconciliation_method,
        required_dispute_resolution: row.required_dispute_resolution,

        // Quality indicators
        overall_confidence: row.overall_confidence,
        data_completeness_score: row.data_completeness_score,
        rating_stability_score: row.rating_stability_score,

        // Status information
        rating_status: row.rating_status,
        review_required: row.review_required,
        review_reason: row.review_reason,
        next_review_date: row.next_review_date,
        expiry_date: row.expiry_date,

        // Weighting information
        project_weight: row.project_weight,
        expertise_weight: row.expertise_weight,
        eba_weight: row.eba_weight,
        calculation_method_id: row.calculation_method_id,
        custom_adjustment: row.custom_adjustment,
        adjustment_reason: row.adjustment_reason,

        // Audit information
        calculated_by: row.calculated_by,
        approved_by: row.approved_by,
        approved_at: row.approved_at,
        approval_notes: row.approval_notes,

        // Metadata
        is_active: row.is_active,
        created_at: row.created_at,
        updated_at: row.updated_at,
        created_by: row.created_by,
        updated_by: row.updated_by,

        // Additional calculated fields
        data_age_days: dataAge,
        days_until_expiry: daysUntilExpiry,
        needs_review: row.review_required || (daysUntilExpiry !== null && daysUntilExpiry <= 7),
      };
    });

    // Get current rating (most recent active rating)
    const currentRating = ratings.find(r => r.is_active && r.rating_status === 'active') || null;

    // Calculate summary statistics
    const summary = {
      total_ratings: ratings.length,
      current_rating_score: currentRating?.final_score || null,
      rating_trend: calculateRatingTrend(ratings),
      last_updated: ratings.length > 0 ? ratings[0].updated_at : null,
      next_review_due: currentRating?.next_review_date || null,
    };

    const totalCount = count || 0;
    const totalPages = Math.ceil(totalCount / pageSize);

    const response: RatingsListResponse = {
      ratings,
      current_rating: currentRating,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages,
      },
      summary,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', // 5min cache
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get final ratings API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST handler - Calculate new final rating
async function calculateFinalRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
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

    // Parse and validate request body
    const body: RatingCalculationRequest = await request.json();

    // Validate weights
    const projectWeight = body.project_weight ?? 0.6;
    const expertiseWeight = body.expertise_weight ?? 0.4;
    const ebaWeight = body.eba_weight ?? 0.15;

    if (!validateWeight(projectWeight) || !validateWeight(expertiseWeight) || !validateWeight(ebaWeight)) {
      return NextResponse.json({ error: 'All weights must be between 0 and 1' }, { status: 400 });
    }

    if (!validateWeights(projectWeight, expertiseWeight, ebaWeight)) {
      return NextResponse.json({ error: 'Invalid weight combination. Total should be reasonable and positive.' }, { status: 400 });
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

    // Check if rating already exists for this date (unless force recalculate)
    const calculationDate = body.calculation_date || new Date().toISOString().split('T')[0];

    if (!body.force_recalculate) {
      const { data: existingRating, error: existingError } = await supabase
        .from('employer_final_ratings')
        .select('id')
        .eq('employer_id', employerId)
        .eq('rating_date', calculationDate)
        .single();

      if (existingRating && !existingError) {
        return NextResponse.json({
          error: 'Rating already exists for this date',
          existingRatingId: existingRating.id,
          message: 'Use force_recalculate=true to override'
        }, { status: 409 });
      }
    }

    // Calculate final rating using database function
    const { data: calculationResult, error: calculationError } = await supabase
      .rpc('calculate_final_employer_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_project_weight: projectWeight,
        p_expertise_weight: expertiseWeight,
        p_eba_weight: ebaWeight,
        p_calculation_method: body.calculation_method || 'hybrid_method',
      });

    if (calculationError) {
      console.error('Failed to calculate final rating:', calculationError);
      return NextResponse.json({ error: 'Failed to calculate final rating' }, { status: 500 });
    }

    // Create or update final rating record
    const { data: ratingId, error: createError } = await supabase
      .rpc('create_or_update_final_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_created_by: user.id,
      });

    if (createError) {
      console.error('Failed to create final rating record:', createError);
      return NextResponse.json({ error: 'Failed to save final rating' }, { status: 500 });
    }

    // Get the created/updated rating for response
    const { data: finalRating, error: fetchError } = await supabase
      .from('employer_final_ratings')
      .select(`
        *,
        rating_calculation_methods!calculation_method_id(method_name, algorithm_type)
      `)
      .eq('id', ratingId)
      .single();

    if (fetchError || !finalRating) {
      console.error('Failed to fetch created rating:', fetchError);
      return NextResponse.json({ error: 'Failed to retrieve created rating' }, { status: 500 });
    }

    // Generate warnings and recommendations
    const warnings = generateWarnings(calculationResult);
    const recommendations = generateRecommendations(calculationResult);

    const response: RatingCalculationResponse = {
      rating_id: ratingId,
      calculation_result: {
        final_rating: calculationResult.final_rating,
        final_score: calculationResult.final_score,
        overall_confidence: calculationResult.overall_confidence,
        data_completeness: calculationResult.data_completeness,
        discrepancy_detected: calculationResult.discrepancy_check.discrepancy_detected,
        reconciliation_needed: calculationResult.reconciliation_needed,
      },
      components: {
        project_data: calculationResult.project_data,
        expertise_data: calculationResult.expertise_data,
        eba_data: calculationResult.eba_data,
      },
      calculation_details: {
        calculation_method: body.calculation_method || 'hybrid_method',
        weights_used: {
          project: projectWeight,
          expertise: expertiseWeight,
          eba: ebaWeight,
        },
        algorithm_type: calculationResult.algorithm_type || 'hybrid_method',
        calculation_timestamp: calculationResult.calculated_at,
      },
      warnings,
      recommendations,
    };

    // Add custom adjustment if provided
    if (body.custom_adjustment && Math.abs(body.custom_adjustment) <= 50) {
      await supabase
        .from('employer_final_ratings')
        .update({
          custom_adjustment: body.custom_adjustment,
          adjustment_reason: body.notes || 'Manual adjustment by user',
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ratingId);
    }

    return NextResponse.json(response, { status: 201 });

  } catch (error) {
    console.error('Calculate final rating API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to calculate rating trend
function calculateRatingTrend(ratings: FinalRatingResponse[]): 'improving' | 'stable' | 'declining' | 'unknown' {
  if (ratings.length < 2) return 'unknown';

  const recent = ratings.slice(0, Math.min(3, ratings.length));
  const scores = recent
    .filter(r => r.final_score !== null)
    .map(r => r.final_score!);

  if (scores.length < 2) return 'unknown';

  // Simple linear trend calculation
  const firstScore = scores[scores.length - 1];
  const lastScore = scores[0];
  const difference = lastScore - firstScore;

  if (difference > 10) return 'improving';
  if (difference < -10) return 'declining';
  return 'stable';
}

// Helper function to generate warnings
function generateWarnings(calculationResult: any): string[] {
  const warnings: string[] = [];

  if (calculationResult.overall_confidence === 'very_low') {
    warnings.push('Very low confidence in rating - insufficient data');
  }

  if (calculationResult.data_completeness < 30) {
    warnings.push('Low data completeness - rating may not be reliable');
  }

  if (calculationResult.discrepancy_check.discrepancy_detected) {
    warnings.push('Significant discrepancy between project and expertise ratings');
    if (calculationResult.discrepancy_check.requires_review) {
      warnings.push('Human review required due to rating discrepancies');
    }
  }

  const projectData = calculationResult.project_data;
  if (projectData.data_age_days && projectData.data_age_days > 180) {
    warnings.push('Project data is significantly outdated');
  }

  const expertiseData = calculationResult.expertise_data;
  if (expertiseData.data_age_days && expertiseData.data_age_days > 365) {
    warnings.push('Expertise assessment data is very old');
  }

  return warnings;
}

// Helper function to generate recommendations
function generateRecommendations(calculationResult: any): string[] {
  const recommendations: string[] = [];

  const score = calculationResult.final_score;
  if (score !== null) {
    if (score < 30) {
      recommendations.push('Immediate intervention and improvement plan required');
      recommendations.push('Schedule comprehensive compliance review');
    } else if (score < 60) {
      recommendations.push('Develop targeted improvement actions');
      recommendations.push('Increase monitoring and assessment frequency');
    } else if (score >= 80) {
      recommendations.push('Maintain current standards and best practices');
      recommendations.push('Consider sharing success factors as case studies');
    }
  }

  if (calculationResult.overall_confidence === 'low' || calculationResult.overall_confidence === 'very_low') {
    recommendations.push('Increase data collection and assessment frequency');
    recommendations.push('Seek additional organiser expertise assessments');
  }

  if (calculationResult.discrepancy_check.discrepancy_detected) {
    recommendations.push('Investigate causes of rating discrepancies');
    recommendations.push('Consider mediation between project and expertise assessments');
  }

  const projectData = calculationResult.project_data;
  if (projectData.assessment_count < 3) {
    recommendations.push('Increase project compliance assessments');
  }

  const expertiseData = calculationResult.expertise_data;
  if (expertiseData.assessment_count < 1) {
    recommendations.push('Complete organiser expertise assessment');
  }

  return recommendations;
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getFinalRatingsHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.STANDARD
);

export const POST = withRateLimit(
  (request, context) => calculateFinalRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    const { count, error } = await supabase
      .from('employer_final_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)
      .eq('is_active', true);

    if (error) throw error;

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Ratings': count?.toString() || '0',
        'X-Last-Updated': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
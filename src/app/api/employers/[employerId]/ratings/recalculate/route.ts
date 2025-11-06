import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';
import { getEmployerRatingFast, getEmployerProjectCompliance, getEmployerExpertiseRatings } from '@/app/api/ratings/batch/optimized-operations';

// Role-based access control
const ALLOWED_ROLES = ['lead_organiser', 'admin'] as const; // More restricted for recalculation
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface RecalculateRatingRequest {
  calculation_date?: string;
  project_weight?: number;
  expertise_weight?: number;
  eba_weight?: number;
  calculation_method?: string;
  force_recalculate?: boolean;
  override_expiration?: boolean;
  custom_adjustment?: number;
  adjustment_reason?: string;
  approval_notes?: string;
}

export interface RecalculateRatingResponse {
  previous_rating?: {
    id: string;
    final_rating: 'green' | 'amber' | 'red' | 'unknown';
    final_score: number | null;
    rating_date: string;
    updated_at: string;
  };
  new_rating: {
    id: string;
    final_rating: 'green' | 'amber' | 'red' | 'unknown';
    final_score: number;
    rating_date: string;
    calculation_timestamp: string;
  };
  changes: {
    rating_changed: boolean;
    score_change: number | null;
    rating_change_type: 'improvement' | 'decline' | 'maintained' | 'first_rating';
    magnitude: 'minimal' | 'minor' | 'moderate' | 'significant' | 'major';
  };
  calculation_details: {
    method_used: string;
    weights_applied: {
      project: number;
      expertise: number;
      eba: number;
    };
    algorithm_type: string;
    processing_time_ms: number;
  };
  validation: {
    discrepancies_resolved: boolean;
    confidence_change: 'improved' | 'declined' | 'maintained';
    data_completeness_change: number;
    warnings_generated: string[];
  };
  audit_trail: {
    calculation_id: string;
    triggered_by: string;
    trigger_reason: string;
    timestamp: string;
    ip_address: string;
  };
}

// POST handler - Trigger rating recalculation
async function recalculateRatingHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();
    const startTime = Date.now();

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Authorization - more restrictive for recalculation
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
      return NextResponse.json({
        error: 'Forbidden - only lead organisers and admins can trigger rating recalculation'
      }, { status: 403 });
    }

    // Parse and validate request body
    const body: RecalculateRatingRequest = await request.json();

    // Validate weights
    const projectWeight = body.project_weight ?? 0.6;
    const expertiseWeight = body.expertise_weight ?? 0.4;
    const ebaWeight = body.eba_weight ?? 0.15;

    if (!validateWeight(projectWeight) || !validateWeight(expertiseWeight) || !validateWeight(ebaWeight)) {
      return NextResponse.json({ error: 'All weights must be between 0 and 1' }, { status: 400 });
    }

    if (!validateWeights(projectWeight, expertiseWeight, ebaWeight)) {
      return NextResponse.json({ error: 'Invalid weight combination' }, { status: 400 });
    }

    if (body.custom_adjustment && Math.abs(body.custom_adjustment) > 50) {
      return NextResponse.json({ error: 'Custom adjustment must be between -50 and 50' }, { status: 400 });
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

    const calculationDate = body.calculation_date || new Date().toISOString().split('T')[0];

    // Get previous rating for comparison using optimized materialized view
    const previousRating = await getEmployerRatingFast(employerId);
    const previousError = previousRating ? null : { message: 'Previous rating not found' };

    // Check if rating already exists for this date
    if (!body.force_recalculate) {
      const { data: existingRating, error: existingError } = await supabase
        .from('employer_final_ratings')
        .select('id, updated_at')
        .eq('employer_id', employerId)
        .eq('rating_date', calculationDate)
        .single();

      if (existingRating && !existingError) {
        const hoursSinceLastUpdate = (Date.now() - new Date(existingRating.updated_at).getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastUpdate < 24) {
          return NextResponse.json({
            error: 'Rating recently calculated',
            message: 'Rating was calculated within the last 24 hours',
            existingRatingId: existingRating.id,
            lastUpdated: existingRating.updated_at,
            recommendation: 'Use force_recalculate=true to override'
          }, { status: 409 });
        }
      }
    }

    // Get pre-computed data from materialized views for validation
    const [projectCompliance, expertiseRatings] = await Promise.all([
      getEmployerProjectCompliance(employerId),
      getEmployerExpertiseRatings(employerId)
    ]);

    // Calculate new rating (still use RPC for calculation, but with pre-validated data)
    const { data: calculationResult, error: calculationError } = await supabase
      .rpc('calculate_final_employer_rating', {
        p_employer_id: employerId,
        p_calculation_date: calculationDate,
        p_project_weight: projectWeight,
        p_expertise_weight: expertiseWeight,
        p_eba_weight: ebaWeight,
        p_calculation_method: body.calculation_method || 'hybrid_method',
        p_use_precomputed_data: true, // Hint that we have pre-computed data
      });

    if (calculationError) {
      console.error('Failed to calculate final rating:', calculationError);
      return NextResponse.json({ error: 'Failed to calculate final rating' }, { status: 500 });
    }

    // Enrich calculation result with materialized view data
    if (calculationResult && projectCompliance && expertiseRatings) {
      calculationResult.project_data_age_days = projectCompliance.latest_assessment_date ?
        Math.floor((Date.now() - new Date(projectCompliance.latest_assessment_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
      calculationResult.expertise_data_age_days = expertiseRatings.latest_expertise_date ?
        Math.floor((Date.now() - new Date(expertiseRatings.latest_expertise_date).getTime()) / (1000 * 60 * 60 * 24)) : null;
      calculationResult.data_completeness = (projectCompliance.total_assessments > 0 ? 50 : 0) +
                                           (expertiseRatings.total_expertise_assessments > 0 ? 50 : 0);
    }

    // Create new rating record
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

    // Apply custom adjustment if provided
    if (body.custom_adjustment) {
      await supabase
        .from('employer_final_ratings')
        .update({
          custom_adjustment: body.custom_adjustment,
          adjustment_reason: body.adjustment_reason || `Manual adjustment by ${profile.first_name} ${profile.surname}`,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', ratingId);
    }

    // Get the new rating details
    const { data: newRating, error: fetchError } = await supabase
      .from('employer_final_ratings')
      .select('id, final_rating, final_score, rating_date, created_at, updated_at')
      .eq('id', ratingId)
      .single();

    if (fetchError || !newRating) {
      console.error('Failed to fetch new rating:', fetchError);
      return NextResponse.json({ error: 'Failed to retrieve new rating' }, { status: 500 });
    }

    // Calculate changes
    const changes = calculateRatingChanges(previousRating, newRating);

    // Generate validation warnings
    const warnings = generateRecalculationWarnings(calculationResult, previousRating);

    // Get client IP for audit trail
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                     request.headers.get('x-real-ip') ||
                     'unknown';

    const processingTime = Date.now() - startTime;

    const response: RecalculateRatingResponse = {
      previous_rating: previousRating || undefined,
      new_rating: {
        id: newRating.id,
        final_rating: newRating.final_rating,
        final_score: newRating.final_score || 0,
        rating_date: newRating.rating_date,
        calculation_timestamp: newRating.created_at,
      },
      changes,
      calculation_details: {
        method_used: body.calculation_method || 'hybrid_method',
        weights_applied: {
          project: projectWeight,
          expertise: expertiseWeight,
          eba: ebaWeight,
        },
        algorithm_type: calculationResult.algorithm_type || 'hybrid_method',
        processing_time_ms: processingTime,
      },
      validation: {
        discrepancies_resolved: calculationResult.reconciliation_needed || false,
        confidence_change: calculateConfidenceChange(previousRating, calculationResult),
        data_completeness_change: calculationResult.data_completeness || 0,
        warnings_generated: warnings,
      },
      audit_trail: {
        calculation_id: crypto.randomUUID(),
        triggered_by: user.id,
        trigger_reason: body.approval_notes || 'Manual recalculation trigger',
        timestamp: new Date().toISOString(),
        ip_address: ipAddress,
      },
    };

    // Log the recalculation in audit trail
    await supabase
      .from('rating_audit_log')
      .insert({
        employer_id: employerId,
        previous_rating: previousRating?.final_rating || null,
        new_rating: newRating.final_rating,
        previous_score: previousRating?.final_score || null,
        new_score: newRating.final_score,
        rating_source: 'calculated_final',
        source_id: ratingId,
        reason_for_change: `Manual recalculation triggered by ${profile.first_name} ${profile.surname} (${profile.role})`,
        changed_by: user.id,
      });

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('Recalculate rating API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper functions
function validateWeight(weight: number | undefined): boolean {
  if (weight === undefined) return true;
  return weight >= 0 && weight <= 1;
}

function validateWeights(project: number, expertise: number, eba: number): boolean {
  const total = project + expertise + eba;
  return total > 0 && total <= 2; // Allow some flexibility
}

function calculateRatingChanges(
  previousRating: any | null,
  newRating: any
): any {
  if (!previousRating) {
    return {
      rating_changed: true,
      score_change: newRating.final_score,
      rating_change_type: 'first_rating',
      magnitude: newRating.final_score ? getMagnitude(Math.abs(newRating.final_score)) : 'minimal',
    };
  }

  const previousScore = previousRating.final_score || 0;
  const newScore = newRating.final_score || 0;
  const scoreChange = newScore - previousScore;
  const ratingChanged = previousRating.final_rating !== newRating.final_rating;

  let changeType: 'improvement' | 'decline' | 'maintained' = 'maintained';
  if (scoreChange > 5) changeType = 'improvement';
  else if (scoreChange < -5) changeType = 'decline';

  return {
    rating_changed: ratingChanged || Math.abs(scoreChange) > 5,
    score_change: scoreChange,
    rating_change_type: changeType,
    magnitude: getMagnitude(Math.abs(scoreChange)),
  };
}

function getMagnitude(scoreDifference: number): 'minimal' | 'minor' | 'moderate' | 'significant' | 'major' {
  if (scoreDifference < 5) return 'minimal';
  if (scoreDifference < 10) return 'minor';
  if (scoreDifference < 20) return 'moderate';
  if (scoreDifference < 30) return 'significant';
  return 'major';
}

function calculateConfidenceChange(previousRating: any | null, calculationResult: any): 'improved' | 'declined' | 'maintained' {
  if (!previousRating) return 'improved';

  const previousConfidence = getConfidenceScore(previousRating.overall_confidence);
  const newConfidence = getConfidenceScore(calculationResult.overall_confidence);

  if (newConfidence > previousConfidence + 0.1) return 'improved';
  if (newConfidence < previousConfidence - 0.1) return 'declined';
  return 'maintained';
}

function getConfidenceScore(level: string): number {
  switch (level) {
    case 'high': return 0.9;
    case 'medium': return 0.7;
    case 'low': return 0.5;
    case 'very_low': return 0.3;
    default: return 0.5;
  }
}

function generateRecalculationWarnings(calculationResult: any, previousRating: any | null): string[] {
  const warnings: string[] = [];

  if (calculationResult.overall_confidence === 'very_low') {
    warnings.push('Very low confidence in calculated rating');
  }

  if (calculationResult.data_completeness < 30) {
    warnings.push('Low data completeness - rating may not be reliable');
  }

  if (calculationResult.reconciliation_needed) {
    warnings.push('Reconciliation required due to rating discrepancies');
  }

  if (previousRating) {
    const scoreDifference = Math.abs((calculationResult.final_score || 0) - (previousRating.final_score || 0));
    if (scoreDifference > 40) {
      warnings.push('Large score difference from previous rating - review recommended');
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

// Export handlers with rate limiting
export const POST = withRateLimit(
  (request, context) => recalculateRatingHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    // Check if employer has any rating data
    const [projectCount, expertiseCount, finalCount] = await Promise.all([
      supabase
        .from('project_compliance_assessments')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', employerId)
        .eq('is_active', true),
      supabase
        .from('organiser_overall_expertise_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', employerId)
        .eq('is_active', true),
      supabase
        .from('employer_final_ratings')
        .select('*', { count: 'exact', head: true })
        .eq('employer_id', employerId)
        .eq('is_active', true),
    ]);

    const canRecalculate = (projectCount.count! > 0 || expertiseCount.count! > 0);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Project-Assessments': projectCount.count?.toString() || '0',
        'X-Expertise-Assessments': expertiseCount.count?.toString() || '0',
        'X-Final-Ratings': finalCount.count?.toString() || '0',
        'X-Can-Recalculate': canRecalculate.toString(),
        'X-Last-Checked': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
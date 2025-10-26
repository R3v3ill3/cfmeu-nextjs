import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit';

// Role-based access control
const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const;
type AllowedRole = typeof ALLOWED_ROLES[number];
const ROLE_SET = new Set<AllowedRole>(ALLOWED_ROLES);

export const dynamic = 'force-dynamic';

// TypeScript types
export interface RatingComparisonResponse {
  employer_id: string;
  comparison_date: string;
  project_vs_expertise: {
    project_rating: 'green' | 'amber' | 'red' | 'unknown' | null;
    project_score: number | null;
    expertise_rating: 'green' | 'amber' | 'red' | 'unknown' | null;
    expertise_score: number | null;
    score_difference: number | null;
    rating_match: boolean;
    discrepancy_level: 'none' | 'minor' | 'moderate' | 'major' | 'critical';
    alignment_quality: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor';
  };
  detailed_breakdown: {
    project_assessments: Array<{
      assessment_type: string;
      score: number | null;
      rating: string | null;
      confidence_level: string;
      assessment_date: string;
      weight: number;
      contribution: number | null;
    }>;
    expertise_assessments: Array<{
      organiser_name: string;
      overall_score: number | null;
      overall_rating: string | null;
      confidence_level: string;
      assessment_date: string;
      reputation_score: number | null;
      contribution: number | null;
    }>;
  };
  validation_data: {
    validation_records: Array<{
      validation_date: string;
      rating_match: boolean;
      score_difference: number;
      project_based_rating: string;
      expertise_rating: string;
      data_confidence_level: string;
    }>;
    accuracy_metrics: {
      total_validations: number;
      matching_validations: number;
      accuracy_percentage: number | null;
      average_score_difference: number | null;
      trend_direction: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    };
  };
  recommendations: {
    immediate_actions: string[];
    investigation_areas: string[];
    data_improvements: string[];
    reconciliation_options: string[];
  };
  confidence_indicators: {
    overall_confidence: 'high' | 'medium' | 'low' | 'very_low';
    data_quality_score: number;
    sample_size_adequacy: 'excellent' | 'adequate' | 'limited' | 'insufficient';
    recency_score: number;
    cross_validation_available: boolean;
  };
}

// GET handler - Compare project data vs expertise ratings
async function getRatingComparisonHandler(request: NextRequest, { params }: { params: { employerId: string } }) {
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
    const comparisonDate = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const lookbackDays = parseInt(searchParams.get('lookbackDays') || '365');
    const includeValidation = searchParams.get('includeValidation') !== 'false';

    // Validate employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employerId)
      .single();

    if (employerError || !employer) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 });
    }

    // Get project compliance rating
    const { data: projectData, error: projectError } = await supabase
      .rpc('calculate_project_compliance_rating', {
        p_employer_id: employerId,
        p_calculation_date: comparisonDate,
        p_lookback_days: lookbackDays,
      });

    if (projectError) {
      console.error('Failed to calculate project compliance rating:', projectError);
      return NextResponse.json({ error: 'Failed to calculate project compliance rating' }, { status: 500 });
    }

    // Get expertise rating
    const { data: expertiseData, error: expertiseError } = await supabase
      .rpc('calculate_expertise_rating', {
        p_employer_id: employerId,
        p_calculation_date: comparisonDate,
        p_lookback_days: lookbackDays,
      });

    if (expertiseError) {
      console.error('Failed to calculate expertise rating:', expertiseError);
      return NextResponse.json({ error: 'Failed to calculate expertise rating' }, { status: 500 });
    }

    // Calculate comparison metrics
    const projectScore = projectData.project_score || 0;
    const expertiseScore = expertiseData.expertise_score || 0;
    const scoreDifference = Math.abs(projectScore - expertiseScore);
    const ratingMatch = projectData.project_rating === expertiseData.expertise_rating;

    // Determine discrepancy level
    let discrepancyLevel: 'none' | 'minor' | 'moderate' | 'major' | 'critical' = 'none';
    if (!ratingMatch) {
      if ((projectData.project_rating === 'green' && expertiseData.expertise_rating === 'red') ||
          (projectData.project_rating === 'red' && expertiseData.expertise_rating === 'green')) {
        discrepancyLevel = 'critical';
      } else if ((projectData.project_rating === 'green' && expertiseData.expertise_rating === 'amber') ||
                 (projectData.project_rating === 'amber' && expertiseData.expertise_rating === 'red') ||
                 (projectData.project_rating === 'amber' && expertiseData.expertise_rating === 'green')) {
        discrepancyLevel = 'major';
      } else {
        discrepancyLevel = 'moderate';
      }
    } else if (scoreDifference > 30) {
      discrepancyLevel = 'major';
    } else if (scoreDifference > 15) {
      discrepancyLevel = 'minor';
    }

    // Determine alignment quality
    let alignmentQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'very_poor' = 'excellent';
    if (discrepancyLevel === 'critical') {
      alignmentQuality = 'very_poor';
    } else if (discrepancyLevel === 'major') {
      alignmentQuality = 'poor';
    } else if (discrepancyLevel === 'moderate') {
      alignmentQuality = 'fair';
    } else if (discrepancyLevel === 'minor') {
      alignmentQuality = 'good';
    }

    // Get detailed breakdown
    const detailedBreakdown = await getDetailedBreakdown(supabase, employerId, comparisonDate, lookbackDays);

    // Get validation data
    let validationData: any = null;
    if (includeValidation) {
      validationData = await getValidationData(supabase, employerId, comparisonDate, lookbackDays);
    }

    // Generate recommendations
    const recommendations = generateComparisonRecommendations(
      discrepancyLevel,
      projectData.data_quality,
      expertiseData.confidence_level,
      detailedBreakdown
    );

    // Calculate confidence indicators
    const confidenceIndicators = calculateConfidenceIndicators(
      projectData,
      expertiseData,
      validationData
    );

    const response: RatingComparisonResponse = {
      employer_id: employerId,
      comparison_date: comparisonDate,
      project_vs_expertise: {
        project_rating: projectData.project_rating,
        project_score: projectData.project_score,
        expertise_rating: expertiseData.expertise_rating,
        expertise_score: expertiseData.expertise_score,
        score_difference: scoreDifference,
        rating_match: ratingMatch,
        discrepancy_level: discrepancyLevel,
        alignment_quality: alignmentQuality,
      },
      detailed_breakdown: detailedBreakdown,
      validation_data: validationData || {
        validation_records: [],
        accuracy_metrics: {
          total_validations: 0,
          matching_validations: 0,
          accuracy_percentage: null,
          average_score_difference: null,
          trend_direction: 'insufficient_data',
        },
      },
      recommendations,
      confidence_indicators: confidenceIndicators,
    };

    // Add cache headers
    const headers = {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'Content-Type': 'application/json',
    };

    return NextResponse.json(response, { headers });

  } catch (error) {
    console.error('Get rating comparison API unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to get detailed breakdown
async function getDetailedBreakdown(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  comparisonDate: string,
  lookbackDays: number
): Promise<any> {
  try {
    // Get detailed project assessments
    const { data: projectAssessments, error: projectError } = await supabase
      .from('project_compliance_assessments')
      .select(`
        assessment_type,
        score,
        rating,
        confidence_level,
        assessment_date,
        compliance_assessment_weights!inner(weight),
        projects!project_id(name, tier)
      `)
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .gte('assessment_date', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('assessment_date', { ascending: false });

    // Get expertise assessments with organiser info
    const { data: expertiseAssessments, error: expertiseError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .select(`
        overall_score,
        overall_rating,
        confidence_level,
        assessment_date,
        profiles!organiser_id(first_name, surname),
        organiser_expertise_reputation!inner(
          reputation_period_start,
          reputation_period_end,
          overall_reputation_score
        )
      `)
      .eq('employer_id', employerId)
      .eq('is_active', true)
      .gte('assessment_date', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('assessment_date', { ascending: false });

    const projectBreakdown = (projectAssessments || []).map((assessment: any) => ({
      assessment_type: assessment.assessment_type,
      score: assessment.score,
      rating: assessment.rating,
      confidence_level: assessment.confidence_level,
      assessment_date: assessment.assessment_date,
      weight: assessment.compliance_assessment_weights.weight,
      contribution: assessment.score ? assessment.score * assessment.compliance_assessment_weights.weight : null,
      project_name: assessment.projects?.name,
      project_tier: assessment.projects?.tier,
    }));

    const expertiseBreakdown = (expertiseAssessments || []).map((assessment: any) => ({
      organiser_name: `${assessment.profiles.first_name} ${assessment.profiles.surname}`.trim(),
      overall_score: assessment.overall_score,
      overall_rating: assessment.overall_rating,
      confidence_level: assessment.confidence_level,
      assessment_date: assessment.assessment_date,
      reputation_score: assessment.organiser_expertise_reputation?.overall_reputation_score,
      contribution: assessment.overall_score, // Would need more complex calculation here
    }));

    return {
      project_assessments: projectBreakdown,
      expertise_assessments: expertiseBreakdown,
    };

  } catch (error) {
    console.error('Error getting detailed breakdown:', error);
    return {
      project_assessments: [],
      expertise_assessments: [],
    };
  }
}

// Helper function to get validation data
async function getValidationData(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  employerId: string,
  comparisonDate: string,
  lookbackDays: number
): Promise<any> {
  try {
    // Get validation records
    const { data: validationRecords, error: validationError } = await supabase
      .from('expertise_validation_records')
      .select(`
        validation_date,
        rating_match,
        score_difference,
        project_based_rating,
        expertise_rating,
        data_confidence_level,
        expertise_confidence_level
      `)
      .eq('employer_id', employerId)
      .gte('validation_date', new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('validation_date', { ascending: false });

    const records = validationRecords || [];
    const totalValidations = records.length;
    const matchingValidations = records.filter(r => r.rating_match).length;
    const accuracyPercentage = totalValidations > 0 ? (matchingValidations / totalValidations) * 100 : null;
    const averageScoreDifference = totalValidations > 0
      ? records.reduce((sum, r) => sum + Math.abs(r.score_difference || 0), 0) / totalValidations
      : null;

    // Calculate trend direction
    let trendDirection: 'improving' | 'stable' | 'declining' | 'insufficient_data' = 'insufficient_data';
    if (records.length >= 3) {
      const recent = records.slice(0, Math.min(5, records.length));
      const recentAccuracy = recent.filter(r => r.rating_match).length / recent.length * 100;
      const older = records.slice(Math.min(5, records.length), Math.min(10, records.length));
      const olderAccuracy = older.length > 0 ? older.filter(r => r.rating_match).length / older.length * 100 : recentAccuracy;

      if (recentAccuracy > olderAccuracy + 10) {
        trendDirection = 'improving';
      } else if (recentAccuracy < olderAccuracy - 10) {
        trendDirection = 'declining';
      } else {
        trendDirection = 'stable';
      }
    }

    return {
      validation_records: records,
      accuracy_metrics: {
        total_validations: totalValidations,
        matching_validations: matchingValidations,
        accuracy_percentage: accuracyPercentage,
        average_score_difference: averageScoreDifference,
        trend_direction: trendDirection,
      },
    };

  } catch (error) {
    console.error('Error getting validation data:', error);
    return {
      validation_records: [],
      accuracy_metrics: {
        total_validations: 0,
        matching_validations: 0,
        accuracy_percentage: null,
        average_score_difference: null,
        trend_direction: 'insufficient_data',
      },
    };
  }
}

// Helper function to generate recommendations
function generateComparisonRecommendations(
  discrepancyLevel: string,
  projectDataQuality: string,
  expertiseConfidence: string,
  detailedBreakdown: any
): any {
  const immediateActions: string[] = [];
  const investigationAreas: string[] = [];
  const dataImprovements: string[] = [];
  const reconciliationOptions: string[] = [];

  // Immediate actions based on discrepancy level
  if (discrepancyLevel === 'critical') {
    immediateActions.push('Immediate senior organiser review required');
    immediateActions.push('Schedule face-to-face meeting with all involved organisers');
    immediateActions.push('Consider temporary rating hold until resolution');
  } else if (discrepancyLevel === 'major') {
    immediateActions.push('Schedule comprehensive review meeting');
    immediateActions.push('Investigate causes of rating differences');
  } else if (discrepancyLevel === 'moderate') {
    immediateActions.push('Review assessment methodologies');
    immediateActions.push('Consider additional data collection');
  }

  // Investigation areas
  if (discrepancyLevel !== 'none') {
    investigationAreas.push('Review project compliance assessment methodology');
    investigationAreas.push('Evaluate organiser expertise assessment process');
    investigationAreas.push('Check for data quality or recency issues');
  }

  if (projectDataQuality === 'very_low' || projectDataQuality === 'low') {
    investigationAreas.push('Increase project compliance assessment frequency');
    dataImprovements.push('Implement regular project monitoring schedule');
  }

  if (expertiseConfidence === 'very_low' || expertiseConfidence === 'low') {
    investigationAreas.push('Review organiser expertise and training');
    dataImprovements.push('Schedule additional expertise assessments');
  }

  // Data improvements
  if (detailedBreakdown.project_assessments.length < 3) {
    dataImprovements.push('Increase project compliance assessment coverage');
  }

  if (detailedBreakdown.expertise_assessments.length < 1) {
    dataImprovements.push('Complete organiser expertise assessment');
  }

  // Reconciliation options
  if (discrepancyLevel === 'critical' || discrepancyLevel === 'major') {
    reconciliationOptions.push('Mediation between project and expertise assessors');
    reconciliationOptions.push('Third-party review and recommendation');
    reconciliationOptions.push('Weighted compromise solution');
  } else if (discrepancyLevel === 'moderate') {
    reconciliationOptions.push('Automated weighted averaging');
    reconciliationOptions.push('Peer review of conflicting assessments');
  } else {
    reconciliationOptions.push('Maintain current assessment processes');
  }

  return {
    immediate_actions: immediateActions,
    investigation_areas: investigationAreas,
    data_improvements: dataImprovements,
    reconciliation_options: reconciliationOptions,
  };
}

// Helper function to calculate confidence indicators
function calculateConfidenceIndicators(
  projectData: any,
  expertiseData: any,
  validationData: any
): any {
  // Calculate overall confidence
  const projectConfidence = getConfidenceScore(projectData.data_quality);
  const expertiseConfidence = getConfidenceScore(expertiseData.confidence_level);
  const overallConfidenceScore = (projectConfidence + expertiseConfidence) / 2;

  let overallConfidence: 'high' | 'medium' | 'low' | 'very_low' = 'medium';
  if (overallConfidenceScore >= 0.8) overallConfidence = 'high';
  else if (overallConfidenceScore >= 0.6) overallConfidence = 'medium';
  else if (overallConfidenceScore >= 0.4) overallConfidence = 'low';
  else overallConfidence = 'very_low';

  // Calculate data quality score
  const assessmentCount = (projectData.assessment_count || 0) + (expertiseData.assessment_count || 0);
  const dataQualityScore = Math.min(100, assessmentCount * 10 + (projectData.data_quality === 'high' ? 30 : 0));

  // Sample size adeququacy
  let sampleSizeAdequacy: 'excellent' | 'adequate' | 'limited' | 'insufficient' = 'insufficient';
  if (assessmentCount >= 10) sampleSizeAdequacy = 'excellent';
  else if (assessmentCount >= 6) sampleSizeAdequacy = 'adequate';
  else if (assessmentCount >= 3) sampleSizeAdequacy = 'limited';

  // Recency score
  const projectDataAge = projectData.data_age_days || 999;
  const expertiseDataAge = expertiseData.data_age_days || 999;
  const averageAge = (projectDataAge + expertiseDataAge) / 2;
  const recencyScore = Math.max(0, 100 - averageAge / 3); // Lose points for older data

  // Cross validation available
  const crossValidationAvailable = validationData && validationData.accuracy_metrics.total_validations > 0;

  return {
    overall_confidence: overallConfidence,
    data_quality_score: Math.round(dataQualityScore),
    sample_size_adequacy: sampleSizeAdequacy,
    recency_score: Math.round(recencyScore),
    cross_validation_available: crossValidationAvailable,
  };
}

// Helper function to convert confidence levels to scores
function getConfidenceScore(level: string): number {
  switch (level) {
    case 'high': return 0.9;
    case 'medium': return 0.7;
    case 'low': return 0.5;
    case 'very_low': return 0.3;
    default: return 0.5;
  }
}

// Export handlers with rate limiting
export const GET = withRateLimit(
  (request, context) => getRatingComparisonHandler(request, context as { params: { employerId: string } }),
  RATE_LIMIT_PRESETS.EXPENSIVE_QUERY
);

// Health check endpoint
export async function HEAD(request: NextRequest, { params }: { params: { employerId: string } }) {
  try {
    const { employerId } = params;
    const supabase = await createServerSupabase();

    // Quick check for both data types
    const [projectResult, expertiseResult] = await Promise.all([
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
    ]);

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Project-Assessments': projectResult.count?.toString() || '0',
        'X-Expertise-Assessments': expertiseResult.count?.toString() || '0',
        'X-Comparison-Available': (projectResult.count! > 0 && expertiseResult.count! > 0).toString(),
      }
    });
  } catch (error) {
    return new NextResponse(null, { status: 503 });
  }
}
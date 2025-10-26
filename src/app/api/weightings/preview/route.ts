// CFMEU Employer Rating System - Weighting Preview API
// Real-time preview of weighting changes on employer ratings

import { createClient } from '@/integrations/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import {
  UserWeightingProfile,
  Track1Weightings,
  Track2Weightings,
  PreviewWeightingsRequest,
  WeightingPreviewResponse,
  WeightingPreviewCalculation,
  WeightingPreviewResults,
  RatingSnapshot,
  RatingChange,
  WeightingImpactAnalysis,
  WeightingImpactLevel,
  TrafficLightRating
} from '@/lib/weighting-system/types/WeightingTypes';
import { WeightingEngine } from '@/lib/weighting-system/WeightingEngine';
import { WeightingValidator } from '@/lib/weighting-system/WeightingValidator';

// =============================================================================
// POST - Generate weighting preview
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body: PreviewWeightingsRequest = await request.json();
    const {
      profile_id,
      proposed_changes,
      sample_employers,
      sample_size = 10,
      employer_filters,
      comparison_profile_id
    } = body;

    // Validate request
    if (!profile_id && !proposed_changes) {
      return NextResponse.json(
        { success: false, error: 'Either profile_id or proposed_changes is required' },
        { status: 400 }
      );
    }

    // Get current profile
    let currentProfile: UserWeightingProfile | null = null;
    let currentTrack1Weightings: Track1Weightings | null = null;
    let currentTrack2Weightings: Track2Weightings | null = null;

    if (profile_id) {
      const { data: profileData, error: profileError } = await supabase
        .from('user_weighting_profiles')
        .select(`
          *,
          track1_weightings (*),
          track2_weightings (*)
        `)
        .eq('id', profile_id)
        .single();

      if (profileError || !profileData) {
        return NextResponse.json(
          { success: false, error: 'Profile not found' },
          { status: 404 }
        );
      }

      currentProfile = profileData;
      currentTrack1Weightings = profileData.track1_weightings?.[0] || null;
      currentTrack2Weightings = profileData.track2_weightings?.[0] || null;
    }

    // Check permissions
    if (currentProfile && currentProfile.user_id !== user.id) {
      const { data: userData } = await supabase
        .from('auth.users')
        .select('raw_user_meta_data')
        .eq('id', user.id)
        .single();

      const userRole = userData?.raw_user_meta_data?.role;
      if (userRole !== 'admin') {
        return NextResponse.json(
          { success: false, error: 'Permission denied' },
          { status: 403 }
        );
      }
    }

    // Validate proposed changes
    if (proposed_changes) {
      const quickValidation = WeightingValidator.validateForPreview(proposed_changes);
      if (!quickValidation.isValid) {
        return NextResponse.json(
          { success: false, error: 'Invalid proposed changes', details: quickValidation.criticalErrors },
          { status: 400 }
        );
      }
    }

    // Get sample employers
    const employers = await getSampleEmployers(
      supabase,
      sample_employers,
      sample_size,
      employer_filters
    );

    if (employers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No employers found for preview' },
        { status: 404 }
      );
    }

    // Create proposed weightings
    const proposedWeightings = createProposedWeightings(
      currentProfile,
      currentTrack1Weightings,
      currentTrack2Weightings,
      proposed_changes
    );

    // Get comparison profile if specified
    let comparisonProfile: UserWeightingProfile | null = null;
    let comparisonTrack1Weightings: Track1Weightings | null = null;
    let comparisonTrack2Weightings: Track2Weightings | null = null;

    if (comparison_profile_id) {
      const { data: comparisonData } = await supabase
        .from('user_weighting_profiles')
        .select(`
          *,
          track1_weightings (*),
          track2_weightings (*)
        `)
        .eq('id', comparison_profile_id)
        .single();

      if (comparisonData) {
        comparisonProfile = comparisonData;
        comparisonTrack1Weightings = comparisonData.track1_weightings?.[0] || null;
        comparisonTrack2Weightings = comparisonData.track2_weightings?.[0] || null;
      }
    }

    // Generate preview results
    const previewResults = await generatePreviewResults(
      supabase,
      employers,
      currentProfile,
      currentTrack1Weightings,
      currentTrack2Weightings,
      proposedWeightings.profile,
      proposedWeightings.track1,
      proposedWeightings.track2,
      comparisonProfile,
      comparisonTrack1Weightings,
      comparisonTrack2Weightings
    );

    // Create impact analysis
    const impactAnalysis = analyzeImpact(previewResults);

    // Create preview calculation record
    const previewCalculation: Omit<WeightingPreviewCalculation, 'id' | 'created_at' | 'expires_at'> = {
      user_id: user.id,
      profile_id: profile_id || undefined,
      sample_employers: employers.map(e => e.id),
      proposed_weightings: proposed_changes || {},
      calculation_results: previewResults,
      impact_analysis: impactAnalysis,
      preview_type: comparison_profile_id ? 'comparison' : 'real_time',
      comparison_profile_id: comparison_profile_id
    };

    // Save preview calculation (optional - for analytics)
    const { data: savedPreview, error: saveError } = await supabase
      .from('weighting_preview_calculations')
      .insert({
        ...previewCalculation,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour expiry
      })
      .select()
      .single();

    const response: WeightingPreviewResponse = {
      success: true,
      data: savedPreview ? {
        ...savedPreview,
        calculation_results: previewResults,
        impact_analysis: impactAnalysis
      } : {
        ...previewCalculation,
        id: 'preview-' + Date.now(),
        created_at: new Date(),
        expires_at: new Date(Date.now() + 60 * 60 * 1000),
        calculation_results: previewResults,
        impact_analysis: impactAnalysis
      },
      calculation_id: savedPreview?.id,
      expires_at: savedPreview?.expires_at || new Date(Date.now() + 60 * 60 * 1000)
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Unexpected error in POST /api/weightings/preview:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get sample employers for preview
 */
async function getSampleEmployers(
  supabase: any,
  employerIds: string[] | undefined,
  sampleSize: number,
  filters: any
): Promise<any[]> {
  let query = supabase
    .from('employers_search_optimized')
    .select(`
      id,
      name,
      employer_type,
      enterprise_agreement_status,
      estimated_worker_count,
      project_count
    `)
    .eq('employer_status', 'active')
    .order('project_count', { ascending: false })
    .limit(sampleSize);

  // Apply specific employer IDs if provided
  if (employerIds && employerIds.length > 0) {
    query = query.in('id', employerIds);
  }

  // Apply filters
  if (filters) {
    if (filters.employer_type && filters.employer_type !== 'all') {
      query = query.eq('employer_type', filters.employer_type);
    }

    if (filters.rating_range) {
      // Would need to join with rating data
      // For now, skip this filter
    }

    if (filters.confidence_levels && filters.confidence_levels.length > 0) {
      // Would need to join with rating data
      // For now, skip this filter
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching sample employers:', error);
    return [];
  }

  return data || [];
}

/**
 * Create proposed weightings based on current profile and changes
 */
function createProposedWeightings(
  currentProfile: UserWeightingProfile | null,
  currentTrack1Weightings: Track1Weightings | null,
  currentTrack2Weightings: Track2Weightings | null,
  proposedChanges: any
): {
  profile: UserWeightingProfile;
  track1: Track1Weightings;
  track2: Track2Weightings;
} {
  // Start with current profile or create a default one
  const baseProfile: UserWeightingProfile = currentProfile || {
    id: 'preview-profile',
    user_id: 'preview-user',
    profile_name: 'Preview Profile',
    profile_type: 'personal',
    user_role: 'lead_organiser',
    employer_category_focus: 'all',
    project_data_weight: 0.6,
    organiser_expertise_weight: 0.4,
    min_data_requirements: {
      min_project_assessments: 3,
      min_expertise_assessments: 1,
      min_data_age_days: 365,
      require_eba_status: false,
      require_safety_data: false
    },
    confidence_thresholds: {
      high_confidence_min: 0.8,
      medium_confidence_min: 0.6,
      low_confidence_min: 0.4,
      very_low_confidence_max: 0.4
    },
    is_default: false,
    is_active: true,
    is_public: false,
    version: 1,
    created_at: new Date(),
    updated_at: new Date()
  };

  const baseTrack1Weightings: Track1Weightings = currentTrack1Weightings || {
    id: 'preview-track1',
    profile_id: 'preview-profile',
    cbus_paying_weight: 0.15,
    cbus_on_time_weight: 0.10,
    cbus_all_workers_weight: 0.10,
    incolink_entitlements_weight: 0.15,
    incolink_on_time_weight: 0.10,
    incolink_all_workers_weight: 0.10,
    union_relations_right_of_entry_weight: 0.15,
    union_relations_delegate_accommodation_weight: 0.10,
    union_relations_access_to_info_weight: 0.10,
    union_relations_access_to_inductions_weight: 0.05,
    safety_hsr_respect_weight: 0.20,
    safety_general_standards_weight: 0.15,
    safety_incidents_weight: 0.25,
    subcontractor_usage_levels_weight: 0.30,
    subcontractor_practices_weight: 0.70,
    builder_tender_consultation_weight: 0.15,
    builder_communication_weight: 0.15,
    builder_delegate_facilities_weight: 0.10,
    builder_contractor_compliance_weight: 0.20,
    builder_eba_contractor_percentage_weight: 0.40,
    created_at: new Date(),
    updated_at: new Date()
  };

  const baseTrack2Weightings: Track2Weightings = currentTrack2Weightings || {
    id: 'preview-track2',
    profile_id: 'preview-profile',
    cbus_overall_assessment_weight: 0.20,
    incolink_overall_assessment_weight: 0.20,
    union_relations_overall_weight: 0.25,
    safety_culture_overall_weight: 0.20,
    historical_relationship_quality_weight: 0.10,
    eba_status_weight: 0.05,
    organiser_confidence_multiplier: 1.00,
    created_at: new Date(),
    updated_at: new Date()
  };

  // Apply proposed changes
  const proposedProfile = {
    ...baseProfile,
    ...(proposedChanges?.profile_changes || {})
  };

  const proposedTrack1Weightings = {
    ...baseTrack1Weightings,
    ...(proposedChanges?.track1_changes || {})
  };

  const proposedTrack2Weightings = {
    ...baseTrack2Weightings,
    ...(proposedChanges?.track2_changes || {})
  };

  return {
    profile: proposedProfile,
    track1: proposedTrack1Weightings,
    track2: proposedTrack2Weightings
  };
}

/**
 * Generate preview results by calculating ratings with different weightings
 */
async function generatePreviewResults(
  supabase: any,
  employers: any[],
  currentProfile: UserWeightingProfile | null,
  currentTrack1Weightings: Track1Weightings | null,
  currentTrack2Weightings: Track2Weightings | null,
  proposedProfile: UserWeightingProfile,
  proposedTrack1Weightings: Track1Weightings,
  proposedTrack2Weightings: Track2Weightings,
  comparisonProfile: UserWeightingProfile | null,
  comparisonTrack1Weightings: Track1Weightings | null,
  comparisonTrack2Weightings: Track2Weightings | null
): Promise<WeightingPreviewResults> {
  const currentRatings: RatingSnapshot[] = [];
  const proposedRatings: RatingSnapshot[] = [];
  const comparisonRatings: RatingSnapshot[] = [];

  for (const employer of employers) {
    // Get mock rating data (in real implementation, this would query actual rating data)
    const mockRatingData = await getMockRatingData(supabase, employer.id);

    if (currentProfile && currentTrack1Weightings && currentTrack2Weightings) {
      const currentResult = WeightingEngine.calculateWeightedRating(
        currentProfile,
        currentTrack1Weightings,
        currentTrack2Weightings,
        mockRatingData.projectData,
        mockRatingData.expertiseData,
        mockRatingData.ebaData
      );

      currentRatings.push({
        employer_id: employer.id,
        employer_name: employer.name,
        current_rating: currentResult.final_rating,
        current_score: currentResult.final_score,
        proposed_rating: currentResult.final_rating, // Will be updated below
        proposed_score: currentResult.final_score,
        confidence_level: currentResult.overall_confidence
      });
    }

    // Calculate with proposed weightings
    const proposedResult = WeightingEngine.calculateWeightedRating(
      proposedProfile,
      proposedTrack1Weightings,
      proposedTrack2Weightings,
      mockRatingData.projectData,
      mockRatingData.expertiseData,
      mockRatingData.ebaData
    );

    proposedRatings.push({
      employer_id: employer.id,
      employer_name: employer.name,
      current_rating: proposedResult.final_rating, // Will be updated if current ratings exist
      current_score: proposedResult.final_score,
      proposed_rating: proposedResult.final_rating,
      proposed_score: proposedResult.final_score,
      confidence_level: proposedResult.overall_confidence
    });

    if (comparisonProfile && comparisonTrack1Weightings && comparisonTrack2Weightings) {
      const comparisonResult = WeightingEngine.calculateWeightedRating(
        comparisonProfile,
        comparisonTrack1Weightings,
        comparisonTrack2Weightings,
        mockRatingData.projectData,
        mockRatingData.expertiseData,
        mockRatingData.ebaData
      );

      comparisonRatings.push({
        employer_id: employer.id,
        employer_name: employer.name,
        current_rating: comparisonResult.final_rating,
        current_score: comparisonResult.final_score,
        proposed_rating: comparisonResult.final_rating,
        proposed_score: comparisonResult.final_score,
        confidence_level: comparisonResult.overall_confidence
      });
    }
  }

  // Update current ratings in proposed ratings if they exist
  currentRatings.forEach((current, index) => {
    if (proposedRatings[index]) {
      proposedRatings[index].current_rating = current.current_rating;
      proposedRatings[index].current_score = current.current_score;
    }
  });

  // Calculate rating changes
  const ratingChanges = calculateRatingChanges(currentRatings, proposedRatings);

  // Calculate summary statistics
  const summaryStatistics = calculateSummaryStatistics(currentRatings, proposedRatings);

  return {
    sample_size: employers.length,
    current_ratings: currentRatings,
    proposed_ratings: proposedRatings,
    rating_changes: ratingChanges,
    summary_statistics: summaryStatistics
  };
}

/**
 * Get mock rating data for testing (in real implementation, this would query actual data)
 */
async function getMockRatingData(supabase: any, employerId: string): Promise<{
  projectData: any;
  expertiseData: any;
  ebaData: any;
}> {
  // This is a mock implementation
  // In the real system, this would query actual rating calculation results

  const mockScore = Math.random() * 0.5 + 0.5; // Random score between 0.5 and 1.0

  return {
    projectData: {
      employer_id: employerId,
      score: mockScore,
      rating: mockScore > 0.8 ? 'green' : mockScore > 0.6 ? 'amber' : 'red',
      confidence_level: 'medium',
      assessment_count: Math.floor(Math.random() * 10) + 1,
      data_quality: 'medium'
    },
    expertiseData: {
      employer_id: employerId,
      score: mockScore + (Math.random() - 0.5) * 0.2, // Add some variation
      rating: mockScore > 0.75 ? 'green' : mockScore > 0.55 ? 'amber' : 'red',
      confidence_level: 'medium',
      assessment_count: Math.floor(Math.random() * 5) + 1
    },
    ebaData: {
      employer_id: employerId,
      eba_status: mockScore > 0.7 ? 'green' : mockScore > 0.4 ? 'amber' : 'red',
      eba_score: mockScore,
      has_active_eba: mockScore > 0.5,
      latest_eba_date: new Date()
    }
  };
}

/**
 * Calculate rating changes between current and proposed
 */
function calculateRatingChanges(
  currentRatings: RatingSnapshot[],
  proposedRatings: RatingSnapshot[]
): RatingChange[] {
  const changes: RatingChange[] = [];

  for (let i = 0; i < proposedRatings.length; i++) {
    const proposed = proposedRatings[i];
    const current = currentRatings[i];

    if (!current) continue;

    const scoreChange = proposed.proposed_score - current.current_score;
    let ratingChangeType: 'improvement' | 'decline' | 'no_change';
    let impactLevel: WeightingImpactLevel;

    if (scoreChange > 0.05) {
      ratingChangeType = 'improvement';
      impactLevel = scoreChange > 0.2 ? 'high' : scoreChange > 0.1 ? 'medium' : 'low';
    } else if (scoreChange < -0.05) {
      ratingChangeType = 'decline';
      impactLevel = scoreChange < -0.2 ? 'high' : scoreChange < -0.1 ? 'medium' : 'low';
    } else {
      ratingChangeType = 'no_change';
      impactLevel = 'low';
    }

    const change: RatingChange = {
      employer_id: proposed.employer_id,
      employer_name: proposed.employer_name,
      previous_rating: current.current_rating,
      new_rating: proposed.proposed_rating,
      previous_score: current.current_score,
      new_score: proposed.proposed_score,
      score_change: scoreChange,
      rating_change_type: ratingChangeType,
      impact_level: impactLevel,
      contributing_factors: ['weighting_adjustment'] // Would be more detailed in real implementation
    };

    changes.push(change);
  }

  return changes;
}

/**
 * Calculate summary statistics for the preview
 */
function calculateSummaryStatistics(
  currentRatings: RatingSnapshot[],
  proposedRatings: RatingSnapshot[]
): any {
  let ratingsImproved = 0;
  let ratingsDeclined = 0;
  let ratingsUnchanged = 0;
  let totalScoreChange = 0;

  for (let i = 0; i < proposedRatings.length; i++) {
    const proposed = proposedRatings[i];
    const current = currentRatings[i];

    if (!current) continue;

    const scoreChange = proposed.proposed_score - current.current_score;
    totalScoreChange += scoreChange;

    if (scoreChange > 0.05) {
      ratingsImproved++;
    } else if (scoreChange < -0.05) {
      ratingsDeclined++;
    } else {
      ratingsUnchanged++;
    }
  }

  const averageScoreChange = currentRatings.length > 0 ? totalScoreChange / currentRatings.length : 0;

  // Calculate confidence change (simplified)
  const currentAvgConfidence = calculateAverageConfidence(currentRatings);
  const proposedAvgConfidence = calculateAverageConfidence(proposedRatings);
  const confidenceChange = proposedAvgConfidence - currentAvgConfidence;

  return {
    ratings_improved: ratingsImproved,
    ratings_declined: ratingsDeclined,
    ratings_unchanged: ratingsUnchanged,
    average_score_change: averageScoreChange,
    confidence_change: confidenceChange
  };
}

/**
 * Calculate average confidence level
 */
function calculateAverageConfidence(ratings: RatingSnapshot[]): number {
  if (ratings.length === 0) return 0;

  const confidenceScores = {
    'very_low': 0.2,
    'low': 0.4,
    'medium': 0.6,
    'high': 0.8
  };

  const totalConfidence = ratings.reduce((sum, rating) => {
    return sum + confidenceScores[rating.confidence_level];
  }, 0);

  return totalConfidence / ratings.length;
}

/**
 * Analyze impact of weighting changes
 */
function analyzeImpact(previewResults: WeightingPreviewResults): WeightingImpactAnalysis {
  const { rating_changes, summary_statistics } = previewResults;

  // Determine overall impact level
  const avgAbsoluteChange = Math.abs(summary_statistics.average_score_change);
  let overallImpactLevel: WeightingImpactLevel;

  if (avgAbsoluteChange > 0.15) {
    overallImpactLevel = 'critical';
  } else if (avgAbsoluteChange > 0.1) {
    overallImpactLevel = 'high';
  } else if (avgAbsoluteChange > 0.05) {
    overallImpactLevel = 'medium';
  } else {
    overallImpactLevel = 'low';
  }

  // Calculate impact distribution
  const impactDistribution = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0
  };

  rating_changes.forEach(change => {
    impactDistribution[change.impact_level]++;
  });

  // Find significant changes
  const significantChanges = rating_changes.filter(change =>
    change.impact_level === 'high' || change.impact_level === 'critical'
  );

  // Generate recommendations
  const recommendations = generateRecommendations(overallImpactLevel, summary_statistics);

  // Risk assessment
  const riskAssessment = {
    high_risk_changes: rating_changes.filter(c => c.impact_level === 'critical').length,
    medium_risk_changes: rating_changes.filter(c => c.impact_level === 'high').length,
    low_risk_changes: rating_changes.filter(c => c.impact_level === 'medium' || c.impact_level === 'low').length
  };

  return {
    overall_impact_level: overallImpactLevel,
    impact_distribution: impactDistribution,
    affected_categories: ['compliance', 'expertise', 'relationships'], // Simplified
    significant_changes: significantChanges,
    recommendations: recommendations,
    risk_assessment: riskAssessment
  };
}

/**
 * Generate recommendations based on impact analysis
 */
function generateRecommendations(
  impactLevel: WeightingImpactLevel,
  summaryStats: any
): string[] {
  const recommendations: string[] = [];

  if (impactLevel === 'critical') {
    recommendations.push('Consider applying these changes gradually to monitor impact');
    recommendations.push('Review employers with significant rating changes');
  }

  if (Math.abs(summaryStats.average_score_change) > 0.1) {
    recommendations.push('Large changes detected - validate with domain expert');
  }

  if (summaryStats.ratings_declined > summaryStats.ratings_improved) {
    recommendations.push('More ratings declining than improving - review weighting balance');
  }

  if (Math.abs(summaryStats.confidence_change) > 0.1) {
    recommendations.push('Significant confidence level changes - review data quality assumptions');
  }

  if (recommendations.length === 0) {
    recommendations.push('Changes appear to have minimal impact - safe to proceed');
  }

  return recommendations;
}
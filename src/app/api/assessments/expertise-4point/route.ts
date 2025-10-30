import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import { featureFlags } from '@/lib/feature-flags';
import { RatingWizardFormData, FrequencyRating } from '@/types/rating';

// Convert frequency rating to numeric value (1-4)
function frequencyToNumeric(rating: FrequencyRating): number {
  switch (rating) {
    case 'always': return 4;
    case 'almost_always': return 3;
    case 'sometimes': return 2;
    case 'rarely_never': return 1;
    default: return 1;
  }
}

// Calculate overall score from assessment data
function calculateOverallScore(
  assessmentData: RatingWizardFormData['assessment_data'],
  customWeights?: { [key: string]: number }
): number {
  // Use custom weights if provided, otherwise use default equal weights
  const weights = customWeights || {
    union_respect: 0.25,  // 25% - 5 criteria
    safety: 0.25,        // 25% - 3 criteria
    subcontractor: 0.25, // 25% - 1 criterion
    compliance: 0.25     // 25% - 3 criteria
  };

  // Union Respect (5 criteria)
  const unionRespectScores = Object.values(assessmentData.union_respect).map(frequencyToNumeric);
  const unionRespectAvg = unionRespectScores.reduce((sum, score) => sum + score, 0) / unionRespectScores.length;

  // Safety (3 criteria)
  const safetyScores = Object.values(assessmentData.safety).map(frequencyToNumeric);
  const safetyAvg = safetyScores.reduce((sum, score) => sum + score, 0) / safetyScores.length;

  // Subcontractor (1 criterion)
  const subcontractorScore = frequencyToNumeric(assessmentData.subcontractor.subcontractor_usage);

  // Compliance (3 criteria)
  const complianceScores = Object.values(assessmentData.compliance).map(frequencyToNumeric);
  const complianceAvg = complianceScores.reduce((sum, score) => sum + score, 0) / complianceScores.length;

  // Weighted average
  const overallScore = (
    unionRespectAvg * weights.union_respect +
    safetyAvg * weights.safety +
    subcontractorScore * weights.subcontractor +
    complianceAvg * weights.compliance
  );

  return Math.round(overallScore * 10) / 10; // Round to 1 decimal place
}

// Convert numeric score to traffic light rating
function scoreToTrafficLight(score: number): 'red' | 'amber' | 'yellow' | 'green' {
  if (score >= 3.5) return 'green';
  if (score >= 2.5) return 'yellow';
  if (score >= 1.5) return 'amber';
  return 'red';
}

export async function POST(request: NextRequest) {
  try {
    // Check if 4-point rating system is enabled
    // In development, always enable. In production, check feature flag.
    const isEnabled = process.env.NODE_ENV === 'development' ||
                     (process.env.RATING_SYSTEM_4POINT === 'true');
    if (!isEnabled) {
      return NextResponse.json(
        { error: '4-point rating system not enabled' },
        { status: 403 }
      );
    }

    const supabase = await createServerSupabase();

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const formData: RatingWizardFormData = await request.json();

    // Validate required fields
    if (!formData.employer_id || !formData.assessment_data) {
      return NextResponse.json(
        { error: 'Missing required fields: employer_id, assessment_data' },
        { status: 400 }
      );
    }

    // Validate assessment data structure
    const { assessment_data } = formData;
    const requiredCategories = ['union_respect', 'safety', 'subcontractor', 'compliance'];
    for (const category of requiredCategories) {
      if (!assessment_data[category as keyof typeof assessment_data]) {
        return NextResponse.json(
          { error: `Missing assessment category: ${category}` },
          { status: 400 }
        );
      }
    }

    // Get custom weights from database
    let customWeights = null;
    try {
      const { data: weightConfig } = await supabase
        .from('rating_weight_configs')
        .select('weights')
        .eq('track', 'organiser_expertise')
        .eq('is_active', true)
        .single();

      if (weightConfig && weightConfig.weights) {
        customWeights = weightConfig.weights;
      }
    } catch (error) {
      console.log('No custom weights found, using defaults');
    }

    // Calculate overall score and rating
    const overallScore = calculateOverallScore(assessment_data, customWeights);
    const overallRating = scoreToTrafficLight(overallScore);

    // Determine confidence level based on notes and assessment method
    let confidenceLevel: 'very_high' | 'high' | 'medium' | 'low' = 'medium';

    if (formData.notes && formData.notes.length > 100) {
      confidenceLevel = 'high';
      if (formData.assessment_method && formData.assessment_method !== 'other') {
        confidenceLevel = 'very_high';
      }
    } else if (!formData.notes || formData.notes.length < 20) {
      confidenceLevel = 'low';
    }

    // Insert the organiser expertise assessment
    const { data: expertiseAssessment, error: expertiseError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .insert({
        employer_id: formData.employer_id,
        organiser_id: user.id,
        assessment_date: new Date().toISOString(),
        overall_score: overallScore,
        overall_rating: overallRating,
        confidence_level: confidenceLevel,
        assessment_basis: formData.assessment_method || 'other',
        assessment_context: formData.notes,
        knowledge_beyond_projects: true, // This assessment goes beyond specific projects
        industry_reputation: overallRating === 'green' ? 'excellent' : overallRating === 'red' ? 'poor' : 'average',
        union_relationship_quality: overallRating === 'green' ? 'excellent' : overallRating === 'red' ? 'poor' : 'average',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (expertiseError) {
      console.error('Error creating expertise assessment:', expertiseError);
      return NextResponse.json(
        { error: 'Failed to create expertise assessment', details: expertiseError.message },
        { status: 500 }
      );
    }

    // Store detailed assessment data in a separate table for future analysis
    const { error: detailError } = await supabase
      .from('expertise_assessment_details_4point')
      .insert({
        expertise_assessment_id: expertiseAssessment.id,
        employer_id: formData.employer_id,
        organiser_id: user.id,
        assessment_date: new Date().toISOString(),

        // Union Respect data
        union_right_of_entry: frequencyToNumeric(assessment_data.union_respect.right_of_entry),
        union_delegate_accommodation: frequencyToNumeric(assessment_data.union_respect.delegate_accommodation),
        union_access_to_information: frequencyToNumeric(assessment_data.union_respect.access_to_information),
        union_access_to_inductions: frequencyToNumeric(assessment_data.union_respect.access_to_inductions),
        union_eba_status: frequencyToNumeric(assessment_data.union_respect.eba_status),

        // Safety data
        safety_site_safety: frequencyToNumeric(assessment_data.safety.site_safety),
        safety_safety_procedures: frequencyToNumeric(assessment_data.safety.safety_procedures),
        safety_incident_reporting: frequencyToNumeric(assessment_data.safety.incident_reporting),

        // Subcontractor data
        subcontractor_usage: frequencyToNumeric(assessment_data.subcontractor.subcontractor_usage),

        // Compliance data
        compliance_cbus: frequencyToNumeric(assessment_data.compliance.cbus_compliance),
        compliance_incolink: frequencyToNumeric(assessment_data.compliance.incolink_compliance),
        compliance_payment_timing: frequencyToNumeric(assessment_data.compliance.payment_timing),

        // Additional metadata
        assessment_method: formData.assessment_method,
        notes: formData.notes,
        follow_up_required: formData.follow_up_required,
        follow_up_date: formData.follow_up_date,
        confidence_factors: formData.confidence_factors,

        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (detailError) {
      console.error('Error storing assessment details:', detailError);
      // Don't fail the request, but log the error
    }

    // Update the current employer rating
    const { error: updateError } = await supabase
      .from('current_employer_ratings_4point')
      .upsert({
        employer_id: formData.employer_id,
        rating_date: new Date().toISOString(),
        current_rating: overallRating,
        current_score: overallScore,
        rating_source: 'organiser_expertise',
        expertise_rating: overallRating,
        expertise_score: overallScore,
        expertise_confidence: confidenceLevel,
        last_updated: new Date().toISOString(),
        updated_by: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });

    if (updateError) {
      console.error('Error updating current rating:', updateError);
      // Don't fail the request, but log the error
    }

    return NextResponse.json({
      success: true,
      data: {
        assessment_id: expertiseAssessment.id,
        overall_score: overallScore,
        overall_rating: overallRating,
        confidence_level: confidenceLevel,
        assessment_date: expertiseAssessment.assessment_date
      },
      message: '4-point expertise assessment submitted successfully'
    });

  } catch (error) {
    console.error('Error submitting 4-point expertise assessment:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
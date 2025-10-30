import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  FourPointRatingCalculation,
  AssessmentType,
  FourPointRating,
  Assessment,
} from '@/types/assessments'
import { z } from 'zod'

// Schema for rating calculation request
const RatingCalculationSchema = z.object({
  employer_id: z.string().uuid(),
  assessment_ids: z.array(z.string().uuid()).optional(),
  trigger_type: z.enum(['new_assessment', 'assessment_updated', 'assessment_deleted', 'manual_recalculation', 'bulk_operation']).default('manual_recalculation'),
  force_recalculate: z.boolean().default(false),
  calculation_context: z.object({
    role_context: z.enum(['trade', 'builder', 'admin', 'organiser']).optional(),
    project_id: z.string().uuid().optional(),
    organiser_id: z.string().uuid().optional(),
  }).optional(),
})

// Default weights for different assessment types (can be customized per employer role)
const DEFAULT_ASSESSMENT_WEIGHTS = {
  union_respect: 0.25,
  safety_4_point: 0.30,
  subcontractor_use: 0.20,
  role_specific: 0.25,
}

// Role-specific weight adjustments
const ROLE_WEIGHT_ADJUSTMENTS: Record<string, Partial<typeof DEFAULT_ASSESSMENT_WEIGHTS>> = {
  head_contractor: {
    subcontractor_use: 0.30, // Higher weight for head contractors
    union_respect: 0.20,
  },
  subcontractor: {
    role_specific: 0.30, // Higher weight for role-specific criteria
    safety_4_point: 0.25,
    subcontractor_use: 0.10, // Lower weight for subcontractors
  },
  trade_contractor: {
    safety_4_point: 0.35, // Higher safety weight for trade contractors
    role_specific: 0.30,
    union_respect: 0.20,
    subcontractor_use: 0.15,
  },
  labour_hire: {
    union_respect: 0.30, // Higher union respect weight for labour hire
    safety_4_point: 0.25,
    role_specific: 0.25,
    subcontractor_use: 0.20,
  },
  consultant: {
    role_specific: 0.40, // Much higher weight for role-specific criteria
    safety_4_point: 0.20,
    union_respect: 0.20,
    subcontractor_use: 0.20,
  },
}

// Helper function to get employer's latest assessments
async function getEmployerAssessments(
  supabase: any,
  employerId: string,
  assessmentIds?: string[]
) {
  const assessments: Record<AssessmentType, any[]> = {
    union_respect: [],
    safety_4_point: [],
    subcontractor_use: [],
    role_specific: [],
  }

  // If specific assessment IDs are provided, only fetch those
  if (assessmentIds && assessmentIds.length > 0) {
    for (const [assessmentType, tableName] of Object.entries({
      union_respect: 'union_respect_assessments',
      safety_4_point: 'safety_4_point_assessments',
      subcontractor_use: 'subcontractor_use_assessments',
      role_specific: 'role_specific_assessments',
    })) {
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('employer_id', employerId)
        .in('id', assessmentIds)
        .eq('status', 'approved') // Only use approved assessments

      if (data) {
        assessments[assessmentType as AssessmentType] = data
      }
    }
  } else {
    // Get latest assessments for each type
    for (const [assessmentType, tableName] of Object.entries({
      union_respect: 'union_respect_assessments',
      safety_4_point: 'safety_4_point_assessments',
      subcontractor_use: 'subcontractor_use_assessments',
      role_specific: 'role_specific_assessments',
    })) {
      const { data } = await supabase
        .from(tableName)
        .select('*')
        .eq('employer_id', employerId)
        .eq('status', 'approved')
        .order('assessment_date', { ascending: false })
        .limit(5) // Get up to 5 most recent assessments for each type

      if (data) {
        assessments[assessmentType as AssessmentType] = data
      }
    }
  }

  return assessments
}

// Helper function to calculate weighted score for an assessment type
function calculateWeightedScore(
  assessments: any[],
  weight: number,
  assessmentType: AssessmentType
): { score: number; confidence: number; data_quality: number } {
  if (!assessments || assessments.length === 0) {
    return { score: 0, confidence: 0, data_quality: 0 }
  }

  // Use the most recent assessment for primary calculation
  const latestAssessment = assessments[0]
  let baseScore = 0
  let confidence = 0

  switch (assessmentType) {
    case 'union_respect':
      baseScore = latestAssessment.overall_score
      confidence = latestAssessment.confidence_level
      break
    case 'safety_4_point':
      baseScore = latestAssessment.overall_safety_score
      confidence = latestAssessment.safety_confidence_level
      break
    case 'subcontractor_use':
      baseScore = latestAssessment.overall_subcontractor_score
      confidence = latestAssessment.confidence_level
      break
    case 'role_specific':
      baseScore = latestAssessment.overall_role_score
      confidence = latestAssessment.role_confidence_level
      break
  }

  // Apply temporal decay for older assessments
  const assessmentAge = Date.now() - new Date(latestAssessment.assessment_date).getTime()
  const daysSinceAssessment = assessmentAge / (1000 * 60 * 60 * 24)
  const decayFactor = Math.max(0.5, 1 - (daysSinceAssessment / 365)) // Minimum 0.5 after 1 year

  // Adjust confidence based on recency
  const recencyAdjustment = daysSinceAssessment < 90 ? 1 : Math.max(0.7, 1 - (daysSinceAssessment - 90) / 275)
  confidence *= recencyAdjustment

  // Data quality assessment
  let dataQuality = 0.5 // Base quality

  // More assessments = better data quality
  if (assessments.length >= 3) dataQuality += 0.2
  if (assessments.length >= 5) dataQuality += 0.1

  // Consistency across assessments
  if (assessments.length > 1) {
    const scores = assessments.map(a => {
      switch (assessmentType) {
        case 'union_respect': return a.overall_score
        case 'safety_4_point': return a.overall_safety_score
        case 'subcontractor_use': return a.overall_subcontractor_score
        case 'role_specific': return a.overall_role_score
        default: return 2.5
      }
    })

    const variance = scores.reduce((sum, score) => {
      const mean = scores.reduce((s, v) => s + v, 0) / scores.length
      return sum + Math.pow(score - mean, 2)
    }, 0) / scores.length

    const consistencyBonus = Math.max(0, 0.2 - variance * 0.05)
    dataQuality += consistencyBonus
  }

  // Recent assessment bonus
  if (daysSinceAssessment < 30) dataQuality += 0.1
  if (daysSinceAssessment < 7) dataQuality += 0.1

  dataQuality = Math.min(1, dataQuality)

  const weightedScore = baseScore * weight * decayFactor

  return {
    score: weightedScore,
    confidence: confidence * dataQuality,
    data_quality: dataQuality,
  }
}

// Helper function to get role-specific weights
function getRoleSpecificWeights(employerRole: string) {
  const baseWeights = { ...DEFAULT_ASSESSMENT_WEIGHTS }
  const adjustments = ROLE_WEIGHT_ADJUSTMENTS[employerRole]

  if (adjustments) {
    Object.assign(baseWeights, adjustments)
  }

  // Normalize weights to ensure they sum to 1
  const totalWeight = Object.values(baseWeights).reduce((sum, weight) => sum + weight, 0)
  Object.keys(baseWeights).forEach(key => {
    baseWeights[key as AssessmentType] /= totalWeight
  })

  return baseWeights
}

// POST - Calculate 4-point rating for an employer
export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validatedData = RatingCalculationSchema.parse(body)

    // Check if employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name, employer_type')
      .eq('id', validatedData.employer_id)
      .single()

    if (employerError || !employer) {
      return NextResponse.json(
        { success: false, message: 'Employer not found' },
        { status: 404 }
      )
    }

    // Get employer's assessments
    const assessments = await getEmployerAssessments(
      supabase,
      validatedData.employer_id,
      validatedData.assessment_ids
    )

    // Get role-specific weights
    const weights = getRoleSpecificWeights(employer.employer_type || 'other')

    // Calculate weighted scores for each assessment type
    const weightedScores: Record<AssessmentType, number> = {
      union_respect: 0,
      safety_4_point: 0,
      subcontractor_use: 0,
      role_specific: 0,
    }

    const scoreDetails: Record<AssessmentType, any> = {}

    for (const [assessmentType, assessmentList] of Object.entries(assessments)) {
      const result = calculateWeightedScore(
        assessmentList,
        weights[assessmentType as AssessmentType],
        assessmentType as AssessmentType
      )
      weightedScores[assessmentType as AssessmentType] = result.score
      scoreDetails[assessmentType as AssessmentType] = result
    }

    // Calculate final score
    const totalWeightedScore = Object.values(weightedScores).reduce((sum, score) => sum + score, 0)
    const finalScore = Math.max(1, Math.min(4, Math.round(totalWeightedScore))) as FourPointRating

    // Calculate overall confidence
    const confidenceFactors = Object.values(scoreDetails).map(detail => detail.confidence)
    const averageConfidence = confidenceFactors.length > 0
      ? confidenceFactors.reduce((sum, conf) => sum + conf, 0) / confidenceFactors.length
      : 0

    // Apply data quality adjustment
    const dataQualityScores = Object.values(scoreDetails).map(detail => detail.data_quality)
    const averageDataQuality = dataQualityScores.length > 0
      ? dataQualityScores.reduce((sum, dq) => sum + dq, 0) / dataQualityScores.length
      : 0

    const finalConfidence = Math.min(100, Math.round(averageConfidence * averageDataQuality))

    // Determine which assessment types were used
    const assessmentTypesUsed = Object.entries(assessments)
      .filter(([_, assessmentList]) => assessmentList && assessmentList.length > 0)
      .map(([type, _]) => type as AssessmentType)

    // Create calculation record
    const calculationData: FourPointRatingCalculation = {
      employer_id: validatedData.employer_id,
      calculation_date: new Date().toISOString(),
      calculated_by: user.id,
      assessments_used: validatedData.assessment_ids || [],
      weights,
      weighted_scores: weightedScores,
      final_score: finalScore,
      confidence_level: finalConfidence,
      calculation_breakdown: {
        total_assessments: Object.values(assessments).reduce((sum, list) => sum + list.length, 0),
        assessment_types_used: assessmentTypesUsed,
        recent_assessments: Object.values(assessments).filter(list =>
          list.length > 0 && Date.now() - new Date(list[0].assessment_date).getTime() < 90 * 24 * 60 * 60 * 1000
        ).length,
        data_quality_score: Math.round(averageDataQuality * 100),
      },
    }

    // Save calculation record
    const { data: savedCalculation, error: saveError } = await supabase
      .from('four_point_rating_calculations')
      .insert(calculationData)
      .select()
      .single()

    if (saveError) {
      console.error('Error saving rating calculation:', saveError)
      // Don't fail the request, but log the error
    }

    // Update employer's current rating
    await supabase
      .from('employers')
      .update({
        current_4_point_rating: finalScore,
        rating_confidence: finalConfidence,
        rating_calculation_date: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', validatedData.employer_id)

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: '4-point rating calculated successfully',
      data: {
        calculation: calculationData,
        employer: {
          id: employer.id,
          name: employer.name,
          employer_type: employer.employer_type,
        },
        score_details: scoreDetails,
      },
      metadata: {
        processing_time_ms: processingTime,
        calculation_id: savedCalculation?.id,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in 4-point rating calculation:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Validation error', errors: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get rating calculation history for an employer
export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    const { data: calculations, error, count } = await supabase
      .from('four_point_rating_calculations')
      .select(`
        *,
        calculators!inner(id, name, email)
      `, { count: 'exact' })
      .eq('employer_id', params.employerId)
      .order('calculation_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching rating calculation history:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch calculation history', error: error.message },
        { status: 500 }
      )
    }

    // Get employer's current rating
    const { data: employer } = await supabase
      .from('employers')
      .select('current_4_point_rating, rating_confidence, rating_calculation_date')
      .eq('id', params.employerId)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        calculations: calculations || [],
        current_rating: employer,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in rating calculation history GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
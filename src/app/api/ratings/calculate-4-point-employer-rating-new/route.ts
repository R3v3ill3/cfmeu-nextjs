import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for rating calculation request
const RatingCalculationSchema = z.object({
  employer_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  calculation_method: z.enum(['automatic_calculation', 'manual_override', 'hybrid']).default('automatic_calculation'),
  trigger_type: z.enum(['new_assessment', 'assessment_updated', 'assessment_deleted', 'manual_recalculation', 'bulk_operation']).default('manual_recalculation'),
  weights: z.object({
    eba_status: z.number().min(0).max(1).optional(),
    union_respect: z.number().min(0).max(1).optional(),
    safety: z.number().min(0).max(1).optional(),
    subcontractor: z.number().min(0).max(1).optional(),
  }).optional(),
  manual_rating: z.number().min(1).max(4).optional(),
  rating_basis: z.enum(['site_visit', 'compliance_check', 'document_review', 'union_knowledge', 'hybrid']).default('hybrid'),
  changed_by: z.string().uuid().optional(),
  rating_change_reason: z.string().optional(),
})

// Default weights for rating calculation
const DEFAULT_WEIGHTS = {
  eba_status: 0.30,
  union_respect: 0.25,
  safety: 0.25,
  subcontractor: 0.20,
}

// Helper function to normalize weights to ensure they sum to 1
function normalizeWeights(weights: any) {
  const normalized = { ...DEFAULT_WEIGHTS, ...weights }
  const total = Object.values(normalized).reduce((sum, weight) => sum + weight, 0)

  Object.keys(normalized).forEach(key => {
    normalized[key as keyof typeof normalized] = normalized[key as keyof typeof normalized] / total
  })

  return normalized
}

// POST - Calculate 4-point employer rating using new schema
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

    // Check if project exists (if provided)
    if (validatedData.project_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, name')
        .eq('id', validatedData.project_id)
        .single()

      if (projectError || !project) {
        return NextResponse.json(
          { success: false, message: 'Project not found' },
          { status: 404 }
        )
      }
    }

    // Normalize weights
    const normalizedWeights = normalizeWeights(validatedData.weights)

    let finalRating: number
    let componentRatings: any = {}
    let calculationDetails: any = {}

    if (validatedData.manual_rating) {
      // Manual override
      finalRating = validatedData.manual_rating
      calculationDetails = {
        manual_rating: validatedData.manual_rating,
        manual_override: true
      }
    } else {
      // Automatic calculation using new 4-point system

      // 1. Get EBA status rating
      const { data: ebaResult, error: ebaError } = await supabase
        .rpc('get_employer_eba_rating_4point', { p_employer_id: validatedData.employer_id })

      if (ebaError) {
        console.error('Error getting EBA rating:', ebaError)
        return NextResponse.json(
          { success: false, message: 'Failed to get EBA rating', error: ebaError.message },
          { status: 500 }
        )
      }

      componentRatings.eba_status_rating = ebaResult || 1

      // 2. Get latest assessment ratings from 4-point tables
      const { data: assessmentResult } = await supabase
        .from('union_respect_assessments_4point')
        .select('overall_union_respect_rating')
        .eq('employer_id', validatedData.employer_id)
        .order('assessment_date', { ascending: false })
        .limit(1)

      const { data: safetyResult } = await supabase
        .from('safety_assessments_4point')
        .select('overall_safety_rating')
        .eq('employer_id', validatedData.employer_id)
        .order('assessment_date', { ascending: false })
        .limit(1)

      const { data: subcontractorResult } = await supabase
        .from('subcontractor_assessments_4point')
        .select('usage_rating')
        .eq('employer_id', validatedData.employer_id)
        .order('assessment_date', { ascending: false })
        .limit(1)

      componentRatings.union_respect_rating = assessmentResult?.[0]?.overall_union_respect_rating || 3
      componentRatings.safety_rating = safetyResult?.[0]?.overall_safety_rating || 3
      componentRatings.subcontractor_rating = subcontractorResult?.[0]?.usage_rating || 3

      // 3. Calculate overall rating using weighted average
      // Note: EBA status is a gating factor - if no EBA, rating is capped at 1 (red)
      if (componentRatings.eba_status_rating === 1) {
        finalRating = 1 // No EBA = automatic red
      } else {
        const weightedScore = (
          componentRatings.eba_status_rating * normalizedWeights.eba_status +
          componentRatings.union_respect_rating * normalizedWeights.union_respect +
          componentRatings.safety_rating * normalizedWeights.safety +
          componentRatings.subcontractor_rating * normalizedWeights.subcontractor
        )

        finalRating = Math.max(1, Math.min(4, Math.round(weightedScore)))

        // Ensure rating is capped by EBA status (expired EBA = max 2)
        if (componentRatings.eba_status_rating === 2 && finalRating > 2) {
          finalRating = 2
        }
      }

      // 4. Build calculation details
      calculationDetails = {
        eba_status: {
          rating: componentRatings.eba_status_rating,
          weight: normalizedWeights.eba_status,
          status: componentRatings.eba_status_rating === 1 ? 'No EBA' :
                 componentRatings.eba_status_rating === 2 ? 'Expired EBA' :
                 componentRatings.eba_status_rating === 3 ? 'Old EBA' : 'Current EBA'
        },
        union_respect: {
          rating: componentRatings.union_respect_rating,
          weight: normalizedWeights.union_respect
        },
        safety: {
          rating: componentRatings.safety_rating,
          weight: normalizedWeights.safety
        },
        subcontractor: {
          rating: componentRatings.subcontractor_rating,
          weight: normalizedWeights.subcontractor
        },
        weighted_score: (
          componentRatings.eba_status_rating * normalizedWeights.eba_status +
          componentRatings.union_respect_rating * normalizedWeights.union_respect +
          componentRatings.safety_rating * normalizedWeights.safety +
          componentRatings.subcontractor_rating * normalizedWeights.subcontractor
        ),
        final_rating: finalRating
      }
    }

    // Convert numeric rating to label
    const ratingLabels = { 1: 'red', 2: 'amber', 3: 'yellow', 4: 'green' }
    const ratingLabel = ratingLabels[finalRating as keyof typeof ratingLabels]

    // Save rating to the 4-point ratings table
    const { data: savedRating, error: saveError } = await supabase
      .from('employer_ratings_4point')
      .insert({
        employer_id: validatedData.employer_id,
        project_id: validatedData.project_id,
        overall_rating: finalRating,
        overall_rating_label: ratingLabel,
        eba_status_rating: componentRatings.eba_status_rating || 1,
        union_respect_rating: componentRatings.union_respect_rating || 3,
        safety_rating: componentRatings.safety_rating || 3,
        subcontractor_rating: componentRatings.subcontractor_rating || 3,
        calculation_method: validatedData.calculation_method,
        weights: normalizedWeights,
        rating_factors: calculationDetails,
        rating_basis: validatedData.rating_basis,
        changed_by: validatedData.changed_by || user.id,
        rating_change_reason: validatedData.rating_change_reason
      })
      .select()
      .single()

    if (saveError) {
      console.error('Error saving employer rating:', saveError)
      return NextResponse.json(
        { success: false, message: 'Failed to save rating', error: saveError.message },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: '4-point employer rating calculated successfully',
      data: {
        rating_id: savedRating.id,
        employer: {
          id: employer.id,
          name: employer.name,
          employer_type: employer.employer_type,
        },
        overall_rating: finalRating,
        overall_rating_label: ratingLabel,
        component_ratings: componentRatings,
        calculation_details: calculationDetails,
        weights_used: normalizedWeights,
        trigger_type: validatedData.trigger_type,
      },
      metadata: {
        processing_time_ms: processingTime,
        calculation_method: validatedData.calculation_method,
        timestamp: new Date().toISOString(),
        calculated_by: user.id,
      },
    })
  } catch (error) {
    console.error('Error in 4-point employer rating calculation:', error)

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

// GET - Get rating history for an employer
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
    const projectId = searchParams.get('project_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = (page - 1) * limit

    let query = supabase
      .from('employer_ratings_4point')
      .select(`
        *,
        employers!inner(id, name),
        profiles!inner(id, name, email)
      `, { count: 'exact' })
      .eq('employer_id', params.employerId)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data: ratings, error, count } = await query
      .order('rating_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching employer rating history:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch rating history', error: error.message },
        { status: 500 }
      )
    }

    // Get employer's current rating from the view
    const { data: currentRating } = await supabase
      .from('current_employer_ratings_4point')
      .select('*')
      .eq('employer_id', params.employerId)
      .single()

    return NextResponse.json({
      success: true,
      data: {
        ratings: ratings || [],
        current_rating: currentRating,
      },
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Error in employer rating history GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
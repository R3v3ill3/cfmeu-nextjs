import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  CreateUnionRespectAssessmentPayload,
  UnionRespectAssessment,
  AssessmentResponse,
  FourPointRating,
} from '@/types/assessments'
import { z } from 'zod'

// Validation schema for Union Respect Assessment
const UnionRespectAssessmentSchema = z.object({
  employer_id: z.string().uuid(),
  criteria: z.object({
    union_engagement: z.number().min(1).max(4),
    communication_respect: z.number().min(1).max(4),
    collaboration_attitude: z.number().min(1).max(4),
    dispute_resolution: z.number().min(1).max(4),
    union_delegate_relations: z.number().min(1).max(4),
  }),
  additional_comments: z.object({
    union_engagement: z.string().optional(),
    communication_respect: z.string().optional(),
    collaboration_attitude: z.string().optional(),
    dispute_resolution: z.string().optional(),
    union_delegate_relations: z.string().optional(),
  }).optional(),
  supporting_evidence: z.object({
    has_union_delegates: z.boolean().optional(),
    regular_meetings: z.boolean().optional(),
    formal_communication_channels: z.boolean().optional(),
    joint_safety_committee: z.boolean().optional(),
    union_training_participation: z.boolean().optional(),
  }).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate overall score
function calculateOverallScore(criteria: UnionRespectAssessment['criteria']): FourPointRating {
  const values = Object.values(criteria)
  const average = values.reduce((sum, val) => sum + val, 0) / values.length
  return Math.round(average) as FourPointRating
}

// Helper function to calculate confidence level
function calculateConfidenceLevel(
  criteria: UnionRespectAssessment['criteria'],
  evidence?: Partial<UnionRespectAssessment['supporting_evidence']>
): number {
  let confidence = 50 // Base confidence

  // Increase confidence based on evidence completeness
  if (evidence) {
    const evidenceFields = Object.values(evidence).filter(Boolean).length
    const totalFields = Object.keys(evidence).length
    confidence += (evidenceFields / totalFields) * 30
  }

  // Increase confidence based on rating consistency
  const values = Object.values(criteria)
  const variance = values.reduce((sum, val) => {
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / values.length

  const consistencyBonus = Math.max(0, 20 - variance * 5)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// POST - Create new Union Respect Assessment
export async function POST(request: NextRequest) {
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
    const validatedData = UnionRespectAssessmentSchema.parse(body) as CreateUnionRespectAssessmentPayload

    // Check if employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', validatedData.employer_id)
      .single()

    if (employerError || !employer) {
      return NextResponse.json(
        { success: false, message: 'Employer not found' },
        { status: 404 }
      )
    }

    // Calculate overall score and confidence
    const overallScore = calculateOverallScore(validatedData.criteria)
    const confidenceLevel = calculateConfidenceLevel(
      validatedData.criteria,
      validatedData.supporting_evidence
    )

    // Create the assessment
    const assessmentData = {
      employer_id: validatedData.employer_id,
      assessment_type: 'union_respect',
      assessor_id: user.id,
      assessment_date: new Date().toISOString(),
      status: 'submitted',
      criteria: validatedData.criteria,
      additional_comments: validatedData.additional_comments || null,
      supporting_evidence: validatedData.supporting_evidence || null,
      overall_score: overallScore,
      confidence_level: confidenceLevel,
      notes: validatedData.notes || null,
    }

    const { data: assessment, error } = await supabase
      .from('union_respect_assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating Union Respect assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create assessment', error: error.message },
        { status: 500 }
      )
    }

    // Trigger rating calculation for this employer
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          employer_id: validatedData.employer_id,
          assessment_ids: [assessment.id],
          trigger_type: 'new_assessment',
        }),
      })
    } catch (ratingError) {
      console.error('Error triggering rating calculation:', ratingError)
      // Don't fail the request if rating calculation fails
    }

    const response: AssessmentResponse<UnionRespectAssessment> = {
      data: assessment,
      success: true,
      message: 'Union Respect assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: confidenceLevel,
        last_updated: assessment.created_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Union Respect assessment POST:', error)

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

// GET - List Union Respect Assessments with filtering
export async function GET(request: NextRequest) {
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
    const employerId = searchParams.get('employer_id')
    const assessorId = searchParams.get('assessor_id')
    const status = searchParams.get('status')
    const minScore = searchParams.get('min_score')
    const maxScore = searchParams.get('max_score')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('union_respect_assessments')
      .select(`
        *,
        employers!inner(id, name, abn),
        assessors!inner(id, name, email)
      `, { count: 'exact' })

    // Apply filters
    if (employerId) {
      query = query.eq('employer_id', employerId)
    }
    if (assessorId) {
      query = query.eq('assessor_id', assessorId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (minScore) {
      query = query.gte('overall_score', parseInt(minScore))
    }
    if (maxScore) {
      query = query.lte('overall_score', parseInt(maxScore))
    }

    // Apply pagination and ordering
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching Union Respect assessments:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch assessments', error: error.message },
        { status: 500 }
      )
    }

    const response = {
      data: assessments || [],
      success: true,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Union Respect assessment GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
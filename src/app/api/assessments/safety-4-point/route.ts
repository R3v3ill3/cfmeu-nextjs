import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  CreateSafety4PointAssessmentPayload,
  Safety4PointAssessment,
  AssessmentResponse,
  FourPointRating,
} from '@/types/assessments'
import { z } from 'zod'

// Validation schema for Safety 4-Point Assessment
const Safety4PointAssessmentSchema = z.object({
  employer_id: z.string().uuid(),
  safety_criteria: z.object({
    safety_management_systems: z.number().min(1).max(4),
    incident_reporting: z.number().min(1).max(4),
    site_safety_culture: z.number().min(1).max(4),
    risk_assessment_processes: z.number().min(1).max(4),
    emergency_preparedness: z.number().min(1).max(4),
    worker_safety_training: z.number().min(1).max(4),
  }),
  safety_metrics: z.object({
    lost_time_injuries: z.number().min(0),
    near_misses: z.number().min(0),
    safety_breaches: z.number().min(0),
    safety_improvements: z.number().min(0),
    training_hours: z.number().min(0),
  }),
  audit_compliance: z.object({
    last_audit_date: z.string().optional(),
    audit_score: z.number().min(1).max(4).optional(),
    outstanding_actions: z.number().min(0),
    critical_risks_identified: z.number().min(0),
  }).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate overall safety score
function calculateOverallSafetyScore(
  criteria: Safety4PointAssessment['safety_criteria'],
  metrics: Safety4PointAssessment['safety_metrics'],
  auditCompliance?: Safety4PointAssessment['audit_compliance']
): FourPointRating {
  // Base score from criteria (70% weight)
  const criteriaValues = Object.values(criteria)
  const criteriaAverage = criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length

  // Safety metrics score (20% weight)
  let metricsScore = 4 // Start with perfect score
  if (metrics.lost_time_injuries > 0) metricsScore -= Math.min(2, metrics.lost_time_injuries)
  if (metrics.near_misses > 10) metricsScore -= 1
  if (metrics.safety_breaches > 5) metricsScore -= 1
  if (metrics.training_hours < 10) metricsScore -= 1
  metricsScore = Math.max(1, metricsScore)

  // Audit compliance score (10% weight)
  let auditScore = 4
  if (auditCompliance) {
    if (auditCompliance.audit_score) auditScore = auditCompliance.audit_score
    if (auditCompliance.outstanding_actions > 3) auditScore -= 1
    if (auditCompliance.critical_risks_identified > 2) auditScore -= 1
    auditScore = Math.max(1, auditScore)
  }

  // Weighted average
  const weightedScore = (criteriaAverage * 0.7) + (metricsScore * 0.2) + (auditScore * 0.1)

  return Math.round(weightedScore) as FourPointRating
}

// Helper function to calculate safety confidence level
function calculateSafetyConfidenceLevel(
  criteria: Safety4PointAssessment['safety_criteria'],
  metrics: Safety4PointAssessment['safety_metrics'],
  auditCompliance?: Safety4PointAssessment['audit_compliance']
): number {
  let confidence = 50 // Base confidence

  // Data completeness bonus
  const criteriaCompleteness = Object.values(criteria).filter(val => val >= 1 && val <= 4).length / Object.keys(criteria).length
  confidence += criteriaCompleteness * 20

  // Metrics reliability bonus
  if (metrics.training_hours > 0) confidence += 10
  if (metrics.safety_improvements > 0) confidence += 5

  // Audit confidence bonus
  if (auditCompliance) {
    if (auditCompliance.last_audit_date) {
      const auditAge = Date.now() - new Date(auditCompliance.last_audit_date).getTime()
      const daysSinceAudit = auditAge / (1000 * 60 * 60 * 24)
      if (daysSinceAudit < 365) confidence += 15
    }
    if (auditCompliance.audit_score) confidence += 10
  }

  // Safety record consistency bonus
  const criteriaValues = Object.values(criteria)
  const variance = criteriaValues.reduce((sum, val) => {
    const mean = criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / criteriaValues.length

  const consistencyBonus = Math.max(0, 15 - variance * 3)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// POST - Create new Safety 4-Point Assessment
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
    const validatedData = Safety4PointAssessmentSchema.parse(body) as CreateSafety4PointAssessmentPayload

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

    // Calculate overall safety score and confidence
    const overallScore = calculateOverallSafetyScore(
      validatedData.safety_criteria,
      validatedData.safety_metrics,
      validatedData.audit_compliance
    )
    const confidenceLevel = calculateSafetyConfidenceLevel(
      validatedData.safety_criteria,
      validatedData.safety_metrics,
      validatedData.audit_compliance
    )

    // Create the assessment
    const assessmentData = {
      employer_id: validatedData.employer_id,
      assessment_type: 'safety_4_point',
      assessor_id: user.id,
      assessment_date: new Date().toISOString(),
      status: 'submitted',
      safety_criteria: validatedData.safety_criteria,
      safety_metrics: validatedData.safety_metrics,
      audit_compliance: validatedData.audit_compliance || null,
      overall_safety_score: overallScore,
      safety_confidence_level: confidenceLevel,
      notes: validatedData.notes || null,
    }

    const { data: assessment, error } = await supabase
      .from('safety_4_point_assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating Safety 4-Point assessment:', error)
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
    }

    const response: AssessmentResponse<Safety4PointAssessment> = {
      data: assessment,
      success: true,
      message: 'Safety 4-Point assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: confidenceLevel,
        last_updated: assessment.created_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Safety 4-Point assessment POST:', error)

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

// GET - List Safety 4-Point Assessments with filtering
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
      .from('safety_4_point_assessments')
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
      query = query.gte('overall_safety_score', parseInt(minScore))
    }
    if (maxScore) {
      query = query.lte('overall_safety_score', parseInt(maxScore))
    }

    // Apply pagination and ordering
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching Safety 4-Point assessments:', error)
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
    console.error('Error in Safety 4-Point assessment GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
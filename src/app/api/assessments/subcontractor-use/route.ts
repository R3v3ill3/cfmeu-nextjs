import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  CreateSubcontractorUseAssessmentPayload,
  SubcontractorUseAssessment,
  AssessmentResponse,
  FourPointRating,
} from '@/types/assessments'
import { z } from 'zod'

// Validation schema for Subcontractor Use Assessment
const SubcontractorUseAssessmentSchema = z.object({
  employer_id: z.string().uuid(),
  subcontracting_criteria: z.object({
    fair_subcontractor_selection: z.number().min(1).max(4),
    payment_practices: z.number().min(1).max(4),
    work_quality_standards: z.number().min(1).max(4),
    subcontractor_relations: z.number().min(1).max(4),
    contract_fairness: z.number().min(1).max(4),
  }),
  subcontractor_metrics: z.object({
    active_subcontractors: z.number().min(0),
    payment_terms_days: z.number().min(0),
    dispute_count: z.number().min(0),
    repeat_subcontractor_rate: z.number().min(0).max(100),
  }),
  compliance_records: z.object({
    abn_verified: z.boolean().optional(),
    insurance_valid: z.boolean().optional(),
    licences_current: z.boolean().optional(),
    payment_history_clean: z.boolean().optional(),
  }).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate overall subcontractor score
function calculateOverallSubcontractorScore(
  criteria: SubcontractorUseAssessment['subcontracting_criteria'],
  metrics: SubcontractorUseAssessment['subcontractor_metrics'],
  compliance?: SubcontractorUseAssessment['compliance_records']
): FourPointRating {
  // Base score from criteria (60% weight)
  const criteriaValues = Object.values(criteria)
  const criteriaAverage = criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length

  // Metrics score (25% weight)
  let metricsScore = 4 // Start with perfect score

  // Payment practices impact
  if (metrics.payment_terms_days > 60) metricsScore -= 1
  if (metrics.payment_terms_days > 90) metricsScore -= 1

  // Dispute history impact
  if (metrics.dispute_count > 5) metricsScore -= 1
  if (metrics.dispute_count > 10) metricsScore -= 1

  // Repeat business bonus
  if (metrics.repeat_subcontractor_rate > 70) metricsScore += 0.5
  if (metrics.repeat_subcontractor_rate > 85) metricsScore += 0.5

  metricsScore = Math.max(1, Math.min(4, metricsScore))

  // Compliance score (15% weight)
  let complianceScore = 4
  if (compliance) {
    const complianceFields = Object.values(compliance).filter(Boolean).length
    const totalFields = Object.keys(compliance).length
    const complianceRate = complianceFields / totalFields
    complianceScore = 1 + (complianceRate * 3) // Scale from 1-4
  }

  // Weighted average
  const weightedScore = (criteriaAverage * 0.6) + (metricsScore * 0.25) + (complianceScore * 0.15)

  return Math.round(weightedScore) as FourPointRating
}

// Helper function to calculate confidence level
function calculateSubcontractorConfidenceLevel(
  criteria: SubcontractorUseAssessment['subcontracting_criteria'],
  metrics: SubcontractorUseAssessment['subcontractor_metrics'],
  compliance?: SubcontractorUseAssessment['compliance_records']
): number {
  let confidence = 50 // Base confidence

  // Data completeness bonus
  const criteriaCompleteness = Object.values(criteria).filter(val => val >= 1 && val <= 4).length / Object.keys(criteria).length
  confidence += criteriaCompleteness * 20

  // Metrics reliability bonus
  if (metrics.active_subcontractors > 0) confidence += 10
  if (metrics.repeat_subcontractor_rate > 0) confidence += 10
  if (metrics.payment_terms_days > 0) confidence += 5

  // Compliance verification bonus
  if (compliance) {
    const complianceFields = Object.values(compliance).filter(Boolean).length
    const totalFields = Object.keys(compliance).length
    const complianceRate = complianceFields / totalFields
    confidence += complianceRate * 15
  }

  // Criteria consistency bonus
  const criteriaValues = Object.values(criteria)
  const variance = criteriaValues.reduce((sum, val) => {
    const mean = criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / criteriaValues.length

  const consistencyBonus = Math.max(0, 20 - variance * 4)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// POST - Create new Subcontractor Use Assessment
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
    const validatedData = SubcontractorUseAssessmentSchema.parse(body) as CreateSubcontractorUseAssessmentPayload

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

    // Check if employer is a head contractor (subcontractor assessments only apply to head contractors)
    if (employer.employer_type !== 'head_contractor') {
      return NextResponse.json(
        { success: false, message: 'Subcontractor use assessments are only applicable to head contractors' },
        { status: 400 }
      )
    }

    // Calculate overall score and confidence
    const overallScore = calculateOverallSubcontractorScore(
      validatedData.subcontracting_criteria,
      validatedData.subcontractor_metrics,
      validatedData.compliance_records
    )
    const confidenceLevel = calculateSubcontractorConfidenceLevel(
      validatedData.subcontracting_criteria,
      validatedData.subcontractor_metrics,
      validatedData.compliance_records
    )

    // Create the assessment
    const assessmentData = {
      employer_id: validatedData.employer_id,
      assessment_type: 'subcontractor_use',
      assessor_id: user.id,
      assessment_date: new Date().toISOString(),
      status: 'submitted',
      subcontracting_criteria: validatedData.subcontracting_criteria,
      subcontractor_metrics: validatedData.subcontractor_metrics,
      compliance_records: validatedData.compliance_records || null,
      overall_subcontractor_score: overallScore,
      confidence_level: confidenceLevel,
      notes: validatedData.notes || null,
    }

    const { data: assessment, error } = await supabase
      .from('subcontractor_use_assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating Subcontractor Use assessment:', error)
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

    const response: AssessmentResponse<SubcontractorUseAssessment> = {
      data: assessment,
      success: true,
      message: 'Subcontractor Use assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: confidenceLevel,
        last_updated: assessment.created_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Subcontractor Use assessment POST:', error)

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

// GET - List Subcontractor Use Assessments with filtering
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
    const hasDisputes = searchParams.get('has_disputes')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('subcontractor_use_assessments')
      .select(`
        *,
        employers!inner(id, name, abn, employer_type),
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
      query = query.gte('overall_subcontractor_score', parseInt(minScore))
    }
    if (maxScore) {
      query = query.lte('overall_subcontractor_score', parseInt(maxScore))
    }
    if (hasDisputes === 'true') {
      query = query.gt('subcontractor_metrics->>dispute_count', 0)
    } else if (hasDisputes === 'false') {
      query = query.eq('subcontractor_metrics->>dispute_count', 0)
    }

    // Apply pagination and ordering
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching Subcontractor Use assessments:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch assessments', error: error.message },
        { status: 500 }
      )
    }

    // Calculate aggregate statistics
    const stats = await supabase
      .from('subcontractor_use_assessments')
      .select('overall_subcontractor_score, subcontractor_metrics, compliance_records')

    const averageScore = stats.data?.reduce((sum, record) => sum + record.overall_subcontractor_score, 0) / (stats.data?.length || 1)
    const totalDisputes = stats.data?.reduce((sum, record) => sum + (record.subcontractor_metrics?.dispute_count || 0), 0) || 0
    const complianceRate = stats.data?.filter(record => {
      const compliance = record.compliance_records
      return compliance && Object.values(compliance).some(Boolean)
    }).length / (stats.data?.length || 1) * 100

    const response = {
      data: assessments || [],
      success: true,
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      statistics: {
        average_score: Math.round(averageScore * 100) / 100,
        total_disputes: totalDisputes,
        compliance_rate: Math.round(complianceRate),
        total_assessments: stats.data?.length || 0,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Subcontractor Use assessment GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
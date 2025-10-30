import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  SubcontractorUseAssessment,
  AssessmentResponse,
} from '@/types/assessments'
import { z } from 'zod'

const UpdateSubcontractorUseAssessmentSchema = z.object({
  subcontracting_criteria: z.object({
    fair_subcontractor_selection: z.number().min(1).max(4).optional(),
    payment_practices: z.number().min(1).max(4).optional(),
    work_quality_standards: z.number().min(1).max(4).optional(),
    subcontractor_relations: z.number().min(1).max(4).optional(),
    contract_fairness: z.number().min(1).max(4).optional(),
  }).optional(),
  subcontractor_metrics: z.object({
    active_subcontractors: z.number().min(0).optional(),
    payment_terms_days: z.number().min(0).optional(),
    dispute_count: z.number().min(0).optional(),
    repeat_subcontractor_rate: z.number().min(0).max(100).optional(),
  }).optional(),
  compliance_records: z.object({
    abn_verified: z.boolean().optional(),
    insurance_valid: z.boolean().optional(),
    licences_current: z.boolean().optional(),
    payment_history_clean: z.boolean().optional(),
  }).optional(),
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved']).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate overall subcontractor score
function calculateOverallSubcontractorScore(
  criteria: SubcontractorUseAssessment['subcontracting_criteria'],
  metrics: SubcontractorUseAssessment['subcontractor_metrics'],
  compliance?: SubcontractorUseAssessment['compliance_records']
): 1 | 2 | 3 | 4 {
  const criteriaValues = Object.values(criteria)
  const criteriaAverage = criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length

  let metricsScore = 4

  if (metrics.payment_terms_days > 60) metricsScore -= 1
  if (metrics.payment_terms_days > 90) metricsScore -= 1
  if (metrics.dispute_count > 5) metricsScore -= 1
  if (metrics.dispute_count > 10) metricsScore -= 1
  if (metrics.repeat_subcontractor_rate > 70) metricsScore += 0.5
  if (metrics.repeat_subcontractor_rate > 85) metricsScore += 0.5

  metricsScore = Math.max(1, Math.min(4, metricsScore))

  let complianceScore = 4
  if (compliance) {
    const complianceFields = Object.values(compliance).filter(Boolean).length
    const totalFields = Object.keys(compliance).length
    const complianceRate = complianceFields / totalFields
    complianceScore = 1 + (complianceRate * 3)
  }

  const weightedScore = (criteriaAverage * 0.6) + (metricsScore * 0.25) + (complianceScore * 0.15)

  return Math.round(weightedScore) as 1 | 2 | 3 | 4
}

// Helper function to calculate confidence level
function calculateSubcontractorConfidenceLevel(
  criteria: SubcontractorUseAssessment['subcontracting_criteria'],
  metrics: SubcontractorUseAssessment['subcontractor_metrics'],
  compliance?: SubcontractorUseAssessment['compliance_records']
): number {
  let confidence = 50

  const criteriaCompleteness = Object.values(criteria).filter(val => val >= 1 && val <= 4).length / Object.keys(criteria).length
  confidence += criteriaCompleteness * 20

  if (metrics.active_subcontractors > 0) confidence += 10
  if (metrics.repeat_subcontractor_rate > 0) confidence += 10
  if (metrics.payment_terms_days > 0) confidence += 5

  if (compliance) {
    const complianceFields = Object.values(compliance).filter(Boolean).length
    const totalFields = Object.keys(compliance).length
    const complianceRate = complianceFields / totalFields
    confidence += complianceRate * 15
  }

  const criteriaValues = Object.values(criteria)
  const variance = criteriaValues.reduce((sum, val) => {
    const mean = criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / criteriaValues.length

  const consistencyBonus = Math.max(0, 20 - variance * 4)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// GET - Retrieve a specific Subcontractor Use Assessment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const { data: assessment, error } = await supabase
      .from('subcontractor_use_assessments')
      .select(`
        *,
        employers!inner(id, name, abn, employer_type),
        assessors!inner(id, name, email)
      `)
      .eq('id', params.id)
      .single()

    if (error || !assessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Get related subcontractor information if available
    const { data: subcontractorRelationships } = await supabase
      .from('employer_subcontractor_relationships')
      .select(`
        *,
        subcontractor:employers!subcontractor_id(id, name, abn)
      `)
      .eq('head_contractor_id', assessment.employer_id)
      .order('relationship_start_date', { ascending: false })
      .limit(10)

    const response: AssessmentResponse<SubcontractorUseAssessment> = {
      data: {
        ...assessment,
        related_subcontractors: subcontractorRelationships || [],
      },
      success: true,
      metadata: {
        calculation_time: Date.now(),
        confidence_level: assessment.confidence_level,
        last_updated: assessment.updated_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Subcontractor Use assessment GET by ID:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a Subcontractor Use Assessment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Check if assessment exists and user has permission
    const { data: existingAssessment, error: fetchError } = await supabase
      .from('subcontractor_use_assessments')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingAssessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (existingAssessment.assessor_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'organiser'].includes(profile.role)) {
        return NextResponse.json(
          { success: false, message: 'Permission denied' },
          { status: 403 }
        )
      }
    }

    const body = await request.json()
    const validatedData = UpdateSubcontractorUseAssessmentSchema.parse(body)

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...validatedData,
    }

    // Recalculate scores if relevant data changed
    let shouldRecalculate = false

    if (validatedData.subcontracting_criteria) {
      const updatedCriteria = {
        ...(existingAssessment.subcontracting_criteria || {}),
        ...validatedData.subcontracting_criteria,
      }
      updateData.subcontracting_criteria = updatedCriteria
      shouldRecalculate = true
    }

    if (validatedData.subcontractor_metrics) {
      const updatedMetrics = {
        ...(existingAssessment.subcontractor_metrics || {}),
        ...validatedData.subcontractor_metrics,
      }
      updateData.subcontractor_metrics = updatedMetrics
      shouldRecalculate = true
    }

    if (validatedData.compliance_records) {
      const updatedCompliance = {
        ...(existingAssessment.compliance_records || {}),
        ...validatedData.compliance_records,
      }
      updateData.compliance_records = updatedCompliance
      shouldRecalculate = true
    }

    if (shouldRecalculate) {
      const finalCriteria = updateData.subcontracting_criteria || existingAssessment.subcontracting_criteria
      const finalMetrics = updateData.subcontractor_metrics || existingAssessment.subcontractor_metrics
      const finalCompliance = updateData.compliance_records || existingAssessment.compliance_records

      updateData.overall_subcontractor_score = calculateOverallSubcontractorScore(
        finalCriteria,
        finalMetrics,
        finalCompliance
      )
      updateData.confidence_level = calculateSubcontractorConfidenceLevel(
        finalCriteria,
        finalMetrics,
        finalCompliance
      )
    }

    const { data: updatedAssessment, error } = await supabase
      .from('subcontractor_use_assessments')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating Subcontractor Use assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update assessment', error: error.message },
        { status: 500 }
      )
    }

    // Trigger rating calculation if the assessment was updated in a significant way
    if (shouldRecalculate || validatedData.status === 'submitted') {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            employer_id: existingAssessment.employer_id,
            assessment_ids: [params.id],
            trigger_type: 'assessment_updated',
          }),
        })
      } catch (ratingError) {
        console.error('Error triggering rating calculation:', ratingError)
      }
    }

    const response: AssessmentResponse<SubcontractorUseAssessment> = {
      data: updatedAssessment,
      success: true,
      message: 'Subcontractor Use assessment updated successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: updatedAssessment.confidence_level,
        last_updated: updatedAssessment.updated_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Subcontractor Use assessment PUT:', error)

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

// DELETE - Delete a Subcontractor Use Assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    // Check if assessment exists and get employer_id for rating recalculation
    const { data: existingAssessment, error: fetchError } = await supabase
      .from('subcontractor_use_assessments')
      .select('employer_id, assessor_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingAssessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (existingAssessment.assessor_id !== user.id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (!profile || !['admin', 'organiser'].includes(profile.role)) {
        return NextResponse.json(
          { success: false, message: 'Permission denied' },
          { status: 403 }
        )
      }
    }

    // Delete the assessment
    const { error } = await supabase
      .from('subcontractor_use_assessments')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting Subcontractor Use assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to delete assessment', error: error.message },
        { status: 500 }
      )
    }

    // Trigger rating calculation for the employer
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          employer_id: existingAssessment.employer_id,
          trigger_type: 'assessment_deleted',
        }),
      })
    } catch (ratingError) {
      console.error('Error triggering rating calculation:', ratingError)
    }

    return NextResponse.json({
      success: true,
      message: 'Subcontractor Use assessment deleted successfully',
    })
  } catch (error) {
    console.error('Error in Subcontractor Use assessment DELETE:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
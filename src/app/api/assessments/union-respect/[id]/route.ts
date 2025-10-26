import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  UnionRespectAssessment,
  AssessmentResponse,
  CreateUnionRespectAssessmentPayload,
} from '@/types/assessments'
import { z } from 'zod'

const UpdateUnionRespectAssessmentSchema = z.object({
  criteria: z.object({
    union_engagement: z.number().min(1).max(4).optional(),
    communication_respect: z.number().min(1).max(4).optional(),
    collaboration_attitude: z.number().min(1).max(4).optional(),
    dispute_resolution: z.number().min(1).max(4).optional(),
    union_delegate_relations: z.number().min(1).max(4).optional(),
  }).optional(),
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
  status: z.enum(['draft', 'submitted', 'reviewed', 'approved']).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate overall score
function calculateOverallScore(criteria: UnionRespectAssessment['criteria']): 1 | 2 | 3 | 4 {
  const values = Object.values(criteria)
  const average = values.reduce((sum, val) => sum + val, 0) / values.length
  return Math.round(average) as 1 | 2 | 3 | 4
}

// Helper function to calculate confidence level
function calculateConfidenceLevel(
  criteria: UnionRespectAssessment['criteria'],
  evidence?: Partial<UnionRespectAssessment['supporting_evidence']>
): number {
  let confidence = 50 // Base confidence

  if (evidence) {
    const evidenceFields = Object.values(evidence).filter(Boolean).length
    const totalFields = Object.keys(evidence).length
    confidence += (evidenceFields / totalFields) * 30
  }

  const values = Object.values(criteria)
  const variance = values.reduce((sum, val) => {
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / values.length

  const consistencyBonus = Math.max(0, 20 - variance * 5)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// GET - Retrieve a specific Union Respect Assessment
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
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
      .from('union_respect_assessments')
      .select(`
        *,
        employers!inner(id, name, abn),
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

    const response: AssessmentResponse<UnionRespectAssessment> = {
      data: assessment,
      success: true,
      metadata: {
        calculation_time: Date.now(),
        confidence_level: assessment.confidence_level,
        last_updated: assessment.updated_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Union Respect assessment GET by ID:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a Union Respect Assessment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
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
      .from('union_respect_assessments')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingAssessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Check permissions (only assessor or admin can update)
    if (existingAssessment.assessor_id !== user.id) {
      // Check if user is admin
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
    const validatedData = UpdateUnionRespectAssessmentSchema.parse(body)

    // Prepare update data
    const updateData: any = {
      updated_at: new Date().toISOString(),
      ...validatedData,
    }

    // Recalculate overall score and confidence if criteria changed
    if (validatedData.criteria) {
      const updatedCriteria = { ...existingAssessment.criteria, ...validatedData.criteria }
      updateData.criteria = updatedCriteria
      updateData.overall_score = calculateOverallScore(updatedCriteria)
      updateData.confidence_level = calculateConfidenceLevel(
        updatedCriteria,
        validatedData.supporting_evidence || existingAssessment.supporting_evidence
      )
    }

    // Update supporting evidence if provided
    if (validatedData.supporting_evidence) {
      const updatedEvidence = {
        ...(existingAssessment.supporting_evidence || {}),
        ...validatedData.supporting_evidence
      }
      updateData.supporting_evidence = updatedEvidence

      // Recalculate confidence if evidence changed but criteria didn't
      if (!validatedData.criteria) {
        updateData.confidence_level = calculateConfidenceLevel(
          existingAssessment.criteria,
          updatedEvidence
        )
      }
    }

    // Update additional comments if provided
    if (validatedData.additional_comments) {
      const updatedComments = {
        ...(existingAssessment.additional_comments || {}),
        ...validatedData.additional_comments
      }
      updateData.additional_comments = updatedComments
    }

    const { data: updatedAssessment, error } = await supabase
      .from('union_respect_assessments')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating Union Respect assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to update assessment', error: error.message },
        { status: 500 }
      )
    }

    // Trigger rating calculation if the assessment was submitted
    if (validatedData.status === 'submitted' || updatedData.criteria || updatedData.supporting_evidence) {
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

    const response: AssessmentResponse<UnionRespectAssessment> = {
      data: updatedAssessment,
      success: true,
      message: 'Union Respect assessment updated successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: updatedAssessment.confidence_level,
        last_updated: updatedAssessment.updated_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Union Respect assessment PUT:', error)

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

// DELETE - Delete a Union Respect Assessment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient()
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
      .from('union_respect_assessments')
      .select('employer_id, assessor_id')
      .eq('id', params.id)
      .single()

    if (fetchError || !existingAssessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Check permissions (only assessor or admin can delete)
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
      .from('union_respect_assessments')
      .delete()
      .eq('id', params.id)

    if (error) {
      console.error('Error deleting Union Respect assessment:', error)
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
      message: 'Union Respect assessment deleted successfully',
    })
  } catch (error) {
    console.error('Error in Union Respect assessment DELETE:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
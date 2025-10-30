import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import {
  CreateUnionRespectAssessmentPayload,
  BulkAssessmentOperation,
  AssessmentResponse,
  UnionRespectAssessment,
} from '@/types/assessments'
import { z } from 'zod'

// Bulk operation validation schema
const BulkUnionRespectAssessmentSchema = z.object({
  operation: z.enum(['create', 'update', 'calculate']),
  employer_ids: z.array(z.string().uuid()).min(1).max(50), // Limit to 50 at a time
  payload: z.object({
    criteria: z.object({
      union_engagement: z.number().min(1).max(4).optional(),
      communication_respect: z.number().min(1).max(4).optional(),
      collaboration_attitude: z.number().min(1).max(4).optional(),
      dispute_resolution: z.number().min(1).max(4).optional(),
      union_delegate_relations: z.number().min(1).max(4).optional(),
    }).optional(),
    additional_comments: z.record(z.string().optional()).optional(),
    supporting_evidence: z.record(z.boolean().optional()).optional(),
    status: z.enum(['draft', 'submitted', 'reviewed', 'approved']).optional(),
    notes: z.string().optional(),
  }).optional(),
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
  let confidence = 50

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

// POST - Bulk operations for Union Respect Assessments
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

    // Check if user has admin or organiser role for bulk operations
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'organiser'].includes(profile.role)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions for bulk operations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = BulkUnionRespectAssessmentSchema.parse(body)

    const results = {
      successful: [] as any[],
      failed: [] as { employer_id: string; error: string }[],
      total_processed: 0,
      operation: validatedData.operation,
    }

    switch (validatedData.operation) {
      case 'create':
        await handleBulkCreate(supabase, validatedData, results, user.id)
        break
      case 'update':
        await handleBulkUpdate(supabase, validatedData, results, user.id)
        break
      case 'calculate':
        await handleBulkCalculate(supabase, validatedData, results)
        break
    }

    const processingTime = Date.now() - startTime

    // Trigger bulk rating calculation for affected employers
    const affectedEmployerIds = results.successful.map(r => r.employer_id)
    if (affectedEmployerIds.length > 0) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/bulk-calculate-4-point`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          },
          body: JSON.stringify({
            employer_ids: affectedEmployerIds,
            trigger_type: 'bulk_assessment_operation',
          }),
        })
      } catch (ratingError) {
        console.error('Error triggering bulk rating calculation:', ratingError)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Bulk ${validatedData.operation} completed`,
      data: results,
      metadata: {
        processing_time_ms: processingTime,
        operation_count: results.total_processed,
        success_rate: results.total_processed > 0 ? (results.successful.length / results.total_processed) * 100 : 0,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in bulk Union Respect assessment operation:', error)

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

async function handleBulkCreate(
  supabase: any,
  data: any,
  results: any,
  userId: string
) {
  if (!data.payload || !data.payload.criteria) {
    throw new Error('Criteria are required for bulk create operations')
  }

  for (const employerId of data.employer_ids) {
    try {
      results.total_processed++

      // Check if employer exists
      const { data: employer, error: employerError } = await supabase
        .from('employers')
        .select('id, name')
        .eq('id', employerId)
        .single()

      if (employerError || !employer) {
        results.failed.push({
          employer_id: employerId,
          error: 'Employer not found',
        })
        continue
      }

      // Calculate scores
      const overallScore = calculateOverallScore(data.payload.criteria)
      const confidenceLevel = calculateConfidenceLevel(
        data.payload.criteria,
        data.payload.supporting_evidence
      )

      // Create assessment
      const assessmentData = {
        employer_id: employerId,
        assessment_type: 'union_respect',
        assessor_id: userId,
        assessment_date: new Date().toISOString(),
        status: data.payload.status || 'submitted',
        criteria: data.payload.criteria,
        additional_comments: data.payload.additional_comments || null,
        supporting_evidence: data.payload.supporting_evidence || null,
        overall_score: overallScore,
        confidence_level: confidenceLevel,
        notes: data.payload.notes || null,
      }

      const { data: assessment, error } = await supabase
        .from('union_respect_assessments')
        .insert(assessmentData)
        .select()
        .single()

      if (error) {
        results.failed.push({
          employer_id: employerId,
          error: error.message,
        })
      } else {
        results.successful.push({
          employer_id: employerId,
          assessment_id: assessment.id,
          overall_score: assessment.overall_score,
          confidence_level: assessment.confidence_level,
        })
      }
    } catch (error) {
      results.failed.push({
        employer_id: employerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

async function handleBulkUpdate(
  supabase: any,
  data: any,
  results: any,
  userId: string
) {
  if (!data.payload) {
    throw new Error('Payload is required for bulk update operations')
  }

  for (const employerId of data.employer_ids) {
    try {
      results.total_processed++

      // Find existing assessment
      const { data: existingAssessment, error: fetchError } = await supabase
        .from('union_respect_assessments')
        .select('*')
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !existingAssessment) {
        results.failed.push({
          employer_id: employerId,
          error: 'No existing assessment found for this employer',
        })
        continue
      }

      // Prepare update data
      const updateData: any = {
        updated_at: new Date().toISOString(),
        ...data.payload,
      }

      // Recalculate scores if criteria changed
      if (data.payload.criteria) {
        const updatedCriteria = {
          ...(existingAssessment.criteria || {}),
          ...data.payload.criteria,
        }
        updateData.criteria = updatedCriteria
        updateData.overall_score = calculateOverallScore(updatedCriteria)
        updateData.confidence_level = calculateConfidenceLevel(
          updatedCriteria,
          data.payload.supporting_evidence || existingAssessment.supporting_evidence
        )
      }

      // Update the assessment
      const { data: updatedAssessment, error } = await supabase
        .from('union_respect_assessments')
        .update(updateData)
        .eq('id', existingAssessment.id)
        .select()
        .single()

      if (error) {
        results.failed.push({
          employer_id: employerId,
          error: error.message,
        })
      } else {
        results.successful.push({
          employer_id: employerId,
          assessment_id: updatedAssessment.id,
          overall_score: updatedAssessment.overall_score,
          confidence_level: updatedAssessment.confidence_level,
        })
      }
    } catch (error) {
      results.failed.push({
        employer_id: employerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}

async function handleBulkCalculate(
  supabase: any,
  data: any,
  results: any
) {
  for (const employerId of data.employer_ids) {
    try {
      results.total_processed++

      // Get latest assessment for each employer
      const { data: assessment, error: fetchError } = await supabase
        .from('union_respect_assessments')
        .select('*')
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(1)
        .single()

      if (fetchError || !assessment) {
        results.failed.push({
          employer_id: employerId,
          error: 'No assessment found for this employer',
        })
        continue
      }

      // Recalculate scores
      const updatedScore = calculateOverallScore(assessment.criteria)
      const updatedConfidence = calculateConfidenceLevel(
        assessment.criteria,
        assessment.supporting_evidence
      )

      // Update assessment with recalculated scores
      const { data: updatedAssessment, error } = await supabase
        .from('union_respect_assessments')
        .update({
          overall_score: updatedScore,
          confidence_level: updatedConfidence,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assessment.id)
        .select()
        .single()

      if (error) {
        results.failed.push({
          employer_id: employerId,
          error: error.message,
        })
      } else {
        results.successful.push({
          employer_id: employerId,
          assessment_id: updatedAssessment.id,
          previous_score: assessment.overall_score,
          new_score: updatedScore,
          previous_confidence: assessment.confidence_level,
          new_confidence: updatedConfidence,
        })
      }
    } catch (error) {
      results.failed.push({
        employer_id: employerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }
}
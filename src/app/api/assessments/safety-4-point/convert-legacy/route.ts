import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  LegacyDataConversion,
  Safety4PointAssessment,
  FourPointRating,
} from '@/types/assessments'
import { z } from 'zod'

// Schema for legacy data conversion
const LegacySafetyConversionSchema = z.object({
  employer_id: z.string().uuid(),
  legacy_assessment_id: z.string().uuid(),
  legacy_score: z.number().min(0).max(100),
  conversion_method: z.enum(['linear', 'quartile', 'custom']).default('linear'),
  legacy_safety_metrics: z.object({
    lost_time_injuries: z.number().min(0),
    near_misses: z.number().min(0),
    safety_breaches: z.number().min(0),
    safety_improvements: z.number().min(0),
    training_hours: z.number().min(0),
  }).optional(),
  legacy_audit_data: z.object({
    last_audit_date: z.string().optional(),
    audit_score: z.number().min(0).max(100).optional(),
    outstanding_actions: z.number().min(0),
    critical_risks_identified: z.number().min(0),
  }).optional(),
  conversion_notes: z.string().optional(),
})

// Helper functions for conversion
function convertLegacyScoreToFourPoint(
  legacyScore: number,
  method: 'linear' | 'quartile' | 'custom' = 'linear'
): { rating: FourPointRating; confidence: number } {
  switch (method) {
    case 'linear':
      if (legacyScore < 25) return { rating: 1, confidence: 80 }
      if (legacyScore < 50) return { rating: 2, confidence: 85 }
      if (legacyScore < 75) return { rating: 3, confidence: 90 }
      return { rating: 4, confidence: 95 }

    case 'quartile':
      // For quartile method, we would need historical data
      // For now, using a more sophisticated linear conversion
      const normalizedScore = Math.min(100, Math.max(0, legacyScore))

      if (normalizedScore < 20) return { rating: 1, confidence: 75 }
      if (normalizedScore < 40) return { rating: 2, confidence: 80 }
      if (normalizedScore < 70) return { rating: 3, confidence: 85 }
      return { rating: 4, confidence: 95 }

    case 'custom':
      // Custom conversion based on CFMEU specific criteria
      if (legacyScore < 30) return { rating: 1, confidence: 70 }
      if (legacyScore < 55) return { rating: 2, confidence: 75 }
      if (legacyScore < 80) return { rating: 3, confidence: 85 }
      return { rating: 4, confidence: 95 }

    default:
      return convertLegacyScoreToFourPoint(legacyScore, 'linear')
  }
}

function estimateSafetyCriteriaFromLegacyScore(
  legacyScore: number,
  metrics?: any,
  auditData?: any
): Safety4PointAssessment['safety_criteria'] {
  const baseRating = convertLegacyScoreToFourPoint(legacyScore).rating

  // Adjust criteria based on metrics and audit data if available
  let adjustments = 0
  if (metrics) {
    if (metrics.lost_time_injuries === 0) adjustments += 0.5
    if (metrics.safety_improvements > 5) adjustments += 0.3
    if (metrics.training_hours > 20) adjustments += 0.2
  }

  if (auditData?.audit_score) {
    const auditRating = convertLegacyScoreToFourPoint(auditData.audit_score).rating
    adjustments += (auditRating - baseRating) * 0.3
  }

  const finalRating = Math.max(1, Math.min(4, baseRating + adjustments))

  return {
    safety_management_systems: Math.round(finalRating) as FourPointRating,
    incident_reporting: Math.round(finalRating) as FourPointRating,
    site_safety_culture: Math.round(finalRating) as FourPointRating,
    risk_assessment_processes: Math.round(finalRating) as FourPointRating,
    emergency_preparedness: Math.round(finalRating) as FourPointRating,
    worker_safety_training: Math.round(finalRating) as FourPointRating,
  }
}

function convertLegacyAuditData(
  legacyAuditData?: any
): Safety4PointAssessment['audit_compliance'] | null {
  if (!legacyAuditData) return null

  const auditScore = legacyAuditData.audit_score
    ? convertLegacyScoreToFourPoint(legacyAuditData.audit_score).rating
    : undefined

  return {
    last_audit_date: legacyAuditData.last_audit_date,
    audit_score: auditScore,
    outstanding_actions: legacyAuditData.outstanding_actions || 0,
    critical_risks_identified: legacyAuditData.critical_risks_identified || 0,
  }
}

// POST - Convert legacy safety assessments to 4-point scale
export async function POST(request: NextRequest) {
  const startTime = Date.now()

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

    // Check if user has admin or organiser role for data conversion
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'organiser'].includes(profile.role)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions for legacy data conversion' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = LegacySafetyConversionSchema.parse(body)

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

    // Check if legacy assessment exists
    const { data: legacyAssessment, error: legacyError } = await supabase
      .from('safety_assessments') // Assuming legacy table exists
      .select('*')
      .eq('id', validatedData.legacy_assessment_id)
      .single()

    if (legacyError || !legacyAssessment) {
      return NextResponse.json(
        { success: false, message: 'Legacy assessment not found' },
        { status: 404 }
      )
    }

    // Perform the conversion
    const conversionResult = convertLegacyScoreToFourPoint(
      validatedData.legacy_score,
      validatedData.conversion_method
    )

    const estimatedCriteria = estimateSafetyCriteriaFromLegacyScore(
      validatedData.legacy_score,
      validatedData.legacy_safety_metrics,
      validatedData.legacy_audit_data
    )

    const convertedAuditData = convertLegacyAuditData(validatedData.legacy_audit_data)

    // Calculate overall safety score and confidence
    const overallSafetyScore = Math.round(conversionResult.rating) as FourPointRating
    const safetyConfidenceLevel = Math.round(
      conversionResult.confidence * 0.9 // Reduce confidence slightly for converted data
    )

    // Create the new 4-point assessment
    const assessmentData = {
      employer_id: validatedData.employer_id,
      assessment_type: 'safety_4_point',
      assessor_id: user.id,
      assessment_date: legacyAssessment.created_at || new Date().toISOString(),
      status: 'approved', // Legacy assessments are pre-approved
      safety_criteria: estimatedCriteria,
      safety_metrics: validatedData.legacy_safety_metrics || {
        lost_time_injuries: 0,
        near_misses: 0,
        safety_breaches: 0,
        safety_improvements: 0,
        training_hours: 0,
      },
      audit_compliance: convertedAuditData,
      overall_safety_score: overallSafetyScore,
      safety_confidence_level: safetyConfidenceLevel,
      notes: `Converted from legacy assessment (ID: ${validatedData.legacy_assessment_id}). ${validatedData.conversion_notes || ''}`,
      metadata: {
        conversion: {
          legacy_assessment_id: validatedData.legacy_assessment_id,
          legacy_score: validatedData.legacy_score,
          conversion_method: validatedData.conversion_method,
          conversion_date: new Date().toISOString(),
          converted_by: user.id,
        }
      }
    }

    const { data: newAssessment, error: insertError } = await supabase
      .from('safety_4_point_assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating converted Safety 4-Point assessment:', insertError)
      return NextResponse.json(
        { success: false, message: 'Failed to create converted assessment', error: insertError.message },
        { status: 500 }
      )
    }

    // Create conversion record for audit trail
    const conversionRecord: LegacyDataConversion = {
      legacy_score: validatedData.legacy_score,
      converted_four_point_rating: overallSafetyScore,
      conversion_confidence: safetyConfidenceLevel,
      conversion_method: validatedData.conversion_method,
      legacy_assessment_type: 'safety_assessment',
      new_assessment_type: 'safety_4_point',
      conversion_date: new Date().toISOString(),
      converted_by: user.id,
    }

    await supabase
      .from('legacy_data_conversions')
      .insert({
        employer_id: validatedData.employer_id,
        legacy_assessment_id: validatedData.legacy_assessment_id,
        new_assessment_id: newAssessment.id,
        conversion_data: conversionRecord,
        created_by: user.id,
      })

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
          assessment_ids: [newAssessment.id],
          trigger_type: 'legacy_conversion',
        }),
      })
    } catch (ratingError) {
      console.error('Error triggering rating calculation:', ratingError)
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Legacy safety assessment converted successfully',
      data: {
        legacy_assessment_id: validatedData.legacy_assessment_id,
        new_assessment_id: newAssessment.id,
        conversion_result: conversionRecord,
        new_assessment: newAssessment,
      },
      metadata: {
        processing_time_ms: processingTime,
        conversion_confidence: safetyConfidenceLevel,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in legacy safety assessment conversion:', error)

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

// GET - Get conversion statistics and audit trail
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const employerId = searchParams.get('employer_id')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('legacy_data_conversions')
      .select(`
        *,
        employers!inner(id, name),
        converter:profiles!inner(id, name, email)
      `, { count: 'exact' })
      .eq('new_assessment_type', 'safety_4_point')

    if (employerId) {
      query = query.eq('employer_id', employerId)
    }

    const { data: conversions, error, count } = await query
      .order('conversion_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching conversion records:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch conversion records', error: error.message },
        { status: 500 }
      )
    }

    // Calculate conversion statistics
    const stats = await supabase
      .from('legacy_data_conversions')
      .select('conversion_data')
      .eq('new_assessment_type', 'safety_4_point')

    const totalConversions = stats.data?.length || 0
    const averageConfidence = stats.data?.reduce((sum, record) => {
      const confidence = record.conversion_data?.conversion_confidence || 0
      return sum + confidence
    }, 0) / Math.max(1, totalConversions)

    const distribution = stats.data?.reduce((acc, record) => {
      const rating = record.conversion_data?.converted_four_point_rating || 0
      acc[rating] = (acc[rating] || 0) + 1
      return acc
    }, {} as Record<number, number>) || {}

    return NextResponse.json({
      success: true,
      data: conversions || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
      statistics: {
        total_conversions: totalConversions,
        average_confidence: Math.round(averageConfidence),
        rating_distribution: distribution,
        conversion_methods: ['linear', 'quartile', 'custom'],
      },
    })
  } catch (error) {
    console.error('Error in conversion statistics GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
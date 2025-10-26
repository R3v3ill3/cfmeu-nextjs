import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  CreateRoleSpecificAssessmentPayload,
  RoleSpecificAssessment,
  AssessmentResponse,
  FourPointRating,
  EmployerRole,
} from '@/types/assessments'
import { z } from 'zod'

// Validation schema for Role-Specific Assessment
const RoleSpecificAssessmentSchema = z.object({
  employer_id: z.string().uuid(),
  employer_role: z.enum(['head_contractor', 'subcontractor', 'trade_contractor', 'labour_hire', 'consultant', 'other']),
  role_criteria: z.object({
    industry_reputation: z.number().min(1).max(4),
    work_quality: z.number().min(1).max(4),
    reliability: z.number().min(1).max(4),
    financial_stability: z.number().min(1).max(4),
    expertise_level: z.number().min(1).max(4),
  }),
  role_specific_metrics: z.object({
    years_in_industry: z.number().min(0),
    project_success_rate: z.number().min(0).max(100),
    staff_retention_rate: z.number().min(0).max(100),
    average_project_size: z.number().min(0),
  }),
  certifications: z.object({
    industry_certifications: z.array(z.string()).optional(),
    quality_assurance_cert: z.boolean().optional(),
    environmental_cert: z.boolean().optional(),
    safety_certifications: z.array(z.string()).optional(),
  }).optional(),
  notes: z.string().optional(),
})

// Helper function to calculate role-based weighting
function getRoleWeightings(role: EmployerRole): Record<string, number> {
  const baseWeights = {
    industry_reputation: 0.2,
    work_quality: 0.25,
    reliability: 0.2,
    financial_stability: 0.15,
    expertise_level: 0.2,
  }

  switch (role) {
    case 'head_contractor':
      return {
        ...baseWeights,
        financial_stability: 0.25, // Higher weight for financial stability
        reliability: 0.25, // Critical for head contractors
        industry_reputation: 0.15,
      }

    case 'subcontractor':
      return {
        ...baseWeights,
        work_quality: 0.3, // Quality is most important
        reliability: 0.25,
        financial_stability: 0.1, // Less critical than head contractors
        expertise_level: 0.15,
      }

    case 'trade_contractor':
      return {
        ...baseWeights,
        expertise_level: 0.3, // Technical expertise is key
        work_quality: 0.3,
        reliability: 0.2,
        financial_stability: 0.1,
        industry_reputation: 0.1,
      }

    case 'labour_hire':
      return {
        ...baseWeights,
        reliability: 0.3, // Reliability is crucial
        industry_reputation: 0.25,
        work_quality: 0.2,
        expertise_level: 0.15,
        financial_stability: 0.1,
      }

    case 'consultant':
      return {
        ...baseWeights,
        expertise_level: 0.35, // Expertise is paramount
        industry_reputation: 0.3,
        work_quality: 0.2,
        reliability: 0.1,
        financial_stability: 0.05,
      }

    case 'other':
    default:
      return baseWeights
  }
}

// Helper function to calculate overall role score
function calculateOverallRoleScore(
  criteria: RoleSpecificAssessment['role_criteria'],
  metrics: RoleSpecificAssessment['role_specific_metrics'],
  certifications: RoleSpecificAssessment['certifications'],
  role: EmployerRole
): FourPointRating {
  // Get role-specific weights
  const weights = getRoleWeightings(role)

  // Calculate weighted criteria score
  const criteriaScore = Object.entries(criteria).reduce((sum, [key, value]) => {
    return sum + (value * (weights[key] || 0.2))
  }, 0)

  // Metrics adjustment (±0.3 max)
  let metricsAdjustment = 0
  if (metrics.project_success_rate > 90) metricsAdjustment += 0.1
  if (metrics.project_success_rate > 95) metricsAdjustment += 0.1
  if (metrics.staff_retention_rate > 80) metricsAdjustment += 0.05
  if (metrics.staff_retention_rate > 90) metricsAdjustment += 0.05
  if (metrics.years_in_industry > 10) metricsAdjustment += 0.05
  if (metrics.years_in_industry > 20) metricsAdjustment += 0.05

  // Certification bonus (±0.2 max)
  let certificationBonus = 0
  if (certifications) {
    if (certifications.quality_assurance_cert) certificationBonus += 0.1
    if (certifications.environmental_cert) certificationBonus += 0.05
    if (certifications.industry_certifications?.length) certificationBonus += 0.05
    if (certifications.safety_certifications?.length) certificationBonus += 0.05
  }

  // Final score
  const finalScore = criteriaScore + metricsAdjustment + certificationBonus

  return Math.max(1, Math.min(4, Math.round(finalScore))) as FourPointRating
}

// Helper function to calculate role confidence level
function calculateRoleConfidenceLevel(
  criteria: RoleSpecificAssessment['role_criteria'],
  metrics: RoleSpecificAssessment['role_specific_metrics'],
  certifications: RoleSpecificAssessment['certifications']
): number {
  let confidence = 50 // Base confidence

  // Criteria completeness
  const criteriaCompleteness = Object.values(criteria).filter(val => val >= 1 && val <= 4).length / Object.keys(criteria).length
  confidence += criteriaCompleteness * 20

  // Metrics availability
  const metricsProvided = Object.values(metrics).filter(val => val !== undefined && val !== null).length
  const metricsCompleteness = metricsProvided / Object.keys(metrics).length
  confidence += metricsCompleteness * 15

  // Certification verification
  if (certifications) {
    const certFields = [
      certifications.quality_assurance_cert,
      certifications.environmental_cert,
      certifications.industry_certifications?.length,
      certifications.safety_certifications?.length,
    ].filter(Boolean).length
    confidence += certFields * 5
  }

  // Data consistency
  const criteriaValues = Object.values(criteria)
  const variance = criteriaValues.reduce((sum, val) => {
    const mean = criteriaValues.reduce((s, v) => s + v, 0) / criteriaValues.length
    return sum + Math.pow(val - mean, 2)
  }, 0) / criteriaValues.length

  const consistencyBonus = Math.max(0, 15 - variance * 3)
  confidence += consistencyBonus

  return Math.min(100, Math.round(confidence))
}

// POST - Create new Role-Specific Assessment
export async function POST(request: NextRequest) {
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

    const body = await request.json()
    const validatedData = RoleSpecificAssessmentSchema.parse(body) as CreateRoleSpecificAssessmentPayload

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

    // Validate role compatibility with employer type
    if (employer.employer_type && !isRoleCompatible(employer.employer_type, validatedData.employer_role)) {
      return NextResponse.json(
        {
          success: false,
          message: `Role '${validatedData.employer_role}' is not compatible with employer type '${employer.employer_type}'`
        },
        { status: 400 }
      )
    }

    // Calculate overall score and confidence
    const overallScore = calculateOverallRoleScore(
      validatedData.role_criteria,
      validatedData.role_specific_metrics,
      validatedData.certifications || {},
      validatedData.employer_role
    )
    const confidenceLevel = calculateRoleConfidenceLevel(
      validatedData.role_criteria,
      validatedData.role_specific_metrics,
      validatedData.certifications
    )

    // Create the assessment
    const assessmentData = {
      employer_id: validatedData.employer_id,
      assessment_type: 'role_specific',
      employer_role: validatedData.employer_role,
      assessor_id: user.id,
      assessment_date: new Date().toISOString(),
      status: 'submitted',
      role_criteria: validatedData.role_criteria,
      role_specific_metrics: validatedData.role_specific_metrics,
      certifications: validatedData.certifications || null,
      overall_role_score: overallScore,
      role_confidence_level: confidenceLevel,
      notes: validatedData.notes || null,
    }

    const { data: assessment, error } = await supabase
      .from('role_specific_assessments')
      .insert(assessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating Role-Specific assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create assessment', error: error.message },
        { status: 500 }
      )
    }

    // Update employer's role if this is the first role-specific assessment
    if (!employer.employer_type) {
      await supabase
        .from('employers')
        .update({
          employer_type: validatedData.employer_role,
          updated_at: new Date().toISOString(),
        })
        .eq('id', validatedData.employer_id)
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

    const response: AssessmentResponse<RoleSpecificAssessment> = {
      data: assessment,
      success: true,
      message: 'Role-Specific assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        confidence_level: confidenceLevel,
        last_updated: assessment.created_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Role-Specific assessment POST:', error)

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

// GET - List Role-Specific Assessments with filtering
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
    const employerRole = searchParams.get('employer_role')
    const assessorId = searchParams.get('assessor_id')
    const status = searchParams.get('status')
    const minScore = searchParams.get('min_score')
    const maxScore = searchParams.get('max_score')
    const hasCertifications = searchParams.get('has_certifications')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('role_specific_assessments')
      .select(`
        *,
        employers!inner(id, name, abn, employer_type),
        assessors!inner(id, name, email)
      `, { count: 'exact' })

    // Apply filters
    if (employerId) {
      query = query.eq('employer_id', employerId)
    }
    if (employerRole) {
      query = query.eq('employer_role', employerRole)
    }
    if (assessorId) {
      query = query.eq('assessor_id', assessorId)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (minScore) {
      query = query.gte('overall_role_score', parseInt(minScore))
    }
    if (maxScore) {
      query = query.lte('overall_role_score', parseInt(maxScore))
    }
    if (hasCertifications === 'true') {
      query = query.not('certifications', 'is', null)
    } else if (hasCertifications === 'false') {
      query = query.is('certifications', null)
    }

    // Apply pagination and ordering
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching Role-Specific assessments:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to fetch assessments', error: error.message },
        { status: 500 }
      )
    }

    // Calculate role distribution statistics
    const stats = await supabase
      .from('role_specific_assessments')
      .select('employer_role, overall_role_score, role_confidence_level')

    const roleDistribution = stats.data?.reduce((acc, record) => {
      acc[record.employer_role] = (acc[record.employer_role] || 0) + 1
      return acc
    }, {} as Record<string, number>) || {}

    const averageScore = stats.data?.reduce((sum, record) => sum + record.overall_role_score, 0) / (stats.data?.length || 1)
    const averageConfidence = stats.data?.reduce((sum, record) => sum + record.role_confidence_level, 0) / (stats.data?.length || 1)

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
        role_distribution: roleDistribution,
        average_score: Math.round(averageScore * 100) / 100,
        average_confidence: Math.round(averageConfidence),
        total_assessments: stats.data?.length || 0,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Role-Specific assessment GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Helper function to validate role compatibility
function isRoleCompatible(employerType: string, role: EmployerRole): boolean {
  const compatibilityMap: Record<string, EmployerRole[]> = {
    'head_contractor': ['head_contractor'],
    'subcontractor': ['subcontractor', 'trade_contractor'],
    'trade_contractor': ['trade_contractor', 'subcontractor'],
    'labour_hire': ['labour_hire'],
    'consultant': ['consultant'],
  }

  return compatibilityMap[employerType]?.includes(role) || role === 'other'
}
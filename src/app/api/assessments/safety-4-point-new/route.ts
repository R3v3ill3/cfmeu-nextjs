import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withValidation, validateQueryParams } from '@/lib/validation/middleware'
import { schemas, commonSchemas } from '@/lib/validation/schemas'
import { businessValidation } from '@/lib/validation/middleware'

/**
 * POST /api/assessments/safety-4-point-new
 * Create a new safety assessment with comprehensive validation and business logic checks
 */
export const POST = withValidation(
  async (request, { data, user }) => {
    const supabase = await createServerSupabase()

    // Validate employer exists and user has access
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name, abn, status')
      .eq('id', data.employer_id)
      .single()

    if (employerError || !employer) {
      return NextResponse.json({
        success: false,
        error: 'Employer not found',
        hint: 'Please verify the employer ID and try again'
      }, { status: 404 })
    }

    // Check if employer is active
    if (employer.status !== 'active') {
      return NextResponse.json({
        success: false,
        error: 'Cannot create assessment for inactive employer',
        details: { employerId: employer.id, status: employer.status },
        hint: 'Contact administrator to activate this employer'
      }, { status: 409 })
    }

    // Validate project exists and is in appropriate stage (if provided)
    if (data.project_id) {
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('id, name, stage, status')
        .eq('id', data.project_id)
        .single()

      if (projectError || !project) {
        return NextResponse.json({
          success: false,
          error: 'Project not found',
          hint: 'Please verify the project ID or remove it from the assessment'
        }, { status: 404 })
      }

      // Business logic: Safety assessments should only be done for active construction projects
      if (project.stage !== 'construction') {
        return NextResponse.json({
          success: false,
          error: 'Safety assessments are typically only for active construction projects',
          details: { projectStage: project.stage, projectId: project.id },
          hint: 'Consider whether this assessment is appropriate for a project in stage: ' + project.stage
        }, { status: 400 })
      }
    }

    // Business logic validation for assessment criteria
    const criteriaValidation = validateSafetyAssessmentCriteria(data.criteria)
    if (!criteriaValidation.valid) {
      return NextResponse.json({
        success: false,
        error: criteriaValidation.error,
        details: criteriaValidation.details,
        hint: criteriaValidation.hint
      }, { status: 400 })
    }

    // Calculate overall rating (average of 3 criteria)
    const criteriaValues = Object.values(data.criteria)
    const overallRating = Math.round(criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length)

    // Validate follow-up date logic
    if (data.follow_up_required && !data.follow_up_date) {
      return NextResponse.json({
        success: false,
        error: 'Follow-up date is required when follow-up is marked as required',
        field: 'follow_up_date',
        hint: 'Please specify a follow-up date or uncheck the follow-up required box'
      }, { status: 400 })
    }

    if (data.follow_up_date && new Date(data.follow_up_date) <= new Date()) {
      return NextResponse.json({
        success: false,
        error: 'Follow-up date must be in the future',
        field: 'follow_up_date',
        hint: 'Please select a future date for the follow-up'
      }, { status: 400 })
    }

    // Create the assessment using the new 4-point schema
    const assessmentData = {
      employer_id: data.employer_id,
      project_id: data.project_id || null,
      assessor_id: user.id,
      assessment_date: new Date().toISOString().split('T')[0],
      site_safety_rating: data.criteria.site_safety,
      safety_procedures_rating: data.criteria.safety_procedures,
      incident_reporting_rating: data.criteria.incident_reporting,
      overall_safety_rating: overallRating,
      confidence_level: data.confidence_level,
      assessment_method: data.assessment_method,
      notes: data.notes || null,
      evidence_urls: data.evidence_urls || [],
      follow_up_required: data.follow_up_required,
      follow_up_date: data.follow_up_date,
    }

    const { data: assessment, error } = await supabase
      .from('safety_assessments_4point')
      .insert(assessmentData)
      .select(`
        *,
        employers!inner(id, name, abn),
        profiles!inner(id, full_name, email)
      `)
      .single()

    if (error) {
      console.error('Error creating Safety assessment:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to create assessment',
        details: error.message,
        hint: 'Please check your data and try again'
      }, { status: 500 })
    }

    // Trigger rating calculation for this employer (async)
    triggerRatingCalculation(data.employer_id, data.project_id).catch(error => {
      console.error('Error triggering rating calculation:', error)
      // Don't fail the request if rating calculation fails
    })

    return NextResponse.json({
      success: true,
      data: assessment,
      message: 'Safety assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        overall_rating: overallRating,
        confidence_level: data.confidence_level,
        assessment_interpretation: getRatingInterpretation(overallRating),
        created_at: assessment.created_at,
        employer_name: employer.name,
        project_name: data.project_id ? 'Linked Project' : 'General Assessment'
      }
    })
  },
  schemas.assessment.safetyAssessment,
  {
    requireAuth: true,
    requiredRoles: ['admin', 'lead_organiser', 'organiser', 'delegate'],
    returnValidationErrors: process.env.NODE_ENV === 'development'
  }
)

/**
 * GET /api/assessments/safety-4-point-new
 * List safety assessments with comprehensive filtering and validation
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)

    // Validate query parameters
    const queryValidation = validateQueryParams(searchParams, schemas.assessment.assessmentSearch, {
      returnValidationErrors: process.env.NODE_ENV === 'development'
    })

    if (!queryValidation.success) {
      return NextResponse.json({
        success: false,
        error: queryValidation.error,
        field: queryValidation.field,
        hint: 'Please check your search parameters'
      }, { status: 400 })
    }

    const params = queryValidation.data!

    // Check authentication and get user with patch restrictions
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({
        success: false,
        error: 'Authentication required'
      }, { status: 401 })
    }

    // Get user profile with role and patch assignments
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, organiser_patch_assignments!inner(patch_id)')
      .eq('id', user.id)

    if (profileError || !profile) {
      return NextResponse.json({
        success: false,
        error: 'User profile not found'
      }, { status: 404 })
    }

    // Build base query
    let query = supabase
      .from('safety_assessments_4point')
      .select(`
        *,
        employers!inner(id, name, abn),
        profiles!inner(id, full_name, email),
        projects!left_outer(id, name, stage)
      `, { count: 'exact' })

    // Apply role-based data filtering
    if (profile[0].role !== 'admin') {
      const userPatchIds = profile.map(p => p.organiser_patch_assignments.patch_id)

      // Filter assessments to only include employers/projects in user's patches
      query = query.or(`employers.patch_id.in.(${userPatchIds.join(',')}),projects.patch_id.in.(${userPatchIds.join(',')})`)
    }

    // Apply filters with validation
    if (params.employerId) {
      query = query.eq('employer_id', params.employerId)
    }
    if (params.projectId) {
      query = query.eq('project_id', params.projectId)
    }
    if (params.assessorId) {
      query = query.eq('assessor_id', params.assessorId)
    }
    if (params.confidenceLevel) {
      query = query.eq('confidence_level', params.confidenceLevel)
    }
    if (params.assessmentMethod) {
      query = query.eq('assessment_method', params.assessmentMethod)
    }
    if (params.minRating !== undefined) {
      query = query.gte('overall_safety_rating', params.minRating)
    }
    if (params.maxRating !== undefined) {
      query = query.lte('overall_safety_rating', params.maxRating)
    }
    if (params.followUpRequired !== undefined) {
      query = query.eq('follow_up_required', params.followUpRequired)
    }
    if (params.dateFrom) {
      query = query.gte('assessment_date', params.dateFrom)
    }
    if (params.dateTo) {
      query = query.lte('assessment_date', params.dateTo)
    }

    // Apply pagination and ordering
    const offset = (params.page - 1) * params.pageSize
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + params.pageSize - 1)

    if (error) {
      console.error('Error fetching Safety assessments:', error)
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch assessments',
        details: error.message
      }, { status: 500 })
    }

    // Enrich data with rating interpretations
    const enrichedAssessments = (assessments || []).map(assessment => ({
      ...assessment,
      rating_interpretation: getRatingInterpretation(assessment.overall_safety_rating),
      confidence_interpretation: getConfidenceInterpretation(assessment.confidence_level)
    }))

    return NextResponse.json({
      success: true,
      data: enrichedAssessments,
      pagination: {
        page: params.page,
        pageSize: params.pageSize,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / params.pageSize),
        hasNext: offset + params.pageSize < (count || 0),
        hasPrev: params.page > 1
      },
      filters: {
        applied: params,
        available: {
          confidenceLevels: ['very_high', 'high', 'medium', 'low'],
          assessmentMethods: ['site_visit', 'phone_call', 'safety_meeting', 'worker_interview', 'document_review', 'other'],
          ratingRange: { min: 1, max: 4 }
        }
      }
    })
  } catch (error) {
    console.error('Error in Safety assessment GET:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      hint: 'Please try again or contact support'
    }, { status: 500 })
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validates safety assessment criteria for logical consistency
 */
function validateSafetyAssessmentCriteria(criteria: any): { valid: boolean; error?: string; details?: any; hint?: string } {
  const { site_safety, safety_procedures, incident_reporting } = criteria

  // Check if all ratings are within valid range
  const ratings = [site_safety, safety_procedures, incident_reporting]
  if (ratings.some(rating => rating < 1 || rating > 4)) {
    return {
      valid: false,
      error: 'All safety criteria ratings must be between 1 and 4',
      details: { criteria },
      hint: '1 = Excellent, 2 = Good, 3 = Needs Improvement, 4 = Poor'
    }
  }

  // Business logic: Check for extreme rating disparities
  const maxRating = Math.max(...ratings)
  const minRating = Math.min(...ratings)
  const ratingDifference = maxRating - minRating

  if (ratingDifference >= 3) {
    return {
      valid: false,
      error: 'Extreme rating disparities detected',
      details: { maxRating, minRating, difference: ratingDifference },
      hint: 'Please review your assessments - such large differences may indicate data entry errors'
    }
  }

  return { valid: true }
}

/**
 * Triggers rating calculation asynchronously
 */
async function triggerRatingCalculation(employerId: string, projectId?: string): Promise<void> {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point-employer-rating-new`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        employer_id: employerId,
        project_id: projectId,
        calculation_method: 'automatic_calculation',
        trigger_type: 'new_assessment',
      }),
    })

    if (!response.ok) {
      throw new Error(`Rating calculation failed: ${response.statusText}`)
    }
  } catch (error) {
    console.error('Error triggering rating calculation:', error)
    throw error
  }
}

/**
 * Get human-readable interpretation of safety rating
 */
function getRatingInterpretation(rating: number): string {
  switch (rating) {
    case 1:
      return 'Excellent safety standards'
    case 2:
      return 'Good safety standards'
    case 3:
      return 'Safety needs improvement'
    case 4:
      return 'Poor safety standards - immediate attention required'
    default:
      return 'Unknown rating'
  }
}

/**
 * Get human-readable interpretation of confidence level
 */
function getConfidenceInterpretation(level: string): string {
  switch (level) {
    case 'very_high':
      return 'Very high confidence - comprehensive assessment'
    case 'high':
      return 'High confidence - thorough assessment'
    case 'medium':
      return 'Medium confidence - adequate assessment'
    case 'low':
      return 'Low confidence - limited information'
    default:
      return 'Unknown confidence level'
  }
}
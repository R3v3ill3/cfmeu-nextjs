import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schema for Subcontractor Assessment (4-point system)
const SubcontractorAssessmentSchema = z.object({
  employer_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  criteria: z.object({
    subcontractor_usage: z.number().min(1).max(4), // 1=good, 4=terrible
    payment_terms: z.number().min(1).max(4),
    treatment_of_subbies: z.number().min(1).max(4),
  }),
  confidence_level: z.enum(['very_high', 'high', 'medium', 'low']).default('medium'),
  assessment_method: z.enum(['site_visit', 'phone_call', 'subcontractor_meeting', 'worker_interview', 'document_review', 'other']).default('site_visit'),
  notes: z.string().optional(),
  evidence_urls: z.array(z.string()).optional(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z.string().optional().transform(val => val ? new Date(val).toISOString() : null),
})

// POST - Create new Subcontractor Assessment
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
    const validatedData = SubcontractorAssessmentSchema.parse(body)

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

    // Calculate overall rating (average of 3 criteria, but usage is the main factor)
    const criteriaValues = Object.values(validatedData.criteria)
    const overallRating = Math.round(criteriaValues.reduce((sum, val) => sum + val, 0) / criteriaValues.length)

    // Create the assessment using the new 4-point schema
    const assessmentData = {
      employer_id: validatedData.employer_id,
      project_id: validatedData.project_id || null,
      assessor_id: user.id,
      assessment_date: new Date().toISOString().split('T')[0],
      subcontractor_usage_rating: validatedData.criteria.subcontractor_usage,
      payment_terms_rating: validatedData.criteria.payment_terms,
      treatment_of_subbies_rating: validatedData.criteria.treatment_of_subbies,
      usage_rating: overallRating, // Main rating field used in calculations
      confidence_level: validatedData.confidence_level,
      assessment_method: validatedData.assessment_method,
      notes: validatedData.notes || null,
      evidence_urls: validatedData.evidence_urls || [],
      follow_up_required: validatedData.follow_up_required,
      follow_up_date: validatedData.follow_up_date,
    }

    const { data: assessment, error } = await supabase
      .from('subcontractor_assessments_4point')
      .insert(assessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating Subcontractor assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create assessment', error: error.message },
        { status: 500 }
      )
    }

    // Trigger rating calculation for this employer
    try {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point-employer-rating-new`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          employer_id: validatedData.employer_id,
          project_id: validatedData.project_id,
          calculation_method: 'automatic_calculation',
          trigger_type: 'new_assessment',
        }),
      })
    } catch (ratingError) {
      console.error('Error triggering rating calculation:', ratingError)
      // Don't fail the request if rating calculation fails
    }

    const response = {
      data: assessment,
      success: true,
      message: 'Subcontractor assessment created successfully',
      metadata: {
        calculation_time: Date.now(),
        overall_rating: overallRating,
        confidence_level: validatedData.confidence_level,
        created_at: assessment.created_at,
      },
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error in Subcontractor assessment POST:', error)

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

// GET - List Subcontractor Assessments with filtering
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
    const projectId = searchParams.get('project_id')
    const assessorId = searchParams.get('assessor_id')
    const confidenceLevel = searchParams.get('confidence_level')
    const assessmentMethod = searchParams.get('assessment_method')
    const minRating = searchParams.get('min_rating')
    const maxRating = searchParams.get('max_rating')
    const followUpRequired = searchParams.get('follow_up_required')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = supabase
      .from('subcontractor_assessments_4point')
      .select(`
        *,
        employers!inner(id, name, abn),
        profiles!inner(id, name, email)
      `, { count: 'exact' })

    // Apply filters
    if (employerId) {
      query = query.eq('employer_id', employerId)
    }
    if (projectId) {
      query = query.eq('project_id', projectId)
    }
    if (assessorId) {
      query = query.eq('assessor_id', assessorId)
    }
    if (confidenceLevel) {
      query = query.eq('confidence_level', confidenceLevel)
    }
    if (assessmentMethod) {
      query = query.eq('assessment_method', assessmentMethod)
    }
    if (minRating) {
      query = query.gte('usage_rating', parseInt(minRating))
    }
    if (maxRating) {
      query = query.lte('usage_rating', parseInt(maxRating))
    }
    if (followUpRequired) {
      query = query.eq('follow_up_required', followUpRequired === 'true')
    }

    // Apply pagination and ordering
    const { data: assessments, error, count } = await query
      .order('assessment_date', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('Error fetching Subcontractor assessments:', error)
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
    console.error('Error in Subcontractor assessment GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
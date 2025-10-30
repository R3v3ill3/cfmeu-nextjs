import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { AssessmentType, FourPointRating } from '@/types/assessments'

// Mobile-optimized endpoint for assessments with progressive loading
export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url)
    const employerId = searchParams.get('employer_id')
    const assessmentType = searchParams.get('assessment_type') as AssessmentType
    const limit = parseInt(searchParams.get('limit') || '10')
    const offset = parseInt(searchParams.get('offset') || '0')
    const lastSync = searchParams.get('last_sync') // For incremental sync
    const lightweight = searchParams.get('lightweight') === 'true' // Minimal data mode

    if (!employerId) {
      return NextResponse.json(
        { success: false, message: 'Employer ID is required' },
        { status: 400 }
      )
    }

    // Progressive loading strategy
    const assessments: any[] = []

    // Union Respect Assessments
    if (!assessmentType || assessmentType === 'union_respect') {
      const query = supabase
        .from('union_respect_assessments')
        .select(`
          id,
          overall_score,
          confidence_level,
          assessment_date,
          status,
          created_at,
          updated_at
        `)
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(lightweight ? 3 : limit)

      if (lastSync) {
        query.gte('updated_at', lastSync)
      }

      const { data: unionAssessments } = await query
      if (unionAssessments) {
        assessments.push(...unionAssessments.map(a => ({
          ...a,
          assessment_type: 'union_respect',
          score_field: 'overall_score',
          confidence_field: 'confidence_level',
        })))
      }
    }

    // Safety 4-Point Assessments
    if (!assessmentType || assessmentType === 'safety_4_point') {
      const query = supabase
        .from('safety_4_point_assessments')
        .select(`
          id,
          overall_safety_score,
          safety_confidence_level,
          assessment_date,
          status,
          created_at,
          updated_at
        `)
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(lightweight ? 3 : limit)

      if (lastSync) {
        query.gte('updated_at', lastSync)
      }

      const { data: safetyAssessments } = await query
      if (safetyAssessments) {
        assessments.push(...safetyAssessments.map(a => ({
          ...a,
          assessment_type: 'safety_4_point',
          score_field: 'overall_safety_score',
          confidence_field: 'safety_confidence_level',
        })))
      }
    }

    // Subcontractor Use Assessments
    if (!assessmentType || assessmentType === 'subcontractor_use') {
      const query = supabase
        .from('subcontractor_use_assessments')
        .select(`
          id,
          overall_subcontractor_score,
          confidence_level,
          assessment_date,
          status,
          created_at,
          updated_at
        `)
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(lightweight ? 3 : limit)

      if (lastSync) {
        query.gte('updated_at', lastSync)
      }

      const { data: subcontractorAssessments } = await query
      if (subcontractorAssessments) {
        assessments.push(...subcontractorAssessments.map(a => ({
          ...a,
          assessment_type: 'subcontractor_use',
          score_field: 'overall_subcontractor_score',
          confidence_field: 'confidence_level',
        })))
      }
    }

    // Role-Specific Assessments
    if (!assessmentType || assessmentType === 'role_specific') {
      const query = supabase
        .from('role_specific_assessments')
        .select(`
          id,
          overall_role_score,
          role_confidence_level,
          assessment_date,
          status,
          created_at,
          updated_at
        `)
        .eq('employer_id', employerId)
        .order('assessment_date', { ascending: false })
        .limit(lightweight ? 3 : limit)

      if (lastSync) {
        query.gte('updated_at', lastSync)
      }

      const { data: roleAssessments } = await query
      if (roleAssessments) {
        assessments.push(...roleAssessments.map(a => ({
          ...a,
          assessment_type: 'role_specific',
          score_field: 'overall_role_score',
          confidence_field: 'role_confidence_level',
        })))
      }
    }

    // Sort all assessments by date
    assessments.sort((a, b) => new Date(b.assessment_date).getTime() - new Date(a.assessment_date).getTime())

    // Apply pagination
    const paginatedAssessments = assessments.slice(offset, offset + limit)

    // Get employer's current rating for context
    const { data: employer } = await supabase
      .from('employers')
      .select('current_4_point_rating, rating_confidence, rating_calculation_date')
      .eq('id', employerId)
      .single()

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        assessments: paginatedAssessments,
        employer_rating: employer,
        pagination: {
          total: assessments.length,
          offset,
          limit,
          has_more: offset + limit < assessments.length,
        },
        sync_info: {
          last_sync: lastSync || null,
          current_sync: new Date().toISOString(),
          incremental: !!lastSync,
          lightweight_mode: lightweight,
        },
      },
      metadata: {
        processing_time_ms: processingTime,
        cache_control: lightweight ? 'max-age=300' : 'max-age=60', // Longer cache for lightweight requests
        response_size_kb: Math.round(JSON.stringify(paginatedAssessments).length / 1024),
      },
    })
  } catch (error) {
    console.error('Error in mobile assessments GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Mobile-optimized assessment creation with offline support
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

    const body = await request.json()
    const {
      employer_id,
      assessment_type,
      assessment_data,
      client_timestamp,
      offline_id, // For offline sync tracking
      device_info,
    } = body

    if (!employer_id || !assessment_type || !assessment_data) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Verify employer exists
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select('id, name')
      .eq('id', employer_id)
      .single()

    if (employerError || !employer) {
      return NextResponse.json(
        { success: false, message: 'Employer not found' },
        { status: 404 }
      )
    }

    // Prepare assessment data with mobile metadata
    const enhancedAssessmentData = {
      ...assessment_data,
      employer_id,
      assessor_id: user.id,
      assessment_date: assessment_data.assessment_date || new Date().toISOString(),
      status: 'submitted', // Mobile submissions default to submitted
      metadata: {
        client_timestamp,
        server_timestamp: new Date().toISOString(),
        offline_id,
        device_info,
        source: 'mobile_app',
      },
    }

    let result
    let tableName = ''

    // Route to appropriate table based on assessment type
    switch (assessment_type) {
      case 'union_respect':
        tableName = 'union_respect_assessments'
        break
      case 'safety_4_point':
        tableName = 'safety_4_point_assessments'
        break
      case 'subcontractor_use':
        tableName = 'subcontractor_use_assessments'
        break
      case 'role_specific':
        tableName = 'role_specific_assessments'
        break
      default:
        return NextResponse.json(
          { success: false, message: 'Invalid assessment type' },
          { status: 400 }
        )
    }

    // Create the assessment
    const { data, error } = await supabase
      .from(tableName)
      .insert(enhancedAssessmentData)
      .select()
      .single()

    if (error) {
      console.error('Error creating mobile assessment:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create assessment', error: error.message },
        { status: 500 }
      )
    }

    result = data

    // Log mobile submission for analytics
    await supabase
      .from('mobile_assessment_submissions')
      .insert({
        assessment_id: result.id,
        assessment_type,
        employer_id,
        user_id: user.id,
        client_timestamp,
        server_timestamp: new Date().toISOString(),
        processing_time_ms: Date.now() - startTime,
        device_info,
        offline_id,
      })

    // Trigger rating calculation (non-blocking for mobile)
    try {
      fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
          'X-Trigger-Async': 'true', // Indicate this can be processed asynchronously
        },
        body: JSON.stringify({
          employer_id,
          assessment_ids: [result.id],
          trigger_type: 'mobile_submission',
        }),
      }).catch(error => {
        console.error('Error triggering async rating calculation:', error)
      })
    } catch (error) {
      console.error('Error setting up async rating calculation:', error)
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Assessment created successfully',
      data: {
        assessment: result,
        employer: {
          id: employer.id,
          name: employer.name,
        },
      },
      metadata: {
        processing_time_ms: processingTime,
        server_timestamp: new Date().toISOString(),
        offline_id_matched: offline_id === result.metadata?.offline_id,
      },
    })
  } catch (error) {
    console.error('Error in mobile assessments POST:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Mobile assessment update with conflict resolution
export async function PUT(request: NextRequest) {
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

    const body = await request.json()
    const {
      assessment_id,
      assessment_type,
      updates,
      client_timestamp,
      conflict_resolution = 'server_wins', // or 'client_wins' or 'merge'
      version, // For optimistic locking
    } = body

    if (!assessment_id || !assessment_type || !updates) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Determine table name
    const tableName = {
      union_respect: 'union_respect_assessments',
      safety_4_point: 'safety_4_point_assessments',
      subcontractor_use: 'subcontractor_use_assessments',
      role_specific: 'role_specific_assessments',
    }[assessment_type]

    if (!tableName) {
      return NextResponse.json(
        { success: false, message: 'Invalid assessment type' },
        { status: 400 }
      )
    }

    // Get current assessment for conflict resolution
    const { data: currentAssessment, error: fetchError } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', assessment_id)
      .single()

    if (fetchError || !currentAssessment) {
      return NextResponse.json(
        { success: false, message: 'Assessment not found' },
        { status: 404 }
      )
    }

    // Check permissions
    if (currentAssessment.assessor_id !== user.id) {
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

    // Handle conflict resolution
    let finalUpdates = { ...updates }

    if (conflict_resolution === 'merge') {
      // Merge strategy: combine non-conflicting fields
      Object.keys(updates).forEach(key => {
        if (currentAssessment[key] && typeof currentAssessment[key] === 'object' && typeof updates[key] === 'object') {
          finalUpdates[key] = { ...currentAssessment[key], ...updates[key] }
        }
      })
    } else if (conflict_resolution === 'client_wins') {
      // Client wins: use client updates as-is
      finalUpdates = updates
    }
    // server_wins: keep current server data for conflicts (default behavior)

    // Add mobile metadata
    finalUpdates.updated_at = new Date().toISOString()
    finalUpdates.metadata = {
      ...(currentAssessment.metadata || {}),
      last_mobile_update: {
        timestamp: new Date().toISOString(),
        client_timestamp,
        conflict_resolution,
        updated_by: user.id,
      },
    }

    // Update the assessment
    const { data: updatedAssessment, error: updateError } = await supabase
      .from(tableName)
      .update(finalUpdates)
      .eq('id', assessment_id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating mobile assessment:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to update assessment', error: updateError.message },
        { status: 500 }
      )
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Assessment updated successfully',
      data: {
        assessment: updatedAssessment,
        conflict_resolution_used: conflict_resolution,
        had_conflicts: JSON.stringify(currentAssessment) !== JSON.stringify({ ...currentAssessment, ...updates }),
      },
      metadata: {
        processing_time_ms: processingTime,
        server_timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in mobile assessments PUT:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
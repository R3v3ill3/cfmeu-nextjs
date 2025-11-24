import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// POST - Clear sham contracting flag for a specific employer on a specific project
export async function POST(
  request: NextRequest,
  { params }: { params: { projectId: string; employerId: string } }
) {
  try {
    const { projectId, employerId } = params
    const supabase = await createServerSupabase()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { clearing_reason } = body

    if (!clearing_reason || clearing_reason.trim().length < 10) {
      return NextResponse.json(
        { error: 'Clearing reason must be at least 10 characters' },
        { status: 400 }
      )
    }

    // Clear flag in employer_compliance_checks for this project
    const { error: complianceError } = await supabase
      .from('employer_compliance_checks')
      .update({
        sham_contracting_detected: false,
        sham_contracting_cleared_date: new Date().toISOString(),
        sham_contracting_cleared_by: user.id,
        sham_contracting_clearing_reason: clearing_reason,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('project_id', projectId)
      .eq('employer_id', employerId)
      .eq('sham_contracting_detected', true)
      .is('sham_contracting_cleared_date', null)

    if (complianceError) {
      console.error('Error clearing compliance check:', complianceError)
      return NextResponse.json(
        { error: 'Failed to clear compliance flag' },
        { status: 500 }
      )
    }

    // Clear flag in subcontractor_assessments_4point for this project
    const { error: assessmentError } = await supabase
      .from('subcontractor_assessments_4point')
      .update({
        sham_contracting_detected: false,
        sham_contracting_cleared_date: new Date().toISOString(),
        sham_contracting_cleared_by: user.id,
        sham_contracting_clearing_reason: clearing_reason,
        updated_at: new Date().toISOString()
      })
      .eq('project_id', projectId)
      .eq('employer_id', employerId)
      .eq('sham_contracting_detected', true)
      .is('sham_contracting_cleared_date', null)

    if (assessmentError) {
      console.error('Error clearing assessment:', assessmentError)
      return NextResponse.json(
        { error: 'Failed to clear assessment flag' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Sham contracting flag cleared for this project'
    })
  } catch (error) {
    console.error('Error in POST /api/projects/[projectId]/employers/[employerId]/sham-contracting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET - Get sham contracting status for employer on this project
export async function GET(
  request: NextRequest,
  { params }: { params: { projectId: string; employerId: string } }
) {
  try {
    const { projectId, employerId } = params
    const supabase = await createServerSupabase()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get compliance check flags
    const { data: complianceData, error: complianceError } = await supabase
      .from('employer_compliance_checks')
      .select('*')
      .eq('project_id', projectId)
      .eq('employer_id', employerId)
      .eq('is_current', true)
      .single()

    // Get assessment flags
    const { data: assessmentData, error: assessmentError } = await supabase
      .from('subcontractor_assessments_4point')
      .select('*')
      .eq('project_id', projectId)
      .eq('employer_id', employerId)
      .order('assessment_date', { ascending: false })
      .limit(1)
      .maybeSingle()

    const hasShamContracting = 
      (complianceData?.sham_contracting_detected && !complianceData?.sham_contracting_cleared_date) ||
      (assessmentData?.sham_contracting_detected && !assessmentData?.sham_contracting_cleared_date)

    return NextResponse.json({
      has_sham_contracting: hasShamContracting,
      compliance: complianceData,
      assessment: assessmentData
    })
  } catch (error) {
    console.error('Error in GET /api/projects/[projectId]/employers/[employerId]/sham-contracting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





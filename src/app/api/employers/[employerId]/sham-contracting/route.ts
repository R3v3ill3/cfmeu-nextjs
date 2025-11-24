import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { ShamContractingAuditLog, ShamContractingStatus } from '@/types/compliance'

// GET - Get sham contracting status and audit history for an employer
export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const { employerId } = params
    const supabase = await createServerSupabase()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get aggregated status
    const { data: statusData, error: statusError } = await supabase
      .rpc('get_employer_sham_contracting_status', { p_employer_id: employerId })
      .single()

    if (statusError) {
      console.error('Error fetching sham contracting status:', statusError)
      return NextResponse.json(
        { error: 'Failed to fetch status' },
        { status: 500 }
      )
    }

    // Get audit log
    const { data: auditLog, error: auditError } = await supabase
      .from('sham_contracting_audit_log')
      .select(`
        *,
        action_by_profile:profiles!sham_contracting_audit_log_action_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        project:projects(id, name)
      `)
      .eq('employer_id', employerId)
      .order('action_timestamp', { ascending: false })

    if (auditError) {
      console.error('Error fetching audit log:', auditError)
      return NextResponse.json(
        { error: 'Failed to fetch audit log' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: statusData as ShamContractingStatus,
      auditLog: auditLog as ShamContractingAuditLog[]
    })
  } catch (error) {
    console.error('Error in GET /api/employers/[employerId]/sham-contracting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Clear sham contracting flag for an employer (global clear)
export async function POST(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const { employerId } = params
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

    // Clear all active flags in employer_compliance_checks
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
      .eq('employer_id', employerId)
      .eq('sham_contracting_detected', true)
      .is('sham_contracting_cleared_date', null)

    if (complianceError) {
      console.error('Error clearing compliance checks:', complianceError)
      return NextResponse.json(
        { error: 'Failed to clear compliance flags' },
        { status: 500 }
      )
    }

    // Clear all active flags in subcontractor_assessments_4point
    const { error: assessmentError } = await supabase
      .from('subcontractor_assessments_4point')
      .update({
        sham_contracting_detected: false,
        sham_contracting_cleared_date: new Date().toISOString(),
        sham_contracting_cleared_by: user.id,
        sham_contracting_clearing_reason: clearing_reason,
        updated_at: new Date().toISOString()
      })
      .eq('employer_id', employerId)
      .eq('sham_contracting_detected', true)
      .is('sham_contracting_cleared_date', null)

    if (assessmentError) {
      console.error('Error clearing assessments:', assessmentError)
      return NextResponse.json(
        { error: 'Failed to clear assessment flags' },
        { status: 500 }
      )
    }

    // Clear all active flags in organiser_overall_expertise_ratings
    const { error: expertiseError } = await supabase
      .from('organiser_overall_expertise_ratings')
      .update({
        sham_contracting_detected: false,
        sham_contracting_cleared_date: new Date().toISOString(),
        sham_contracting_cleared_by: user.id,
        sham_contracting_clearing_reason: clearing_reason,
        updated_at: new Date().toISOString(),
        updated_by: user.id
      })
      .eq('employer_id', employerId)
      .eq('sham_contracting_detected', true)
      .is('sham_contracting_cleared_date', null)

    if (expertiseError) {
      console.error('Error clearing expertise ratings:', expertiseError)
      return NextResponse.json(
        { error: 'Failed to clear expertise flags' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'All sham contracting flags cleared for employer'
    })
  } catch (error) {
    console.error('Error in POST /api/employers/[employerId]/sham-contracting:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}





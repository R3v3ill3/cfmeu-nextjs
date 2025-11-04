import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EmployerVersionResponse {
  id: string
  version: number
  last_known_version: number | null
  is_being_edited: boolean
  current_editor_id: string | null
  can_edit: boolean
  conflict_risk: 'low' | 'medium' | 'high'
  active_editors: Array<{
    user_id: string
    session_started: string
    last_heartbeat: string
    client_session_id: string
  }>
  recent_changes: Array<{
    changed_by: string
    changed_at: string
    change_type: string
    changed_fields: Record<string, boolean>
  }>
  recommendations: Array<{
    type: string
    message: string
    action: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const { employerId } = params

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this employer
    const { data: employerAccess, error: accessError } = await supabase
      .rpc('check_employer_audit_access', {
        p_employer_id: employerId,
        p_user_id: user.id
      })

    if (accessError || !employerAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    // Get employer version info
    const { data: employer, error: employerError } = await supabase
      .from('employers')
      .select(`
        id,
        version,
        last_known_version,
        is_being_edited,
        current_editor_id
      `)
      .eq('id', employerId)
      .single()

    if (employerError || !employer) {
      return NextResponse.json(
        { error: 'Employer not found' },
        { status: 404 }
      )
    }

    // Check editing conflicts
    const { data: conflictCheck, error: conflictError } = await supabase
      .rpc('check_employer_editing_conflicts', {
        p_employer_id: employerId,
        p_expected_version: employer.version
      })

    if (conflictError) {
      console.error('Conflict check error:', conflictError)
    }

    const response: EmployerVersionResponse = {
      id: employer.id,
      version: employer.version,
      last_known_version: employer.last_known_version,
      is_being_edited: employer.is_being_edited || false,
      current_editor_id: employer.current_editor_id,
      can_edit: conflictCheck?.can_edit || true,
      conflict_risk: (conflictCheck?.conflict_risk as 'low' | 'medium' | 'high') || 'low',
      active_editors: conflictCheck?.active_editors || [],
      recent_changes: conflictCheck?.recent_changes || [],
      recommendations: conflictCheck?.recommendations || []
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Version check error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const { employerId } = params
    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verify user has access to this employer
    const { data: employerAccess, error: accessError } = await supabase
      .rpc('check_employer_audit_access', {
        p_employer_id: employerId,
        p_user_id: user.id
      })

    if (accessError || !employerAccess) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    }

    const { expected_version, client_session_id } = body

    if (!client_session_id) {
      return NextResponse.json(
        { error: 'Client session ID is required' },
        { status: 400 }
      )
    }

    // Start editing session
    const { data: sessionId, error: sessionError } = await supabase
      .rpc('start_employer_editing_session', {
        p_employer_id: employerId,
        p_client_session_id: client_session_id,
        p_expected_version: expected_version || null,
        p_ip_address: request.ip || null,
        p_user_agent: request.headers.get('user-agent') || null
      })

    if (sessionError) {
      console.error('Session start error:', sessionError)

      // Handle specific error cases
      if (sessionError.message.includes('Version conflict')) {
        return NextResponse.json(
          {
            error: 'Version conflict',
            details: sessionError.message,
            requires_refresh: true
          },
          { status: 409 }
        )
      }

      if (sessionError.message.includes('currently being edited')) {
        return NextResponse.json(
          {
            error: 'Employer is currently being edited by another user',
            requires_wait: true
          },
          { status: 423 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to start editing session' },
        { status: 500 }
      )
    }

    // Get updated employer info
    const { data: updatedEmployer, error: updateError } = await supabase
      .from('employers')
      .select('version, is_being_edited, current_editor_id')
      .eq('id', employerId)
      .single()

    if (updateError) {
      console.error('Employer update check error:', updateError)
    }

    return NextResponse.json({
      success: true,
      session_id: sessionId,
      employer: {
        version: updatedEmployer?.version,
        is_being_edited: updatedEmployer?.is_being_edited,
        current_editor_id: updatedEmployer?.current_editor_id
      }
    })
  } catch (error) {
    console.error('Start editing session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const { employerId } = params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // End editing session
    const { data: success, error: sessionError } = await supabase
      .rpc('end_employer_editing_session', {
        p_session_id: sessionId
      })

    if (sessionError) {
      console.error('Session end error:', sessionError)

      if (sessionError.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Editing session not found or already ended' },
          { status: 404 }
        )
      }

      if (sessionError.message.includes('Only the session owner')) {
        return NextResponse.json(
          { error: 'Only the session owner can end this editing session' },
          { status: 403 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to end editing session' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: success || true
    })
  } catch (error) {
    console.error('End editing session error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const { employerId } = params
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')
    const body = await request.json()

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Heartbeat the editing session
    const { data: success, error: heartbeatError } = await supabase
      .rpc('heartbeat_employer_editing_session', {
        p_session_id: sessionId
      })

    if (heartbeatError) {
      console.error('Heartbeat error:', heartbeatError)
      return NextResponse.json(
        { error: 'Failed to update session heartbeat' },
        { status: 500 }
      )
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Editing session not found or expired' },
        { status: 404 }
      )
    }

    // If updating pending changes in the session
    if (body.pending_changes) {
      const { error: updateError } = await supabase
        .from('employer_editing_sessions')
        .update({
          pending_changes: body.pending_changes,
          last_heartbeat: new Date().toISOString()
        })
        .eq('id', sessionId)
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Session update error:', updateError)
        return NextResponse.json(
          { error: 'Failed to update session data' },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Heartbeat error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
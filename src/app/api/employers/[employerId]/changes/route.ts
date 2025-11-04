import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EmployerChangeResponse {
  id: string
  employer_id: string
  change_type: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_by: string
  changed_at: string
  from_version: number | null
  to_version: number
  changed_fields: Record<string, boolean>
  old_values: Record<string, any> | null
  new_values: Record<string, any> | null
  change_context: Record<string, any>
  conflict_with_change_id: string | null
  conflict_resolution_type: string | null
  resolved_at: string | null
  resolved_by: string | null
  bulk_operation_id: string | null
  changed_by_name: string
  changed_by_email: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const supabase = await createServerSupabase()
    const { employerId } = params
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')
    const changeType = searchParams.get('change_type')
    const userId = searchParams.get('user_id')
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')
    const includeConflicts = searchParams.get('include_conflicts') === 'true'

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

    // Build query
    let query = supabase
      .from('employer_change_history')
      .select('*')
      .eq('employer_id', employerId)
      .order('changed_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Apply filters
    if (changeType) {
      query = query.eq('change_type', changeType.toUpperCase())
    }

    if (userId) {
      query = query.eq('changed_by', userId)
    }

    if (startDate) {
      query = query.gte('changed_at', startDate)
    }

    if (endDate) {
      query = query.lte('changed_at', endDate)
    }

    if (includeConflicts) {
      query = query.not('conflict_with_change_id', 'is', null)
    }

    const { data: changes, error: changesError } = await query

    if (changesError) {
      console.error('Changes fetch error:', changesError)
      return NextResponse.json(
        { error: 'Failed to fetch changes' },
        { status: 500 }
      )
    }

    // Transform data to match interface
    const transformedChanges: EmployerChangeResponse[] = changes.map((change: any) => ({
      id: change.id,
      employer_id: change.employer_id,
      change_type: change.change_type,
      changed_by: change.changed_by,
      changed_at: change.changed_at,
      from_version: change.from_version,
      to_version: change.to_version,
      changed_fields: change.changed_fields,
      old_values: change.old_values,
      new_values: change.new_values,
      change_context: change.change_context,
      conflict_with_change_id: change.conflict_with_change_id,
      conflict_resolution_type: change.conflict_resolution_type,
      resolved_at: change.resolved_at,
      resolved_by: change.resolved_by,
      bulk_operation_id: change.bulk_operation_id,
      changed_by_name: change.changed_by_name,
      changed_by_email: change.changed_by_email
    }))

    // Get total count for pagination
    const { count, error: countError } = await supabase
      .from('employer_change_audit')
      .select('*', { count: 'exact', head: true })
      .eq('employer_id', employerId)

    if (countError) {
      console.error('Count error:', countError)
    }

    return NextResponse.json({
      changes: transformedChanges,
      pagination: {
        total: count || 0,
        limit,
        offset,
        has_more: count ? offset + limit < count : false
      }
    })
  } catch (error) {
    console.error('Changes fetch error:', error)
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

    const { expected_version, employer_data, change_context = {} } = body

    if (!expected_version || !employer_data) {
      return NextResponse.json(
        { error: 'Expected version and employer data are required' },
        { status: 400 }
      )
    }

    // Update employer with version checking
    const { data: updateResult, error: updateError } = await supabase
      .rpc('update_employer_with_version', {
        p_employer_id: employerId,
        p_expected_version: expected_version,
        p_employer_data: employer_data,
        p_change_context: {
          ...change_context,
          api_endpoint: 'changes',
          user_agent: request.headers.get('user-agent'),
          ip_address: request.ip
        }
      })

    if (updateError) {
      console.error('Employer update error:', updateError)

      if (updateError.message.includes('Version conflict')) {
        // Detect conflicts for this employer
        const { data: conflicts, error: conflictError } = await supabase
          .rpc('detect_employer_conflicts_detailed', {
            p_employer_id: employerId
          })

        return NextResponse.json(
          {
            error: 'Version conflict detected',
            details: updateError.message,
            conflicts: conflicts || [],
            requires_resolution: true
          },
          { status: 409 }
        )
      }

      if (updateError.message.includes('currently being edited')) {
        return NextResponse.json(
          {
            error: 'Employer is currently being edited by another user',
            requires_wait: true
          },
          { status: 423 }
        )
      }

      return NextResponse.json(
        { error: 'Failed to update employer', details: updateError.message },
        { status: 500 }
      )
    }

    // Get updated employer data
    const { data: updatedEmployer, error: fetchError } = await supabase
      .from('employers')
      .select('*')
      .eq('id', employerId)
      .single()

    if (fetchError) {
      console.error('Employer fetch error:', fetchError)
    }

    // Get the change audit record that was just created
    const { data: auditRecord, error: auditError } = await supabase
      .from('employer_change_audit')
      .select('*')
      .eq('employer_id', employerId)
      .eq('changed_by', user.id)
      .order('changed_at', { ascending: false })
      .limit(1)
      .single()

    if (auditError) {
      console.error('Audit record fetch error:', auditError)
    }

    return NextResponse.json({
      success: true,
      employer: updatedEmployer,
      new_version: updateResult?.[0]?.new_version,
      conflict_detected: updateResult?.[0]?.conflict_detected || false,
      conflict_details: updateResult?.[0]?.conflict_details || {},
      audit_record: auditRecord
    })
  } catch (error) {
    console.error('Employer update error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
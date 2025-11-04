import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ConflictDetails {
  id: string
  employer_id: string
  conflicting_change_id_1: string
  conflicting_change_id_2: string
  conflict_detected_at: string
  conflicting_fields: Array<{
    field: string
    type: string
    severity: string
    auto_resolvable: boolean
    value_1: string
    value_2: string
  }>
  conflict_severity: 'low' | 'medium' | 'high' | 'critical'
  resolution_status: 'pending' | 'resolved' | 'deferred' | 'escalated'
  resolved_by: string | null
  resolved_at: string | null
  resolution_method: string | null
  resolution_notes: string | null
  resolved_values: Record<string, any> | null
  created_at: string
  updated_at: string
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
    const status = searchParams.get('status')
    const severity = searchParams.get('severity')
    const includeResolved = searchParams.get('include_resolved') !== 'false'
    const autoDetect = searchParams.get('auto_detect') === 'true'

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

    // Auto-detect conflicts if requested
    if (autoDetect) {
      const { error: detectError } = await supabase
        .rpc('detect_employer_conflicts_detailed', {
          p_employer_id: employerId
        })

      if (detectError) {
        console.error('Conflict detection error:', detectError)
      }
    }

    // Build query
    let query = supabase
      .from('employer_change_conflicts')
      .select(`
        *,
        conflicting_change_1:conflicting_change_id_1(
          id,
          changed_by,
          changed_at,
          change_type,
          changed_fields,
          new_values
        ),
        conflicting_change_2:conflicting_change_id_2(
          id,
          changed_by,
          changed_at,
          change_type,
          changed_fields,
          new_values
        )
      `)
      .eq('employer_id', employerId)
      .order('conflict_detected_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('resolution_status', status)
    } else if (!includeResolved) {
      query = query.in('resolution_status', ['pending', 'deferred', 'escalated'])
    }

    if (severity) {
      query = query.eq('conflict_severity', severity)
    }

    const { data: conflicts, error: conflictsError } = await query

    if (conflictsError) {
      console.error('Conflicts fetch error:', conflictsError)
      return NextResponse.json(
        { error: 'Failed to fetch conflicts' },
        { status: 500 }
      )
    }

    // Transform data to match interface
    const transformedConflicts: ConflictDetails[] = conflicts.map((conflict: any) => ({
      id: conflict.id,
      employer_id: conflict.employer_id,
      conflicting_change_id_1: conflict.conflicting_change_id_1,
      conflicting_change_id_2: conflict.conflicting_change_id_2,
      conflict_detected_at: conflict.conflict_detected_at,
      conflicting_fields: conflict.conflicting_fields || [],
      conflict_severity: conflict.conflict_severity,
      resolution_status: conflict.resolution_status,
      resolved_by: conflict.resolved_by,
      resolved_at: conflict.resolved_at,
      resolution_method: conflict.resolution_method,
      resolution_notes: conflict.resolution_notes,
      resolved_values: conflict.resolved_values,
      created_at: conflict.created_at,
      updated_at: conflict.updated_at
    }))

    // Get conflict statistics
    const { data: stats, error: statsError } = await supabase
      .from('employer_change_conflicts')
      .select('conflict_severity, resolution_status')
      .eq('employer_id', employerId)

    if (statsError) {
      console.error('Stats fetch error:', statsError)
    }

    const statistics = {
      total_conflicts: stats?.length || 0,
      by_severity: {
        low: stats?.filter(s => s.conflict_severity === 'low').length || 0,
        medium: stats?.filter(s => s.conflict_severity === 'medium').length || 0,
        high: stats?.filter(s => s.conflict_severity === 'high').length || 0,
        critical: stats?.filter(s => s.conflict_severity === 'critical').length || 0
      },
      by_status: {
        pending: stats?.filter(s => s.resolution_status === 'pending').length || 0,
        resolved: stats?.filter(s => s.resolution_status === 'resolved').length || 0,
        deferred: stats?.filter(s => s.resolution_status === 'deferred').length || 0,
        escalated: stats?.filter(s => s.resolution_status === 'escalated').length || 0
      }
    }

    return NextResponse.json({
      conflicts: transformedConflicts,
      statistics,
      has_active_conflicts: statistics.by_status.pending > 0
    })
  } catch (error) {
    console.error('Conflicts fetch error:', error)
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

    const { action, conflict_id, resolution_strategy, resolved_data, resolution_notes } = body

    if (!action) {
      return NextResponse.json(
        { error: 'Action is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'auto_resolve':
        if (!conflict_id || !resolution_strategy) {
          return NextResponse.json(
            { error: 'Conflict ID and resolution strategy are required for auto-resolution' },
            { status: 400 }
          )
        }

        const { data: autoResult, error: autoError } = await supabase
          .rpc('auto_resolve_conflicts', {
            p_conflict_id: conflict_id,
            p_resolution_strategy: resolution_strategy
          })

        if (autoError) {
          console.error('Auto resolution error:', autoError)
          return NextResponse.json(
            { error: 'Failed to auto-resolve conflict', details: autoError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: autoResult?.[0]?.success || false,
          resolved_employer_data: autoResult?.[0]?.resolved_employer_data,
          unresolved_fields: autoResult?.[0]?.unresolved_fields || [],
          resolution_log: autoResult?.[0]?.resolution_log || []
        })

      case 'manual_resolve':
        if (!conflict_id || !resolved_data) {
          return NextResponse.json(
            { error: 'Conflict ID and resolved data are required for manual resolution' },
            { status: 400 }
          )
        }

        const { data: manualResult, error: manualError } = await supabase
          .rpc('manual_resolve_conflict', {
            p_conflict_id: conflict_id,
            p_resolved_data: resolved_data,
            p_resolution_notes: resolution_notes
          })

        if (manualError) {
          console.error('Manual resolution error:', manualError)
          return NextResponse.json(
            { error: 'Failed to manually resolve conflict', details: manualError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: manualResult || false
        })

      case 'detect_new':
        const { data: detectedConflicts, error: detectError } = await supabase
          .rpc('detect_employer_conflicts_detailed', {
            p_employer_id: employerId
          })

        if (detectError) {
          console.error('Conflict detection error:', detectError)
          return NextResponse.json(
            { error: 'Failed to detect conflicts', details: detectError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          detected_conflicts: detectedConflicts || [],
          new_conflicts_count: Array.isArray(detectedConflicts) ? detectedConflicts.length : 0
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: auto_resolve, manual_resolve, detect_new' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Conflict action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
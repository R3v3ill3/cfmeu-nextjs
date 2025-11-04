import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface EmployerChangeAnalytics {
  summary: {
    total_changes: number
    unique_employers: number
    unique_users: number
    avg_changes_per_employer: number
    most_active_user: {
      user_id: string
      change_count: number
    }
    most_changed_employer: {
      employer_id: string
      employer_name: string
      change_count: number
    }
  }
  change_trends: Array<{
    date: string
    change_count: number
    user_count: number
    employer_count: number
  }>
  conflict_analysis: Array<{
    conflict_type: string
    severity: string
    total_conflicts: number
    resolved_conflicts: number
    auto_resolved: number
    manual_resolved: number
    avg_resolution_time: string
    most_conflicted_fields: Array<{
      field: string
      count: number
    }>
    most_active_users: Array<{
      user_id: string
      conflicts: number
    }>
  }>
  field_change_frequency: Array<{
    field: string
    change_count: number
    percentage: number
  }>
  user_activity: Array<{
    user_id: string
    user_name: string
    user_email: string
    change_count: number
    conflict_count: number
    last_activity: string
  }>
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)

    // Parse query parameters
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0]
    const employerId = searchParams.get('employer_id')
    const userId = searchParams.get('user_id')

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has admin access for analytics
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !['admin', 'coordinator'].includes(profile?.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions for analytics access' },
        { status: 403 }
      )
    }

    const analytics: EmployerChangeAnalytics = {
      summary: {
        total_changes: 0,
        unique_employers: 0,
        unique_users: 0,
        avg_changes_per_employer: 0,
        most_active_user: { user_id: '', change_count: 0 },
        most_changed_employer: { employer_id: '', employer_name: '', change_count: 0 }
      },
      change_trends: [],
      conflict_analysis: [],
      field_change_frequency: [],
      user_activity: []
    }

    // Get change summary
    let changeQuery = supabase
      .from('employer_change_audit')
      .select('employer_id, changed_by, changed_at')
      .gte('changed_at::date', startDate)
      .lte('changed_at::date', endDate)

    if (employerId) {
      changeQuery = changeQuery.eq('employer_id', employerId)
    }

    if (userId) {
      changeQuery = changeQuery.eq('changed_by', userId)
    }

    const { data: changes, error: changesError } = await changeQuery

    if (changesError) {
      console.error('Changes fetch error:', changesError)
      return NextResponse.json(
        { error: 'Failed to fetch change data' },
        { status: 500 }
      )
    }

    // Calculate summary statistics
    analytics.summary.total_changes = changes?.length || 0
    analytics.summary.unique_employers = new Set(changes?.map(c => c.employer_id)).size
    analytics.summary.unique_users = new Set(changes?.map(c => c.changed_by)).size
    analytics.summary.avg_changes_per_employer = analytics.summary.unique_employers > 0
      ? Math.round((analytics.summary.total_changes / analytics.summary.unique_employers) * 100) / 100
      : 0

    // Find most active user
    const userChangeCounts = changes?.reduce((acc: any, change) => {
      acc[change.changed_by] = (acc[change.changed_by] || 0) + 1
      return acc
    }, {}) || {}

    const mostActiveUserId = Object.keys(userChangeCounts).reduce((a, b) =>
      userChangeCounts[a] > userChangeCounts[b] ? a : b, ''
    )

    analytics.summary.most_active_user = {
      user_id: mostActiveUserId,
      change_count: userChangeCounts[mostActiveUserId] || 0
    }

    // Find most changed employer
    const employerChangeCounts = changes?.reduce((acc: any, change) => {
      acc[change.employer_id] = (acc[change.employer_id] || 0) + 1
      return acc
    }, {}) || {}

    const mostChangedEmployerId = Object.keys(employerChangeCounts).reduce((a, b) =>
      employerChangeCounts[a] > employerChangeCounts[b] ? a : b, ''
    )

    // Get employer name for most changed employer
    if (mostChangedEmployerId) {
      const { data: employerData } = await supabase
        .from('employers')
        .select('name')
        .eq('id', mostChangedEmployerId)
        .single()

      analytics.summary.most_changed_employer = {
        employer_id: mostChangedEmployerId,
        employer_name: employerData?.name || 'Unknown',
        change_count: employerChangeCounts[mostChangedEmployerId] || 0
      }
    }

    // Get daily change trends
    const dailyChanges = changes?.reduce((acc: any, change) => {
      const date = change.changed_at.split('T')[0]
      if (!acc[date]) {
        acc[date] = { count: 0, users: new Set(), employers: new Set() }
      }
      acc[date].count += 1
      acc[date].users.add(change.changed_by)
      acc[date].employers.add(change.employer_id)
      return acc
    }, {}) || {}

    analytics.change_trends = Object.entries(dailyChanges)
      .map(([date, data]: [string, any]) => ({
        date,
        change_count: data.count,
        user_count: data.users.size,
        employer_count: data.employers.size
      }))
      .sort((a, b) => a.date.localeCompare(b.date))

    // Get conflict analysis
    const { data: conflictData, error: conflictError } = await supabase
      .rpc('analyze_conflict_patterns', {
        p_start_date: startDate,
        p_end_date: endDate
      })

    if (!conflictError && conflictData) {
      analytics.conflict_analysis = conflictData.map((conflict: any) => ({
        conflict_type: conflict.conflict_type,
        severity: conflict.severity,
        total_conflicts: conflict.total_conflicts,
        resolved_conflicts: conflict.resolved_conflicts,
        auto_resolved: conflict.auto_resolved,
        manual_resolved: conflict.manual_resolved,
        avg_resolution_time: conflict.avg_resolution_time,
        most_conflicted_fields: conflict.most_conflicted_fields || [],
        most_active_users: conflict.most_active_users || []
      }))
    }

    // Get field change frequency
    const fieldCounts: { [key: string]: number } = {}
    const { data: changesWithFields } = await supabase
      .from('employer_change_audit')
      .select('changed_fields')
      .gte('changed_at::date', startDate)
      .lte('changed_at::date', endDate)

    changesWithFields?.forEach((change: any) => {
      if (change.changed_fields && typeof change.changed_fields === 'object') {
        Object.keys(change.changed_fields).forEach(field => {
          if (change.changed_fields[field]) {
            fieldCounts[field] = (fieldCounts[field] || 0) + 1
          }
        })
      }
    })

    const totalFieldChanges = Object.values(fieldCounts).reduce((sum: number, count: number) => sum + count, 0)
    analytics.field_change_frequency = Object.entries(fieldCounts)
      .map(([field, count]) => ({
        field,
        change_count: count,
        percentage: totalFieldChanges > 0 ? Math.round((count / totalFieldChanges) * 10000) / 100 : 0
      }))
      .sort((a, b) => b.change_count - a.change_count)
      .slice(0, 20) // Top 20 fields

    // Get user activity details
    const userIds = analytics.summary.unique_users > 0
      ? Array.from(new Set(changes?.map(c => c.changed_by)))
      : []

    if (userIds.length > 0) {
      const { data: userProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds)

      const userChangeCountsDetailed = userIds.map(userId => {
        const userChanges = changes?.filter(c => c.changed_by === userId) || []
        const lastChange = userChanges.length > 0
          ? userChanges.reduce((latest, change) =>
              change.changed_at > latest.changed_at ? change : latest
            ).changed_at
          : null

        return {
          user_id: userId,
          change_count: userChanges.length,
          last_activity: lastChange
        }
      })

      // Get conflict counts for each user
      const { data: userConflicts } = await supabase
        .from('employer_change_conflicts')
        .select('conflicting_change_id_1, conflicting_change_id_2')
        .gte('conflict_detected_at::date', startDate)
        .lte('conflict_detected_at::date', endDate)

      const conflictCounts: { [key: string]: number } = {}
      userConflicts?.forEach((conflict: any) => {
        // This is a simplified approach - in practice you'd need to look up the actual change records
        conflictCounts[conflict.conflicting_change_id_1] = (conflictCounts[conflict.conflicting_change_id_1] || 0) + 1
        conflictCounts[conflict.conflicting_change_id_2] = (conflictCounts[conflict.conflicting_change_id_2] || 0) + 1
      })

      analytics.user_activity = userChangeCountsDetailed
        .map(userActivity => {
          const profile = userProfiles?.find(p => p.id === userActivity.user_id)
          return {
            user_id: userActivity.user_id,
            user_name: profile?.full_name || 'Unknown',
            user_email: profile?.email || 'Unknown',
            change_count: userActivity.change_count,
            conflict_count: conflictCounts[userActivity.user_id] || 0,
            last_activity: userActivity.last_activity || ''
          }
        })
        .sort((a, b) => b.change_count - a.change_count)
    }

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const body = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check admin permissions
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !['admin', 'coordinator'].includes(profile?.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const { action } = body

    switch (action) {
      case 'resolve_simple_conflicts':
        const { data: resolutionResult, error: resolutionError } = await supabase
          .rpc('resolve_simple_conflicts')

        if (resolutionError) {
          console.error('Conflict resolution error:', resolutionError)
          return NextResponse.json(
            { error: 'Failed to resolve conflicts', details: resolutionError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          result: resolutionResult?.[0] || {
            conflicts_resolved: 0,
            conflicts_deferred: 0,
            processing_time: '0 seconds'
          }
        })

      case 'cleanup_old_conflicts':
        const { days_to_keep = 90 } = body
        const { data: cleanupResult, error: cleanupError } = await supabase
          .rpc('cleanup_resolved_conflicts', {
            p_days_to_keep: days_to_keep
          })

        if (cleanupError) {
          console.error('Cleanup error:', cleanupError)
          return NextResponse.json(
            { error: 'Failed to cleanup conflicts', details: cleanupError.message },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          deleted_conflicts: cleanupResult || 0
        })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: resolve_simple_conflicts, cleanup_old_conflicts' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Analytics action error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
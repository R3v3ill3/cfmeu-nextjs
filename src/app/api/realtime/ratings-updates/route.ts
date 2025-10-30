import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

// Real-time updates for rating changes
// This would typically use WebSockets, but we're providing a polling-friendly fallback

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
    const employerIds = searchParams.get('employer_ids')?.split(',')
    const lastCheck = searchParams.get('last_check')
    const subscriptionType = searchParams.get('type') || 'rating_changes'

    if (!employerIds || employerIds.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Employer IDs are required' },
        { status: 400 }
      )
    }

    const currentTime = new Date().toISOString()
    const updates: any[] = []

    switch (subscriptionType) {
      case 'rating_changes':
        // Get recent rating calculations
        const { data: recentCalculations } = await supabase
          .from('four_point_rating_calculations')
          .select(`
            *,
            employers!inner(id, name)
          `)
          .in('employer_id', employerIds)
          .gte('calculation_date', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('calculation_date', { ascending: false })

        if (recentCalculations) {
          updates.push(...recentCalculations.map(calc => ({
            type: 'rating_updated',
            employer_id: calc.employer_id,
            employer_name: calc.employers.name,
            data: {
              previous_rating: calc.final_score,
              new_rating: calc.final_score,
              confidence_level: calc.confidence_level,
              calculation_date: calc.calculation_date,
              assessment_types_used: calc.calculation_breakdown.assessment_types_used,
            },
            timestamp: calc.calculation_date,
          })))
        }

        // Get employer rating updates
        const { data: employerUpdates } = await supabase
          .from('employers')
          .select('id, name, current_4_point_rating, rating_confidence, rating_calculation_date, updated_at')
          .in('id', employerIds)
          .gte('updated_at', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())

        if (employerUpdates) {
          updates.push(...employerUpdates.map(employer => ({
            type: 'employer_rating_updated',
            employer_id: employer.id,
            employer_name: employer.name,
            data: {
              current_rating: employer.current_4_point_rating,
              confidence_level: employer.rating_confidence,
              calculation_date: employer.rating_calculation_date,
            },
            timestamp: employer.updated_at,
          })))
        }
        break

      case 'assessment_changes':
        // Get new assessments
        const assessmentTypes = ['union_respect_assessments', 'safety_4_point_assessments', 'subcontractor_use_assessments', 'role_specific_assessments']

        for (const tableName of assessmentTypes) {
          const assessmentType = tableName.replace('_assessments', '')

          const { data: newAssessments } = await supabase
            .from(tableName)
            .select(`
              id,
              employer_id,
              assessment_date,
              status,
              created_at,
              updated_at,
              employers!inner(id, name)
            `)
            .in('employer_id', employerIds)
            .gte('created_at', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('created_at', { ascending: false })

          if (newAssessments) {
            updates.push(...newAssessments.map(assessment => ({
              type: 'assessment_created',
              employer_id: assessment.employer_id,
              employer_name: assessment.employers.name,
              data: {
                assessment_id: assessment.id,
                assessment_type: assessmentType,
                status: assessment.status,
                assessment_date: assessment.assessment_date,
              },
              timestamp: assessment.created_at,
            })))
          }

          const { data: updatedAssessments } = await supabase
            .from(tableName)
            .select(`
              id,
              employer_id,
              assessment_date,
              status,
              created_at,
              updated_at,
              employers!inner(id, name)
            `)
            .in('employer_id', employerIds)
            .gte('updated_at', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .neq('created_at', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .order('updated_at', { ascending: false })

          if (updatedAssessments) {
            updates.push(...updatedAssessments.map(assessment => ({
              type: 'assessment_updated',
              employer_id: assessment.employer_id,
              employer_name: assessment.employers.name,
              data: {
                assessment_id: assessment.id,
                assessment_type: assessmentType,
                status: assessment.status,
                assessment_date: assessment.assessment_date,
              },
              timestamp: assessment.updated_at,
            })))
          }
        }
        break

      case 'bulk_operations':
        // Get bulk operation status updates
        const { data: bulkOperations } = await supabase
          .from('bulk_rating_calculation_logs')
          .select('*')
          .contains('employer_ids', employerIds)
          .gte('completed_at', lastCheck || new Date(Date.now() - 5 * 60 * 1000).toISOString())
          .order('completed_at', { ascending: false })

        if (bulkOperations) {
          updates.push(...bulkOperations.map(operation => ({
            type: 'bulk_calculation_completed',
            data: {
              batch_id: operation.batch_id,
              total_employers: operation.total_employers,
              successful_calculations: operation.successful_calculations,
              failed_calculations: operation.failed_calculations,
              affected_employers: operation.employer_ids.filter((id: string) => employerIds.includes(id)),
            },
            timestamp: operation.completed_at,
          })))
        }
        break
    }

    // Sort updates by timestamp
    updates.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return NextResponse.json({
      success: true,
      data: {
        updates,
        subscription_info: {
          employer_ids: employerIds,
          subscription_type: subscriptionType,
          last_check: lastCheck,
          current_time: currentTime,
          updates_since_last_check: updates.length,
        },
      },
      metadata: {
        cache_control: 'no-cache', // Real-time data shouldn't be cached
        polling_recommended: true, // Suggest polling every 30-60 seconds
        next_poll_in: 30, // seconds
      },
    })
  } catch (error) {
    console.error('Error in real-time rating updates GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Subscribe to real-time updates (webhook-style)
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
    const {
      employer_ids,
      subscription_types = ['rating_changes'],
      webhook_url,
      notification_preferences = {
        email: false,
        push: false,
        webhook: !!webhook_url,
      },
      active = true,
    } = body

    if (!employer_ids || employer_ids.length === 0) {
      return NextResponse.json(
        { success: false, message: 'Employer IDs are required' },
        { status: 400 }
      )
    }

    // Create subscription record
    const { data: subscription, error } = await supabase
      .from('realtime_subscriptions')
      .insert({
        user_id: user.id,
        employer_ids,
        subscription_types,
        webhook_url,
        notification_preferences,
        active,
        created_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      console.error('Error creating realtime subscription:', error)
      return NextResponse.json(
        { success: false, message: 'Failed to create subscription', error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Real-time subscription created successfully',
      data: {
        subscription_id: subscription.id,
        employer_ids: subscription.employer_ids,
        subscription_types: subscription.subscription_types,
        webhook_url: subscription.webhook_url,
        active: subscription.active,
      },
      metadata: {
        created_at: subscription.created_at,
        polling_endpoints: {
          rating_changes: `/api/realtime/ratings-updates?type=rating_changes&employer_ids=${employer_ids.join(',')}`,
          assessment_changes: `/api/realtime/ratings-updates?type=assessment_changes&employer_ids=${employer_ids.join(',')}`,
          bulk_operations: `/api/realtime/ratings-updates?type=bulk_operations&employer_ids=${employer_ids.join(',')}`,
        },
      },
    })
  } catch (error) {
    console.error('Error in real-time subscription POST:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE - Cancel real-time subscription
export async function DELETE(request: NextRequest) {
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
    const subscriptionId = searchParams.get('subscription_id')

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, message: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Verify subscription belongs to user
    const { data: subscription, error: fetchError } = await supabase
      .from('realtime_subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !subscription) {
      return NextResponse.json(
        { success: false, message: 'Subscription not found' },
        { status: 404 }
      )
    }

    // Deactivate subscription
    const { error: updateError } = await supabase
      .from('realtime_subscriptions')
      .update({
        active: false,
        deactivated_at: new Date().toISOString(),
        deactivated_by: user.id,
      })
      .eq('id', subscriptionId)

    if (updateError) {
      console.error('Error deactivating subscription:', updateError)
      return NextResponse.json(
        { success: false, message: 'Failed to cancel subscription', error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Real-time subscription cancelled successfully',
      data: {
        subscription_id: subscriptionId,
        deactivated_at: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in real-time subscription DELETE:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
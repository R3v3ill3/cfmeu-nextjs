/**
 * Field Organizer Analytics API
 *
 * Provides comprehensive analytics and monitoring for field organizer mobile usage:
 * - Performance metrics and trends
 * - GPS accuracy and location data
 * - Photo capture and upload statistics
 * - Form completion rates and times
 * - Network connectivity patterns
 * - Device performance analysis
 * - Offline sync statistics
 * - User behavior insights
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { z } from 'zod'

// Validation schemas
const AnalyticsQuerySchema = z.object({
  userId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  projectId: z.string().optional(),
  taskType: z.enum(['mapping', 'audit', 'compliance', 'discovery']).optional(),
  deviceType: z.string().optional(),
  networkType: z.string().optional(),
  limit: z.number().min(1).max(1000).default(100),
  offset: z.number().min(0).default(0),
  groupBy: z.enum(['day', 'week', 'month', 'project', 'task_type']).optional()
})

const MetricsSubmissionSchema = z.object({
  userId: z.string(),
  sessionId: z.string(),
  projectId: z.string().optional(),
  taskType: z.enum(['mapping', 'audit', 'compliance', 'discovery']).optional(),
  metrics: z.object({
    // Location metrics
    gpsAccuracy: z.number().optional(),
    locationFetchTime: z.number().optional(),

    // Performance metrics
    pageLoadTime: z.number().optional(),
    formCompletionTime: z.number().optional(),
    photoCaptureTime: z.number().optional(),
    photoUploadTime: z.number().optional(),

    // Device metrics
    batteryLevel: z.number().optional(),
    deviceMemory: z.number().optional(),
    networkType: z.string().optional(),
    connectionSpeed: z.number().optional(),

    // Interaction metrics
    touchResponseTime: z.number().optional(),
    errorCount: z.number().optional(),
    crashCount: z.number().optional(),

    // Workflow metrics
    taskCompletionRate: z.number().optional(),
    autoSaveCount: z.number().optional(),
    offlineDuration: z.number().optional(),
    syncAttempts: z.number().optional(),
    syncSuccessRate: z.number().optional()
  }),
  events: z.array(z.object({
    type: z.string(),
    timestamp: z.number(),
    duration: z.number().optional(),
    success: z.boolean(),
    metadata: z.record(z.any()).optional(),
    error: z.string().optional()
  })).optional(),
  deviceInfo: z.object({
    userAgent: z.string(),
    model: z.string().optional(),
    os: z.string().optional(),
    screenResolution: z.string().optional(),
    memoryCapacity: z.number().optional()
  }),
  timestamp: z.number()
})

// Analytics aggregation functions
async function getPerformanceMetrics(supabase: any, query: any) {
  const { userId, dateFrom, dateTo, projectId, limit, offset } = query

  let dbQuery = supabase
    .from('field_organizer_metrics')
    .select(`
      *,
      profiles:user_id (name, email, role)
    `)
    .order('timestamp', { ascending: false })
    .limit(limit)
    .range(offset, offset + limit - 1)

  // Apply filters
  if (userId) dbQuery = dbQuery.eq('user_id', userId)
  if (projectId) dbQuery = dbQuery.eq('project_id', projectId)
  if (dateFrom) dbQuery = dbQuery.gte('timestamp', dateFrom)
  if (dateTo) dbQuery = dbQuery.lte('timestamp', dateTo)

  const { data, error } = await dbQuery

  if (error) throw error

  return data
}

async function getAggregatedMetrics(supabase: any, query: any) {
  const { userId, dateFrom, dateTo, groupBy = 'day' } = query

  let dateFormat = ''
  switch (groupBy) {
    case 'day':
      dateFormat = 'YYYY-MM-DD'
      break
    case 'week':
      dateFormat = 'YYYY-"W"WW'
      break
    case 'month':
      dateFormat = 'YYYY-MM'
      break
    default:
      dateFormat = 'YYYY-MM-DD'
  }

  const { data, error } = await supabase
    .rpc('aggregate_field_organizer_metrics', {
      p_user_id: userId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
      p_group_format: dateFormat
    })

  if (error) throw error

  return data
}

async function getDeviceAnalytics(supabase: any, query: any) {
  const { data, error } = await supabase
    .from('field_organizer_device_analytics')
    .select('*')
    .order('last_seen', { ascending: false })

  if (error) throw error

  // Aggregate device statistics
  const deviceStats = data.reduce((acc: any, device: any) => {
    const key = `${device.os}_${device.model || 'unknown'}`
    if (!acc[key]) {
      acc[key] = {
        os: device.os,
        model: device.model,
        count: 0,
        avgPerformance: 0,
        avgBatteryLife: 0,
        totalSessions: 0,
        crashRate: 0
      }
    }

    acc[key].count += 1
    acc[key].totalSessions += device.session_count
    acc[key].avgPerformance += device.avg_performance_score || 0
    acc[key].avgBatteryLife += device.avg_battery_level || 0
    acc[key].crashRate += device.crash_rate || 0

    return acc
  }, {})

  // Calculate averages
  Object.values(deviceStats).forEach((stat: any) => {
    stat.avgPerformance /= stat.count
    stat.avgBatteryLife /= stat.count
  })

  return Object.values(deviceStats)
}

async function getNetworkAnalytics(supabase: any, query: any) {
  const { userId, dateFrom, dateTo } = query

  let dbQuery = supabase
    .from('field_organizer_network_metrics')
    .select('*')

  if (userId) dbQuery = dbQuery.eq('user_id', userId)
  if (dateFrom) dbQuery = dbQuery.gte('timestamp', dateFrom)
  if (dateTo) dbQuery = dbQuery.lte('timestamp', dateTo)

  const { data, error } = await dbQuery.order('timestamp', { ascending: false })

  if (error) throw error

  // Aggregate network statistics
  const networkStats = data.reduce((acc: any, metric: any) => {
    const type = metric.network_type || 'unknown'
    if (!acc[type]) {
      acc[type] = {
        type,
        count: 0,
        avgSpeed: 0,
        reliability: 0,
        usageTime: 0,
        offlineCount: 0
      }
    }

    acc[type].count += 1
    acc[type].avgSpeed += metric.connection_speed || 0
    acc[type].reliability += metric.is_online ? 1 : 0
    acc[type].usageTime += metric.duration || 0
    if (!metric.is_online) acc[type].offlineCount += 1

    return acc
  }, {})

  // Calculate averages
  Object.values(networkStats).forEach((stat: any) => {
    if (stat.count > 0) {
      stat.avgSpeed /= stat.count
      stat.reliability = (stat.reliability / stat.count) * 100
    }
  })

  return Object.values(networkStats)
}

async function getTaskPerformanceAnalytics(supabase: any, query: any) {
  const { userId, dateFrom, dateTo, taskType } = query

  let dbQuery = supabase
    .from('field_organizer_task_analytics')
    .select('*')

  if (userId) dbQuery = dbQuery.eq('user_id', userId)
  if (taskType) dbQuery = dbQuery.eq('task_type', taskType)
  if (dateFrom) dbQuery = dbQuery.gte('started_at', dateFrom)
  if (dateTo) dbQuery = dbQuery.lte('started_at', dateTo)

  const { data, error } = await dbQuery.order('started_at', { ascending: false })

  if (error) throw error

  // Aggregate task performance
  const taskStats = data.reduce((acc: any, task: any) => {
    const type = task.task_type
    if (!acc[type]) {
      acc[type] = {
        taskType: type,
        totalTasks: 0,
        completedTasks: 0,
        avgDuration: 0,
        avgFormTime: 0,
        errorRate: 0,
        satisfactionScore: 0,
        photoCount: 0,
        gpsAccuracy: 0
      }
    }

    acc[type].totalTasks += 1
    if (task.status === 'completed') acc[type].completedTasks += 1
    acc[type].avgDuration += task.duration || 0
    acc[type].avgFormTime += task.form_completion_time || 0
    acc[type].errorRate += task.error_count || 0
    acc[type].satisfactionScore += task.satisfaction_score || 0
    acc[type].photoCount += task.photo_count || 0
    acc[type].gpsAccuracy += task.gps_accuracy || 0

    return acc
  }, {})

  // Calculate averages
  Object.values(taskStats).forEach((stat: any) => {
    if (stat.totalTasks > 0) {
      stat.avgDuration /= stat.totalTasks
      stat.avgFormTime /= stat.totalTasks
      stat.errorRate /= stat.totalTasks
      stat.satisfactionScore /= stat.totalTasks
      stat.gpsAccuracy /= stat.totalTasks
      stat.completionRate = (stat.completedTasks / stat.totalTasks) * 100
    }
  })

  return Object.values(taskStats)
}

async function storeMetrics(supabase: any, metricsData: any) {
  const { userId, sessionId, projectId, taskType, metrics, events, deviceInfo, timestamp } = metricsData

  // Store main metrics
  const { error: metricsError } = await supabase
    .from('field_organizer_metrics')
    .insert({
      user_id: userId,
      session_id: sessionId,
      project_id: projectId,
      task_type: taskType,
      gps_accuracy: metrics.gpsAccuracy,
      location_fetch_time: metrics.locationFetchTime,
      page_load_time: metrics.pageLoadTime,
      form_completion_time: metrics.formCompletionTime,
      photo_capture_time: metrics.photoCaptureTime,
      photo_upload_time: metrics.photoUploadTime,
      battery_level: metrics.batteryLevel,
      device_memory: metrics.deviceMemory,
      network_type: metrics.networkType,
      connection_speed: metrics.connectionSpeed,
      touch_response_time: metrics.touchResponseTime,
      error_count: metrics.errorCount,
      crash_count: metrics.crashCount,
      task_completion_rate: metrics.taskCompletionRate,
      auto_save_count: metrics.autoSaveCount,
      offline_duration: metrics.offlineDuration,
      sync_attempts: metrics.syncAttempts,
      sync_success_rate: metrics.syncSuccessRate,
      timestamp: new Date(timestamp).toISOString()
    })

  if (metricsError) throw metricsError

  // Store events if provided
  if (events && events.length > 0) {
    const eventsToStore = events.map(event => ({
      user_id: userId,
      session_id: sessionId,
      event_type: event.type,
      timestamp: new Date(event.timestamp).toISOString(),
      duration: event.duration,
      success: event.success,
      metadata: event.metadata,
      error: event.error
    }))

    const { error: eventsError } = await supabase
      .from('field_organizer_events')
      .insert(eventsToStore)

    if (eventsError) throw eventsError
  }

  // Update device analytics
  await updateDeviceAnalytics(supabase, userId, deviceInfo, metrics)

  // Update network analytics
  if (metrics.networkType) {
    await updateNetworkAnalytics(supabase, userId, metrics.networkType, metrics.connectionSpeed, timestamp)
  }

  return { success: true }
}

async function updateDeviceAnalytics(supabase: any, userId: string, deviceInfo: any, metrics: any) {
  const { error } = await supabase
    .from('field_organizer_device_analytics')
    .upsert({
      user_id: userId,
      user_agent: deviceInfo.userAgent,
      model: deviceInfo.model,
      os: deviceInfo.os,
      screen_resolution: deviceInfo.screenResolution,
      memory_capacity: deviceInfo.memoryCapacity,
      avg_performance_score: metrics.touchResponseTime ? 100 - Math.min(metrics.touchResponseTime, 100) : null,
      avg_battery_level: metrics.batteryLevel,
      last_seen: new Date().toISOString(),
      session_count: 1 // This would be aggregated differently in production
    })

  if (error) throw error
}

async function updateNetworkAnalytics(supabase: any, userId: string, networkType: string, connectionSpeed: number, timestamp: number) {
  const { error } = await supabase
    .from('field_organizer_network_metrics')
    .insert({
      user_id: userId,
      network_type: networkType,
      connection_speed: connectionSpeed,
      is_online: true, // This would be determined from actual connection status
      timestamp: new Date(timestamp).toISOString(),
      duration: 60000 // Default 1 minute, would be calculated from actual session
    })

  if (error) throw error
}

// GET handler - Retrieve analytics data
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { searchParams } = new URL(request.url)
    const query = Object.fromEntries(searchParams)

    // Validate query parameters
    const validatedQuery = AnalyticsQuerySchema.parse(query)

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    // Non-admin users can only see their own data
    if (profile.role !== 'admin' && validatedQuery.userId && validatedQuery.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // If userId not specified and not admin, use current user
    if (!validatedQuery.userId && profile.role !== 'admin') {
      validatedQuery.userId = user.id
    }

    const analyticsType = searchParams.get('type') || 'performance'

    let result
    switch (analyticsType) {
      case 'performance':
        result = await getPerformanceMetrics(supabase, validatedQuery)
        break
      case 'aggregated':
        result = await getAggregatedMetrics(supabase, validatedQuery)
        break
      case 'devices':
        result = await getDeviceAnalytics(supabase, validatedQuery)
        break
      case 'network':
        result = await getNetworkAnalytics(supabase, validatedQuery)
        break
      case 'tasks':
        result = await getTaskPerformanceAnalytics(supabase, validatedQuery)
        break
      default:
        // Return overview data
        const [performance, devices, network, tasks] = await Promise.all([
          getPerformanceMetrics(supabase, { ...validatedQuery, limit: 50 }),
          getDeviceAnalytics(supabase, validatedQuery),
          getNetworkAnalytics(supabase, validatedQuery),
          getTaskPerformanceAnalytics(supabase, validatedQuery)
        ])

        result = {
          performance: performance.slice(0, 10),
          deviceAnalytics: devices,
          networkAnalytics: network,
          taskAnalytics: tasks,
          summary: {
            totalSessions: performance.length,
            avgPerformanceScore: performance.reduce((sum: number, p: any) => sum + (p.task_completion_rate || 0), 0) / performance.length,
            mostUsedDevice: devices.length > 0 ? devices[0] : null,
            networkReliability: network.length > 0 ? network.reduce((sum: number, n: any) => sum + n.reliability, 0) / network.length : 0,
            taskCompletionRate: tasks.length > 0 ? tasks.reduce((sum: number, t: any) => sum + t.completionRate, 0) / tasks.length : 0
          }
        }
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        query: validatedQuery,
        timestamp: new Date().toISOString(),
        total: Array.isArray(result) ? result.length : Object.keys(result).length
      }
    })

  } catch (error) {
    console.error('Field Organizer Analytics API Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid query parameters',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// POST handler - Store metrics data
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = MetricsSubmissionSchema.parse(body)

    // Verify user can only submit their own data
    if (validatedData.userId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Store metrics
    await storeMetrics(supabase, validatedData)

    return NextResponse.json({
      success: true,
      message: 'Metrics stored successfully',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Field Organizer Metrics Storage Error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid metrics data',
        details: error.errors
      }, { status: 400 })
    }

    return NextResponse.json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
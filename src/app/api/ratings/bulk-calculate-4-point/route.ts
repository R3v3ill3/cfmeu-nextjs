import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Schema for bulk rating calculation
const BulkRatingCalculationSchema = z.object({
  employer_ids: z.array(z.string().uuid()).min(1).max(100), // Limit to 100 at a time
  trigger_type: z.enum(['bulk_operation', 'scheduled_recalculation', 'emergency_recalculation']).default('bulk_operation'),
  force_recalculate: z.boolean().default(false),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  batch_id: z.string().uuid().optional(),
})

// Background job tracking for bulk calculations
const activeBulkJobs = new Map<string, {
  id: string
  employer_ids: string[]
  started_at: string
  status: 'running' | 'completed' | 'failed'
  progress: number
  results: any[]
  errors: any[]
}>()

// POST - Start bulk 4-point rating calculation
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  const batchId = crypto.randomUUID()

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user has admin or organiser role for bulk operations
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'organiser'].includes(profile.role)) {
      return NextResponse.json(
        { success: false, message: 'Insufficient permissions for bulk calculations' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const validatedData = BulkRatingCalculationSchema.parse(body)

    // Verify all employers exist
    const { data: employers, error: employerError } = await supabase
      .from('employers')
      .select('id, name, employer_type')
      .in('id', validatedData.employer_ids)

    if (employerError || !employers || employers.length !== validatedData.employer_ids.length) {
      return NextResponse.json(
        { success: false, message: 'One or more employers not found' },
        { status: 404 }
      )
    }

    // Initialize bulk job tracking
    const bulkJob = {
      id: batchId,
      employer_ids: validatedData.employer_ids,
      started_at: new Date().toISOString(),
      status: 'running' as const,
      progress: 0,
      results: [],
      errors: [],
    }
    activeBulkJobs.set(batchId, bulkJob)

    // Start the bulk calculation process in the background
    processBulkCalculation(batchId, validatedData.employer_ids, user.id, supabase)
      .catch(error => {
        console.error('Bulk calculation process failed:', error)
        const job = activeBulkJobs.get(batchId)
        if (job) {
          job.status = 'failed'
          job.errors.push({ message: error.message, timestamp: new Date().toISOString() })
        }
      })

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: 'Bulk rating calculation started',
      data: {
        batch_id: batchId,
        employer_count: validatedData.employer_ids.length,
        trigger_type: validatedData.trigger_type,
        priority: validatedData.priority,
        estimated_duration: Math.max(60, validatedData.employer_ids.length * 2), // seconds
      },
      metadata: {
        processing_time_ms: processingTime,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Error in bulk rating calculation POST:', error)

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

// GET - Get status of a bulk calculation job
export async function GET(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const job = activeBulkJobs.get(params.batchId)

    if (!job) {
      return NextResponse.json(
        { success: false, message: 'Bulk calculation job not found' },
        { status: 404 }
      )
    }

    // Calculate progress percentage
    const progressPercentage = job.employer_ids.length > 0
      ? (job.progress / job.employer_ids.length) * 100
      : 0

    // Estimate remaining time
    const elapsedTime = Date.now() - new Date(job.started_at).getTime()
    const avgTimePerEmployer = job.progress > 0 ? elapsedTime / job.progress : 2000 // 2 seconds default estimate
    const remainingEmployers = job.employer_ids.length - job.progress
    const estimatedRemainingTime = remainingEmployers * avgTimePerEmployer

    return NextResponse.json({
      success: true,
      data: {
        batch_id: job.id,
        status: job.status,
        progress: {
          current: job.progress,
          total: job.employer_ids.length,
          percentage: Math.round(progressPercentage),
        },
        timing: {
          started_at: job.started_at,
          elapsed_time_ms: elapsedTime,
          estimated_remaining_time_ms: estimatedRemainingTime,
        },
        results: {
          successful_calculations: job.results.length,
          errors: job.errors.length,
          details: job.status === 'completed' ? {
            results: job.results,
            errors: job.errors,
          } : null,
        },
      },
    })
  } catch (error) {
    console.error('Error in bulk calculation status GET:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Background processing function
async function processBulkCalculation(
  batchId: string,
  employerIds: string[],
  userId: string,
  supabase: any
) {
  const job = activeBulkJobs.get(batchId)
  if (!job) return

  const results = []
  const errors = []

  for (let i = 0; i < employerIds.length; i++) {
    const employerId = employerIds[i]

    try {
      // Call the individual rating calculation endpoint
      const calculationResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ratings/calculate-4-point`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({
          employer_id: employerId,
          trigger_type: 'bulk_operation',
          force_recalculate: true,
        }),
      })

      if (calculationResponse.ok) {
        const calculationResult = await calculationResponse.json()
        results.push({
          employer_id: employerId,
          success: true,
          final_score: calculationResult.data.calculation.final_score,
          confidence_level: calculationResult.data.calculation.confidence_level,
          calculation_time: calculationResult.metadata.processing_time_ms,
        })
      } else {
        const errorData = await calculationResponse.json()
        errors.push({
          employer_id: employerId,
          error: errorData.message || 'Calculation failed',
          status: calculationResponse.status,
        })
      }
    } catch (error) {
      errors.push({
        employer_id: employerId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }

    // Update progress
    job.progress = i + 1
    job.results = results
    job.errors = errors

    // Add a small delay to prevent overwhelming the system
    if (i < employerIds.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  // Mark job as completed
  job.status = 'completed'

  // Log bulk calculation completion
  await supabase
    .from('bulk_rating_calculation_logs')
    .insert({
      batch_id: batchId,
      employer_ids: employerIds,
      initiated_by: userId,
      started_at: job.started_at,
      completed_at: new Date().toISOString(),
      total_employers: employerIds.length,
      successful_calculations: results.length,
      failed_calculations: errors.length,
      results: results,
      errors: errors,
    })

  // Clean up old completed jobs (keep only last 10)
  const completedJobs = Array.from(activeBulkJobs.entries())
    .filter(([_, job]) => job.status === 'completed')
    .sort(([_, a], [__, b]) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())

  if (completedJobs.length > 10) {
    for (let i = 10; i < completedJobs.length; i++) {
      activeBulkJobs.delete(completedJobs[i][0])
    }
  }
}

// DELETE - Cancel a running bulk calculation job
export async function DELETE(
  request: NextRequest,
  { params }: { params: { batchId: string } }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const job = activeBulkJobs.get(params.batchId)

    if (!job) {
      return NextResponse.json(
        { success: false, message: 'Bulk calculation job not found' },
        { status: 404 }
      )
    }

    if (job.status !== 'running') {
      return NextResponse.json(
        { success: false, message: 'Job is not running and cannot be cancelled' },
        { status: 400 }
      )
    }

    // Mark job as cancelled
    job.status = 'failed'
    job.errors.push({
      message: 'Job cancelled by user',
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: 'Bulk calculation job cancelled successfully',
      data: {
        batch_id: params.batchId,
        cancelled_at: new Date().toISOString(),
        progress: {
          completed: job.progress,
          total: job.employer_ids.length,
        },
      },
    })
  } catch (error) {
    console.error('Error cancelling bulk calculation:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
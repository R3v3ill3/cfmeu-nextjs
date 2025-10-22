import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { generateJobIdempotencyKey, isUniqueViolationError } from '@/lib/idempotency'

export const dynamic = 'force-dynamic'

/**
 * POST /api/projects/batch-upload/retry-failed
 *
 * Retries all failed scans in a batch by recreating their jobs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { batchId, scanIds } = body

    if (!batchId && (!scanIds || scanIds.length === 0)) {
      return NextResponse.json(
        { error: 'Either batchId or scanIds required' },
        { status: 400 }
      )
    }

    console.log('[retry-failed] Retrying failed scans:', { batchId, scanIds })

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Build query for failed scans - fetch all metadata to preserve context
    let query = supabase
      .from('mapping_sheet_scans')
      .select('id, file_url, file_name, upload_mode, batch_id, selected_pages, error_message, retry_attempt, ai_provider')
      .eq('status', 'failed')

    if (batchId) {
      query = query.eq('batch_id', batchId)
    } else if (scanIds && scanIds.length > 0) {
      query = query.in('id', scanIds)
    }

    const { data: failedScans, error: fetchError } = await query

    if (fetchError) {
      console.error('[retry-failed] Fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    if (!failedScans || failedScans.length === 0) {
      return NextResponse.json({
        message: 'No failed scans found',
        retriedCount: 0
      })
    }

    console.log(`[retry-failed] Found ${failedScans.length} failed scans`)

    // Reset scans to pending and create new jobs with preserved context
    const jobsCreated = []
    const scansUpdated = []

    for (const scan of failedScans) {
      const retryAttempt = (scan.retry_attempt || 0) + 1
      const previousError = scan.error_message

      // Reset scan to pending with incremented retry counter
      // Preserve previous error in notes for debugging
      const { error: updateError } = await supabase
        .from('mapping_sheet_scans')
        .update({
          status: 'pending',
          error_message: null,
          extraction_attempted_at: null,
          retry_attempt: retryAttempt,
          notes: scan.error_message
            ? `Retry attempt ${retryAttempt}. Previous error: ${previousError}`
            : null,
        })
        .eq('id', scan.id)

      if (updateError) {
        console.error(`[retry-failed] Failed to reset scan ${scan.id}:`, updateError)
        continue
      }

      scansUpdated.push(scan.id)

      console.log(`[retry-failed] Scan ${scan.id}: Retry attempt ${retryAttempt}, selected_pages: ${scan.selected_pages ? JSON.stringify(scan.selected_pages) : 'null'}`)

      // Prepare job payload
      const jobPayload = {
        scanId: scan.id,
        fileUrl: scan.file_url,
        fileName: scan.file_name,
        uploadMode: scan.upload_mode,
        selectedPages: scan.selected_pages, // CRITICAL: Include selected pages
        aiProvider: scan.ai_provider || 'claude', // Preserve AI provider preference
        retryAttempt: retryAttempt,
        previousError: previousError,
      }

      // Generate idempotency key (note: includes retryAttempt to allow retries)
      const jobIdempotencyKey = await generateJobIdempotencyKey(
        user.id,
        scan.id,
        'mapping_sheet_scan',
        jobPayload
      )

      // Check if retry job already exists
      const { data: existingJob } = await supabase
        .from('scraper_jobs')
        .select('id')
        .eq('idempotency_key', jobIdempotencyKey)
        .single()

      if (existingJob) {
        console.log(`[retry-failed] Job already exists for scan ${scan.id}: ${existingJob.id}`)
        jobsCreated.push(existingJob.id)
        continue
      }

      // Create new job in scraper_jobs with full context preserved
      const { data: job, error: jobError } = await supabase
        .from('scraper_jobs')
        .insert({
          job_type: 'mapping_sheet_scan',
          status: 'queued',
          priority: 5,
          payload: jobPayload,
          max_attempts: 3,
          run_at: new Date().toISOString(),
          created_by: user.id, // Required for RLS policy
          idempotency_key: jobIdempotencyKey,
        })
        .select('id')
        .single()

      if (jobError) {
        // If unique violation due to race condition, that's okay
        if (isUniqueViolationError(jobError)) {
          console.log(`[retry-failed] Job already created by concurrent request for scan ${scan.id}`)
          continue
        }

        console.error(`[retry-failed] Failed to create job for scan ${scan.id}:`, jobError)
        continue
      }

      if (job) {
        jobsCreated.push(job.id)
      }
    }

    console.log(`[retry-failed] Retried ${scansUpdated.length} scans, created ${jobsCreated.length} jobs`)

    return NextResponse.json({
      success: true,
      retriedCount: scansUpdated.length,
      scansUpdated,
      jobsCreated,
    })
  } catch (error) {
    console.error('[retry-failed] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to retry scans' },
      { status: 500 }
    )
  }
}

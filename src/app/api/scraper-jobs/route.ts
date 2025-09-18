import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

const SUPPORTED_JOB_TYPES = ['fwc_lookup', 'incolink_sync'] as const
const DEFAULT_MAX_ATTEMPTS = 5
const DEFAULT_PRIORITY = 5

type SupportedJobType = typeof SUPPORTED_JOB_TYPES[number]

function normalizePriority(priority: unknown) {
  const value = Number(priority)
  if (!Number.isFinite(value)) return DEFAULT_PRIORITY
  return Math.min(Math.max(Math.trunc(value), 1), 10)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { jobType, payload, priority, runAt, maxAttempts, progressTotal } = body as {
    jobType?: string
    payload?: unknown
    priority?: number
    runAt?: string
    maxAttempts?: number
    progressTotal?: number
  }

  if (!jobType || !SUPPORTED_JOB_TYPES.includes(jobType as SupportedJobType)) {
    return NextResponse.json({ error: 'Unsupported job type' }, { status: 400 })
  }

  if (payload === undefined || payload === null) {
    return NextResponse.json({ error: 'Missing payload' }, { status: 400 })
  }

  const priorityValue = normalizePriority(priority)
  const maxAttemptsValue = Number.isInteger(maxAttempts) ? Math.max(1, maxAttempts as number) : DEFAULT_MAX_ATTEMPTS

  let runAtValue: string | undefined
  if (runAt) {
    const runDate = new Date(runAt)
    if (Number.isNaN(runDate.getTime())) {
      return NextResponse.json({ error: 'Invalid runAt value' }, { status: 400 })
    }
    runAtValue = runDate.toISOString()
  }

  const insertPayload: Record<string, unknown> = {
    job_type: jobType,
    payload,
    priority: priorityValue,
    max_attempts: maxAttemptsValue,
    created_by: user.id,
  }

  if (runAtValue) {
    insertPayload.run_at = runAtValue
  }

  if (Number.isInteger(progressTotal)) {
    insertPayload.progress_total = Math.max(0, progressTotal as number)
  }

  const { data, error } = await supabase
    .from('scraper_jobs')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('scraper_job_events')
    .insert({
      job_id: data.id,
      event_type: 'queued',
      payload: { createdBy: user.id },
    })

  return NextResponse.json({ job: data })
}

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const url = new URL(request.url)
  const id = url.searchParams.get('id') ?? undefined
  const includeEvents = url.searchParams.get('includeEvents') === '1'

  if (id) {
    const jobQuery = supabase
      .from('scraper_jobs')
      .select('*')
      .eq('id', id)
      .eq('created_by', user.id)
      .maybeSingle()

    const [jobResult, eventsResult] = await Promise.all([
      jobQuery,
      includeEvents
        ? supabase
            .from('scraper_job_events')
            .select('*')
            .eq('job_id', id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ])

    if (jobResult.error) {
      return NextResponse.json({ error: jobResult.error.message }, { status: 500 })
    }

    if (!jobResult.data) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (eventsResult && eventsResult.error) {
      return NextResponse.json({ error: eventsResult.error.message }, { status: 500 })
    }

    return NextResponse.json({ job: jobResult.data, events: eventsResult?.data ?? [] })
  }

  const status = url.searchParams.get('status') ?? undefined
  const limit = Math.min(Number(url.searchParams.get('limit') ?? 20) || 20, 100)

  let query = supabase
    .from('scraper_jobs')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ jobs: data ?? [] })
}

export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const { id, action } = body as { id?: string; action?: string }

  if (!id) {
    return NextResponse.json({ error: 'Missing job id' }, { status: 400 })
  }

  if (action !== 'cancel') {
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
  }

  const { data: job, error: fetchError } = await supabase
    .from('scraper_jobs')
    .select('*')
    .eq('id', id)
    .eq('created_by', user.id)
    .maybeSingle()

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!job) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled') {
    return NextResponse.json({ job })
  }

  const { data, error } = await supabase
    .from('scraper_jobs')
    .update({ status: 'cancelled', completed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await supabase
    .from('scraper_job_events')
    .insert({
      job_id: id,
      event_type: 'cancelled',
      payload: { cancelledBy: user.id },
    })

  return NextResponse.json({ job: data })
}

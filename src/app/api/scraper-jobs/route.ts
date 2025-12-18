import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import * as Sentry from '@sentry/nextjs'

export const dynamic = 'force-dynamic'

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
  const debugEnabled = request.cookies.get('__agent_debug')?.value === '1'
  const sbCookieCount = request.cookies.getAll().filter((c) => c.name.startsWith('sb-')).length
  if (debugEnabled) {
    // #region agent log
    try {
      Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setTag('component', 'scraper-jobs')
        scope.setTag('method', 'POST')
        scope.setExtra('path', request.nextUrl.pathname)
        scope.setExtra('sbCookieCount', sbCookieCount)
        Sentry.captureMessage('[AgentDebug] scraper-jobs POST request')
      })
    } catch {}
    // #endregion
  }

  // Tag jobs with an environment so workers can be isolated (local vs production).
  // - On Vercel: VERCEL_ENV is 'production' | 'preview' | 'development'
  // - Locally: VERCEL_ENV is undefined; NODE_ENV is usually 'development'
  const jobEnvironment =
    process.env.VERCEL_ENV != null
      ? process.env.VERCEL_ENV === 'production'
        ? 'production'
        : 'development'
      : process.env.NODE_ENV === 'production'
        ? 'production'
        : 'development'

  const supabase = await createServerSupabase()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          scope.setExtra('authErrorMessage', authError.message)
          scope.setExtra('authErrorStatus', (authError as any)?.status ?? null)
          Sentry.captureMessage('[AgentDebug] scraper-jobs authError')
        })
      } catch {}
      // #endregion
    }
    return NextResponse.json({ error: authError.message }, { status: 401 })
  }

  if (!user) {
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          Sentry.captureMessage('[AgentDebug] scraper-jobs no user')
        })
      } catch {}
      // #endregion
    }
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          scope.setExtra('userIdSuffix', user.id.slice(-6))
          Sentry.captureMessage('[AgentDebug] scraper-jobs invalid payload')
        })
      } catch {}
      // #endregion
    }
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
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          scope.setExtra('userIdSuffix', user.id.slice(-6))
          scope.setExtra('jobType', jobType ?? null)
          Sentry.captureMessage('[AgentDebug] scraper-jobs unsupported job type')
        })
      } catch {}
      // #endregion
    }
    return NextResponse.json({ error: 'Unsupported job type' }, { status: 400 })
  }

  if (payload === undefined || payload === null) {
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('warning')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          scope.setExtra('userIdSuffix', user.id.slice(-6))
          scope.setExtra('jobType', jobType)
          Sentry.captureMessage('[AgentDebug] scraper-jobs missing payload')
        })
      } catch {}
      // #endregion
    }
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
    environment: jobEnvironment,
  }

  if (runAtValue) {
    insertPayload.run_at = runAtValue
  }

  if (Number.isInteger(progressTotal)) {
    insertPayload.progress_total = Math.max(0, progressTotal as number)
  }

  if (debugEnabled) {
    // #region agent log
    try {
      const payloadAny = payload as any
      const employerIdsCount = Array.isArray(payloadAny?.employerIds) ? payloadAny.employerIds.length : null
      Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setTag('component', 'scraper-jobs')
        scope.setTag('method', 'POST')
        scope.setExtra('path', request.nextUrl.pathname)
        scope.setExtra('sbCookieCount', sbCookieCount)
        scope.setExtra('userIdSuffix', user.id.slice(-6))
        scope.setExtra('jobType', jobType)
        scope.setExtra('priority', priorityValue)
        scope.setExtra('progressTotal', Number.isInteger(progressTotal) ? progressTotal : null)
        scope.setExtra('employerIdsCount', employerIdsCount)
        Sentry.captureMessage('[AgentDebug] scraper-jobs validated request')
      })
    } catch {}
    // #endregion
  }

  const { data, error } = await supabase
    .from('scraper_jobs')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    if (debugEnabled) {
      // #region agent log
      try {
        Sentry.withScope((scope) => {
          scope.setLevel('error')
          scope.setTag('component', 'scraper-jobs')
          scope.setTag('method', 'POST')
          scope.setExtra('path', request.nextUrl.pathname)
          scope.setExtra('sbCookieCount', sbCookieCount)
          scope.setExtra('userIdSuffix', user.id.slice(-6))
          scope.setExtra('jobType', jobType)
          scope.setExtra('errorMessage', error.message)
          scope.setExtra('errorCode', (error as any)?.code ?? null)
          Sentry.captureMessage('[AgentDebug] scraper-jobs insert failed')
        })
      } catch {}
      // #endregion
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const eventInsert = await supabase
    .from('scraper_job_events')
    .insert({
      job_id: data.id,
      event_type: 'queued',
      payload: { createdBy: user.id },
    })

  if (eventInsert.error && debugEnabled) {
    // #region agent log
    try {
      Sentry.withScope((scope) => {
        scope.setLevel('warning')
        scope.setTag('component', 'scraper-jobs')
        scope.setTag('method', 'POST')
        scope.setExtra('path', request.nextUrl.pathname)
        scope.setExtra('sbCookieCount', sbCookieCount)
        scope.setExtra('userIdSuffix', user.id.slice(-6))
        scope.setExtra('jobIdSuffix', data.id.slice(-6))
        scope.setExtra('errorMessage', eventInsert.error?.message ?? null)
        scope.setExtra('errorCode', (eventInsert.error as any)?.code ?? null)
        Sentry.captureMessage('[AgentDebug] scraper-jobs event insert failed')
      })
    } catch {}
    // #endregion
  } else if (debugEnabled) {
    // #region agent log
    try {
      Sentry.withScope((scope) => {
        scope.setLevel('info')
        scope.setTag('component', 'scraper-jobs')
        scope.setTag('method', 'POST')
        scope.setExtra('path', request.nextUrl.pathname)
        scope.setExtra('sbCookieCount', sbCookieCount)
        scope.setExtra('userIdSuffix', user.id.slice(-6))
        scope.setExtra('jobIdSuffix', data.id.slice(-6))
        Sentry.captureMessage('[AgentDebug] scraper-jobs created')
      })
    } catch {}
    // #endregion
  }

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

  const searchParams = request.nextUrl.searchParams
  const id = searchParams.get('id') ?? undefined
  const includeEvents = searchParams.get('includeEvents') === '1'

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

  const status = searchParams.get('status') ?? undefined
  const limit = Math.min(Number(searchParams.get('limit') ?? 20) || 20, 100)

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

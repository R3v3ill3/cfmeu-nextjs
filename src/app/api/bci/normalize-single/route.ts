import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Timeout for upstream worker request (30 seconds to handle Railway cold starts)
const UPSTREAM_TIMEOUT_MS = 30_000

/**
 * POST /api/bci/normalize-single
 * 
 * Accepts a BCI XLSX file upload and returns normalized project + company data.
 * Used by the mobile BCI import flow to allow organisers to import single projects.
 * 
 * The actual normalization is done by the BCI worker - this route proxies to it.
 */
export async function POST(request: NextRequest) {
  // Verify user is authenticated
  const supabase = await createServerSupabase()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Check user role - must be organiser, lead_organiser, or admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  
  if (!profile || !['organiser', 'lead_organiser', 'admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
  }
  
  // Get worker URL
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const workerBaseUrl = process.env.BCI_WORKER_URL || 'http://localhost:3250'

  if (isProd && !process.env.BCI_WORKER_URL) {
    console.error('[bci-normalize-single] BCI_WORKER_URL is not configured in production')
    return NextResponse.json({ error: 'BCI_WORKER_URL is not configured' }, { status: 500 })
  }

  try {
    // Parse the incoming form data
    const incomingFormData = await request.formData()
    const file = incomingFormData.get('file')
    
    if (!file) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    // Validate file is a Blob/File
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'Invalid file field - expected file upload' }, { status: 400 })
    }

    // Create a new FormData for the upstream request
    const upstreamFormData = new FormData()
    upstreamFormData.append('file', file, (file as File).name || 'upload.xlsx')

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, UPSTREAM_TIMEOUT_MS)

    console.log(`[bci-normalize-single] Forwarding request to ${workerBaseUrl}/bci/normalize-xlsx`)

    try {
      const upstream = await fetch(`${workerBaseUrl}/bci/normalize-xlsx`, {
        method: 'POST',
        body: upstreamFormData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log(`[bci-normalize-single] Upstream response: ${upstream.status}`)

      const contentType = upstream.headers.get('content-type') || ''
      
      if (contentType.includes('application/json')) {
        const data = await upstream.json()
        
        if (!upstream.ok) {
          return NextResponse.json(data, { status: upstream.status })
        }
        
        // Return normalized data with metadata
        return NextResponse.json({
          success: true,
          projects: data.projects || [],
          companies: data.companies || [],
          projectCount: (data.projects || []).length,
          companyCount: (data.companies || []).length,
        })
      }
      
      const text = await upstream.text()
      return new NextResponse(text, { 
        status: upstream.status, 
        headers: { 'content-type': contentType || 'text/plain' } 
      })
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId)
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[bci-normalize-single] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms`)
        return NextResponse.json({ 
          error: 'Request timed out. The worker may be starting up - please try again in a few seconds.',
          code: 'TIMEOUT'
        }, { status: 504 })
      }
      
      console.error('[bci-normalize-single] Upstream fetch failed:', fetchError)
      throw fetchError
    }
  } catch (err: unknown) {
    console.error('[bci-normalize-single] Proxy request failed:', err)
    return NextResponse.json({ 
      error: 'Failed to process file. Please try again.',
      details: isProd ? undefined : (err instanceof Error ? err.message : String(err))
    }, { status: 502 })
  }
}

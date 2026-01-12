import { NextRequest, NextResponse } from 'next/server'

// Timeout for upstream worker request (30 seconds to handle Railway cold starts)
const UPSTREAM_TIMEOUT_MS = 30_000

export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const workerBaseUrl = process.env.BCI_WORKER_URL || 'http://localhost:3250'

  if (isProd && !process.env.BCI_WORKER_URL) {
    console.error('[bci-proxy] BCI_WORKER_URL is not configured in production')
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
    // This ensures proper multipart boundary serialization
    const upstreamFormData = new FormData()
    upstreamFormData.append('file', file, (file as File).name || 'upload.xlsx')

    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      controller.abort()
    }, UPSTREAM_TIMEOUT_MS)

    console.log(`[bci-proxy] Forwarding request to ${workerBaseUrl}/bci/normalize-xlsx`)

    try {
      const upstream = await fetch(`${workerBaseUrl}/bci/normalize-xlsx`, {
        method: 'POST',
        body: upstreamFormData,
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      console.log(`[bci-proxy] Upstream response: ${upstream.status}`)

      const contentType = upstream.headers.get('content-type') || ''
      if (contentType.includes('application/json')) {
        const data = await upstream.json()
        return NextResponse.json(data, { status: upstream.status })
      }
      
      const text = await upstream.text()
      return new NextResponse(text, { 
        status: upstream.status, 
        headers: { 'content-type': contentType || 'text/plain' } 
      })
    } catch (fetchError: any) {
      clearTimeout(timeoutId)
      
      if (fetchError.name === 'AbortError') {
        console.error(`[bci-proxy] Request timed out after ${UPSTREAM_TIMEOUT_MS}ms`)
        return NextResponse.json({ 
          error: 'Request timed out. The worker may be starting up - please try again in a few seconds.',
          code: 'TIMEOUT'
        }, { status: 504 })
      }
      
      console.error('[bci-proxy] Upstream fetch failed:', fetchError.message || fetchError)
      throw fetchError
    }
  } catch (err: any) {
    console.error('[bci-proxy] Proxy request failed:', err.message || err)
    return NextResponse.json({ 
      error: 'Proxy request failed. Please try again.',
      details: isProd ? undefined : err.message 
    }, { status: 502 })
  }
}

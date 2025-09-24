import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const isProd = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1'
  const workerBaseUrl = process.env.BCI_WORKER_URL || 'http://localhost:3250'

  if (isProd && !process.env.BCI_WORKER_URL) {
    return NextResponse.json({ error: 'BCI_WORKER_URL is not configured' }, { status: 500 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file) {
      return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
    }

    const upstream = await fetch(`${workerBaseUrl}/bci/normalize-xlsx`, {
      method: 'POST',
      body: formData as any
    })

    const contentType = upstream.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await upstream.json()
      return NextResponse.json(data, { status: upstream.status })
    }
    const text = await upstream.text()
    return new NextResponse(text, { status: upstream.status, headers: { 'content-type': contentType || 'text/plain' } })
  } catch (err) {
    return NextResponse.json({ error: 'Proxy request failed' }, { status: 502 })
  }
}



import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  // Generate a cryptographically secure nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const res = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  // Pass nonce to the request so it can be used in layouts/components
  res.headers.set('x-nonce', nonce)

  // Build CSP with nonce
  const csp = buildCSP(nonce)
  res.headers.set('Content-Security-Policy', csp)

  return res
}

function buildCSP(nonce: string): string {
  const isDev = process.env.NODE_ENV !== 'production'

  // Build connect-src with required origins
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://maps.googleapis.com',
    'https://*.googleapis.com',
  ]

  const workerUrl = process.env.NEXT_PUBLIC_DASHBOARD_WORKER_URL
  if (workerUrl) {
    try {
      const origin = new URL(workerUrl).origin
      if (!connectSrc.includes(origin)) connectSrc.push(origin)
    } catch {}
  } else if (isDev) {
    if (!connectSrc.includes('http://localhost:3200')) connectSrc.push('http://localhost:3200')
  }

  // Build CSP directives
  const directives = [
    "default-src 'self'",
    // Production: strict nonce-based scripts (NO unsafe-eval, NO unsafe-inline)
    // Dev: allow unsafe-eval for HMR only
    isDev
      ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval' https://maps.googleapis.com`
      : `script-src 'self' 'nonce-${nonce}' https://maps.googleapis.com`,
    // Style: unsafe-inline required for React inline styles (style={{...}})
    // NOTE: Cannot use nonce with unsafe-inline - nonce causes unsafe-inline to be ignored per CSP spec
    // TODO: migrate to CSS modules/Tailwind only for full nonce-based styles
    `style-src 'self' 'unsafe-inline'`,
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ]

  return directives.join('; ')
}

export const config = {
  matcher: [
    // apply on all app routes except static assets and api auth callback
    '/((?!_next/|.*\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?)$|api/).*)',
  ],
}


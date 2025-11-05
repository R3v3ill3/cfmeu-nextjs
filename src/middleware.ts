import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request: req,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Refresh auth session - this handles PKCE code exchange when present
  const authStartTime = Date.now();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  const authDuration = Date.now() - authStartTime;

  const timestamp = new Date().toISOString();
  const logData = {
    path: req.nextUrl.pathname,
    userId: user?.id || null,
    hasSession: !!user,
    authDuration,
    timestamp,
    method: req.method,
  };

  if (authError) {
    console.error('[Middleware] Auth error:', {
      ...logData,
      error: authError,
      errorMessage: authError.message,
      errorCode: authError.status,
    });
  } else if (!user) {
    console.warn('[Middleware] No authenticated user', logData);
  } else {
    console.log('[Middleware] Auth user:', `User ${user.id}`, logData);
  }
  
  // Generate a cryptographically secure nonce for CSP
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  // Set nonce in request headers
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  // Update the supabaseResponse to include our headers
  supabaseResponse.headers.set('x-nonce', nonce)

  // Build and set CSP with nonce
  const csp = buildCSP(nonce)
  supabaseResponse.headers.set('Content-Security-Policy', csp)

  return supabaseResponse
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
    // Include fonts.googleapis.com for Google Maps fonts
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
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


import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  })
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
  const path = req.nextUrl.pathname

  const logMiddleware = (level: 'log' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => {
    const payload = { requestId, path, ...data, timestamp: new Date().toISOString() }
    const method = level === 'log' ? 'log' : level
    console[method](`[Middleware] ${message}`, payload)
  }

  // Skip auth check for public routes to improve performance
  const publicPaths = ['/auth', '/auth/reset-password', '/auth/confirm', '/manifest.json', '/favicon.ico', '/apple-touch-icon.png']
  const isPublicPath = publicPaths.some(path => req.nextUrl.pathname.startsWith(path))
  
  if (isPublicPath) {
    // Still need to set up Supabase client for cookie handling, but skip auth check
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
              supabaseResponse.cookies.set(name, value, {
                ...options,
                path: '/',
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
              })
            )
          },
        },
      }
    )
    // Generate nonce and set CSP even for public routes
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
    const requestHeaders = new Headers(req.headers)
    requestHeaders.set('x-nonce', nonce)
    supabaseResponse.headers.set('x-nonce', nonce)
    const csp = buildCSP(nonce)
    supabaseResponse.headers.set('Content-Security-Policy', csp)
    return supabaseResponse
  }

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
            supabaseResponse.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            })
          )
        },
      },
    }
  )

  // IMPORTANT: Refresh auth session - this handles PKCE code exchange when present
  // Check for PKCE code in query params (Supabase auth redirects)
  const hasAuthCode = req.nextUrl.searchParams.has('code') || req.nextUrl.searchParams.has('code_verifier')
  const authStartTime = Date.now();
  
  // Explicitly handle PKCE code exchange if present
  if (hasAuthCode) {
    try {
      // Call getSession first to trigger code exchange
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        logMiddleware('error', 'Session error during PKCE exchange', {
          error: sessionError,
          errorMessage: sessionError.message,
        });
      } else if (session) {
        logMiddleware('log', 'PKCE code exchanged successfully', {
          userId: session.user?.id,
        });
      }
    } catch (err) {
      logMiddleware('error', 'Exception during PKCE exchange', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Get user after potential code exchange
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  const authDuration = Date.now() - authStartTime;

  // Enhanced logging for diagnostics
  if (authError) {
    logMiddleware('error', 'Auth error', {
      error: authError,
      errorMessage: authError.message,
      errorCode: authError.status,
      authDuration,
      hasAuthCode,
    });
  } else if (authDuration > 200 || hasAuthCode) {
    // Log slow auth checks and all PKCE exchanges for debugging
    logMiddleware('log', 'Auth check details', {
      userId: user?.id || null,
      authDuration,
      hasAuthCode,
      hasUser: !!user,
    });
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
  const isVercelPreview = process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development'
  const allowVercelLive = isDev || isVercelPreview

  // Build connect-src with required origins
  const connectSrc = [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://maps.googleapis.com',
    'https://*.googleapis.com',
    // Monitoring services
    'https://*.sentry.io',
    'https://*.posthog.com',
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

  // Build script-src with conditional Vercel Live support
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://maps.googleapis.com',
    // PostHog session recording and analytics
    'https://*.posthog.com',
  ]
  
  if (isDev) {
    scriptSrc.push("'unsafe-eval'") // Required for HMR in development
  }
  
  if (allowVercelLive) {
    scriptSrc.push('https://vercel.live') // Allow Vercel Live feedback scripts in preview/dev
  }

  // Build CSP directives
  const directives = [
    "default-src 'self'",
    // Production: strict nonce-based scripts (NO unsafe-eval, NO unsafe-inline)
    // Dev/Preview: allow unsafe-eval for HMR and Vercel Live scripts
    `script-src ${scriptSrc.join(' ')}`,
    // Style: unsafe-inline required for React inline styles (style={{...}})
    // NOTE: Cannot use nonce with unsafe-inline - nonce causes unsafe-inline to be ignored per CSP spec
    // TODO: migrate to CSS modules/Tailwind only for full nonce-based styles
    // Include fonts.googleapis.com for Google Maps fonts
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    "img-src 'self' data: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc.join(' ')}`,
    "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
    // PostHog session recording uses web workers for compression
    "worker-src 'self' blob:",
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
    '/((?!_next/|.*\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?|mp4|webm|mov|m4v|mp3|pdf)$|api/).*)',
  ],
}


import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { trackConnection, releaseConnection, recordConnectionError, getConnectionStats } from '@/lib/db-connection-monitor'

export async function middleware(req: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: req,
  })
  const requestId = req.headers.get('x-request-id') ?? crypto.randomUUID()
  const path = req.nextUrl.pathname
  const isHttps =
    req.nextUrl.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https'

  // Track connection for middleware monitoring
  const middlewareConnectionId = trackConnection('middleware', `middleware-${requestId}`)

  const logMiddleware = (level: 'log' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => {
    const payload = { requestId, path, ...data, timestamp: new Date().toISOString() }
    const method = level === 'log' ? 'log' : level
    console[method](`[Middleware] ${message}`, payload)
  }

  // Log connection stats at request start (only in debug mode)
  if (process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true') {
    const stats = getConnectionStats()
    logMiddleware('log', 'Connection stats at request start', {
      poolUtilization: Math.round(stats.poolUtilization * 100),
      totalActive: stats.totalActiveConnections,
      healthStatus: stats.healthStatus
    })
  }

  // Wrap the entire middleware in try-catch for connection monitoring
  try {

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
                // Secure cookies are required on HTTPS (production/Vercel) and iOS PWA contexts.
                // BUT: setting `secure: true` on HTTP (local dev) prevents the browser from storing the cookie,
                // which breaks refresh token persistence and causes session loss.
                secure: isHttps,
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

    // Release connection for public path
    releaseConnection('middleware', middlewareConnectionId)
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
              // Secure cookies are required on HTTPS (production/Vercel) and iOS PWA contexts.
              // BUT: setting `secure: true` on HTTP (local dev) prevents the browser from storing the cookie,
              // which breaks refresh token persistence and causes session loss.
              secure: isHttps,
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
  let {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  let authDuration = Date.now() - authStartTime;

  // Check for Supabase auth cookies to help diagnose session issues
  const allCookies = req.cookies.getAll()
  const sbCookies = allCookies.filter(c => c.name.startsWith('sb-'))
  const hasSbCookies = sbCookies.length > 0

  // Enhanced logging for diagnostics - only log errors when cookies exist but auth fails
  // (indicates actual session loss, not just unauthenticated requests)
  if (authError) {

    if (hasSbCookies) {
      // Record auth errors in connection monitor ONLY when cookies exist (real session-loss signal)
      recordConnectionError('middleware', authError, 'auth.getUser()')
      // This is the important case: user had cookies but auth failed - potential session loss
      logMiddleware('error', 'Auth error with existing cookies (potential session loss)', {
        errorMessage: authError.message,
        errorCode: authError.status,
        authDuration,
        hasAuthCode,
        sbCookieCount: sbCookies.length,
        sbCookieNames: sbCookies.map(c => c.name),
      });
      // #region agent log
      if (process.env.NODE_ENV !== 'production') {
        fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'D',location:'src/middleware.ts:authError',message:'middleware auth error with sb cookies',data:{path,authDuration,hasAuthCode,sbCookieCount:sbCookies.length,errorMessage:authError.message,errorStatus:authError.status??null},timestamp:Date.now()})}).catch(()=>{});
      }
      // #endregion
      
      // Try to refresh the session - this can recover from stale JWT tokens
      logMiddleware('log', 'Attempting session refresh due to auth error with existing cookies');
      try {
        const refreshStartTime = Date.now();
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        const refreshDuration = Date.now() - refreshStartTime;
        
        if (refreshError) {
          recordConnectionError('middleware', refreshError, 'auth.refreshSession()')
          logMiddleware('warn', 'Session refresh failed', {
            errorMessage: refreshError.message,
            refreshDuration,
          });
        } else if (refreshData.session) {
          // Session refreshed successfully, get user again
          const { data: userData, error: userError } = await supabase.auth.getUser();
          if (!userError && userData.user) {
            user = userData.user;
            authError = null;
            authDuration = Date.now() - authStartTime;
            logMiddleware('log', 'Session recovered via refresh', {
              userId: user.id,
              totalDuration: authDuration,
              refreshDuration,
            });
          }
        }
      } catch (refreshException) {
        logMiddleware('error', 'Exception during session refresh', {
          error: refreshException instanceof Error ? refreshException.message : String(refreshException),
        });
      }
    }
    // If no cookies, this is just an unauthenticated request (bot, preview check, etc.)
    // Don't log as error - this is expected behavior
  } else if (!user && hasSbCookies) {
    // No error but also no user, yet we have cookies - try refresh
    logMiddleware('log', 'No user but sb cookies present, attempting session refresh', {
      sbCookieCount: sbCookies.length,
      sbCookieNames: sbCookies.map(c => c.name),
    });
    // #region agent log
    if (process.env.NODE_ENV !== 'production') {
      fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({sessionId:'debug-session',runId:'run1',hypothesisId:'D',location:'src/middleware.ts:noUser',message:'middleware saw sb cookies but no user',data:{path,authDuration,hasAuthCode,sbCookieCount:sbCookies.length},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    
    try {
      const refreshStartTime = Date.now();
      const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
      const refreshDuration = Date.now() - refreshStartTime;
      
      if (refreshError) {
        logMiddleware('warn', 'Session refresh failed (no user)', {
          errorMessage: refreshError.message,
          refreshDuration,
        });
      } else if (refreshData.session) {
        // Session refreshed, get user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (!userError && userData.user) {
          user = userData.user;
          authDuration = Date.now() - authStartTime;
          logMiddleware('log', 'Session recovered via refresh (no user case)', {
            userId: user.id,
            totalDuration: authDuration,
            refreshDuration,
          });
        }
      }
    } catch (refreshException) {
      logMiddleware('error', 'Exception during session refresh (no user)', {
        error: refreshException instanceof Error ? refreshException.message : String(refreshException),
      });
    }
  } else if (authDuration > 200 || hasAuthCode) {
    // Log slow auth checks and all PKCE exchanges for debugging
    logMiddleware('log', 'Auth check details', {
      userId: user?.id || null,
      authDuration,
      hasAuthCode,
      hasUser: !!user,
      sbCookieCount: sbCookies.length,
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

  } catch (error) {
    // Record any middleware errors for connection monitoring
    recordConnectionError('middleware', error as Error, 'middleware-execution')
    logMiddleware('error', 'Middleware execution error', {
      error: error instanceof Error ? error.message : String(error)
    })
  } finally {
    // Always release the middleware connection
    releaseConnection('middleware', middlewareConnectionId)
  }

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

  // Local debug-mode log ingest server (NDJSON) - allow in dev even when worker URL is configured
  if (isDev) {
    if (!connectSrc.includes('http://127.0.0.1:7242')) connectSrc.push('http://127.0.0.1:7242')
    if (!connectSrc.includes('http://localhost:7242')) connectSrc.push('http://localhost:7242')
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


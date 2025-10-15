import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

export async function middleware(req: NextRequest) {
  // CRITICAL: Handle Supabase PKCE auth code exchange for password reset
  if (req.nextUrl.pathname === '/auth/reset-password' && req.nextUrl.searchParams.has('code')) {
    const code = req.nextUrl.searchParams.get('code')!
    console.log('[Middleware] PKCE code detected, exchanging for session...')
    
    // Create Supabase client with cookie handling
    const res = NextResponse.next()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            res.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            res.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (error) {
      console.error('[Middleware] Code exchange failed:', error)
      // Redirect with error
      const url = req.nextUrl.clone()
      url.searchParams.delete('code')
      url.searchParams.set('error', 'auth_failed')
      url.searchParams.set('error_description', error.message)
      return NextResponse.redirect(url)
    }
    
    if (data?.session) {
      console.log('[Middleware] ✅ Code exchange successful, session created for user:', data.session.user.id)
      // Redirect to clean URL without code (cookies are already set in res)
      const url = req.nextUrl.clone()
      url.searchParams.delete('code')
      // Use the response object that has the cookies set
      return NextResponse.redirect(url, { headers: res.headers })
    }
  }
  
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


import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  return res
}

export const config = {
  matcher: [
    // apply on all app routes except static assets and api auth callback
    '/((?!_next/|.*\.(?:css|js|map|png|jpg|jpeg|gif|svg|ico|woff2?)$|api/).*)',
  ],
}


// This file is required by Next.js when instrumentationHook is enabled
// It initializes Sentry for both server and edge runtimes

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Server-side Sentry initialization
    await import('./sentry.server.config')
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    // Edge runtime Sentry initialization
    await import('./sentry.edge.config')
  }
}

// Capture unhandled errors in instrumentation
export const onRequestError = async (
  error: Error,
  request: Request,
  context: { routerKind: string; routePath: string; routeType: string }
) => {
  const Sentry = await import('@sentry/nextjs')
  
  Sentry.withScope((scope) => {
    scope.setTag('routerKind', context.routerKind)
    scope.setTag('routePath', context.routePath)
    scope.setTag('routeType', context.routeType)
    scope.setExtra('request.url', request.url)
    scope.setExtra('request.method', request.method)
    Sentry.captureException(error)
  })
}

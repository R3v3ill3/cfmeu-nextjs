// Sentry monitoring integration for scraper worker
import * as Sentry from '@sentry/node';

// Initialize Sentry for this worker
export function initMonitoring() {
  const dsn = process.env.SENTRY_DSN;
  
  if (!dsn) {
    console.log('[Monitoring] SENTRY_DSN not set, monitoring disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA || 'local',
    
    // Only enable in production or when debug is set
    enabled: process.env.NODE_ENV === 'production' || process.env.SENTRY_DEBUG === 'true',
    
    // Sample rate for performance monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Integrations for Express
    integrations: [
      Sentry.expressIntegration(),
      Sentry.httpIntegration(),
    ],
    
    // Add service name tag
    initialScope: {
      tags: {
        service: 'cfmeu-scraper-worker',
      },
    },

    // Before sending, add context
    beforeSend(event) {
      // Don't send in development unless debug is enabled
      if (process.env.NODE_ENV === 'development' && process.env.SENTRY_DEBUG !== 'true') {
        return null;
      }
      return event;
    },
  });

  console.log('[Monitoring] Sentry initialized for scraper worker');
}

// Capture error with context
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      service: 'cfmeu-scraper-worker',
    },
  });
}

// Express error handler middleware
export function sentryErrorHandler() {
  return Sentry.expressErrorHandler();
}

// Express request handler middleware
export function sentryRequestHandler() {
  return Sentry.expressRequestHandler();
}

// Flush events before shutdown
export async function flushEvents() {
  await Sentry.close(2000);
}

export { Sentry };


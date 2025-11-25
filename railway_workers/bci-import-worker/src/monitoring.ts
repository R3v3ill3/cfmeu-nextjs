// Sentry monitoring integration for BCI import worker
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
    
    // Add service name tag
    initialScope: {
      tags: {
        service: 'bci-import-worker',
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

  console.log('[Monitoring] Sentry initialized for BCI import worker');
}

// Capture error with context
export function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, {
    extra: context,
    tags: {
      service: 'bci-import-worker',
    },
  });
}

// Flush events before shutdown
export async function flushEvents() {
  await Sentry.close(2000);
}

export { Sentry };


// Sentry monitoring integration for mapping sheet scanner worker
import * as Sentry from '@sentry/node';
import type { Express } from 'express';

let isInitialized = false;

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
        service: 'mapping-sheet-scanner-worker',
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

  isInitialized = true;
  console.log('[Monitoring] Sentry initialized for mapping sheet scanner worker');
}

// Setup Express error handler - call after all routes are defined
export function setupSentryErrorHandler(app: Express) {
  if (isInitialized) {
    Sentry.setupExpressErrorHandler(app);
  }
}

// Capture error with context
export function captureError(error: Error, context?: Record<string, any>) {
  if (!isInitialized) return;
  Sentry.captureException(error, {
    extra: context,
    tags: {
      service: 'mapping-sheet-scanner-worker',
    },
  });
}

// Flush events before shutdown
export async function flushEvents() {
  if (isInitialized) {
    await Sentry.close(2000);
  }
}

export { Sentry };


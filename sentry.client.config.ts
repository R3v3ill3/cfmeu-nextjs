// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a user loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Only enable in production or when explicitly set
  enabled: process.env.NODE_ENV === 'production' || process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',

  // Adjust this value in production, or use tracesSampler for greater control
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Setting this option to true will print useful information to the console while you're setting up Sentry.
  debug: process.env.NEXT_PUBLIC_SENTRY_DEBUG === 'true',

  // Session Replay for error context - increase sample rate during investigation
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 0,

  integrations: [
    Sentry.replayIntegration({
      // Additional SDK configuration
      maskAllText: false,
      blockAllMedia: false,
      // Capture network requests for debugging session loss
      networkDetailAllowUrls: [
        window.location.origin,
        /.*supabase\.co.*/,
      ],
    }),
    Sentry.browserTracingIntegration(),
    Sentry.feedbackIntegration({
      colorScheme: "system",
      showBranding: false,
    }),
  ],

  // Environment and release tracking
  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'local',

  // Use tunnel route to avoid ad-blockers
  tunnel: "/monitoring",

  // Filter out common noise - BUT keep auth-related errors
  ignoreErrors: [
    // Browser extensions
    'top.GLOBALS',
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed with undelivered notifications',
    // Network errors that are user-side (but NOT Load failed - keep that for SW debugging)
    'Failed to fetch',
    'NetworkError',
    // Common hydration warnings (not critical)
    'Minified React error #418',
    'Minified React error #423',
  ],

  // Before sending, add user context
  beforeSend(event, hint) {
    // Don't send events in development unless debug is enabled
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_SENTRY_DEBUG !== 'true') {
      return null;
    }
    
    // Add extra context for auth-related errors
    const error = hint?.originalException;
    if (error instanceof Error) {
      const isAuthRelated = 
        error.message.includes('session') ||
        error.message.includes('auth') ||
        error.message.includes('permission') ||
        error.message.includes('JWT') ||
        error.message.includes('token');
      
      if (isAuthRelated) {
        event.tags = {
          ...event.tags,
          auth_related: 'true',
        };
        event.level = 'error';
      }
    }
    
    return event;
  },
});


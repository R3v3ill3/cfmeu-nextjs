// PostHog client-side initialization and utilities
// https://posthog.com/docs/libraries/next-js

import posthog from 'posthog-js';

// Check if PostHog is configured
export const isPostHogEnabled = (): boolean => {
  return !!(
    typeof window !== 'undefined' &&
    process.env.NEXT_PUBLIC_POSTHOG_KEY &&
    process.env.NEXT_PUBLIC_POSTHOG_HOST
  );
};

// Initialize PostHog on the client
export const initPostHog = (): void => {
  if (!isPostHogEnabled()) {
    return;
  }

  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    
    // Only load in production or when explicitly enabled
    loaded: (posthog) => {
      if (process.env.NODE_ENV === 'development') {
        // Disable in development unless explicitly enabled
        if (process.env.NEXT_PUBLIC_POSTHOG_DEBUG !== 'true') {
          posthog.opt_out_capturing();
        }
      }
    },

    // Capture page views automatically
    capture_pageview: true,
    capture_pageleave: true,

    // Session Recording - the main feature for testing phase
    disable_session_recording: false,
    session_recording: {
      // Record console logs for debugging
      recordCrossOriginIframes: true,
    },

    // Performance
    autocapture: true,
    capture_performance: true,

    // Privacy settings - adjust based on your needs
    mask_all_text: false,
    mask_all_element_attributes: false,

    // Persist across sessions
    persistence: 'localStorage+cookie',
    
    // Enable feature flags
    bootstrap: {
      featureFlags: {},
    },
  });
};

// Identify user when they log in
export const identifyUser = (
  userId: string,
  properties?: {
    email?: string;
    name?: string;
    role?: string;
    patches?: string[];
  }
): void => {
  if (!isPostHogEnabled()) return;

  posthog.identify(userId, {
    email: properties?.email,
    name: properties?.name,
    role: properties?.role,
    patches: properties?.patches,
    app: 'cfmeu-uconstruct',
  });
};

// Reset user on logout
export const resetUser = (): void => {
  if (!isPostHogEnabled()) return;
  posthog.reset();
};

// Track custom events
export const trackEvent = (
  eventName: string,
  properties?: Record<string, any>
): void => {
  if (!isPostHogEnabled()) return;

  posthog.capture(eventName, {
    ...properties,
    timestamp: new Date().toISOString(),
  });
};

// Track page views with additional context
export const trackPageView = (
  pageName: string,
  properties?: Record<string, any>
): void => {
  if (!isPostHogEnabled()) return;

  posthog.capture('$pageview', {
    page_name: pageName,
    ...properties,
  });
};

// Track errors (complementing Sentry)
export const trackError = (
  error: Error,
  context?: Record<string, any>
): void => {
  if (!isPostHogEnabled()) return;

  posthog.capture('error_occurred', {
    error_name: error.name,
    error_message: error.message,
    error_stack: error.stack?.substring(0, 500), // Limit stack trace length
    ...context,
  });
};

// Feature flags
export const isFeatureEnabled = (flagName: string): boolean => {
  if (!isPostHogEnabled()) return false;
  return posthog.isFeatureEnabled(flagName) ?? false;
};

export const getFeatureFlag = (flagName: string): string | boolean | undefined => {
  if (!isPostHogEnabled()) return undefined;
  return posthog.getFeatureFlag(flagName);
};

// Group analytics (for team/patch-based analysis)
export const setGroup = (groupType: string, groupId: string, properties?: Record<string, any>): void => {
  if (!isPostHogEnabled()) return;
  posthog.group(groupType, groupId, properties);
};

// Export the posthog instance for direct access if needed
export { posthog };


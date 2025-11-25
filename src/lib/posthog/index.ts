// PostHog exports
// Use client.ts for client-side code
// Use server.ts for server-side code

export {
  isPostHogEnabled,
  initPostHog,
  identifyUser,
  resetUser,
  trackEvent,
  trackPageView,
  trackError,
  isFeatureEnabled,
  getFeatureFlag,
  setGroup,
  posthog,
} from './client';

export {
  getPostHogClient,
  captureServerEvent,
  identifyServerUser,
  getServerFeatureFlag,
  shutdownPostHog,
  trackApiRequest,
} from './server';


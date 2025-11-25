// PostHog server-side utilities
// https://posthog.com/docs/libraries/node

import { PostHog } from 'posthog-node';

// Create a singleton instance for server-side usage
let posthogClient: PostHog | null = null;

export const getPostHogClient = (): PostHog | null => {
  if (!process.env.POSTHOG_API_KEY) {
    return null;
  }

  if (!posthogClient) {
    posthogClient = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
      flushAt: 1, // Flush immediately for serverless
      flushInterval: 0, // Disable interval flushing for serverless
    });
  }

  return posthogClient;
};

// Capture server-side events
export const captureServerEvent = async (
  distinctId: string,
  eventName: string,
  properties?: Record<string, any>
): Promise<void> => {
  const client = getPostHogClient();
  if (!client) return;

  client.capture({
    distinctId,
    event: eventName,
    properties: {
      ...properties,
      $lib: 'posthog-node',
      source: 'server',
      timestamp: new Date().toISOString(),
    },
  });
};

// Identify user on server side
export const identifyServerUser = async (
  userId: string,
  properties?: Record<string, any>
): Promise<void> => {
  const client = getPostHogClient();
  if (!client) return;

  client.identify({
    distinctId: userId,
    properties: {
      ...properties,
      app: 'cfmeu-uconstruct',
    },
  });
};

// Check feature flags server-side
export const getServerFeatureFlag = async (
  distinctId: string,
  flagName: string
): Promise<boolean | string | undefined> => {
  const client = getPostHogClient();
  if (!client) return undefined;

  return await client.getFeatureFlag(flagName, distinctId);
};

// Shutdown function for graceful exit
export const shutdownPostHog = async (): Promise<void> => {
  if (posthogClient) {
    await posthogClient.shutdown();
    posthogClient = null;
  }
};

// Track API request metrics
export const trackApiRequest = async (
  userId: string | undefined,
  endpoint: string,
  method: string,
  statusCode: number,
  duration: number
): Promise<void> => {
  const client = getPostHogClient();
  if (!client) return;

  client.capture({
    distinctId: userId || 'anonymous',
    event: 'api_request',
    properties: {
      endpoint,
      method,
      status_code: statusCode,
      duration_ms: duration,
      success: statusCode >= 200 && statusCode < 400,
      source: 'server',
    },
  });
};


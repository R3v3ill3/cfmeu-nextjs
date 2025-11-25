'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { identifyUser, resetUser, setGroup } from '@/lib/posthog/client';

interface User {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
}

interface Profile {
  id: string;
  email?: string;
  full_name?: string;
  role?: string;
  patches?: Array<{ id: string; name: string }>;
}

/**
 * Hook to identify the current user in Sentry and PostHog
 * Call this in your authenticated layout or after login
 */
export function useMonitoringIdentity(user: User | null, profile?: Profile | null) {
  useEffect(() => {
    if (user) {
      // Identify user in Sentry
      Sentry.setUser({
        id: user.id,
        email: user.email,
        username: profile?.full_name || user.email,
      });

      // Add role as a tag for filtering in Sentry
      Sentry.setTag('user_role', profile?.role || 'unknown');

      // Identify user in PostHog
      identifyUser(user.id, {
        email: user.email,
        name: profile?.full_name,
        role: profile?.role,
        patches: profile?.patches?.map(p => p.name),
      });

      // Set group for patch-based analytics
      if (profile?.patches && profile.patches.length > 0) {
        // Use the first patch as primary group
        const primaryPatch = profile.patches[0];
        setGroup('patch', primaryPatch.id, {
          name: primaryPatch.name,
        });
      }
    } else {
      // Clear user on logout
      Sentry.setUser(null);
      resetUser();
    }
  }, [user, profile]);
}

/**
 * Utility function to identify user imperatively (e.g., after login API call)
 * Use this when you don't have access to the hook
 */
export function identifyMonitoringUser(
  userId: string,
  email?: string,
  name?: string,
  role?: string,
  patches?: string[]
) {
  // Sentry
  Sentry.setUser({
    id: userId,
    email,
    username: name || email,
  });
  Sentry.setTag('user_role', role || 'unknown');

  // PostHog
  identifyUser(userId, {
    email,
    name,
    role,
    patches,
  });
}

/**
 * Clear user identity on logout
 */
export function clearMonitoringIdentity() {
  Sentry.setUser(null);
  resetUser();
}


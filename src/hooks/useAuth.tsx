"use client"
import { useState, useEffect, createContext, useContext, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import * as Sentry from "@sentry/nextjs";
import type { SeverityLevel } from "@sentry/types";

// Session recovery: if session is lost unexpectedly, wait this long before giving up
const SESSION_RECOVERY_TIMEOUT = 5000; // 5 seconds

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const queryClient = useQueryClient();
  
  // Track if we've ever had a valid session (for recovery logic)
  const instanceIdRef = useRef(`auth-${Math.random().toString(36).slice(2, 10)}`);
  const hadSessionRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const sessionLossReportedRef = useRef(false);
  const isSubscribedRef = useRef(true);
  const sessionRef = useRef<Session | null>(null);
  const recoveryTimeoutRef = useRef<NodeJS.Timeout>();


  const logAuthEvent = useCallback(
    (message: string, data?: Record<string, unknown>, level: SeverityLevel = "info") => {
      const payload = { ...data, timestamp: new Date().toISOString() };
      if (process.env.NODE_ENV !== "test") {
        console.log(`[useAuth] ${message}`, payload);
      }
      if (typeof window !== "undefined") {
        Sentry.addBreadcrumb({
          category: "auth",
          level,
          message,
          data: payload,
        });
      }
    },
    []
  );

  const logAuthError = useCallback(
    (message: string, error: unknown, data?: Record<string, unknown>) => {
      const normalizedError = error instanceof Error ? error : new Error(String(error));
      const payload = {
        ...data,
        errorMessage: normalizedError.message,
        name: normalizedError.name,
      };
      console.error(`[useAuth] ${message}`, payload);
      if (typeof window !== "undefined") {
        Sentry.captureException(normalizedError, {
          tags: { component: "useAuth" },
          extra: payload,
        });
      }
      logAuthEvent(message, payload, "error");
    },
    [logAuthEvent]
  );

  const applyAuthState = useCallback(
    (nextSession: Session | null, metadata?: Record<string, unknown>) => {
      const prevUserId = sessionRef.current?.user?.id ?? null;
      const nextUserId = nextSession?.user?.id ?? null;
      const prevHasSession = !!sessionRef.current;
      const nextHasSession = !!nextSession;
      setSession(nextSession);
      sessionRef.current = nextSession;
      setUser(nextSession?.user ?? null);

      if (typeof window !== "undefined") {
        Sentry.setUser(
          nextSession?.user
            ? {
                id: nextSession.user.id,
                email: nextSession.user.email ?? undefined,
              }
            : null
        );
      }

      if (metadata) {
        logAuthEvent("Session state updated", {
          source: metadata.source ?? "unknown",
          hasSession: !!nextSession,
          userId: nextSession?.user?.id ?? null,
          ...metadata,
        });
      }
    },
    [logAuthEvent]
  );

  // Session recovery function - attempts to refresh when session is unexpectedly lost
  const attemptSessionRecovery = useCallback(async () => {
    if (recoveryAttemptedRef.current || !hadSessionRef.current) {
      return null;
    }
    
    recoveryAttemptedRef.current = true;
    logAuthEvent("Attempting session recovery", { source: "unexpected-loss" });
    
    try {
      const supabase = getSupabaseBrowserClient();
      
      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        logAuthError("Session recovery failed", error, { stage: "refreshSession" });
        return null;
      }
      
      if (data.session) {
        logAuthEvent("Session recovered successfully", {
          source: "refreshSession",
          userId: data.session.user?.id ?? null,
        });
        return data.session;
      }
      
      return null;
    } catch (error) {
      logAuthError("Session recovery exception", error);
      return null;
    }
  }, [logAuthError, logAuthEvent]);

  // Debounced recovery scheduler - prevents concurrent recovery attempts
  const scheduleRecovery = useCallback(() => {
    if (recoveryAttemptedRef.current) return; // Already attempted
    if (recoveryTimeoutRef.current) return; // Already scheduled

    logAuthEvent("Scheduling debounced session recovery", { delay: 1000 });

    recoveryTimeoutRef.current = setTimeout(() => {
      attemptSessionRecovery();
      recoveryTimeoutRef.current = undefined;
    }, 1000); // 1-second debounce to prevent race conditions
  }, [attemptSessionRecovery, logAuthEvent]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    isSubscribedRef.current = true;
    let initialSessionSet = false;

    logAuthEvent("Initializing auth listener");

    // IMMEDIATELY call getSession() to get cached session from storage
    // This is synchronous if session is in memory, or reads from localStorage
    const initializeSession = async () => {
      const start = typeof performance !== "undefined" ? performance.now() : Date.now();
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        const duration = Math.round((typeof performance !== "undefined" ? performance.now() : Date.now()) - start);
        
        if (error) {
          logAuthError("Error getting initial session", error, { duration });
        }
        
        if (isSubscribedRef.current && !initialSessionSet) {
          initialSessionSet = true;
          applyAuthState(initialSession ?? null, { source: "getSession" });
          setLoading(false);
          
          if (initialSession) {
            hadSessionRef.current = true;
            logAuthEvent("Initial session loaded", {
              userId: initialSession.user?.id,
              expiresAt: initialSession.expires_at
                ? new Date(initialSession.expires_at * 1000).toISOString()
                : null,
              duration,
            });
          } else {
            logAuthEvent("No initial session found", { duration });
          }
        }
      } catch (error) {
        logAuthError("Exception getting initial session", error);
        if (isSubscribedRef.current && !initialSessionSet) {
          initialSessionSet = true;
          setLoading(false);
        }
      }
    };

    // Start loading session immediately
    initializeSession();

    // Set up listener for future auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isSubscribedRef.current) return;

        const timestamp = new Date().toISOString();
        logAuthEvent(`Auth state change: ${event}`, {
          timestamp,
          hasSession: !!newSession,
          userId: newSession?.user?.id ?? null,
        });

        // Track if we've ever had a session (for recovery logic)
        if (newSession) {
          hadSessionRef.current = true;
          recoveryAttemptedRef.current = false;
          sessionLossReportedRef.current = false;

          // Clear any pending recovery timeout since we now have a valid session
          if (recoveryTimeoutRef.current) {
            clearTimeout(recoveryTimeoutRef.current);
            recoveryTimeoutRef.current = undefined;
            logAuthEvent("Cleared pending recovery timeout - valid session restored");
          }
        }

        // Handle INITIAL_SESSION event - update if we haven't set session yet
        if (event === 'INITIAL_SESSION') {
          const shouldApplyInitialSession =
            !initialSessionSet ||
            (!sessionRef.current && !!newSession);

          if (shouldApplyInitialSession) {
            initialSessionSet = true;
            applyAuthState(newSession ?? null, { source: 'initial_session_event' });
            setLoading(false);
          } else if (!initialSessionSet) {
            initialSessionSet = true;
            setLoading(false);
          }
          return;
        }

        // For other events, always update state
        applyAuthState(newSession ?? null, { source: event.toLowerCase() });
        setLoading(false);

        // Invalidate auth-dependent caches ONLY on actual sign in/out events
        // TOKEN_REFRESHED should NOT invalidate caches - it's just a token refresh, user is still the same
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
          logAuthEvent("Invalidating auth-dependent caches", { reason: event });
          queryClient.invalidateQueries({ queryKey: ['user-role'] });
          queryClient.invalidateQueries({ queryKey: ['accessible-patches'] });
          queryClient.invalidateQueries({ queryKey: ['current-user-profile'] });
          // Be more targeted - only invalidate queries that specifically need fresh auth
          // Don't use broad predicates that might clear profile/project data
        }

        if (!newSession?.user && event !== 'SIGNED_OUT') {
          // Only log/attempt recovery if we actually had a session before
          // Don't treat TOKEN_REFRESHED without session as "lost" - it might just be a timing issue
          if (hadSessionRef.current) {
            logAuthEvent('Session lost unexpectedly', { 
              event, 
              timestamp,
              previousUserId: sessionRef.current?.user?.id ?? null,
            }, 'warning');
            if (typeof window !== 'undefined' && !sessionLossReportedRef.current) {
              sessionLossReportedRef.current = true;
              try {
                Sentry.withScope((scope) => {
                  scope.setLevel('warning');
                  scope.setTag('component', 'useAuth');
                  scope.setTag('auth_event', event);
                  scope.setExtra('instanceId', instanceIdRef.current);
                  scope.setExtra('path', window.location?.pathname ?? null);
                  scope.setExtra(
                    'previousUserIdSuffix',
                    (sessionRef.current?.user?.id ?? '').slice(-6) || null
                  );
                  Sentry.captureMessage('[Auth] Session lost unexpectedly');
                });
              } catch {}
            }
            // Try recovery if we haven't already
            if (!recoveryAttemptedRef.current) {
              scheduleRecovery();
            }
          }
        }

        if (newSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          // Sync profile and apply any pending role
          try {
            logAuthEvent('Applying pending user on login', { userId: newSession.user.id });
            await supabase.rpc('apply_pending_user_on_login');
            logAuthEvent('Successfully applied pending user');
          } catch (error) {
            logAuthError('Failed to apply pending user', error, {
              userId: newSession.user.id,
            });
          }
          // If user remains viewer, raise a pending request automatically
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', newSession.user.id)
              .single();
            if (prof && (prof as any).role === 'viewer') {
              await supabase.from('pending_users').insert({
                email: newSession.user.email || '',
                role: 'organiser',
                notes: 'Self-signup request'
              });
            }
          } catch (error) {
            logAuthError('Failed to check/update viewer status', error);
          }
        }
      }
    );

    return () => {
      logAuthEvent("Cleaning up auth state listener");
      isSubscribedRef.current = false;
      subscription.unsubscribe();

      // Clear any pending recovery timeout
      if (recoveryTimeoutRef.current) {
        clearTimeout(recoveryTimeoutRef.current);
        recoveryTimeoutRef.current = undefined;
      }
    };
  }, [scheduleRecovery, queryClient, applyAuthState, logAuthEvent, logAuthError]);

  // Visibility change listener - proactively re-validate session when page becomes visible
  // This handles cases where the session may have been lost while the tab was in background
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleVisibilityChange = async () => {
      // Only check when becoming visible and we previously had a session
      if (document.visibilityState !== 'visible' || !hadSessionRef.current) {
        return;
      }

      const supabase = getSupabaseBrowserClient();
      
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          logAuthEvent('Visibility check: error getting session', { 
            errorMessage: error.message,
          }, 'warning');
        }
        
        // If we had a session but now don't, and we haven't already tried recovery
        if (!currentSession && hadSessionRef.current && !recoveryAttemptedRef.current) {
          logAuthEvent('Visibility check: session lost, scheduling recovery', {
            hadSession: true,
            recoveryAttempted: recoveryAttemptedRef.current,
          });

          scheduleRecovery();
        } else if (currentSession && !sessionRef.current) {
          // Edge case: we have a session now but didn't before (maybe cookie was restored)
          logAuthEvent('Visibility check: session restored externally', {
            userId: currentSession.user?.id,
          });
          applyAuthState(currentSession, { source: 'visibility_restore' });
        }
      } catch (err) {
        logAuthError('Visibility check exception', err);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [scheduleRecovery, applyAuthState, logAuthEvent, logAuthError]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    hadSessionRef.current = false; // Reset on explicit sign out
    recoveryAttemptedRef.current = false; // Reset recovery attempt flag

    // Clear any pending recovery timeout on sign out
    if (recoveryTimeoutRef.current) {
      clearTimeout(recoveryTimeoutRef.current);
      recoveryTimeoutRef.current = undefined;
    }

    logAuthEvent("Manual sign out requested", { userId: sessionRef.current?.user?.id ?? null });
    await supabase.auth.signOut();
    applyAuthState(null, { source: "signout" });
    router.replace('/auth');
  };

  const value = {
    user,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

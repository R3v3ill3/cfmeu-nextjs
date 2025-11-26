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
  const hadSessionRef = useRef(false);
  const recoveryAttemptedRef = useRef(false);
  const isSubscribedRef = useRef(true);
  const sessionRef = useRef<Session | null>(null);

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

        // Invalidate auth-dependent caches on auth state changes
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          logAuthEvent("Invalidating auth-dependent caches", { reason: event });
          queryClient.invalidateQueries({ queryKey: ['user-role'] });
          queryClient.invalidateQueries({ queryKey: ['accessible-patches'] });
          queryClient.invalidateQueries({ queryKey: ['my-role'] });
          queryClient.invalidateQueries({ predicate: (query) =>
            query.queryKey.some(key => typeof key === 'string' &&
              (key.includes('user') || key.includes('auth') || key.includes('role') || key.includes('permission')))
          });
        }

        if (!newSession?.user && event !== 'SIGNED_OUT') {
          logAuthEvent('Session lost unexpectedly', { event, timestamp }, 'warning');
          
          // If we had a session and it's now gone (not from explicit sign out), try recovery
          if (hadSessionRef.current && !recoveryAttemptedRef.current) {
            const recovered = await attemptSessionRecovery();
            if (recovered && isSubscribedRef.current) {
              applyAuthState(recovered, { source: 'recovery' });
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
    };
  }, [attemptSessionRecovery, queryClient, applyAuthState, logAuthEvent, logAuthError]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    hadSessionRef.current = false; // Reset on explicit sign out
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

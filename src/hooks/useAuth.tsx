"use client"
import { useState, useEffect, createContext, useContext, useRef, useCallback } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

  // Session recovery function - attempts to refresh when session is unexpectedly lost
  const attemptSessionRecovery = useCallback(async () => {
    if (recoveryAttemptedRef.current || !hadSessionRef.current) {
      return null;
    }
    
    recoveryAttemptedRef.current = true;
    console.log('[useAuth] Attempting session recovery...');
    
    try {
      const supabase = getSupabaseBrowserClient();
      
      // Try to refresh the session
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error) {
        console.warn('[useAuth] Session recovery failed:', error.message);
        return null;
      }
      
      if (data.session) {
        console.log('[useAuth] Session recovered successfully');
        return data.session;
      }
      
      return null;
    } catch (error) {
      console.warn('[useAuth] Session recovery exception:', error);
      return null;
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    isSubscribedRef.current = true;
    let initialSessionReceived = false;

    console.log('[useAuth] Setting up auth state listener');

    // onAuthStateChange fires IMMEDIATELY with cached session from storage
    // This is the primary source of truth - no need to call getSession() separately
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!isSubscribedRef.current) return;

        const timestamp = new Date().toISOString();
        console.log(`[useAuth] Auth state change: ${event}`, {
          timestamp,
          hasSession: !!newSession,
          userId: newSession?.user?.id,
          sessionExpires: newSession?.expires_at ? new Date(newSession.expires_at * 1000).toISOString() : null,
        });

        // Track if we've ever had a session (for recovery logic)
        if (newSession) {
          hadSessionRef.current = true;
          recoveryAttemptedRef.current = false; // Reset recovery flag when we get a valid session
        }

        // Handle INITIAL_SESSION event specially - this is Supabase's cached session
        if (event === 'INITIAL_SESSION') {
          initialSessionReceived = true;
          setSession(newSession);
          setUser(newSession?.user ?? null);
          setLoading(false);
          
          if (!newSession && hadSessionRef.current) {
            // We had a session before but now it's gone - try recovery
            const recovered = await attemptSessionRecovery();
            if (recovered && isSubscribedRef.current) {
              setSession(recovered);
              setUser(recovered.user);
            }
          }
          return;
        }

        // For other events, update state normally
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);

        // Invalidate auth-dependent caches on auth state changes
        if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
          console.log(`[useAuth] Invalidating auth-dependent caches due to: ${event}`);
          queryClient.invalidateQueries({ queryKey: ['user-role'] });
          queryClient.invalidateQueries({ queryKey: ['accessible-patches'] });
          queryClient.invalidateQueries({ predicate: (query) =>
            query.queryKey.some(key => typeof key === 'string' &&
              (key.includes('user') || key.includes('auth') || key.includes('role') || key.includes('permission')))
          });
        }

        if (!newSession?.user && event !== 'SIGNED_OUT') {
          console.warn('[useAuth] Session lost unexpectedly', { event, timestamp });
          
          // If we had a session and it's now gone (not from explicit sign out), try recovery
          if (hadSessionRef.current && !recoveryAttemptedRef.current) {
            const recovered = await attemptSessionRecovery();
            if (recovered && isSubscribedRef.current) {
              setSession(recovered);
              setUser(recovered.user);
            }
          }
        }

        if (newSession?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          // Sync profile and apply any pending role
          try {
            console.log('[useAuth] Applying pending user on login', { userId: newSession.user.id });
            await supabase.rpc('apply_pending_user_on_login');
            console.log('[useAuth] Successfully applied pending user');
          } catch (error) {
            console.error('[useAuth] Failed to apply pending user:', error, {
              userId: newSession.user.id,
              errorMessage: error instanceof Error ? error.message : String(error),
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
              // Request access via direct database call since RPC types are not available
              await supabase.from('pending_users').insert({
                email: newSession.user.email || '',
                role: 'organiser',
                notes: 'Self-signup request'
              });
            }
          } catch (error) {
            console.warn('[useAuth] Failed to check/update viewer status:', error);
          }
        }
      }
    );

    // Safety fallback: if onAuthStateChange doesn't fire within a reasonable time,
    // set loading to false to prevent UI from being stuck
    const safetyTimeout = setTimeout(() => {
      if (!initialSessionReceived && isSubscribedRef.current) {
        console.warn('[useAuth] Safety timeout: onAuthStateChange did not fire, setting loading=false');
        setLoading(false);
      }
    }, SESSION_RECOVERY_TIMEOUT);

    return () => {
      console.log('[useAuth] Cleaning up auth state listener');
      isSubscribedRef.current = false;
      clearTimeout(safetyTimeout);
      subscription.unsubscribe();
    };
  }, [attemptSessionRecovery, queryClient]);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
    hadSessionRef.current = false; // Reset on explicit sign out
    await supabase.auth.signOut();
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

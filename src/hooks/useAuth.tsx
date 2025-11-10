"use client"
import { useState, useEffect, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import { User, Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

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

  useEffect(() => {
    // Set up auth state listener FIRST to prevent race conditions
    const supabase = getSupabaseBrowserClient();
    let isSubscribed = true;
    let sessionChecked = false;

    console.log('[useAuth] Setting up auth state listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isSubscribed) return;

        const timestamp = new Date().toISOString();
        console.log(`[useAuth] Auth state change: ${event}`, {
          timestamp,
          hasSession: !!session,
          userId: session?.user?.id,
          sessionExpires: session?.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        });

        setSession(session);
        setUser(session?.user ?? null);
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

        if (!session?.user) {
          console.warn('[useAuth] Session lost - no user in session', { event, timestamp });
        }

        if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
          // Sync profile and apply any pending role
          try {
            console.log('[useAuth] Applying pending user on login', { userId: session.user.id });
            await supabase.rpc('apply_pending_user_on_login');
            console.log('[useAuth] Successfully applied pending user');
          } catch (error) {
            console.error('[useAuth] Failed to apply pending user:', error, {
              userId: session.user.id,
              errorMessage: error instanceof Error ? error.message : String(error),
            });
          }
          // If user remains viewer, raise a pending request automatically
          try {
            const { data: prof } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            if (prof && (prof as any).role === 'viewer') {
              // Request access via direct database call since RPC types are not available
              await supabase.from('pending_users').insert({
                email: session.user.email || '',
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

    // Get initial session AFTER listener is ready to prevent race condition
    const checkInitialSession = async () => {
      console.log('[useAuth] Fetching initial session');
      const startTime = Date.now();

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        const duration = Date.now() - startTime;

        if (!isSubscribed) return; // Component unmounted, ignore result

        if (error) {
          console.error('[useAuth] Error fetching initial session:', error, { duration });
        } else {
          console.log('[useAuth] Initial session loaded', {
            duration,
            hasSession: !!session,
            userId: session?.user?.id,
          });

          // Only set if listener hasn't already set a session
          if (!sessionChecked) {
            setSession(session);
            setUser(session?.user ?? null);
          }
        }
      } catch (error) {
        console.error('[useAuth] Exception fetching initial session:', error);
      } finally {
        if (isSubscribed) {
          setLoading(false);
          sessionChecked = true;
        }
      }
    };

    // Small delay to ensure listener is ready, then check session
    const timeoutId = setTimeout(checkInitialSession, 100);

    return () => {
      console.log('[useAuth] Cleaning up auth state listener');
      isSubscribed = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    const supabase = getSupabaseBrowserClient();
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
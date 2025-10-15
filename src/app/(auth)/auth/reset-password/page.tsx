'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient, resetSupabaseBrowserClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const [checking, setChecking] = useState(false)
  const router = useRouter()

  // Manual session check for debugging
  const checkSession = async () => {
    setChecking(true)
    const supabase = getSupabaseBrowserClient()
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      console.log('=== MANUAL SESSION CHECK ===')
      console.log('Error:', error)
      console.log('Session:', session)
      console.log('User ID:', session?.user?.id)
      console.log('URL hash:', window.location.hash)
      console.log('===========================')
      
      if (session) {
        setIsRecoverySession(true)
        setError(null)
        alert('Session found! You can now set your password.')
      } else {
        alert('No session found. Check console for details.')
      }
    } catch (err) {
      console.error('Check session error:', err)
      alert('Error checking session: ' + (err as Error).message)
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    // CRITICAL: Reset the client cache to force fresh client creation
    // This ensures the client can properly handle PKCE flow
    resetSupabaseBrowserClient()
    const supabase = getSupabaseBrowserClient()
    let mounted = true
    
    console.log('🔄 Fresh Supabase client created for password reset')
    
    // Check for error in URL params
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const errorDescription = params.get('error_description')
    
    if (errorParam) {
      setError(errorDescription || 'Invalid or expired reset link. Please request a new one.')
      return
    }

    console.log('Password reset page loaded')
    console.log('Current URL:', window.location.href)
    console.log('URL Hash:', window.location.hash)
    console.log('URL Search:', window.location.search)
    
    // Check if URL has PKCE code - Supabase client should auto-exchange it
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    
    if (code) {
      console.log('🔑 PKCE code detected in URL:', code.substring(0, 20) + '...')
      console.log('⏳ Waiting for Supabase to auto-exchange code...')
      
      // Let Supabase client auto-exchange the code, then check for session
      const waitForAutoExchange = async () => {
        // Give Supabase time to automatically exchange the code
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('Post-exchange session check:', {
          hasSession: !!session,
          error: sessionError,
          userId: session?.user?.id
        })
        
        if (session && mounted) {
          console.log('✅ Session established after auto-exchange')
          setIsRecoverySession(true)
          setError(null)
          
          // Clean up URL
          const newUrl = window.location.origin + window.location.pathname
          window.history.replaceState({}, '', newUrl)
        } else if (mounted) {
          console.log('❌ No session after auto-exchange')
          // Try one more time
          await new Promise(resolve => setTimeout(resolve, 2000))
          const { data: { retrySession } } = await supabase.auth.getSession()
          
          if (retrySession && mounted) {
            console.log('✅ Session found on retry')
            setIsRecoverySession(true)
            setError(null)
          } else {
            setError('Unable to verify reset link. The link may have expired. Please request a new one.')
          }
        }
      }
      
      waitForAutoExchange()
    } else {
      console.log('ℹ️ No PKCE code in URL, checking for existing session...')
      
      const checkForExistingSession = async () => {
        await new Promise(resolve => setTimeout(resolve, 500))
        
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        console.log('Session check result:', {
          hasSession: !!session,
          error: sessionError,
          userId: session?.user?.id
        })
        
        if (session && mounted) {
          console.log('✅ Existing session found')
          setIsRecoverySession(true)
          setError(null)
        } else if (mounted) {
          console.log('⚠️ No session found')
          setError('No active password reset session. Please click the reset link from your email.')
        }
      }
      
      checkForExistingSession()
    }
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔔 Auth state change:', event, 'Has session:', !!session)
      
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        console.log('✅ PASSWORD_RECOVERY event - recovery session established')
        setIsRecoverySession(true)
        setError(null)
      } else if (event === 'SIGNED_IN') {
        console.log('✅ SIGNED_IN event - session created')
        setIsRecoverySession(true)
        setError(null)
      } else if (event === 'SIGNED_OUT') {
        console.log('Signed out on reset page')
        setIsRecoverySession(false)
      } else if (event === 'INITIAL_SESSION') {
        console.log('INITIAL_SESSION event, has session:', !!session)
        if (session && mounted) {
          setIsRecoverySession(true)
          setError(null)
        }
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('TOKEN_REFRESHED event')
        if (session && mounted) {
          setIsRecoverySession(true)
        }
      }
    })
    
    return () => {
      mounted = false
      if (sessionCheckTimeout) clearTimeout(sessionCheckTimeout)
      subscription.unsubscribe()
    }
  }, [router])

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long')
      return
    }

    setLoading(true)
    setError(null)
    const supabase = getSupabaseBrowserClient()
    
    try {
      console.log('Attempting to update password...')
      
      // Check if we have any session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Session check:', sessionError ? `Error: ${sessionError.message}` : session ? 'Session exists' : 'No session')
      
      if (sessionError) {
        console.error('Session error:', sessionError)
        setError('Session error: ' + sessionError.message)
        setLoading(false)
        return
      }
      
      if (!session) {
        console.error('No session found when trying to update password')
        setError('No active session found. The reset link may have expired. Please request a new one.')
        setLoading(false)
        return
      }
      
      console.log('Session found, updating password for user:', session.user.id)
      
      // Update the password
      const { error: updateError } = await supabase.auth.updateUser({ 
        password: password 
      })
      
      if (updateError) {
        console.error('Password update error:', updateError)
        setError(updateError.message)
        setLoading(false)
        return
      }

      // Password updated successfully
      console.log('✅ Password updated successfully')
      setSuccess(true)
      
      // Sign out the recovery session to force a clean login with the new password
      console.log('Signing out recovery session...')
      await supabase.auth.signOut({ scope: 'local' })
      
      // Redirect to login after a brief delay
      setTimeout(() => {
        router.replace('/auth')
      }, 2000)
      
    } catch (err) {
      console.error('Unexpected error updating password:', err)
      const message = err instanceof Error ? err.message : 'Unexpected error updating password'
      setError(message)
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-semibold text-green-600 mb-4">Password Updated!</h1>
          <p className="text-gray-600">Your password has been successfully updated. Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handlePasswordUpdate} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Reset Password</h1>
        <p className="text-gray-600 text-center text-sm">Enter your new password below</p>
        
        {/* Debug: Show recovery session status */}
        {isRecoverySession && (
          <div className="bg-green-50 border border-green-200 rounded px-3 py-2 text-sm text-green-700">
            ✓ Recovery session active
          </div>
        )}
        {!isRecoverySession && !error && (
          <div className="bg-yellow-50 border border-yellow-200 rounded px-3 py-2 text-sm text-yellow-700">
            <div>⏳ Waiting for recovery session...</div>
            <button
              type="button"
              onClick={checkSession}
              disabled={checking}
              className="mt-2 text-xs underline hover:no-underline"
            >
              {checking ? 'Checking...' : '🔍 Check Session Status'}
            </button>
          </div>
        )}
        
        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          minLength={6}
          disabled={!isRecoverySession && !error}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          minLength={6}
          disabled={!isRecoverySession && !error}
        />
        
        {error && <p className="text-red-600 text-sm">{error}</p>}
        
        <button 
          disabled={loading || (!isRecoverySession && !error)} 
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
          title={!isRecoverySession ? 'Waiting for recovery session to establish' : ''}
        >
          {loading ? 'Updating Password...' : 'Update Password'}
        </button>
        
        <div className="text-center">
          <button
            type="button"
            onClick={() => router.replace('/auth')}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Back to Login
          </button>
        </div>
        
        {/* Debug info */}
        <div className="text-xs text-gray-400 text-center">
          Check browser console for detailed logs
        </div>
      </form>
    </div>
  )
}

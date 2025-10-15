'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [isRecoverySession, setIsRecoverySession] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    let mounted = true
    
    // Check for error in URL params
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const errorDescription = params.get('error_description')
    
    if (errorParam) {
      setError(errorDescription || 'Invalid or expired reset link. Please request a new one.')
      return
    }

    // Initialize: Check if we have a recovery session and clear any conflicting sessions
    const initializeRecoverySession = async () => {
      try {
        // First, check what kind of session we have
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('Session error:', sessionError)
          return
        }

        console.log('Current session on reset page:', session)

        // Check if the URL hash contains reset token parameters
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const hasResetToken = hashParams.has('access_token') && hashParams.get('type') === 'recovery'
        
        if (hasResetToken) {
          console.log('Password reset link detected, clearing any existing sessions...')
          
          // Sign out any existing session first to avoid conflicts
          // This is critical - we need a clean slate for password recovery
          await supabase.auth.signOut({ scope: 'local' })
          
          // Wait a moment for the signout to complete
          await new Promise(resolve => setTimeout(resolve, 500))
          
          // The reset token in the URL will automatically create a new recovery session
          console.log('Existing session cleared, ready for password recovery')
        }
        
        if (session && mounted) {
          // We have a session - mark as recovery session
          setIsRecoverySession(true)
        }
      } catch (err) {
        console.error('Error initializing recovery session:', err)
      }
    }

    initializeRecoverySession()
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth event on reset page:', event, 'Has session:', !!session)
      
      if (!mounted) return

      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link and now has a recovery session
        console.log('Password recovery event detected')
        setIsRecoverySession(true)
        setError(null) // Clear any previous errors
      } else if (event === 'SIGNED_OUT') {
        // Session was signed out
        console.log('Signed out on reset page')
        setIsRecoverySession(false)
      }
      // Do NOT redirect away from this page during password recovery
    })
    
    return () => {
      mounted = false
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
      
      // Check if we have a recovery session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      console.log('Current session during password update:', session, 'Error:', sessionError)
      
      if (!session) {
        setError('No active session found. The reset link may have expired. Please request a new one.')
        setLoading(false)
        return
      }

      if (!isRecoverySession) {
        setError('This page can only be used with a valid password reset link.')
        setLoading(false)
        return
      }
      
      // Update the password
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })
      
      console.log('Password update result:', error)
      
      if (error) {
        setError(error.message)
        setLoading(false)
        return
      }

      // Password updated successfully
      setSuccess(true)
      
      // Sign out the recovery session to force a clean login with the new password
      console.log('Password updated, signing out recovery session...')
      await supabase.auth.signOut({ scope: 'local' })
      
      // Redirect to login after a brief delay
      setTimeout(() => {
        router.replace('/auth')
      }, 2000)
      
    } catch (err) {
      console.error('Error updating password:', err)
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
        
        <input
          type="password"
          placeholder="New Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          minLength={6}
        />
        <input
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
          minLength={6}
        />
        
        {error && <p className="text-red-600 text-sm">{error}</p>}
        
        <button 
          disabled={loading} 
          className="w-full bg-black text-white py-2 rounded disabled:opacity-50"
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
      </form>
    </div>
  )
}

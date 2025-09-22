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
  const router = useRouter()

  useEffect(() => {
    // Check if we have the session from the password reset link
    const supabase = getSupabaseBrowserClient()
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        // User clicked the reset link and is now authenticated
        // They can now update their password
      } else if (event === 'SIGNED_IN' && session) {
        // Redirect to dashboard if already signed in
        router.replace('/')
      }
    })
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
      const { error } = await supabase.auth.updateUser({ 
        password: password 
      })
      
      if (error) {
        setError(error.message)
      } else {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.replace('/auth')
        }, 2000)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error updating password'
      setError(message)
    } finally {
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

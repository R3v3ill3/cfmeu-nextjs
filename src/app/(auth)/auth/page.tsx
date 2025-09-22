'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const router = useRouter()

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setResetSuccess(false)
    const supabase = getSupabaseBrowserClient()
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.replace('/')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during sign-in'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email address first')
      return
    }
    
    setResetLoading(true)
    setError(null)
    setResetSuccess(false)
    const supabase = getSupabaseBrowserClient()
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) {
        setError(error.message)
      } else {
        setResetSuccess(true)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during password reset'
      setError(message)
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <form onSubmit={handleSignIn} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold text-center">Sign in</h1>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {resetSuccess && <p className="text-green-600 text-sm">Password reset email sent! Check your inbox.</p>}
        <button disabled={loading} className="w-full bg-black text-white py-2 rounded disabled:opacity-50">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        <div className="text-center">
          <button
            type="button"
            onClick={handlePasswordReset}
            disabled={resetLoading || !email}
            className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetLoading ? 'Sending reset email...' : 'Forgot your password?'}
          </button>
        </div>
      </form>
    </div>
  )
}


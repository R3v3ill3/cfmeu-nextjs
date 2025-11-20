'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [appleLoading, setAppleLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)
  const router = useRouter()

  // Check for error messages from OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorParam = params.get('error')
    const errorDescription = params.get('error_description')
    
    if (errorParam && errorDescription) {
      // Special handling for specific error types
      if (errorParam === 'private_relay_email') {
        setError(
          'Apple Sign In requires sharing your email address. ' +
          'Please try again and when Apple asks, select "Share My Email" instead of "Hide My Email". ' +
          'Your email is needed to match your account.'
        )
      } else if (errorParam === 'account_exists') {
        setError(errorDescription || 'An account already exists for this email. Please sign in with your existing account instead.')
      } else {
        setError(errorDescription)
      }
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

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

  async function handleAppleSignIn() {
    setAppleLoading(true)
    setError(null)
    setResetSuccess(false)
    const supabase = getSupabaseBrowserClient()
    
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: `${window.location.origin}/auth/confirm`,
          scopes: 'email', // Request email scope so Apple shows "Share My Email" option
        },
      })
      
      if (error) {
        setError(error.message)
        setAppleLoading(false)
      }
      // Note: On success, user will be redirected to Apple, then back to /auth/confirm
      // The loading state will be handled by the redirect
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during Apple sign-in'
      setError(message)
      setAppleLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-4">
        {/* YouTube Video Embed - Looping */}
        <div className="w-full aspect-video rounded-lg overflow-hidden mb-4 relative">
          <iframe
            className="w-full h-full"
            src="https://www.youtube-nocookie.com/embed/xS2GiGpvdqM?autoplay=1&mute=1&loop=1&playlist=xS2GiGpvdqM&controls=0&modestbranding=1&rel=0&playsinline=1"
            title="Eureka flag Australia (vintage style)"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            style={{ border: 0 }}
          />
          {/* Overlay to mask YouTube UI for first 3.5 seconds */}
          <div className="absolute inset-0 bg-black rounded-lg pointer-events-none youtube-overlay-mask" />
        </div>
        
        <h1 className="text-2xl font-semibold text-center">Sign in</h1>
        
        {/* Apple Sign In Button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={appleLoading || loading}
            className="w-full flex items-center justify-center gap-2 bg-black text-white py-2.5 px-4 rounded-md hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {appleLoading ? (
              <>
                <span className="animate-spin">⟳</span>
                <span>Signing in with Apple…</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
                <span>Continue with Apple</span>
              </>
            )}
          </button>
          <p className="text-xs text-muted-foreground text-center">
            When signing in, please select "Share My Email" so we can match your account
          </p>
        </div>

        {/* Divider */}
        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-300"></div>
          <span className="px-4 text-sm text-gray-500">or</span>
          <div className="flex-grow border-t border-gray-300"></div>
        </div>

        {/* Email/Password Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
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
          <button disabled={loading || appleLoading} className="w-full bg-black text-white py-2 rounded disabled:opacity-50">
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
    </div>
  )
}


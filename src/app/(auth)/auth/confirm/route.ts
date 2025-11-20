import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code') // OAuth code (for Apple Sign In)
  const next = searchParams.get('next') ?? '/'

  const supabase = await createServerSupabase()

  // Handle OAuth callback (Apple Sign In)
  if (code) {
    try {
      // Exchange code for session
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (sessionError) {
        console.error('[Auth Confirm] OAuth session error:', sessionError)
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'oauth_error')
        redirectTo.searchParams.set('error_description', 'Failed to complete sign-in. Please try again.')
        return NextResponse.redirect(redirectTo)
      }

      // Get user email from session
      const userEmail = sessionData?.user?.email
      
      if (!userEmail) {
        console.error('[Auth Confirm] No email in OAuth session')
        // Sign out the user since we can't validate them
        await supabase.auth.signOut()
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'no_email')
        redirectTo.searchParams.set('error_description', 'Unable to retrieve email from Apple. Please contact support.')
        return NextResponse.redirect(redirectTo)
      }

      // Check if user exists in profiles or pending_users
      const { data: userExists, error: checkError } = await supabase.rpc('check_user_exists_for_oauth', {
        p_email: userEmail
      })

      if (checkError) {
        console.error('[Auth Confirm] Error checking user existence:', checkError)
        // Sign out the user
        await supabase.auth.signOut()
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'validation_error')
        redirectTo.searchParams.set('error_description', 'Unable to verify your account. Please contact support.')
        return NextResponse.redirect(redirectTo)
      }

      if (!userExists) {
        console.warn('[Auth Confirm] OAuth sign-in rejected - user not registered:', userEmail)
        // Sign out the user
        await supabase.auth.signOut()
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'not_registered')
        redirectTo.searchParams.set('error_description', 'Your email is not registered. Please contact your administrator to request access.')
        return NextResponse.redirect(redirectTo)
      }

      // User exists and is validated - redirect to dashboard
      console.log('[Auth Confirm] OAuth sign-in successful for:', userEmail)
      const redirectTo = new URL(next, request.url)
      redirectTo.searchParams.delete('code')
      redirectTo.searchParams.delete('next')
      return NextResponse.redirect(redirectTo)
    } catch (error) {
      console.error('[Auth Confirm] OAuth callback exception:', error)
      await supabase.auth.signOut()
      const redirectTo = new URL('/auth', request.url)
      redirectTo.searchParams.set('error', 'oauth_exception')
      redirectTo.searchParams.set('error_description', 'An unexpected error occurred. Please try again.')
      return NextResponse.redirect(redirectTo)
    }
  }

  // Handle email OTP callback (password reset)
  if (token_hash && type) {
    const redirectTo = request.nextUrl.clone()
    redirectTo.pathname = next === '/' ? '/auth/reset-password' : next
    redirectTo.searchParams.delete('token_hash')
    redirectTo.searchParams.delete('type')
    redirectTo.searchParams.delete('next')

    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }

    // If verification failed, surface the message on the reset page
    redirectTo.searchParams.set('error', 'invalid_or_expired')
    redirectTo.searchParams.set('error_description', error.message)
    return NextResponse.redirect(redirectTo)
  }

  // Missing required params → send back to auth page with error
  const redirectTo = new URL('/auth', request.url)
  redirectTo.searchParams.set('error', 'missing_params')
  redirectTo.searchParams.set('error_description', 'Missing authentication parameters')
  return NextResponse.redirect(redirectTo)
}



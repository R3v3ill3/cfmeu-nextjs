import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code') // OAuth code (for Apple Sign In)
  const error_param = searchParams.get('error') // OAuth error from Supabase
  const error_description = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/'

  const supabase = await createServerSupabase()

  // Log all incoming parameters for debugging
  console.log('[Auth Confirm] Callback received:', {
    hasCode: !!code,
    hasTokenHash: !!token_hash,
    hasType: !!type,
    hasError: !!error_param,
    errorDescription: error_description,
    allParams: Object.fromEntries(searchParams.entries()),
  })

  // Handle OAuth error from Supabase (e.g., signups disabled)
  if (error_param) {
    console.error('[Auth Confirm] OAuth error from Supabase:', { error_param, error_description })
    const redirectTo = new URL('/auth', request.url)
    if (error_param === 'signups_not_allowed' || error_description?.includes('Signups not allowed')) {
      redirectTo.searchParams.set('error', 'signups_disabled')
      redirectTo.searchParams.set('error_description', 'OAuth signups are currently disabled in Supabase. Please enable signups in Authentication → Settings → Auth, then disable the "Disable new user signups" toggle.')
    } else {
      redirectTo.searchParams.set('error', 'oauth_error')
      redirectTo.searchParams.set('error_description', error_description || 'OAuth authentication failed')
    }
    return NextResponse.redirect(redirectTo)
  }

  // Handle OAuth callback (Apple Sign In)
  if (code) {
    try {
      // Exchange code for session
      const { data: sessionData, error: sessionError } = await supabase.auth.exchangeCodeForSession(code)
      
      if (sessionError) {
        console.error('[Auth Confirm] OAuth session error:', sessionError)
        
        // Check if error is due to signups being disabled
        if (sessionError.message?.includes('Signups not allowed') || sessionError.status === 422) {
          const redirectTo = new URL('/auth', request.url)
          redirectTo.searchParams.set('error', 'signups_disabled')
          redirectTo.searchParams.set('error_description', 'OAuth signups are currently disabled. Please contact your administrator.')
          return NextResponse.redirect(redirectTo)
        }
        
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'oauth_error')
        redirectTo.searchParams.set('error_description', `Failed to complete sign-in: ${sessionError.message}`)
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

      // Check if Apple provided a private relay email (user chose "Hide My Email")
      const isPrivateRelayEmail = userEmail.includes('@privaterelay.appleid.com')
      
      if (isPrivateRelayEmail) {
        console.warn('[Auth Confirm] Apple private relay email detected - user chose "Hide My Email":', userEmail)
        // Sign out the user immediately
        await supabase.auth.signOut()
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'private_relay_email')
        redirectTo.searchParams.set('error_description', 'Apple Sign In requires sharing your email address. Please try again and select "Share My Email" instead of "Hide My Email" when signing in with Apple.')
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
        // Sign out the user and delete the newly created profile/auth user if it exists
        const currentUser = sessionData?.user
        if (currentUser?.id) {
          // Delete the unauthorized profile using the SECURITY DEFINER function
          // This is needed because there's no DELETE policy on profiles
          const { data: deleted, error: cleanupError } = await supabase.rpc('cleanup_unauthorized_oauth_profile', {
            p_user_id: currentUser.id
          })
          if (cleanupError) {
            console.error('[Auth Confirm] Failed to cleanup unauthorized profile:', cleanupError)
          } else if (deleted) {
            console.log('[Auth Confirm] Cleaned up unauthorized OAuth profile for user:', currentUser.id)
          }
        }
        // Sign out BEFORE redirecting to ensure session is cleared
        await supabase.auth.signOut()
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'not_registered')
        redirectTo.searchParams.set('error_description', 'Your email is not registered. Please contact your administrator to request access.')
        return NextResponse.redirect(redirectTo)
      }

      // Check if this email matches an existing AUTHORIZED profile with a different user ID
      // This happens when OAuth creates a new account but the email already exists
      // We only match profiles that have an explicitly assigned role (not NULL)
      const normalizedEmail = userEmail.toLowerCase().trim()
      const { data: existingProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, email, role, is_active')
        .or(`email.ilike.${normalizedEmail},apple_email.ilike.${normalizedEmail}`)
        .eq('is_active', true)
        .not('role', 'is', null)
        .maybeSingle()

      if (profileError) {
        console.error('[Auth Confirm] Error checking existing profile:', profileError)
      }

      const currentUserId = sessionData?.user?.id
      
      // If email matches an existing profile but with a different user ID, we have a problem
      if (existingProfile && existingProfile.id !== currentUserId) {
        console.warn('[Auth Confirm] Email matches existing profile but different user ID:', {
          existingProfileId: existingProfile.id,
          currentUserId,
          email: userEmail
        })
        
        // Sign out the new OAuth user
        await supabase.auth.signOut()
        
        // Try to delete the profile that was auto-created by the trigger using the cleanup function
        if (currentUserId) {
          const { error: cleanupError } = await supabase.rpc('cleanup_unauthorized_oauth_profile', {
            p_user_id: currentUserId
          })
          if (cleanupError) {
            console.error('[Auth Confirm] Failed to cleanup duplicate profile:', cleanupError)
          }
        }
        
        const redirectTo = new URL('/auth', request.url)
        redirectTo.searchParams.set('error', 'account_exists')
        redirectTo.searchParams.set('error_description', `An account already exists for ${userEmail}. Please sign in with your existing account (email/password) instead of Apple Sign In, or contact support to link your Apple ID to your existing account.`)
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



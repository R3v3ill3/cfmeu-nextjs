import { type EmailOtpType } from '@supabase/supabase-js'
import { type NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/auth/reset-password'

  // Build clean redirect URL without auth params
  const redirectTo = request.nextUrl.clone()
  redirectTo.pathname = next
  redirectTo.searchParams.delete('token_hash')
  redirectTo.searchParams.delete('type')
  redirectTo.searchParams.delete('next')

  if (token_hash && type) {
    const supabase = await createServerSupabase()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      return NextResponse.redirect(redirectTo)
    }

    // If verification failed, surface the message on the reset page
    redirectTo.searchParams.set('error', 'invalid_or_expired')
    redirectTo.searchParams.set('error_description', error.message)
    return NextResponse.redirect(redirectTo)
  }

  // Missing required params → send back to reset page with error
  redirectTo.searchParams.set('error', 'missing_params')
  redirectTo.searchParams.set('error_description', 'Missing token_hash or type')
  return NextResponse.redirect(redirectTo)
}



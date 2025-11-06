import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { generateTemporaryPassword, isDevelopmentEmail } from '@/utils/auth-utils'

export const dynamic = 'force-dynamic'

interface ResetPasswordRequest {
  email: string
}

interface ResetPasswordResponse {
  success: boolean
  data?: {
    email: string
    new_password: string
    message: string
  }
  error?: string
  details?: string
}

export async function POST(request: NextRequest) {
  console.log('🔐 RESET PASSWORD API: Starting request...')

  try {
    const supabase = await createServerSupabase()

    // Check authentication
    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser()

    if (userAuthError || !user) {
      console.log('❌ Authentication failed:', userAuthError?.message || 'No user found')
      return NextResponse.json(
        {
          success: false,
          error: 'Unauthorized - Admin login required',
          details: userAuthError?.message || 'No authenticated user found',
        },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('❌ Failed to fetch user profile:', profileError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to verify permissions',
          details: profileError.message
        },
        { status: 500 }
      )
    }

    if (!profile || profile.role !== 'admin') {
      console.log('❌ User is not admin:', { userId: user.id, role: profile?.role })
      return NextResponse.json(
        {
          success: false,
          error: 'Forbidden - Admin access required',
          details: `User role: ${profile?.role || 'none'}`
        },
        { status: 403 }
      )
    }

    console.log('✅ Admin permission verified')

    // Parse request body
    let body: ResetPasswordRequest
    try {
      body = await request.json()
      console.log('📋 Request body parsed:', { email: body.email })
    } catch (parseError) {
      console.error('❌ Failed to parse request body:', parseError)
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body'
        },
        { status: 400 }
      )
    }

    const { email } = body

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: 'Email is required'
        },
        { status: 400 }
      )
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Verify this is a testing email
    if (!isDevelopmentEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only testing emails can have passwords reset via this endpoint',
          details: 'Use the standard password reset flow for production emails'
        },
        { status: 400 }
      )
    }

    console.log('🔍 Resetting password for testing account:', normalizedEmail)

    // Generate new temporary password
    const newPassword = generateTemporaryPassword()
    if (!newPassword) {
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to generate new password'
        },
        { status: 500 }
      )
    }

    console.log('🔑 Generated new password:', {
      length: newPassword.length,
      preview: `${newPassword.substring(0, 3)}***`
    })

    // First, find the user ID from profiles table (more efficient)
    const { data: targetProfile, error: targetProfileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (targetProfileError) {
      console.error('❌ Failed to find profile:', targetProfileError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to find user',
          details: targetProfileError.message
        },
        { status: 500 }
      )
    }

    if (!targetProfile || !targetProfile.id) {
      console.error('❌ User not found:', normalizedEmail)
      return NextResponse.json(
        {
          success: false,
          error: 'User not found',
          details: `No profile found with email: ${normalizedEmail}`
        },
        { status: 404 }
      )
    }

    const userId = targetProfile.id
    console.log('✅ Found user profile:', { id: userId, email: targetProfile.email })

    // Use service role to update password
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Update the password using admin API
    const { data: updatedUser, error: updateError } = await serviceSupabase.auth.admin.updateUserById(
      userId,
      {
        password: newPassword
      }
    )

    if (updateError) {
      console.error('❌ Failed to update password:', updateError)
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to update password',
          details: updateError.message
        },
        { status: 500 }
      )
    }

    console.log('✅ Password updated successfully for:', normalizedEmail)
    console.log('🔑 NEW PASSWORD:', {
      email: normalizedEmail,
      password: newPassword,
      note: 'SAVE THIS PASSWORD - User can login with this now'
    })

    return NextResponse.json({
      success: true,
      data: {
        email: normalizedEmail,
        new_password: newPassword,
        message: 'Password reset successfully. User can now login with the new password.'
      }
    } as ResetPasswordResponse)
  } catch (error: any) {
    console.error('💥 RESET PASSWORD API: CATCH ALL ERROR:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
        details: error.stack
      },
      { status: 500 }
    )
  }
}


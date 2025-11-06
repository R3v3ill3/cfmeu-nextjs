import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { generateTemporaryPassword, prepareUserMetadata } from '@/utils/auth-utils'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    console.log('🧪 Testing auth creation...')

    const tempPassword = generateTemporaryPassword()
    const testEmail = 'debug-test@testing.org'
    const userMetadata = prepareUserMetadata('organiser', 'Debug Test User')

    console.log('📝 Test data prepared:', { email: testEmail, hasTempPassword: !!tempPassword })

    // Create Supabase auth user using service role key
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

    console.log('🔑 Service client created')
    console.log('🌐 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
    console.log('🔑 Has service key:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

    const { data: createdAuthUser, error: createAuthError } = await serviceSupabase.auth.admin.createUser({
      email: testEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: userMetadata
    })

    console.log('👤 User creation result:', {
      hasData: !!createdAuthUser,
      hasError: !!createAuthError,
      error: createAuthError?.message,
      userId: createdAuthUser?.user?.id
    })

    if (createAuthError) {
      return NextResponse.json({
        success: false,
        error: createAuthError.message,
        details: createAuthError,
        tempPassword,
        email: testEmail
      })
    }

    // Clean up the test user
    if (createdAuthUser?.user?.id) {
      await serviceSupabase.auth.admin.deleteUser(createdAuthUser.user.id)
      console.log('🧹 Test user cleaned up')
    }

    return NextResponse.json({
      success: true,
      message: 'Auth creation test successful',
      tempPassword,
      userId: createdAuthUser?.user?.id,
      email: testEmail
    })

  } catch (error: any) {
    console.error('❌ Auth test failed:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
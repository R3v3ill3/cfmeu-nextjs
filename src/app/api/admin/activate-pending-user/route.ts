import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { generateTemporaryPassword, isDevelopmentEmail, prepareUserMetadata } from '@/utils/auth-utils'

export const dynamic = 'force-dynamic'

interface ActivateUserRequest {
  pendingEmail: string
  activatedEmail?: string
}

interface ActivationResult {
  success: boolean
  pending_user_id?: string
  activated_user_id?: string
  pending_email?: string
  activated_email?: string
  role?: string
  full_name?: string
  hierarchy_migrated?: {
    role_hierarchy_created: number
    lead_draft_links_created: number
    draft_links_updated: number
    links_deactivated: number
  }
  patches_migrated?: number
  invalid_patches_cleaned?: number
  error?: string
  error_detail?: string
}

interface ApiResponse {
  success: boolean
  data?: {
    pending_user_id?: string
    activated_user_id?: string
    pending_email?: string
    activated_email?: string
    role?: string
    full_name?: string
    hierarchy_migrated?: {
      role_hierarchy_created: number
      lead_draft_links_created: number
      draft_links_updated: number
      links_deactivated: number
    }
    patches_migrated?: number
    invalid_patches_cleaned?: number
    temporary_password?: string
    auth_user_created?: boolean
    testing_account?: boolean
  }
  error?: string
  details?: string
}

export async function POST(request: NextRequest) {
  console.log('🚀 ACTIVATION API: Starting request...')

  try {
    const supabase = await createServerSupabase()
    console.log('🚀 ACTIVATION API: Supabase client created')

    // Check authentication
    console.log('🔐 Checking authentication for activation API...')
    const {
      data: { user },
      error: userAuthError,
    } = await supabase.auth.getUser()

    console.log('🔐 Auth check result:', {
      hasUser: !!user,
      hasError: !!userAuthError,
      userId: user?.id,
      userEmail: user?.email,
      authError: userAuthError?.message
    })

    if (userAuthError || !user) {
      console.log('❌ Authentication failed:', userAuthError?.message || 'No user found')
      return NextResponse.json(
        {
          error: 'Unauthorized - Admin login required',
          details: userAuthError?.message || 'No authenticated user found',
          debug: { hasUser: !!user, hasError: !!userAuthError }
        },
        { status: 401 }
      )
    }

    // Check if user is admin
    console.log('🔍 Checking admin permissions...')
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('❌ Failed to fetch user profile:', profileError)
      return NextResponse.json(
        {
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
          error: 'Forbidden - Admin access required',
          details: `User role: ${profile?.role || 'none'}`
        },
        { status: 403 }
      )
    }

    console.log('✅ Admin permission verified')

    // Parse request body
    console.log('📋 ACTIVATION API: Parsing request body...')
    let body: ActivateUserRequest
    try {
      body = await request.json()
      console.log('📋 ACTIVATION API: Request body parsed:', body)
    } catch (parseError) {
      console.error('❌ ACTIVATION API: Failed to parse request body:', parseError)
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      )
    }

    const { pendingEmail, activatedEmail } = body

    if (!pendingEmail) {
      console.log('❌ ACTIVATION API: Missing pendingEmail')
      return NextResponse.json(
        { error: 'pendingEmail is required' },
        { status: 400 }
      )
    }

    // Normalize email
    const normalizedPendingEmail = pendingEmail.toLowerCase().trim()

    // Generate activated email if not provided
    // For testing emails, keep the same domain; for production, convert to @cfmeu.org
    const isTestingEmail = isDevelopmentEmail(normalizedPendingEmail)
    const finalActivatedEmail = activatedEmail ||
      (isTestingEmail ? normalizedPendingEmail : normalizedPendingEmail.replace(/@testing\.org$/i, '@cfmeu.org'))

    console.log('📧 ACTIVATION API: Email processing:', {
      original: pendingEmail,
      normalized: normalizedPendingEmail,
      isTesting: isTestingEmail,
      finalActivated: finalActivatedEmail
    })

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(normalizedPendingEmail) || !emailRegex.test(finalActivatedEmail)) {
      console.log('❌ ACTIVATION API: Invalid email format')
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Fetch pending user data from database
    console.log('📋 ACTIVATION API: Fetching pending user data...')
    const { data: pendingUserData, error: pendingUserError } = await supabase
      .from('pending_users')
      .select('id, email, full_name, role, assigned_patch_ids, status')
      .eq('email', normalizedPendingEmail)
      .maybeSingle()

    if (pendingUserError) {
      console.error('❌ ACTIVATION API: Failed to fetch pending user:', pendingUserError)
      return NextResponse.json(
        {
          error: 'Failed to fetch pending user data',
          details: pendingUserError.message
        },
        { status: 500 }
      )
    }

    if (!pendingUserData) {
      console.error('❌ ACTIVATION API: Pending user not found:', normalizedPendingEmail)
      return NextResponse.json(
        {
          error: 'Pending user not found',
          details: `No pending user found with email: ${normalizedPendingEmail}`
        },
        { status: 404 }
      )
    }

    if (pendingUserData.status === 'archived') {
      console.error('❌ ACTIVATION API: Pending user is archived:', normalizedPendingEmail)
      return NextResponse.json(
        {
          error: 'Pending user is archived',
          details: 'Cannot activate an archived pending user'
        },
        { status: 400 }
      )
    }

    console.log('✅ ACTIVATION API: Pending user found:', {
      id: pendingUserData.id,
      email: pendingUserData.email,
      role: pendingUserData.role,
      full_name: pendingUserData.full_name,
      patch_count: pendingUserData.assigned_patch_ids?.length || 0
    })

    let authUser: any = null
    let tempPassword: string | undefined
    let authError: any = null

    // For testing emails, create auth user FIRST
    if (isTestingEmail) {
      console.log('🚀 Starting testing account creation for:', finalActivatedEmail)

      try {
        // Always generate password for testing emails
        tempPassword = generateTemporaryPassword()
        if (!tempPassword) {
          throw new Error('Failed to generate temporary password')
        }
        
        // CRITICAL: Log the actual password immediately so it can be recovered
        console.log('🔑 TEMPORARY PASSWORD GENERATED:', {
          email: finalActivatedEmail,
          password: tempPassword,
          length: tempPassword.length,
          note: 'SAVE THIS PASSWORD - It will be used for login'
        })
        
        console.log('🔑 Password validation:', {
          hasUppercase: /[A-Z]/.test(tempPassword),
          hasLowercase: /[a-z]/.test(tempPassword),
          hasNumbers: /[0-9]/.test(tempPassword),
          hasSpecial: /[!@#$%&]/.test(tempPassword)
        })
        
        const userMetadata = prepareUserMetadata(pendingUserData.role, pendingUserData.full_name || undefined)

        console.log('📝 Metadata prepared:', {
          email: finalActivatedEmail,
          role: pendingUserData.role,
          full_name: pendingUserData.full_name,
          hasTempPassword: !!tempPassword
        })

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

        console.log('🔑 Service client created, attempting user creation...')

        const { data: createdAuthUser, error: createAuthError } = await serviceSupabase.auth.admin.createUser({
          email: finalActivatedEmail,
          password: tempPassword,
          email_confirm: true, // Skip email verification for testing
          user_metadata: userMetadata
        })

        console.log('👤 User creation result:', {
          hasData: !!createdAuthUser,
          hasError: !!createAuthError,
          error: createAuthError?.message,
          userId: createdAuthUser?.user?.id
        })

        if (createAuthError) {
          authError = createAuthError
          console.error('Failed to create auth user:', createAuthError)
        } else {
          authUser = createdAuthUser
          console.log(`✅ Created testing auth user: ${finalActivatedEmail}`)
        }
      } catch (err: any) {
        authError = err
        console.error('Exception creating auth user:', err)
      }

      // If auth creation failed, return error immediately
      if (authError) {
        console.error('❌ Auth creation failed for:', finalActivatedEmail, authError)
        return NextResponse.json(
          {
            error: 'Failed to create authentication credentials.',
            details: authError.message || 'Unknown auth creation error',
            code: authError.status || 'UNKNOWN'
          },
          { status: 500 }
        )
      }
    }

    // Small delay to ensure auth user is available in database
    if (isTestingEmail && authUser) {
      console.log('⏳ Waiting for auth user to propagate...')
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Verify profile exists after auth user creation (for testing emails)
    if (isTestingEmail && authUser) {
      console.log('🔍 Verifying profile exists after auth user creation...')
      
      // Try to fetch profile with retry logic
      let profileExists = false
      const maxRetries = 5
      const retryDelay = 500

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const { data: profileCheck, error: profileCheckError } = await supabase
          .from('profiles')
          .select('id, email, role')
          .eq('id', authUser.user.id)
          .maybeSingle()

        if (profileCheck && !profileCheckError) {
          console.log(`✅ Profile found on attempt ${attempt}:`, {
            id: profileCheck.id,
            email: profileCheck.email,
            role: profileCheck.role
          })
          profileExists = true
          break
        } else {
          console.log(`⏳ Profile not found yet (attempt ${attempt}/${maxRetries})...`)
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }

      // If profile still doesn't exist, create it manually
      if (!profileExists) {
        console.log('⚠️ Profile not created by trigger, creating manually...')
        const { data: newProfile, error: createProfileError } = await supabase
          .from('profiles')
          .insert({
            id: authUser.user.id,
            email: finalActivatedEmail,
            full_name: pendingUserData.full_name || null,
            role: pendingUserData.role
          })
          .select()
          .single()

        if (createProfileError || !newProfile) {
          console.error('❌ Failed to create profile manually:', createProfileError)
          // Clean up auth user
          try {
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
            await serviceSupabase.auth.admin.deleteUser(authUser.user.id)
            console.log('🧹 Cleaned up auth user due to profile creation failure')
          } catch (cleanupError) {
            console.error('Failed to cleanup auth user:', cleanupError)
          }

          return NextResponse.json(
            {
              error: 'Failed to create user profile',
              details: createProfileError?.message || 'Profile creation failed after auth user creation'
            },
            { status: 500 }
          )
        }

        console.log('✅ Profile created manually:', {
          id: newProfile.id,
          email: newProfile.email,
          role: newProfile.role
        })
      }
    }

    // Now call the database function for data migration
    console.log('🔄 Calling activate_pending_user database function...')
    const { data, error } = await supabase.rpc('activate_pending_user', {
      p_pending_email: normalizedPendingEmail,
      p_activated_email: finalActivatedEmail,
    })

    if (error) {
      console.error('❌ Error calling activate_pending_user:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })

      // If database migration fails, clean up the auth user we created
      if (authUser) {
        try {
          console.log('🧹 Cleaning up auth user due to migration failure...')
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
          await serviceSupabase.auth.admin.deleteUser(authUser.user.id)
          console.log('✅ Auth user cleaned up successfully')
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup auth user:', cleanupError)
        }
      }

      return NextResponse.json(
        {
          error: 'Failed to activate user',
          details: error.message || 'Database function call failed',
          code: error.code,
          hint: error.hint
        },
        { status: 500 }
      )
    }

    console.log('📊 activate_pending_user returned data:', data)
    const result = data as ActivationResult

    if (!result.success) {
      console.error('❌ Activation failed:', {
        error: result.error,
        error_detail: result.error_detail
      })

      // If database migration fails, clean up the auth user we created
      if (authUser) {
        try {
          console.log('🧹 Cleaning up auth user due to migration failure...')
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
          await serviceSupabase.auth.admin.deleteUser(authUser.user.id)
          console.log('✅ Auth user cleaned up successfully')
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup auth user:', cleanupError)
        }
      }

      return NextResponse.json(
        {
          error: result.error || 'Activation failed',
          details: result.error_detail || 'Unknown activation error'
        },
        { status: 400 }
      )
    }

    console.log('✅ Activation successful:', {
      pending_user_id: result.pending_user_id,
      activated_user_id: result.activated_user_id,
      role: result.role,
      patches_migrated: result.patches_migrated,
      hierarchy_migrated: result.hierarchy_migrated
    })

    // Log temporary password again before sending response (for recovery)
    if (tempPassword) {
      console.log('🔑 TEMPORARY PASSWORD (FINAL):', {
        email: finalActivatedEmail,
        password: tempPassword,
        note: 'This password will be included in the API response'
      })
    } else if (isTestingEmail) {
      console.warn('⚠️ WARNING: Testing email but no temporary password was generated!')
      console.warn('⚠️ This is a critical error - password should have been generated!')
    }

    // Prepare response data
    // Ensure password is included for testing accounts
    const responseTempPassword = isTestingEmail && tempPassword ? tempPassword : undefined
    
    const responseData: ApiResponse['data'] = {
      pending_user_id: result.pending_user_id,
      activated_user_id: result.activated_user_id,
      pending_email: result.pending_email,
      activated_email: result.activated_email,
      role: result.role,
      full_name: result.full_name,
      hierarchy_migrated: result.hierarchy_migrated,
      patches_migrated: result.patches_migrated,
      invalid_patches_cleaned: result.invalid_patches_cleaned,
      testing_account: isTestingEmail,
      auth_user_created: !!authUser,
      temporary_password: responseTempPassword, // Explicitly include password for testing accounts
    }
    
    // Debug: Verify password is in response object
    console.log('🔍 Response data verification:', {
      has_temp_password_key: 'temporary_password' in responseData,
      temp_password_value: responseData.temporary_password ? 'SET' : 'NOT SET',
      temp_password_type: typeof responseData.temporary_password,
      isTestingEmail,
      tempPassword_exists: !!tempPassword
    })

    // Final log of response data
    console.log('📤 Sending response:', {
      success: true,
      has_temp_password: !!responseData.temporary_password,
      temp_password_length: responseData.temporary_password?.length || 0,
      temp_password_preview: responseData.temporary_password ? `${responseData.temporary_password.substring(0, 3)}***` : 'NONE',
      testing_account: responseData.testing_account,
      auth_user_created: responseData.auth_user_created
    })
    
    // One more safety check - ensure password is in response
    if (isTestingEmail && !responseData.temporary_password) {
      console.error('❌ CRITICAL: Testing account but temporary_password is missing from response!')
      console.error('❌ tempPassword variable:', tempPassword ? `${tempPassword.substring(0, 3)}***` : 'undefined')
    }

    return NextResponse.json({
      success: true,
      data: responseData
    } as ApiResponse)
  } catch (error: any) {
    console.error('💥 ACTIVATION API: CATCH ALL ERROR:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    })
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        debug: {
          name: error.name,
          code: error.code,
          stack: error.stack
        }
      },
      { status: 500 }
    )
  }
}


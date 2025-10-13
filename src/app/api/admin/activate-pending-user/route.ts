import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    // Parse request body
    const body: ActivateUserRequest = await request.json()
    const { pendingEmail, activatedEmail } = body

    if (!pendingEmail) {
      return NextResponse.json(
        { error: 'pendingEmail is required' },
        { status: 400 }
      )
    }

    // Generate activated email if not provided
    // Convert @testing.org to @cfmeu.org
    const finalActivatedEmail = activatedEmail || 
      pendingEmail.replace(/@testing\.org$/i, '@cfmeu.org')

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(pendingEmail) || !emailRegex.test(finalActivatedEmail)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Call the database function
    const { data, error } = await supabase.rpc('activate_pending_user', {
      p_pending_email: pendingEmail.toLowerCase().trim(),
      p_activated_email: finalActivatedEmail.toLowerCase().trim(),
    })

    if (error) {
      console.error('Error calling activate_pending_user:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to activate user' },
        { status: 500 }
      )
    }

    const result = data as ActivationResult

    if (!result.success) {
      return NextResponse.json(
        { 
          error: result.error || 'Activation failed',
          details: result.error_detail 
        },
        { status: 400 }
      )
    }

    // Return success with details
    return NextResponse.json({
      success: true,
      data: {
        pending_user_id: result.pending_user_id,
        activated_user_id: result.activated_user_id,
        pending_email: result.pending_email,
        activated_email: result.activated_email,
        role: result.role,
        full_name: result.full_name,
        hierarchy_migrated: result.hierarchy_migrated,
        patches_migrated: result.patches_migrated,
        invalid_patches_cleaned: result.invalid_patches_cleaned,
      },
    })
  } catch (error: any) {
    console.error('Error in activate-pending-user API:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


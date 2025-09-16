import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export interface UserProfileResponse {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, is_active')
      .eq('id', user.id)
      .single()
    
    if (profileError || !profile) {
      console.error('Profile fetch error:', profileError)
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }
    
    const response: UserProfileResponse = {
      id: profile.id,
      email: profile.email || user.email || '',
      full_name: profile.full_name || '',
      role: profile.role || 'viewer',
      is_active: profile.is_active !== false
    }
    
    // Cache profile for 5 minutes
    const headers = {
      'Cache-Control': 'private, s-maxage=300',
      'Content-Type': 'application/json'
    }
    
    return NextResponse.json(response, { headers })
    
  } catch (error) {
    console.error('User profile API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

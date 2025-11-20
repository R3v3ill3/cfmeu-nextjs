import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const { employerId } = params
    const supabase = await createServerSupabase()

    // Authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse fields query parameter
    const { searchParams } = new URL(request.url)
    const fieldsParam = searchParams.get('fields')
    const fields = fieldsParam ? fieldsParam.split(',').map(f => f.trim()) : null

    // Build select query based on fields parameter
    let selectQuery = supabase
      .from('employers')
      .select(fields ? fields.join(',') : '*')
      .eq('id', employerId)
      .single()

    const { data, error } = await selectQuery

    if (error) {
      // Handle not found
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
      }
      
      console.error('[employers-api] Error fetching employer:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to fetch employer' },
        { status: 500 }
      )
    }

    if (!data) {
      return NextResponse.json({ error: 'Employer not found' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('[employers-api] Unexpected error:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}


import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const seenAt: string | null = body?.seenAt || null

    const effective = seenAt || new Date().toISOString()

    const { data, error } = await supabase
      .from('profiles')
      .update({ last_seen_projects_at: effective })
      .eq('id', user.id)
      .select('id, last_seen_projects_at')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ ok: true, last_seen_projects_at: data.last_seen_projects_at })
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



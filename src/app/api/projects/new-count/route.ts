import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = request.nextUrl.searchParams
    const sinceParam = sp.get('since') || undefined
    const patchParam = sp.get('patch') || undefined
    let patchIds = patchParam ? patchParam.split(',').map(s => s.trim()).filter(Boolean) : []

    // Load profile for default since timestamp and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, last_seen_projects_at')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const role = (profile as any)?.role as string | null
    const effectiveSince = sinceParam || (profile as any)?.last_seen_projects_at || null
    if (!effectiveSince) {
      return NextResponse.json({ count: 0, since: null, aggregated: true })
    }

    // Resolve patch IDs automatically for organisers if not provided
    if (patchIds.length === 0 && role && role !== 'admin') {
      try {
        if (role === 'lead_organiser') {
          const { data: assigns } = await supabase
            .from('lead_organiser_patch_assignments')
            .select('patch_id')
            .eq('lead_organiser_id', user.id)
            .is('effective_to', null)
          patchIds = Array.from(new Set(((assigns as any[]) || []).map((r: any) => r.patch_id).filter(Boolean)))
        } else if (role === 'organiser') {
          const { data: assigns } = await supabase
            .from('organiser_patch_assignments')
            .select('patch_id')
            .eq('organiser_id', user.id)
            .is('effective_to', null)
          patchIds = Array.from(new Set(((assigns as any[]) || []).map((r: any) => r.patch_id).filter(Boolean)))
        }
      } catch {}
    }

    // Build base query on materialized view
    let q = supabase
      .from('project_list_comprehensive_view')
      .select('id', { count: 'exact', head: true })
      .gt('created_at', effectiveSince)

    // If specific patchIds passed, filter by them; otherwise, aggregate across all patches accessible to the user
    if (patchIds.length > 0) {
      const { data: patchProjects, error: ppErr } = await supabase
        .from('patch_project_mapping_view')
        .select('project_id')
        .in('patch_id', patchIds)
      if (ppErr) return NextResponse.json({ error: 'Patch filtering failed' }, { status: 500 })
      const projectIds = Array.from(new Set((patchProjects || []).map((r: any) => r.project_id)))
      if (projectIds.length === 0) return NextResponse.json({ count: 0, since: effectiveSince, aggregated: patchIds.length > 1 })
      q = supabase.from('project_list_comprehensive_view').select('id', { count: 'exact', head: true }).in('id', projectIds).gt('created_at', effectiveSince)
    }

    const { count, error } = await q
    if (error) return NextResponse.json({ error: 'Count failed' }, { status: 500 })

    return NextResponse.json({ count: count || 0, since: effectiveSince, aggregated: patchIds.length !== 1 })
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}



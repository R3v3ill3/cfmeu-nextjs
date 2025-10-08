import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function mapCategoryType(t: string): 'contractor_role' | 'trade' | null {
  if (t === 'role' || t === 'contractor_role') return 'contractor_role'
  if (t === 'trade') return 'trade'
  return null
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const employerId = params.employerId
    const supabase = await createServerSupabase()

    // Fetch categories for employer from unified view (both manual and derived)
    const { data: rows, error } = await supabase
      .from('v_employer_contractor_categories')
      .select('category_type, category_code, category_name, source, is_current, project_id')
      .eq('employer_id', employerId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const categoriesByType: Record<'contractor_role' | 'trade', Array<{ code: string; name: string; manual: boolean; derived: boolean; is_current: boolean }>> = {
      contractor_role: [],
      trade: [],
    }
    const seen = new Set<string>()
    const projectIds = new Set<string>()

    ;(rows || []).forEach((r: any) => {
      if (r.project_id) projectIds.add(r.project_id as string)
      const key = `${r.category_type}:${r.category_code}`
      if (!seen.has(key)) {
        categoriesByType[r.category_type as 'contractor_role' | 'trade'].push({
          code: r.category_code,
          name: r.category_name,
          manual: r.source === 'manual_capability',
          derived: r.source !== 'manual_capability',
          is_current: Boolean(r.is_current),
        })
        seen.add(key)
      }
    })

    // Fetch projects for display
    let projects: Array<{ id: string; name: string }> = []
    if (projectIds.size > 0) {
      const { data: proj, error: pErr } = await supabase
        .from('projects')
        .select('id, name')
        .in('id', Array.from(projectIds))
      if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
      projects = (proj || []) as Array<{ id: string; name: string }>
    }

    return NextResponse.json({
      data: {
        roles: categoriesByType.contractor_role.sort((a, b) => a.name.localeCompare(b.name)),
        trades: categoriesByType.trade.sort((a, b) => a.name.localeCompare(b.name)),
        projects,
      }
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const employerId = params.employerId
    const { type, code } = await request.json() as { type: 'contractor_role' | 'trade' | 'role'; code: string }
    const t = mapCategoryType(type)
    if (!t || !code) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const supabase = await createServerSupabase()

    if (t === 'contractor_role') {
      // Map code -> contractor_role_types.id
      const { data: role, error: rErr } = await supabase
        .from('contractor_role_types')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
      if (!role) return NextResponse.json({ error: 'Unknown contractor role code' }, { status: 400 })

      // Upsert manual capability
      const { error: upErr } = await supabase
        .from('employer_capabilities')
        .upsert({
          employer_id: employerId,
          capability_type: 'contractor_role',
          contractor_role_type_id: role.id,
          trade_type_id: null,
          is_primary: false,
        }, { onConflict: 'employer_id,capability_type,contractor_role_type_id' })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    } else {
      // trade
      const { data: trade, error: tErr } = await supabase
        .from('trade_types')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
      if (!trade) return NextResponse.json({ error: 'Unknown trade code' }, { status: 400 })

      const { error: upErr } = await supabase
        .from('employer_capabilities')
        .upsert({
          employer_id: employerId,
          capability_type: 'trade',
          trade_type_id: trade.id,
          contractor_role_type_id: null,
          is_primary: false,
        }, { onConflict: 'employer_id,capability_type,trade_type_id' })
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { employerId: string } }
) {
  try {
    const employerId = params.employerId
    const { type, code } = await request.json() as { type: 'contractor_role' | 'trade' | 'role'; code: string }
    const t = mapCategoryType(type)
    if (!t || !code) return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })

    const supabase = await createServerSupabase()

    if (t === 'contractor_role') {
      const { data: role, error: rErr } = await supabase
        .from('contractor_role_types')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 })
      if (!role) return NextResponse.json({ error: 'Unknown contractor role code' }, { status: 400 })

      const { error: delErr } = await supabase
        .from('employer_capabilities')
        .delete()
        .eq('employer_id', employerId)
        .eq('capability_type', 'contractor_role')
        .eq('contractor_role_type_id', role.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    } else {
      const { data: trade, error: tErr } = await supabase
        .from('trade_types')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 })
      if (!trade) return NextResponse.json({ error: 'Unknown trade code' }, { status: 400 })

      const { error: delErr } = await supabase
        .from('employer_capabilities')
        .delete()
        .eq('employer_id', employerId)
        .eq('capability_type', 'trade')
        .eq('trade_type_id', trade.id)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}



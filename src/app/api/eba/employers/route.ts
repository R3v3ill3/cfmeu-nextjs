import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function parseBool(value: string | null, fallback: boolean): boolean {
  if (value === null) return fallback
  const v = value.toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  return fallback
}

function mapCategoryType(t: string | null): 'contractor_role' | 'trade' | null {
  if (!t) return null
  if (t === 'role' || t === 'contractor_role') return 'contractor_role'
  if (t === 'trade') return 'trade'
  return null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const typeParam = mapCategoryType(searchParams.get('type'))
    const code = searchParams.get('code') || undefined
    const currentOnly = parseBool(searchParams.get('currentOnly'), true)
    const includeDerived = parseBool(searchParams.get('includeDerived'), true)
    const includeManual = parseBool(searchParams.get('includeManual'), true)
    const keyOnly = parseBool(searchParams.get('keyOnly'), false)
    const includeExtendedData = parseBool(searchParams.get('includeExtendedData'), false)

    if (keyOnly && typeParam && typeParam !== 'trade') {
      return NextResponse.json({ error: 'keyOnly is only supported when type=trade' }, { status: 400 })
    }

    if (!includeDerived && !includeManual) {
      return NextResponse.json({ data: [] })
    }

    const supabase = await createServerSupabase()
    let query = supabase
      .from('v_eba_active_employer_categories')
      .select('employer_id, employer_name, category_type, category_code, project_id, is_current, source')

    if (typeParam) {
      query = query.eq('category_type', typeParam)
    }

    if (code) {
      query = query.eq('category_code', code)
    }

    if (currentOnly) {
      query = query.eq('is_current', true)
    }

    if (includeDerived && !includeManual) {
      query = query.neq('source', 'manual_capability')
    } else if (!includeDerived && includeManual) {
      query = query.eq('source', 'manual_capability')
    }

    if (keyOnly) {
      // Fetch key trades from database (dynamic system)
      const { data: keyTradesData } = await (supabase as any)
        .from('key_contractor_trades')
        .select('trade_type')
        .eq('is_active', true)
      
      const keyTradesList = (keyTradesData || []).map((t: any) => t.trade_type)
      query = query.eq('category_type', 'trade').in('category_code', keyTradesList)
    }

    const { data: rows, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const employersMap = new Map<string, { employer_id: string; employer_name: string; project_ids: Set<string> }>()
    const projectIds: Set<string> = new Set()

    ;(rows || []).forEach((r: any) => {
      const id = r.employer_id as string
      if (!employersMap.has(id)) {
        employersMap.set(id, { employer_id: id, employer_name: r.employer_name as string, project_ids: new Set<string>() })
      }
      if (r.project_id) projectIds.add(r.project_id as string)
      if (r.project_id) employersMap.get(id)!.project_ids.add(r.project_id as string)
    })

    let projectsById: Record<string, any> = {}
    if (projectIds.size > 0) {
      if (includeExtendedData) {
        // Fetch extended project data including tier, address, and builder
        const { data: projects, error: pErr } = await supabase
          .from('projects')
          .select('id, name, tier, full_address')
          .in('id', Array.from(projectIds))
        
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
        
        // Get builder/head contractor role type IDs
        const { data: roleTypes, error: rtErr } = await supabase
          .from('contractor_role_types')
          .select('id, code')
          .in('code', ['builder', 'head_contractor'])
        
        if (rtErr) {
          console.error('Error fetching role types:', rtErr)
          return NextResponse.json({ error: `Failed to fetch role types: ${rtErr.message}` }, { status: 500 })
        }
        
        const builderRoleIds = (roleTypes || []).map((rt: any) => rt.id)
        
        // Get builder information for each project (only if we have role IDs)
        let builderAssignments: any[] = []
        if (builderRoleIds.length > 0) {
          const { data, error: bErr } = await supabase
            .from('project_assignments')
            .select('project_id, employer_id, contractor_role_type_id, employers(name)')
            .in('project_id', Array.from(projectIds))
            .eq('assignment_type', 'contractor_role')
            .eq('is_primary_for_role', true)
            .in('contractor_role_type_id', builderRoleIds)
          
          if (bErr) {
            console.error('Error fetching builder assignments:', bErr)
            return NextResponse.json({ error: `Failed to fetch builder assignments: ${bErr.message}` }, { status: 500 })
          }
          
          builderAssignments = data || []
        }
        
        // Map builders to projects
        const buildersByProject: Record<string, string> = {}
        ;(builderAssignments || []).forEach((ba: any) => {
          if (ba.project_id && ba.employers?.name && !buildersByProject[ba.project_id]) {
            buildersByProject[ba.project_id] = ba.employers.name
          }
        })
        
        projectsById = Object.fromEntries((projects || []).map((p: any) => [
          p.id as string, 
          { 
            id: p.id as string, 
            name: p.name as string,
            tier: p.tier as string | null,
            full_address: p.full_address as string | null,
            builder_name: buildersByProject[p.id] || null
          }
        ]))
      } else {
        // Basic project data (name only)
        const { data: projects, error: pErr } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', Array.from(projectIds))
        if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })
        projectsById = Object.fromEntries((projects || []).map((p: any) => [p.id as string, { id: p.id as string, name: p.name as string }]))
      }
    }

    const result = Array.from(employersMap.values()).map((e) => ({
      employer_id: e.employer_id,
      employer_name: e.employer_name,
      projects: Array.from(e.project_ids).map((pid) => projectsById[pid]).filter(Boolean),
    }))

    return NextResponse.json({ data: result })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}



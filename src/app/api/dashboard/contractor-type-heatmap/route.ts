import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'

export const dynamic = 'force-dynamic'

export interface ContractorTypeHeatmapData {
  trade_type: string
  identified_count: number
  identified_percentage: number
  eba_count: number
  eba_percentage: number
  gap: number // identified % - EBA %
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const patchIds = searchParams.get('patchIds')?.split(',').filter(Boolean) || []
    const universe = searchParams.get('universe') || 'active'
    const stage = searchParams.get('stage') || 'construction'

    // Get active projects with filters
    let projectsQuery = supabase
      .from('projects')
      .select('id, organising_universe, stage_class')
      .eq('organising_universe', universe)
      .eq('stage_class', stage)

    // Apply patch filtering if specified
    let projectIds: string[] = []
    if (patchIds.length > 0) {
      projectIds = await getProjectIdsForPatches(supabase, patchIds)
      
      if (projectIds.length > 0) {
        projectsQuery = projectsQuery.in('id', projectIds)
      } else {
        return NextResponse.json({ data: [] }, { status: 200 })
      }
    }

    const { data: projects, error: projectsError } = await projectsQuery

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 })
    }

    projectIds = projects.map(p => p.id)

    // Get key contractor trades
    const { data: keyTradesData, error: keyTradesError } = await supabase
      .from('key_contractor_trades')
      .select('trade_type')
      .eq('is_active', true)

    if (keyTradesError) {
      console.error('Error fetching key trades:', keyTradesError)
      return NextResponse.json({ error: 'Failed to fetch key trades' }, { status: 500 })
    }

    const keyTrades = new Set<string>(
      (keyTradesData || []).map(t => t.trade_type)
    )

    if (keyTrades.size === 0) {
      return NextResponse.json({ data: [] }, { status: 200 })
    }

    // Get all trade assignments for these projects
    const { data: assignments, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select(`
        id,
        project_id,
        employer_id,
        trade_type_id,
        trade_types!inner(code),
        employers!inner(
          id,
          company_eba_records!left(fwc_certified_date)
        )
      `)
      .in('project_id', projectIds)
      .eq('assignment_type', 'trade_work')
      .not('trade_type_id', 'is', null)

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Aggregate by trade type
    const tradeStats = new Map<string, {
      identified: number
      eba: number
      total: number
    }>()

    // Calculate total slots per trade (number of projects * 1 slot per trade)
    projects.forEach(project => {
      keyTrades.forEach(trade => {
        const current = tradeStats.get(trade) || { identified: 0, eba: 0, total: 0 }
        current.total += 1
        tradeStats.set(trade, current)
      })
    })

    // Count identified and EBA contractors per trade
    assignments.forEach(assignment => {
      const tradeCode = (assignment.trade_types as any)?.code
      if (!tradeCode || !keyTrades.has(tradeCode)) return

      const stats = tradeStats.get(tradeCode)
      if (!stats) return

      stats.identified += 1

      // Check if employer has EBA
      const employer = (assignment.employers as any)
      const ebaRecords = employer?.company_eba_records || []
      const hasEba = Array.isArray(ebaRecords) 
        ? ebaRecords.some((eba: any) => eba.fwc_certified_date)
        : false

      if (hasEba) {
        stats.eba += 1
      }
    })

    // Convert to response format
    const heatmapData: ContractorTypeHeatmapData[] = Array.from(tradeStats.entries())
      .map(([trade_type, stats]) => {
        const identifiedPct = stats.total > 0 
          ? Math.round((stats.identified / stats.total) * 100) 
          : 0
        const ebaPct = stats.identified > 0 
          ? Math.round((stats.eba / stats.identified) * 100) 
          : 0
        const gap = identifiedPct - ebaPct

        return {
          trade_type,
          identified_count: stats.identified,
          identified_percentage: identifiedPct,
          eba_count: stats.eba,
          eba_percentage: ebaPct,
          gap,
        }
      })
      .sort((a, b) => b.gap - a.gap) // Sort by gap (descending)

    return NextResponse.json({ data: heatmapData }, { status: 200 })
  } catch (error) {
    console.error('Error in contractor-type-heatmap route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


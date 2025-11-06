import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'
import { withTimeout, isDatabaseTimeoutError } from '@/lib/query-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 20 // Vercel timeout limit

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

    const startTime = Date.now()

    // Get active projects with filters
    let projectsQuery = supabase
      .from('projects')
      .select('id, organising_universe, stage_class')
      .eq('organising_universe', universe)
      .eq('stage_class', stage)

    // Apply patch filtering if specified
    let projectIds: string[] = []
    if (patchIds.length > 0) {
      try {
        projectIds = await withTimeout(
          getProjectIdsForPatches(supabase, patchIds),
          10000,
          'Patch filtering query timeout'
        )
        
        if (projectIds.length > 0) {
          projectsQuery = projectsQuery.in('id', projectIds)
        } else {
          return NextResponse.json({ data: [] }, { status: 200 })
        }
      } catch (error) {
        console.error('Error in patch filtering:', error)
        if (isDatabaseTimeoutError(error)) {
          return NextResponse.json({ data: [] }, { status: 200 })
        }
        throw error
      }
    }

    const { data: projects, error: projectsError } = await withTimeout(
      projectsQuery,
      10000,
      'Projects query timeout'
    )

    if (projectsError) {
      console.error('Error fetching projects:', projectsError)
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
    }

    if (!projects || projects.length === 0) {
      return NextResponse.json({ data: [] }, { status: 200 })
    }

    projectIds = projects.map(p => p.id)

    // Get key contractor trades
    const { data: keyTradesData, error: keyTradesError } = await withTimeout(
      supabase
        .from('key_contractor_trades')
        .select('trade_type')
        .eq('is_active', true),
      8000,
      'Key trades query timeout'
    )

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
    // Simplified query to avoid deep nesting that causes stack depth issues
    const { data: assignments, error: assignmentsError } = await withTimeout(
      supabase
        .from('project_assignments')
        .select(`
          id,
          project_id,
          employer_id,
          trade_type_id,
          trade_types!inner(code)
        `)
        .in('project_id', projectIds)
        .eq('assignment_type', 'trade_work')
        .not('trade_type_id', 'is', null),
      10000,
      'Project assignments query timeout'
    )

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
      if (isDatabaseTimeoutError(assignmentsError)) {
        return NextResponse.json({ data: [] }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get employer IDs to fetch EBA records separately
    const employerIds = new Set<string>()
    assignments?.forEach(assignment => {
      if (assignment.employer_id) {
        employerIds.add(assignment.employer_id)
      }
    })

    // Fetch EBA records separately to avoid deep nesting
    const employerEbaMap = new Map<string, boolean>()
    if (employerIds.size > 0) {
      try {
        const employerIdArray = Array.from(employerIds)
        // Batch queries to avoid PostgREST limits
        const chunkSize = 200
        const chunks: string[][] = []
        for (let i = 0; i < employerIdArray.length; i += chunkSize) {
          chunks.push(employerIdArray.slice(i, i + chunkSize))
        }

        const ebaQueries = chunks.map(chunk =>
          withTimeout(
            supabase
              .from('company_eba_records')
              .select('employer_id, fwc_certified_date')
              .in('employer_id', chunk)
              .not('fwc_certified_date', 'is', null),
            8000,
            'EBA records query timeout'
          )
        )

        const ebaResults = await Promise.all(ebaQueries)
        ebaResults.forEach(result => {
          if (result.data) {
            result.data.forEach((eba: any) => {
              employerEbaMap.set(eba.employer_id, true)
            })
          }
        })
      } catch (error) {
        console.error('Error fetching EBA records:', error)
        // Continue without EBA data rather than failing completely
      }
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

      // Check if employer has EBA using the separately fetched EBA map
      if (assignment.employer_id && employerEbaMap.has(assignment.employer_id)) {
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
    const queryTime = Date.now() - (startTime || Date.now())
    console.error('Error in contractor-type-heatmap route:', error)
    console.error('Query execution time:', queryTime, 'ms')
    
    if (isDatabaseTimeoutError(error)) {
      console.error('Database timeout error detected')
      return NextResponse.json({ data: [] }, { status: 200 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


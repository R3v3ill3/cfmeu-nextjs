import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'
import { withTimeout, isDatabaseTimeoutError } from '@/lib/query-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 20 // Vercel timeout limit

export interface KeyContractorCategoryData {
  category_code: string
  category_name: string
  category_type: 'trade' | 'contractor_role'
  total: number
  identified: number
  eba: number
  unknown: number
  known_non_eba: number
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

    // Key contractor roles
    const KEY_CONTRACTOR_ROLES = new Set(['builder', 'head_contractor'])

    // Get trade assignments for these projects
    const { data: tradeAssignments, error: tradeAssignmentsError } = await withTimeout(
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
      'Trade assignments query timeout'
    )

    if (tradeAssignmentsError) {
      console.error('Error fetching trade assignments:', tradeAssignmentsError)
      if (isDatabaseTimeoutError(tradeAssignmentsError)) {
        return NextResponse.json({ data: [] }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch trade assignments' }, { status: 500 })
    }

    // Get contractor role assignments for these projects
    const { data: roleAssignments, error: roleAssignmentsError } = await withTimeout(
      supabase
        .from('project_assignments')
        .select(`
          id,
          project_id,
          employer_id,
          contractor_role_type_id,
          contractor_role_types!inner(code)
        `)
        .in('project_id', projectIds)
        .eq('assignment_type', 'contractor_role')
        .not('contractor_role_type_id', 'is', null),
      10000,
      'Role assignments query timeout'
    )

    if (roleAssignmentsError) {
      console.error('Error fetching role assignments:', roleAssignmentsError)
      if (isDatabaseTimeoutError(roleAssignmentsError)) {
        return NextResponse.json({ data: [] }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch role assignments' }, { status: 500 })
    }

    // Get employer IDs to fetch EBA records separately
    const employerIds = new Set<string>()
    tradeAssignments?.forEach(assignment => {
      if (assignment.employer_id) {
        employerIds.add(assignment.employer_id)
      }
    })
    roleAssignments?.forEach(assignment => {
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

    // Get trade type names for display
    const { data: tradeTypesData } = await supabase
      .from('trade_types')
      .select('code, name')
      .in('code', Array.from(keyTrades))
      .eq('is_active', true)

    const tradeTypeNames = new Map<string, string>()
    tradeTypesData?.forEach(tt => {
      tradeTypeNames.set(tt.code, tt.name)
    })

    // Get contractor role names for display
    const { data: roleTypesData } = await supabase
      .from('contractor_role_types')
      .select('code, name')
      .in('code', Array.from(KEY_CONTRACTOR_ROLES))
      .eq('is_active', true)

    const roleTypeNames = new Map<string, string>()
    roleTypesData?.forEach(rt => {
      roleTypeNames.set(rt.code, rt.name)
    })

    // Aggregate by category
    const categoryStats = new Map<string, {
      identified: Set<string> // Track unique employers per category
      eba: Set<string> // Track unique employers with EBA per category
      total: number
      category_name: string
      category_type: 'trade' | 'contractor_role'
    }>()

    // Initialize stats for all key trades
    keyTrades.forEach(trade => {
      const tradeName = tradeTypeNames.get(trade) || trade
      categoryStats.set(trade, {
        identified: new Set(),
        eba: new Set(),
        total: 0,
        category_name: tradeName,
        category_type: 'trade'
      })
    })

    // Initialize stats for all key roles
    KEY_CONTRACTOR_ROLES.forEach(role => {
      const roleName = roleTypeNames.get(role) || role
      categoryStats.set(role, {
        identified: new Set(),
        eba: new Set(),
        total: 0,
        category_name: roleName,
        category_type: 'contractor_role'
      })
    })

    // Calculate total slots per category (number of projects × 1 slot per category)
    projects.forEach(() => {
      keyTrades.forEach(trade => {
        const stats = categoryStats.get(trade)
        if (stats) {
          stats.total += 1
        }
      })
      KEY_CONTRACTOR_ROLES.forEach(role => {
        const stats = categoryStats.get(role)
        if (stats) {
          stats.total += 1
        }
      })
    })

    // Count identified contractors per trade
    tradeAssignments?.forEach(assignment => {
      const tradeCode = (assignment.trade_types as any)?.code
      if (!tradeCode || !keyTrades.has(tradeCode)) return

      const stats = categoryStats.get(tradeCode)
      if (!stats || !assignment.employer_id) return

      stats.identified.add(assignment.employer_id)

      // Check if employer has EBA
      if (employerEbaMap.has(assignment.employer_id)) {
        stats.eba.add(assignment.employer_id)
      }
    })

    // Count identified contractors per role
    roleAssignments?.forEach(assignment => {
      const roleCode = (assignment.contractor_role_types as any)?.code
      if (!roleCode || !KEY_CONTRACTOR_ROLES.has(roleCode)) return

      const stats = categoryStats.get(roleCode)
      if (!stats || !assignment.employer_id) return

      stats.identified.add(assignment.employer_id)

      // Check if employer has EBA
      if (employerEbaMap.has(assignment.employer_id)) {
        stats.eba.add(assignment.employer_id)
      }
    })

    // Convert to response format
    const categoryData: KeyContractorCategoryData[] = Array.from(categoryStats.entries())
      .map(([category_code, stats]) => {
        const identified = stats.identified.size
        const eba = stats.eba.size
        const unknown = stats.total - identified
        const known_non_eba = identified - eba

        return {
          category_code,
          category_name: stats.category_name,
          category_type: stats.category_type,
          total: stats.total,
          identified,
          eba,
          unknown,
          known_non_eba,
        }
      })
      .sort((a, b) => {
        // Sort by category type first (trades then roles), then by name
        if (a.category_type !== b.category_type) {
          return a.category_type === 'trade' ? -1 : 1
        }
        return a.category_name.localeCompare(b.category_name)
      })

    return NextResponse.json({ data: categoryData }, { status: 200 })
  } catch (error) {
    const queryTime = Date.now() - (startTime || Date.now())
    console.error('Error in key-contractor-categories route:', error)
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


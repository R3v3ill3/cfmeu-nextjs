import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'
import { withTimeout, isDatabaseTimeoutError } from '@/lib/query-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 20 // Vercel timeout limit

export interface WaffleTileData {
  total_projects: number
  fully_mapped: number // builder known + ≥80% contractor id
  eba_builder: number // projects with EBA builder
  fully_assured: number // audit threshold met + green/amber rating
  unmapped: number // projects that don't meet fully_mapped criteria
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
    const tier = searchParams.get('tier') || undefined

    // Get active projects with filters
    const startTime = Date.now()
    let projectsQuery = supabase
      .from('projects')
      .select('id, organising_universe, stage_class, tier')
      .eq('organising_universe', universe)
      .eq('stage_class', stage)

    // Apply tier filtering if specified
    if (tier && tier !== 'all') {
      projectsQuery = projectsQuery.eq('tier', tier)
    }

    // Apply patch filtering if specified
    if (patchIds.length > 0) {
      try {
        const projectIds = await withTimeout(
          getProjectIdsForPatches(supabase, patchIds),
          10000,
          'Patch filtering query timeout'
        )
        
        if (projectIds.length > 0) {
          projectsQuery = projectsQuery.in('id', projectIds)
        } else {
          return NextResponse.json({ 
            data: { 
              total_projects: 0, 
              fully_mapped: 0, 
              eba_builder: 0, 
              fully_assured: 0,
              unmapped: 0
            } 
          }, { status: 200 })
        }
      } catch (error) {
        console.error('Error in patch filtering:', error)
        if (isDatabaseTimeoutError(error)) {
          return NextResponse.json({ 
            data: { 
              total_projects: 0, 
              fully_mapped: 0, 
              eba_builder: 0, 
              fully_assured: 0,
              unmapped: 0
            } 
          }, { status: 200 })
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
      return NextResponse.json({ 
        data: { 
          total_projects: 0, 
          fully_mapped: 0, 
          eba_builder: 0, 
          fully_assured: 0,
          unmapped: 0
        } 
      }, { status: 200 })
    }

    const projectIds = projects.map(p => p.id)

    // Get key contractor trades for slot calculation
    const { data: keyTradesData } = await withTimeout(
      supabase
        .from('key_contractor_trades')
        .select('trade_type')
        .eq('is_active', true),
      8000,
      'Key trades query timeout'
    )

    const keyTradesCount = (keyTradesData || []).length
    const keyRolesCount = 2 // head_contractor, builder
    const slotsPerProject = keyTradesCount + keyRolesCount

    // Get project assignments with builder and contractor info
    // Simplified query to avoid deep nesting that causes stack depth issues
    const { data: assignments, error: assignmentsError } = await withTimeout(
      supabase
        .from('project_assignments')
        .select(`
          project_id,
          assignment_type,
          is_primary_for_role,
          employer_id,
          contractor_role_types!left(code),
          trade_type_id,
          trade_types!left(code)
        `)
        .in('project_id', projectIds),
      10000,
      'Project assignments query timeout'
    )

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
      if (isDatabaseTimeoutError(assignmentsError)) {
        // Return empty response on timeout to prevent cascading failures
        return NextResponse.json({ 
          data: { 
            total_projects: projects?.length || 0, 
            fully_mapped: 0, 
            eba_builder: 0, 
            fully_assured: 0,
            unmapped: projects?.length || 0
          } 
        }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get employer IDs from assignments to fetch EBA records separately
    const employerIds = new Set<string>()
    assignments?.forEach(assignment => {
      if (assignment.employer_id) {
        employerIds.add(assignment.employer_id)
      }
    })

    // Fetch EBA records separately to avoid deep nesting
    let employerEbaMap = new Map<string, boolean>()
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

    // Get project-level ratings for fully_assured calculation
    // Simplified query to avoid deep nesting
    let projectRatings: any[] = []
    try {
      const employerIdArray = Array.from(employerIds)
      if (employerIdArray.length > 0) {
        const chunkSize = 200
        const chunks: string[][] = []
        for (let i = 0; i < employerIdArray.length; i += chunkSize) {
          chunks.push(employerIdArray.slice(i, i + chunkSize))
        }

        const ratingQueries = chunks.map(chunk =>
          withTimeout(
            supabase
              .from('employer_final_ratings')
              .select('employer_id, final_rating')
              .in('employer_id', chunk)
              .eq('is_active', true),
            8000,
            'Ratings query timeout'
          )
        )

        const ratingResults = await Promise.all(ratingQueries)
        ratingResults.forEach(result => {
          if (result.data) {
            projectRatings.push(...result.data)
          }
        })
      }
    } catch (error) {
      console.error('Error fetching project ratings:', error)
      // Continue without ratings data
    }

    // Organize assignments by project
    const projectData = new Map<string, {
      hasBuilder: boolean
      hasEbaBuilder: boolean
      identifiedSlots: Set<string>
      totalSlots: number
      hasGreenOrAmberRating: boolean
    }>()

    projects.forEach(project => {
      projectData.set(project.id, {
        hasBuilder: false,
        hasEbaBuilder: false,
        identifiedSlots: new Set(),
        totalSlots: slotsPerProject,
        hasGreenOrAmberRating: false,
      })
    })

    // Process assignments
    assignments?.forEach(assignment => {
      const projectId = assignment.project_id
      const data = projectData.get(projectId)
      if (!data) return

      // Check for builder
      if (assignment.assignment_type === 'contractor_role' && 
          assignment.is_primary_for_role &&
          (assignment.contractor_role_types as any)?.code === 'builder') {
        data.hasBuilder = true
        
        // Check if builder has EBA using the separately fetched EBA map
        if (assignment.employer_id && employerEbaMap.has(assignment.employer_id)) {
          data.hasEbaBuilder = true
        }
      }

      // Count identified contractor slots
      if (assignment.assignment_type === 'contractor_role' && 
          (assignment.contractor_role_types as any)?.code) {
        const roleCode = (assignment.contractor_role_types as any).code
        if (['head_contractor', 'builder'].includes(roleCode)) {
          data.identifiedSlots.add(`role:${roleCode}`)
        }
      }

      if (assignment.assignment_type === 'trade_work' && 
          (assignment.trade_types as any)?.code) {
        const tradeCode = (assignment.trade_types as any).code
        data.identifiedSlots.add(`trade:${tradeCode}`)
      }
    })

    // Process ratings for fully_assured
    // Map employer ratings to projects via assignments
    const employerRatingMap = new Map<string, string>()
    projectRatings.forEach((rating: any) => {
      employerRatingMap.set(rating.employer_id, rating.final_rating)
    })

    // Map ratings to projects
    assignments?.forEach(assignment => {
      if (assignment.project_id && assignment.employer_id) {
        const rating = employerRatingMap.get(assignment.employer_id)
        if (rating) {
          const data = projectData.get(assignment.project_id)
          if (data && (rating === 'green' || rating === 'amber')) {
            data.hasGreenOrAmberRating = true
          }
        }
      }
    })

    // Calculate metrics
    let fullyMapped = 0
    let ebaBuilder = 0
    let fullyAssured = 0

    projectData.forEach((data) => {
      const contractorIdPercentage = data.totalSlots > 0
        ? (data.identifiedSlots.size / data.totalSlots) * 100
        : 0

      // Fully mapped: builder known + ≥80% contractor identification
      if (data.hasBuilder && contractorIdPercentage >= 80) {
        fullyMapped++
      }

      // EBA builder
      if (data.hasEbaBuilder) {
        ebaBuilder++
      }

      // Fully assured: audit threshold met (has ratings) + green/amber
      if (data.hasGreenOrAmberRating) {
        fullyAssured++
      }
    })

    const totalProjects = projects.length
    const unmapped = totalProjects - fullyMapped

    return NextResponse.json({
      data: {
        total_projects: totalProjects,
        fully_mapped: fullyMapped,
        eba_builder: ebaBuilder,
        fully_assured: fullyAssured,
        unmapped,
      }
    }, { status: 200 })
  } catch (error) {
    const queryTime = Date.now() - (startTime || Date.now())
    console.error('Error in waffle-tiles route:', error)
    console.error('Query execution time:', queryTime, 'ms')
    
    if (isDatabaseTimeoutError(error)) {
      console.error('Database timeout error detected')
      // Return empty response on timeout to prevent cascading failures
      return NextResponse.json({ 
        data: { 
          total_projects: 0, 
          fully_mapped: 0, 
          eba_builder: 0, 
          fully_assured: 0,
          unmapped: 0
        } 
      }, { status: 200 })
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


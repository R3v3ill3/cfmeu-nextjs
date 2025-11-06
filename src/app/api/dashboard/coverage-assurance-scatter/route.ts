import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'
import { withTimeout, isDatabaseTimeoutError } from '@/lib/query-timeout'

export const dynamic = 'force-dynamic'
export const maxDuration = 20 // Vercel timeout limit

export interface ScatterPoint {
  project_id: string
  project_name: string
  coverage_percentage: number // identified slots / total slots
  audit_completion_percentage: number // employers audited / employers on project
  rating: 'red' | 'amber' | 'yellow' | 'green' | 'unknown'
  project_scale: number // contractor slots or headcount
  has_eba_builder: boolean
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
    const ebaFilter = searchParams.get('ebaFilter') // 'eba' | 'non_eba' | null

    const startTime = Date.now()

    // Get active projects with filters
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, organising_universe, stage_class')
      .eq('organising_universe', universe)
      .eq('stage_class', stage)

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

    // Get project assignments
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
        return NextResponse.json({ data: [] }, { status: 200 })
      }
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get employer IDs from assignments
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
        // Continue without EBA data
      }
    }

    // Get project-level ratings
    let projectRatings: any[] = []
    if (employerIds.size > 0) {
      try {
        const employerIdArray = Array.from(employerIds)
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
      } catch (error) {
        console.error('Error fetching project ratings:', error)
        // Continue without ratings data
      }
    }

    // Get employers per project (already have this from assignments, but keep for compatibility)
    const projectEmployers = assignments?.map(a => ({
      project_id: a.project_id,
      employer_id: a.employer_id
    })).filter(a => a.employer_id) || []

    // Organize data by project
    const projectData = new Map<string, {
      name: string
      identifiedSlots: Set<string>
      totalSlots: number
      employers: Set<string>
      ratedEmployers: Set<string>
      ratings: Set<string>
      hasEbaBuilder: boolean
    }>()

    projects.forEach(project => {
      projectData.set(project.id, {
        name: project.name,
        identifiedSlots: new Set(),
        totalSlots: slotsPerProject,
        employers: new Set(),
        ratedEmployers: new Set(),
        ratings: new Set(),
        hasEbaBuilder: false,
      })
    })

    // Process assignments
    assignments?.forEach(assignment => {
      const projectId = assignment.project_id
      const data = projectData.get(projectId)
      if (!data) return

      // Track employers
      if (assignment.employer_id) {
        data.employers.add(assignment.employer_id)
      }

      // Check for EBA builder
      if (assignment.assignment_type === 'contractor_role' && 
          assignment.is_primary_for_role &&
          (assignment.contractor_role_types as any)?.code === 'builder') {
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

    // Process project employers
    projectEmployers?.forEach((pe: any) => {
      const data = projectData.get(pe.project_id)
      if (data && pe.employer_id) {
        data.employers.add(pe.employer_id)
      }
    })

    // Process ratings
    const ratingMap = new Map<string, string>()
    projectRatings?.forEach((rating: any) => {
      ratingMap.set(rating.employer_id, rating.final_rating)
    })

    // Assign ratings to projects
    projectData.forEach((data, projectId) => {
      data.employers.forEach(employerId => {
        const rating = ratingMap.get(employerId)
        if (rating) {
          data.ratedEmployers.add(employerId)
          data.ratings.add(rating)
        }
      })
    })

    // Convert to scatter points
    const scatterPoints: ScatterPoint[] = []

    projectData.forEach((data, projectId) => {
      // Apply EBA filter
      if (ebaFilter === 'eba' && !data.hasEbaBuilder) return
      if (ebaFilter === 'non_eba' && data.hasEbaBuilder) return

      const coveragePct = data.totalSlots > 0
        ? Math.round((data.identifiedSlots.size / data.totalSlots) * 100)
        : 0

      const auditCompletionPct = data.employers.size > 0
        ? Math.round((data.ratedEmployers.size / data.employers.size) * 100)
        : 0

      // Determine project rating (most common rating, or unknown)
      const ratingCounts = new Map<string, number>()
      data.ratings.forEach(rating => {
        ratingCounts.set(rating, (ratingCounts.get(rating) || 0) + 1)
      })

      let projectRating: 'red' | 'amber' | 'yellow' | 'green' | 'unknown' = 'unknown'
      let maxCount = 0
      ratingCounts.forEach((count, rating) => {
        if (count > maxCount) {
          maxCount = count
          projectRating = rating as 'red' | 'amber' | 'yellow' | 'green'
        }
      })

      scatterPoints.push({
        project_id: projectId,
        project_name: data.name,
        coverage_percentage: coveragePct,
        audit_completion_percentage: auditCompletionPct,
        rating: projectRating,
        project_scale: data.totalSlots, // Use total slots as scale
        has_eba_builder: data.hasEbaBuilder,
      })
    })

    return NextResponse.json({ data: scatterPoints }, { status: 200 })
  } catch (error) {
    const queryTime = Date.now() - (startTime || Date.now())
    console.error('Error in coverage-assurance-scatter route:', error)
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


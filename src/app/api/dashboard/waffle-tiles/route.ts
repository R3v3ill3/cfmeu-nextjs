import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'

export const dynamic = 'force-dynamic'

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
      const projectIds = await getProjectIdsForPatches(supabase, patchIds)
      
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
    }

    const { data: projects, error: projectsError } = await projectsQuery

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
    const { data: keyTradesData } = await supabase
      .from('key_contractor_trades')
      .select('trade_type')
      .eq('is_active', true)

    const keyTradesCount = (keyTradesData || []).length
    const keyRolesCount = 2 // head_contractor, builder
    const slotsPerProject = keyTradesCount + keyRolesCount

    // Get project assignments with builder and contractor info
    const { data: assignments, error: assignmentsError } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        assignment_type,
        is_primary_for_role,
        employer_id,
        contractor_role_types!left(code),
        trade_type_id,
        trade_types!left(code),
        employers!left(
          id,
          name,
          company_eba_records!left(fwc_certified_date)
        )
      `)
      .in('project_id', projectIds)

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError)
      return NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 })
    }

    // Get project-level ratings for fully_assured calculation
    const { data: projectRatings } = await supabase
      .from('project_assignments')
      .select(`
        project_id,
        employers!inner(
          id,
          employer_final_ratings!inner(
            final_rating,
            is_active
          )
        )
      `)
      .in('project_id', projectIds)
      .eq('employers.employer_final_ratings.is_active', true)

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
        
        // Check if builder has EBA
        const employer = (assignment.employers as any)
        const ebaRecords = employer?.company_eba_records || []
        const hasEba = Array.isArray(ebaRecords) 
          ? ebaRecords.some((eba: any) => eba.fwc_certified_date)
          : false
        
        if (hasEba) {
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
    const projectRatingsMap = new Map<string, Set<string>>()
    projectRatings?.forEach((pr: any) => {
      const projectId = pr.project_id
      const employer = Array.isArray(pr.employers) ? pr.employers[0] : pr.employers
      const ratings = employer?.employer_final_ratings || []
      
      if (Array.isArray(ratings)) {
        ratings.forEach((rating: any) => {
          if (!projectRatingsMap.has(projectId)) {
            projectRatingsMap.set(projectId, new Set())
          }
          projectRatingsMap.get(projectId)!.add(rating.final_rating)
        })
      }
    })

    projectRatingsMap.forEach((ratings, projectId) => {
      const data = projectData.get(projectId)
      if (data) {
        // Has green or amber rating if any rating is green or amber
        data.hasGreenOrAmberRating = ratings.has('green') || ratings.has('amber')
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
    console.error('Error in waffle-tiles route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


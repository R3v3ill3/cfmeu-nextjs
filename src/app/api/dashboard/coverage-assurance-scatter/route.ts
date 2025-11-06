import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { getProjectIdsForPatches } from '@/lib/patch-filtering'

export const dynamic = 'force-dynamic'

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

    // Get active projects with filters
    let projectsQuery = supabase
      .from('projects')
      .select('id, name, organising_universe, stage_class')
      .eq('organising_universe', universe)
      .eq('stage_class', stage)

    // Apply patch filtering if specified
    if (patchIds.length > 0) {
      const projectIds = await getProjectIdsForPatches(supabase, patchIds)
      
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

    const projectIds = projects.map(p => p.id)

    // Get key contractor trades for slot calculation
    const { data: keyTradesData } = await supabase
      .from('key_contractor_trades')
      .select('trade_type')
      .eq('is_active', true)

    const keyTradesCount = (keyTradesData || []).length
    const keyRolesCount = 2 // head_contractor, builder
    const slotsPerProject = keyTradesCount + keyRolesCount

    // Get project assignments
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

    // Get project-level ratings
    const { data: projectRatings } = await supabase
      .from('employer_final_ratings')
      .select(`
        employer_id,
        final_rating,
        is_active
      `)
      .eq('is_active', true)

    // Get employers per project
    const { data: projectEmployers } = await supabase
      .from('project_assignments')
      .select('project_id, employer_id')
      .in('project_id', projectIds)
      .not('employer_id', 'is', null)

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
    console.error('Error in coverage-assurance-scatter route:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}


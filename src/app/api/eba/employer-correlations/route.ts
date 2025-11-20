import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type CorrelationType = 'working_together' | 'builder_networks' | 'compliance_patterns'

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
    const type = searchParams.get('type') as CorrelationType || 'working_together'
    const categoryType = mapCategoryType(searchParams.get('categoryType'))
    const categoryCode = searchParams.get('categoryCode') || undefined
    const currentOnly = parseBool(searchParams.get('currentOnly'), true)
    const includeDerived = parseBool(searchParams.get('includeDerived'), true)
    const includeManual = parseBool(searchParams.get('includeManual'), true)

    if (!categoryType || !categoryCode) {
      return NextResponse.json({ error: 'categoryType and categoryCode are required' }, { status: 400 })
    }

    const supabase = await createServerSupabase()

    // First, get the list of EBA employers for this category
    let query = supabase
      .from('v_eba_active_employer_categories')
      .select('employer_id, employer_name')
      .eq('category_type', categoryType)
      .eq('category_code', categoryCode)

    if (currentOnly) {
      query = query.eq('is_current', true)
    }

    if (includeDerived && !includeManual) {
      query = query.neq('source', 'manual_capability')
    } else if (!includeDerived && includeManual) {
      query = query.eq('source', 'manual_capability')
    }

    const { data: categoryEmployers, error: catError } = await query
    if (catError) return NextResponse.json({ error: catError.message }, { status: 500 })

    if (!categoryEmployers || categoryEmployers.length === 0) {
      return NextResponse.json({ data: [] })
    }

    const employerIds = [...new Set(categoryEmployers.map((e: any) => e.employer_id))]
    const employerNamesMap: Record<string, string> = {}
    categoryEmployers.forEach((e: any) => {
      employerNamesMap[e.employer_id] = e.employer_name
    })

    let result: any = {}

    switch (type) {
      case 'working_together':
        result = await getWorkingTogetherAnalysis(supabase, employerIds, employerNamesMap)
        break
      case 'builder_networks':
        result = await getBuilderNetworksAnalysis(supabase, employerIds, employerNamesMap)
        break
      case 'compliance_patterns':
        result = await getCompliancePatternsAnalysis(supabase, employerIds, employerNamesMap)
        break
      default:
        return NextResponse.json({ error: 'Invalid correlation type' }, { status: 400 })
    }

    return NextResponse.json({ data: result })
  } catch (err: any) {
    console.error('Error in employer correlations:', err)
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 })
  }
}

async function getWorkingTogetherAnalysis(
  supabase: any,
  employerIds: string[],
  employerNamesMap: Record<string, string>
) {
  // Find employer pairs that work on the same projects
  const { data: assignments, error } = await supabase
    .from('project_assignments')
    .select('employer_id, project_id, projects!inner(id, name)')
    .in('employer_id', employerIds)

  if (error) throw new Error(error.message)

  // Group by project to find pairs
  const projectToEmployers: Record<string, Array<{ id: string; name: string }>> = {}
  ;(assignments || []).forEach((a: any) => {
    if (!projectToEmployers[a.project_id]) {
      projectToEmployers[a.project_id] = []
    }
    projectToEmployers[a.project_id].push({
      id: a.employer_id,
      name: employerNamesMap[a.employer_id] || 'Unknown'
    })
  })

  // Count shared projects between employer pairs
  const pairCounts: Record<string, { 
    employer1: { id: string; name: string }
    employer2: { id: string; name: string }
    shared_projects: Array<{ id: string; name: string }>
    count: number
  }> = {}

  Object.entries(projectToEmployers).forEach(([projectId, employers]) => {
    const projectInfo = (assignments || []).find((a: any) => a.project_id === projectId)?.projects
    
    for (let i = 0; i < employers.length; i++) {
      for (let j = i + 1; j < employers.length; j++) {
        const emp1 = employers[i]
        const emp2 = employers[j]
        const pairKey = [emp1.id, emp2.id].sort().join('|')
        
        if (!pairCounts[pairKey]) {
          pairCounts[pairKey] = {
            employer1: emp1,
            employer2: emp2,
            shared_projects: [],
            count: 0
          }
        }
        
        pairCounts[pairKey].shared_projects.push({
          id: projectId,
          name: projectInfo?.name || 'Unknown Project'
        })
        pairCounts[pairKey].count++
      }
    }
  })

  // Filter to pairs with at least 2 shared projects and sort by count
  return Object.values(pairCounts)
    .filter(p => p.count >= 2)
    .sort((a, b) => b.count - a.count)
}

async function getBuilderNetworksAnalysis(
  supabase: any,
  employerIds: string[],
  employerNamesMap: Record<string, string>
) {
  // Get builder/head contractor assignments
  const { data: builderAssignments, error: bError } = await supabase
    .from('project_assignments')
    .select(`
      project_id,
      employer_id,
      employers!inner(id, name),
      contractor_role_types!inner(code)
    `)
    .eq('assignment_type', 'contractor_role')
    .in('contractor_role_types.code', ['builder', 'head_contractor'])

  if (bError) throw new Error(bError.message)

  // Get all assignments for our EBA employers
  const { data: subAssignments, error: sError } = await supabase
    .from('project_assignments')
    .select('employer_id, project_id')
    .in('employer_id', employerIds)

  if (sError) throw new Error(sError.message)

  // Map projects to builders
  const projectToBuilder: Record<string, { id: string; name: string }> = {}
  ;(builderAssignments || []).forEach((ba: any) => {
    if (ba.project_id && ba.employers) {
      projectToBuilder[ba.project_id] = {
        id: ba.employers.id,
        name: ba.employers.name
      }
    }
  })

  // Map builders to employers who work with them
  const builderToEmployers: Record<string, {
    builder: { id: string; name: string }
    employers: Array<{ id: string; name: string }>
    project_count: number
  }> = {}

  ;(subAssignments || []).forEach((sa: any) => {
    const builder = projectToBuilder[sa.project_id]
    if (builder && employerIds.includes(sa.employer_id)) {
      if (!builderToEmployers[builder.id]) {
        builderToEmployers[builder.id] = {
          builder,
          employers: [],
          project_count: 0
        }
      }
      
      // Check if employer already in list
      const existingEmployer = builderToEmployers[builder.id].employers.find(e => e.id === sa.employer_id)
      if (!existingEmployer) {
        builderToEmployers[builder.id].employers.push({
          id: sa.employer_id,
          name: employerNamesMap[sa.employer_id] || 'Unknown'
        })
      }
      builderToEmployers[builder.id].project_count++
    }
  })

  // Filter and sort by employer count
  return Object.values(builderToEmployers)
    .filter(b => b.employers.length >= 2)
    .sort((a, b) => b.employers.length - a.employers.length)
}

async function getCompliancePatternsAnalysis(
  supabase: any,
  employerIds: string[],
  employerNamesMap: Record<string, string>
) {
  // Get current active ratings for all employers
  const { data: ratings, error } = await supabase
    .from('employer_final_ratings')
    .select('employer_id, final_rating, overall_confidence, rating_date')
    .in('employer_id', employerIds)
    .eq('is_active', true)

  if (error) throw new Error(error.message)

  // Group employers by rating and confidence combination
  const patterns: Record<string, {
    rating: string
    confidence: string
    employers: Array<{ id: string; name: string; rating_date: string }>
    count: number
  }> = {}

  ;(ratings || []).forEach((r: any) => {
    const key = `${r.final_rating}|${r.overall_confidence || 'unknown'}`
    
    if (!patterns[key]) {
      patterns[key] = {
        rating: r.final_rating,
        confidence: r.overall_confidence || 'unknown',
        employers: [],
        count: 0
      }
    }
    
    patterns[key].employers.push({
      id: r.employer_id,
      name: employerNamesMap[r.employer_id] || 'Unknown',
      rating_date: r.rating_date
    })
    patterns[key].count++
  })

  // Add employers without ratings
  const ratedEmployerIds = new Set((ratings || []).map((r: any) => r.employer_id))
  const unratedEmployers = employerIds.filter(id => !ratedEmployerIds.has(id))
  
  if (unratedEmployers.length > 0) {
    patterns['no_rating|unknown'] = {
      rating: 'no_rating',
      confidence: 'unknown',
      employers: unratedEmployers.map(id => ({
        id,
        name: employerNamesMap[id] || 'Unknown',
        rating_date: ''
      })),
      count: unratedEmployers.length
    }
  }

  // Sort by count descending
  return Object.values(patterns).sort((a, b) => b.count - a.count)
}








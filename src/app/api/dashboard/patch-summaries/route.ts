import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from '@/utils/organiserDisplay'

export const dynamic = 'force-dynamic'

export interface PatchSummariesRequest {
  userId: string
  userRole: 'organiser' | 'lead_organiser' | 'admin'
  leadOrganizerId?: string // For lead organizer specific queries
  filters?: {
    tier?: string
    stage?: string
    universe?: string
    eba?: string
  }
}

export interface PatchSummaryData {
  patchId: string
  patchName: string
  organiserNames: string[]
  projectCount: number
  ebaProjectsCount: number
  ebaProjectsPercentage: number
  knownBuilderCount: number
  knownBuilderPercentage: number
  keyContractorCoverage: number
  keyContractorEbaPercentage: number
  lastUpdated: string
}

export interface PatchSummariesResponse {
  summaries: PatchSummaryData[]
  aggregatedMetrics?: {
    totalProjects: number
    totalPatches: number
    overallEbaPercentage: number
    overallBuilderKnownPercentage: number
  }
  debug: {
    queryTime: number
    userRole: string
    patchCount: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const supabase = await createServerSupabase()
    
    // Parse request parameters
    const userId = searchParams.get('userId')
    const userRole = searchParams.get('userRole') as 'organiser' | 'lead_organiser' | 'admin'
    const leadOrganizerId = searchParams.get('leadOrganizerId') || undefined
    
    const filters = {
      tier: searchParams.get('tier') || undefined,
      stage: searchParams.get('stage') || undefined,
      universe: searchParams.get('universe') || undefined,
      eba: searchParams.get('eba') || undefined
    }
    
    if (!userId || !userRole) {
      return NextResponse.json(
        { error: 'Missing required parameters: userId and userRole' },
        { status: 400 }
      )
    }
    
    // Use optimized RPC function for patch summaries
    const { data: summariesData, error } = await supabase.rpc('get_patch_summaries_for_user', {
      p_user_id: userId,
      p_user_role: userRole,
      p_lead_organiser_id: leadOrganizerId || null,
      p_filters: Object.keys(filters).some(key => filters[key as keyof typeof filters]) 
        ? filters 
        : null
    })
    
    if (error) {
      console.error('Patch summaries API error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch patch summaries' },
        { status: 500 }
      )
    }
    
    // Transform data to match client interface
    let summaries: PatchSummaryData[] = (summariesData || []).map((row: any) => ({
      patchId: row.patch_id,
      patchName: row.patch_name,
      organiserNames: row.organiser_names || [],
      projectCount: row.project_count || 0,
      ebaProjectsCount: row.eba_projects_count || 0,
      ebaProjectsPercentage: row.eba_projects_percentage || 0,
      knownBuilderCount: row.known_builder_count || 0,
      knownBuilderPercentage: row.known_builder_percentage || 0,
      keyContractorCoverage: row.key_contractor_coverage || 0,
      keyContractorEbaPercentage: row.key_contractor_eba_percentage || 0,
      lastUpdated: row.last_updated || new Date().toISOString()
    }))

    if (summaries.length > 0) {
      const patchIdSet = new Set(summaries.map((summary) => summary.patchId))
      const { data: pendingRows, error: pendingError } = await supabase
        .from('pending_users')
        .select('full_name, email, role, status, assigned_patch_ids')
        .in('status', Array.from(PENDING_USER_DASHBOARD_STATUSES))

      if (pendingError) {
        console.error('Failed to load pending organisers for summaries:', pendingError)
      } else if (pendingRows && pendingRows.length > 0) {
        const pendingByPatch = new Map<string, any[]>()
        pendingRows.forEach((row: any) => {
          const assigned: any[] = Array.isArray(row.assigned_patch_ids) ? row.assigned_patch_ids : []
          assigned.forEach((pidRaw) => {
            const pid = String(pidRaw)
            if (!patchIdSet.has(pid)) return
            if (!pendingByPatch.has(pid)) pendingByPatch.set(pid, [])
            pendingByPatch.get(pid)!.push(row)
          })
        })

        summaries = summaries.map((summary) => {
          const pendingForPatch = pendingByPatch.get(summary.patchId) || []
          return {
            ...summary,
            organiserNames: mergeOrganiserNameLists(summary.organiserNames, pendingForPatch)
          }
        })
      }
    }
    
    // Calculate aggregated metrics
    let aggregatedMetrics = undefined
    if (summaries.length > 0) {
      const totalProjects = summaries.reduce((sum, s) => sum + s.projectCount, 0)
      const totalEbaProjects = summaries.reduce((sum, s) => sum + s.ebaProjectsCount, 0)
      const totalKnownBuilder = summaries.reduce((sum, s) => sum + s.knownBuilderCount, 0)
      
      aggregatedMetrics = {
        totalProjects,
        totalPatches: summaries.length,
        overallEbaPercentage: totalProjects > 0 ? Math.round((totalEbaProjects / totalProjects) * 100) : 0,
        overallBuilderKnownPercentage: totalProjects > 0 ? Math.round((totalKnownBuilder / totalProjects) * 100) : 0
      }
    }
    
    const queryTime = Date.now() - startTime
    
    const response: PatchSummariesResponse = {
      summaries,
      aggregatedMetrics,
      debug: {
        queryTime,
        userRole,
        patchCount: summaries.length
      }
    }
    
    // Cache for 90 seconds, stale for 5 minutes  
    const headers = {
      'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=300',
      'Content-Type': 'application/json'
    }
    
    return NextResponse.json(response, { headers })
    
  } catch (error) {
    console.error('Patch summaries API unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase()
    
    // Quick health check - test with admin role and no filters
    const { error } = await supabase.rpc('get_patch_summaries_for_user', {
      p_user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      p_user_role: 'admin',
      p_lead_organiser_id: null,
      p_filters: null
    })
    
    // Error is expected due to dummy UUID, but function should exist
    const isHealthy = !error || error.message.includes('foreign key') || error.message.includes('not found')
    
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Service': 'patch-summaries',
        'X-Last-Updated': new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Patch summaries health check failed:', error)
    return new NextResponse(null, { status: 503 })
  }
}

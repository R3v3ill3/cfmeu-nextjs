import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { mergeOrganiserNameLists, PENDING_USER_DASHBOARD_STATUSES } from '@/utils/organiserDisplay'

const ALLOWED_ROLES = ['organiser', 'lead_organiser', 'admin'] as const
type AllowedRole = typeof ALLOWED_ROLES[number]
const ALLOWED_PROFILE_ROLES = new Set<AllowedRole>(ALLOWED_ROLES)

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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) {
      console.error('Failed to load authenticated profile for patch summaries:', profileError)
      return NextResponse.json({ error: 'Unable to load user profile' }, { status: 500 })
    }

    const sessionRole = (profile?.role ?? undefined) as PatchSummariesRequest['userRole'] | undefined

    if (!sessionRole || !ALLOWED_PROFILE_ROLES.has(sessionRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request parameters
    const requestedUserId = searchParams.get('userId')
    const leadOrganizerIdParam = searchParams.get('leadOrganizerId') || undefined
    
    const filters = {
      tier: searchParams.get('tier') || undefined,
      stage: searchParams.get('stage') || undefined,
      universe: searchParams.get('universe') || undefined,
      eba: searchParams.get('eba') || undefined
    }
    
    let effectiveUserId = user.id
    let effectiveRole: PatchSummariesRequest['userRole'] = sessionRole
    let leadOrganizerId = leadOrganizerIdParam

    if (sessionRole === 'admin') {
      effectiveUserId = requestedUserId || user.id

      if (effectiveUserId !== user.id) {
        const { data: targetProfile, error: targetProfileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', effectiveUserId)
          .maybeSingle()

        if (targetProfileError) {
          console.error('Failed to resolve target profile for admin patch summaries:', targetProfileError)
          return NextResponse.json({ error: 'Unable to resolve target user profile' }, { status: 400 })
        }

        const targetProfileRole = targetProfile?.role as AllowedRole | undefined

        if (targetProfileRole && ALLOWED_PROFILE_ROLES.has(targetProfileRole)) {
          effectiveRole = targetProfileRole
        } else {
          const requestedRoleParam = searchParams.get('userRole') as PatchSummariesRequest['userRole'] | null
          const requestedRole = requestedRoleParam as AllowedRole | null
          if (requestedRole && ALLOWED_PROFILE_ROLES.has(requestedRole)) {
            effectiveRole = requestedRole
          }
        }
      }
    } else {
      if (requestedUserId && requestedUserId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      effectiveUserId = user.id
      effectiveRole = sessionRole

      if (leadOrganizerId && leadOrganizerId !== user.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }

      if (sessionRole === 'lead_organiser') {
        leadOrganizerId = user.id
      }
      // For admin and organiser roles, keep the provided leadOrganizerId
    }

    if (!effectiveUserId || !effectiveRole) {
      return NextResponse.json({ error: 'Unable to derive execution context' }, { status: 400 })
    }
    
    // Use optimized RPC function for patch summaries
    const { data: summariesData, error } = await supabase.rpc('get_patch_summaries_for_user', {
      p_user_id: effectiveUserId,
      p_user_role: effectiveRole,
      p_lead_organiser_id: leadOrganizerId || null,
      p_filters: Object.keys(filters).some(key => filters[key as keyof typeof filters]) 
        ? filters 
        : null
    })

    if (error) {
      console.error('Patch summaries API error:', error)
      const message = error.message || error.toString()
      if (error.code === '42501') {
        return NextResponse.json({ error: message }, { status: 403 })
      }
      if (error.code === '22023') {
        return NextResponse.json({ error: message }, { status: 400 })
      }
      return NextResponse.json(
        { error: 'Failed to fetch patch summaries', details: message },
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
        userRole: effectiveRole,
        patchCount: summaries.length
      }
    }
    
    // Temporarily disable caching to verify coordinator scorecard fix (can re-enable later)
    const headers = {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
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
  return new NextResponse(null, {
    status: 200,
    headers: {
      'X-Service': 'patch-summaries',
      'X-Last-Updated': new Date().toISOString(),
    },
  })
}

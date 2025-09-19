import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface OrganizingMetricsRequest {
  patchIds?: string[]
  tier?: string
  stage?: string
  universe?: string
  eba?: string
  userId?: string
  userRole?: string
}

export interface OrganizingMetricsResponse {
  metrics: {
    ebaProjectsPercentage: number
    ebaProjectsCount: number
    totalActiveProjects: number
    knownBuilderPercentage: number
    knownBuilderCount: number
    keyContractorCoveragePercentage: number
    mappedKeyContractors: number
    totalKeyContractorSlots: number
    keyContractorEbaBuilderPercentage: number
    keyContractorsOnEbaBuilderProjects: number
    totalKeyContractorsOnEbaBuilderProjects: number
    keyContractorEbaPercentage: number
    keyContractorsWithEba: number
    totalMappedKeyContractors: number
  }
  debug: {
    queryTime: number
    appliedFilters: Record<string, any>
    patchCount: number
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    const searchParams = request.nextUrl.searchParams
    const supabase = await createServerSupabase()
    
    // Parse filters
    const patchIds = searchParams.get('patchIds')?.split(',').filter(Boolean) || []
    const tier = searchParams.get('tier') || undefined
    const stage = searchParams.get('stage') || undefined
    const universe = searchParams.get('universe') || 'active'
    const eba = searchParams.get('eba') || undefined
    const userId = searchParams.get('userId') || undefined
    const userRole = searchParams.get('userRole') || undefined
    
    // Use optimized RPC function for organizing universe calculations
    const { data: metricsArray, error } = await supabase.rpc('calculate_organizing_universe_metrics', {
      p_patch_ids: patchIds.length > 0 ? patchIds : null,
      p_tier: tier,
      p_stage: stage,
      p_universe: universe,
      p_eba_filter: eba,
      p_user_id: userId,
      p_user_role: userRole
    })
    
    if (error) {
      console.error('Organizing metrics API error:', error)
      return NextResponse.json(
        { error: 'Failed to calculate organizing metrics', details: error.message || error.toString() },
        { status: 500 }
      )
    }
    
    // Extract metrics from the single-row result
    const metrics = metricsArray && metricsArray[0] ? {
      ebaProjectsPercentage: metricsArray[0].eba_projects_percentage || 0,
      ebaProjectsCount: metricsArray[0].eba_projects_count || 0,
      totalActiveProjects: metricsArray[0].total_active_projects || 0,
      knownBuilderPercentage: metricsArray[0].known_builder_percentage || 0,
      knownBuilderCount: metricsArray[0].known_builder_count || 0,
      keyContractorCoveragePercentage: metricsArray[0].key_contractor_coverage_percentage || 0,
      mappedKeyContractors: metricsArray[0].mapped_key_contractors || 0,
      totalKeyContractorSlots: metricsArray[0].total_key_contractor_slots || 0,
      keyContractorEbaBuilderPercentage: metricsArray[0].key_contractor_eba_builder_percentage || 0,
      keyContractorsOnEbaBuilderProjects: metricsArray[0].key_contractors_on_eba_builder_projects || 0,
      totalKeyContractorsOnEbaBuilderProjects: metricsArray[0].total_key_contractors_on_eba_builder_projects || 0,
      keyContractorEbaPercentage: metricsArray[0].key_contractor_eba_percentage || 0,
      keyContractorsWithEba: metricsArray[0].key_contractors_with_eba || 0,
      totalMappedKeyContractors: metricsArray[0].total_mapped_key_contractors || 0
    } : {
      ebaProjectsPercentage: 0,
      ebaProjectsCount: 0,
      totalActiveProjects: 0,
      knownBuilderPercentage: 0,
      knownBuilderCount: 0,
      keyContractorCoveragePercentage: 0,
      mappedKeyContractors: 0,
      totalKeyContractorSlots: 0,
      keyContractorEbaBuilderPercentage: 0,
      keyContractorsOnEbaBuilderProjects: 0,
      totalKeyContractorsOnEbaBuilderProjects: 0,
      keyContractorEbaPercentage: 0,
      keyContractorsWithEba: 0,
      totalMappedKeyContractors: 0
    }
    
    const queryTime = Date.now() - startTime
    
    const response: OrganizingMetricsResponse = {
      metrics,
      debug: {
        queryTime,
        appliedFilters: { patchIds, tier, stage, universe, eba, userId, userRole },
        patchCount: patchIds.length
      }
    }
    
    // Cache for 2 minutes, stale for 5 minutes
    const headers = {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      'Content-Type': 'application/json'
    }
    
    return NextResponse.json(response, { headers })
    
  } catch (error) {
    console.error('Organizing metrics API unexpected error:', error)
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
    
    // Quick health check - test the RPC function
    const { error } = await supabase.rpc('calculate_organizing_universe_metrics', {
      p_patch_ids: null,
      p_tier: null,
      p_stage: null,
      p_universe: 'active',
      p_eba_filter: null,
      p_user_id: null,
      p_user_role: null
    })
    
    if (error) throw error
    
    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Service': 'organizing-metrics',
        'X-Last-Updated': new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Organizing metrics health check failed:', error)
    return new NextResponse(null, { status: 503 })
  }
}

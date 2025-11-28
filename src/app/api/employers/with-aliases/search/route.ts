import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withRateLimit } from '@/lib/rateLimit'
import { parseBooleanParam } from '@/lib/api/paramUtils'
import { getEmployersByPatches } from '@/lib/employers/patchFiltering'

export const dynamic = 'force-dynamic'

function buildPaginationMeta(page: number, pageSize: number, totalCount: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize)
  return {
    page,
    pageSize,
    totalCount,
    totalPages,
    hasNextPage: page * pageSize < totalCount,
    hasPrevPage: page > 1
  }
}

// Enhanced interface that includes aliases and performance metrics
export interface EmployerWithAliasesRecord {
  id: string
  name: string
  abn: string | null
  employer_type: string
  website: string | null
  email: string | null
  phone: string | null
  estimated_worker_count: number | null
  incolink_id: string | null
  bci_company_id: string | null
  enterprise_agreement_status: boolean | null
  eba_status_source: string | null
  eba_status_updated_at: string | null
  eba_status_notes: string | null
  incolink_last_matched?: string | null

  // Enhanced data for performance
  is_engaged?: boolean
  eba_category?: string | null
  eba_recency_score?: number
  project_count?: number
  actual_worker_count?: number
  most_recent_eba_date?: string | null

  // Alias information
  aliases?: Array<{
    id: string
    alias: string
    alias_normalized: string
    is_authoritative: boolean
    source_system: string | null
    source_identifier: string | null
    collected_at: string | null
  }>
  match_type?: 'canonical_name' | 'alias' | 'external_id' | 'abn'
  match_details?: {
    canonical_name: string
    matched_alias: string | null
    query: string
    external_id_match: 'bci' | 'incolink' | null
  }
  search_score?: number
}

export interface EmployersWithAliasesResponse {
  employers: EmployerWithAliasesRecord[]
  pagination: {
    page: number
    pageSize: number
    totalCount: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  debug?: {
    queryTime: number
    cacheHit: boolean
    via: 'rpc' | 'materialized_view'
    appliedFilters: Record<string, any>
  }
}

// Request parameters
interface SearchParams {
  q: string
  page?: number
  pageSize?: number
  includeAliases?: boolean
  aliasMatchMode?: 'any' | 'authoritative' | 'canonical'
  engaged?: boolean
  eba?: 'all' | 'active' | 'lodged' | 'pending' | 'no'
  type?: string
  patch?: string // Comma-separated patch IDs
  patchIds?: string[]
}

/**
 * Optimized employer search with alias support
 * Uses batch fetching and materialized views for optimal performance
 */
async function searchEmployersWithAliasesHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get('q')

    if (!query || query.length < 2) {
      const pagination = buildPaginationMeta(1, 50, 0)
      return NextResponse.json({
        employers: [],
        pagination
      })
    }

    const supabase = await createServerSupabase()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile for patch filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
    }

    // Parse search parameters
    const engaged = parseBooleanParam(searchParams.get('engaged'))
    const patchParam = searchParams.get('patch') || undefined
    const patchIds = patchParam ? patchParam.split(',').map(p => p.trim()).filter(Boolean) : []

    const params: SearchParams = {
      q: query.trim(),
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: Math.min(parseInt(searchParams.get('pageSize') || '50'), 100),
      includeAliases: searchParams.get('includeAliases') !== 'false', // default true
      aliasMatchMode: (searchParams.get('aliasMatchMode') || 'any') as 'any' | 'authoritative' | 'canonical',
      engaged,
      eba: (searchParams.get('eba') || 'all') as 'all' | 'active' | 'lodged' | 'pending' | 'no',
      type: searchParams.get('type') || undefined,
      patch: patchParam,
      patchIds
    }

    const offset = (params.page - 1) * params.pageSize

    // Choose the optimal search strategy
    const useMaterializedView = process.env.NEXT_PUBLIC_USE_EMPLOYER_MAT_VIEW !== 'false'

    let employers: EmployerWithAliasesRecord[] = []
    let totalCount = 0
    let via: 'rpc' | 'materialized_view' = 'rpc'

    if (useMaterializedView) {
      // Use materialized view for better performance
      const result = await searchWithMaterializedView(supabase, params, offset)
      employers = result.employers
      totalCount = result.totalCount
      via = 'materialized_view'
    } else {
      // Use RPC function with batch fetching
      const result = await searchWithRPC(supabase, params, offset)
      employers = result.employers
      totalCount = result.totalCount
      via = 'rpc'
    }

    const currentPage = params.page ?? 1
    const currentPageSize = params.pageSize ?? 50
    let manualFilterApplied = false
    let patchFilterShortCircuit = false

    if (params.patchIds && params.patchIds.length > 0 && via === 'rpc') {
      const { employerIds } = await getEmployersByPatches(supabase, params.patchIds)
      if (employerIds.length === 0) {
        employers = []
        totalCount = 0
        patchFilterShortCircuit = true
      } else {
        const allowed = new Set(employerIds)
        employers = employers.filter(emp => allowed.has(emp.id))
        manualFilterApplied = true
      }
    }

    if (params.engaged && via === 'rpc' && !patchFilterShortCircuit) {
      employers = employers.filter(emp =>
        (emp.project_assignments && emp.project_assignments.length > 0) ||
        (emp.worker_placements && emp.worker_placements.length > 0)
      )
      manualFilterApplied = true
    }

    if (manualFilterApplied && !patchFilterShortCircuit) {
      const minimalTotal = (currentPage - 1) * currentPageSize + employers.length
      totalCount = minimalTotal
    }

    const queryTime = Date.now() - startTime
    const paginationMeta = buildPaginationMeta(currentPage, currentPageSize, totalCount)

    const response: EmployersWithAliasesResponse = {
      employers,
      pagination: paginationMeta,
      debug: {
        queryTime,
        cacheHit: false, // TODO: Implement Redis caching
        via,
        appliedFilters: {
          query: params.q,
          includeAliases: params.includeAliases,
          aliasMatchMode: params.aliasMatchMode,
          engaged: params.engaged,
          eba: params.eba,
          type: params.type,
          patch: params.patch
        }
      }
    }

    // Add performance headers
    const headers = {
      'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      'Content-Type': 'application/json',
      'X-Query-Time': queryTime.toString(),
      'X-Search-Via': via,
      'X-Employer-Count': employers.length.toString()
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('Employer search with aliases error:', error)
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    )
  }
}

/**
 * Search using optimized materialized view
 * This is the fastest approach for large datasets
 */
async function searchWithMaterializedView(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  params: SearchParams,
  offset: number
) {
  let query = supabase
    .from('employers_search_optimized')
    .select(`
      id,
      name,
      abn,
      employer_type,
      website,
      email,
      phone,
      estimated_worker_count,
      incolink_id,
      bci_company_id,
      enterprise_agreement_status,
      eba_status_source,
      eba_status_updated_at,
      eba_status_notes,
      is_engaged,
      eba_category,
      eba_recency_score,
      actual_worker_count,
      project_count,
      most_recent_eba_date,
      incolink_last_matched
    `, { count: 'exact' })

  if (params.patchIds && params.patchIds.length > 0) {
    const { employerIds } = await getEmployersByPatches(supabase, params.patchIds)

    if (employerIds.length === 0) {
      return { employers: [], totalCount: 0 }
    }

    query = query.in('id', employerIds)
  }

  // Apply search filter
  query = query.ilike('name', `%${params.q}%`)

  // Apply engagement filter
  if (params.engaged === true) {
    query = query.eq('is_engaged', true)
  }

  // Apply EBA filter
  if (params.eba === 'active') {
    query = query.eq('eba_category', 'active')
  } else if (params.eba === 'no') {
    query = query.eq('eba_category', 'no')
  } else if (params.eba === 'lodged') {
    query = query.eq('eba_category', 'lodged')
  } else if (params.eba === 'pending') {
    query = query.eq('eba_category', 'pending')
  }

  // Apply employer type filter
  if (params.type) {
    query = query.eq('employer_type', params.type)
  }

  // Apply sorting and pagination
  query = query
    .order('eba_recency_score', { ascending: false, nullsFirst: false })
    .range(offset, offset + params.pageSize - 1)

  const { data, error, count } = await query

  if (error) {
    throw new Error(`Materialized view search failed: ${error.message}`)
  }

  const employers: EmployerWithAliasesRecord[] = (data || []).map(row => ({
    id: row.id,
    name: row.name,
    abn: row.abn,
    employer_type: row.employer_type,
    website: row.website,
    email: row.email,
    phone: row.phone,
    estimated_worker_count: row.estimated_worker_count,
    incolink_id: row.incolink_id,
    bci_company_id: row.bci_company_id,
    enterprise_agreement_status: row.enterprise_agreement_status,
    eba_status_source: row.eba_status_source,
    eba_status_updated_at: row.eba_status_updated_at,
    eba_status_notes: row.eba_status_notes,
    incolink_last_matched: row.incolink_last_matched,
    is_engaged: row.is_engaged,
    eba_category: row.eba_category,
    eba_recency_score: row.eba_recency_score,
    project_count: row.project_count,
    actual_worker_count: row.actual_worker_count,
    most_recent_eba_date: row.most_recent_eba_date,
    match_type: 'canonical_name',
    search_score: 50
  }))

  return { employers, totalCount: count || 0 }
}

/**
 * Search using RPC with alias support
 * Provides better matching but can be slower
 */
async function searchWithRPC(
  supabase: Awaited<ReturnType<typeof createServerSupabase>>,
  params: SearchParams,
  offset: number
) {
  // Use the optimized RPC function
  const { data, error } = await supabase.rpc('search_employers_with_aliases', {
    p_query: params.q,
    p_limit: params.pageSize,
    p_offset: offset,
    p_include_aliases: params.includeAliases,
    p_alias_match_mode: params.aliasMatchMode
  })

  if (error) {
    throw new Error(`RPC search failed: ${error.message}`)
  }

  // Get approximate total count (this is expensive, so we do a simpler query)
  const { count } = await supabase
    .from('employers')
    .select('id', { count: 'exact', head: true })
    .ilike('name', `%${params.q}%`)

  const employers: EmployerWithAliasesRecord[] = (data || []).map((row: any) => ({
    id: row.id,
    name: row.name,
    abn: row.abn,
    employer_type: row.employer_type,
    website: row.website,
    email: row.email,
    phone: row.phone,
    estimated_worker_count: row.estimated_worker_count,
    incolink_id: row.incolink_id,
    bci_company_id: row.bci_company_id,
    enterprise_agreement_status: row.enterprise_agreement_status,
    eba_status_source: null,
    eba_status_updated_at: null,
    eba_status_notes: null,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    match_type: row.match_type,
    match_details: row.match_details,
    search_score: row.search_score
  }))

  return { employers, totalCount: count || 0 }
}

// Export rate-limited handler
export const GET = withRateLimit(searchEmployersWithAliasesHandler, {
  maxRequests: 60, // More generous for search
  windowSeconds: 60,
  burstAllowance: 10
})

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase()

    // Test both RPC and materialized view
    const rpcTest = await supabase.rpc('search_employers_with_aliases', {
      p_query: 'test',
      p_limit: 1,
      p_offset: 0,
      p_include_aliases: false,
      p_alias_match_mode: 'any'
    })

    const matViewTest = await supabase
      .from('employers_search_optimized')
      .select('id', { count: 'exact', head: true })
      .limit(1)

    const rpcHealthy = !rpcTest.error
    const matViewHealthy = !matViewTest.error

    return new NextResponse(null, {
      status: (rpcHealthy || matViewHealthy) ? 200 : 503,
      headers: {
        'X-RPC-Search-Healthy': rpcHealthy.toString(),
        'X-MatView-Search-Healthy': matViewHealthy.toString(),
        'X-Last-Checked': new Date().toISOString()
      }
    })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}
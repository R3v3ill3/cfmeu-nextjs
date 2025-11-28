import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase/server'
import { withRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rateLimit'

export const dynamic = 'force-dynamic'

// Cursor-based pagination interface
interface CursorInfo {
  id: string
  created_at?: string
  name?: string
  distance_km?: number
}

interface SearchRequest {
  q?: string
  entities: ('projects' | 'employers' | 'workers' | 'job_sites')[]
  limit?: number
  cursor?: string // Base64 encoded cursor
  lat?: number // For geographic search
  lng?: number // For geographic search
  radiusKm?: number // For geographic search
  filters?: {
    project_tiers?: string[]
    stage_class?: string
    membership?: 'all' | 'member' | 'non_member'
    employer_tiers?: string[]
    has_location?: boolean
  }
  sort?: 'relevance' | 'name' | 'created_at' | 'distance'
  dir?: 'asc' | 'desc'
}

interface SearchResult<T = any> {
  id: string
  type: 'project' | 'employer' | 'worker' | 'job_site'
  score: number
  data: T
  cursor: string
}

interface UnifiedSearchResponse {
  results: SearchResult[]
  pagination: {
    hasMore: boolean
    nextCursor?: string
    limit: number
    totalResults?: number
  }
  debug?: {
    queryTime: number
    entitiesSearched: string[]
    filters: Record<string, any>
  }
}

// Helper functions for cursor encoding/decoding
function encodeCursor(cursor: CursorInfo): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function decodeCursor(cursor?: string): CursorInfo | null {
  if (!cursor) return null
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString())
  } catch {
    return null
  }
}

// Helper function to escape ILIKE patterns
function escapeLikePattern(str: string): string {
  return str.replace(/[%_\\]/g, '\\$&')
}

// Helper function to calculate relevance score
function calculateRelevanceScore(
  query: string,
  fields: string[],
  exactMatches: string[] = []
): number {
  if (!query || query.length < 2) return 1

  const queryLower = query.toLowerCase()
  let score = 0

  // Exact name match gets highest score
  for (const field of fields) {
    if (field && field.toLowerCase() === queryLower) {
      score += 100
    }
  }

  // Exact match in any field
  for (const field of fields) {
    if (field && field.toLowerCase().includes(queryLower)) {
      score += 50
    }
  }

  // Fuzzy matching using word boundaries
  const queryWords = queryLower.split(/\s+/)
  for (const word of queryWords) {
    for (const field of fields) {
      if (field) {
        const fieldWords = field.toLowerCase().split(/\s+/)
        for (const fieldWord of fieldWords) {
          if (fieldWord.startsWith(word)) {
            score += 10
          }
        }
      }
    }
  }

  return score || 1
}

// Search functions for different entities
async function searchProjects(
  supabase: any,
  query: string,
  limit: number,
  cursor: CursorInfo | null,
  filters: any,
  userPatchIds: string[] | null
): Promise<SearchResult[]> {
  let dbQuery = supabase
    .from('projects')
    .select(`
      id,
      name,
      tier,
      value,
      organising_universe,
      stage_class,
      created_at,
      job_sites!inner(
        id,
        name,
        full_address,
        latitude,
        longitude
      )
    `)
    .eq('stage_class', 'construction') // Only active construction projects
    .order('created_at', { ascending: false })

  // Apply user patch restrictions if needed
  if (userPatchIds && userPatchIds.length > 0) {
    dbQuery = dbQuery.in('id',
      supabase
        .from('v_patch_projects_current')
        .select('project_id')
        .in('patch_id', userPatchIds)
    )
  }

  // Apply text search
  if (query && query.length >= 2) {
    dbQuery = dbQuery.ilike('name', `%${escapeLikePattern(query)}%`)
  }

  // Apply filters
  if (filters?.project_tiers?.length) {
    dbQuery = dbQuery.in('tier', filters.project_tiers)
  }

  if (filters?.stage_class) {
    dbQuery = dbQuery.eq('stage_class', filters.stage_class)
  }

  // Apply cursor for pagination
  if (cursor) {
    dbQuery = dbQuery.lt('created_at', cursor.created_at || '')
  }

  const { data, error } = await dbQuery.limit(limit)

  if (error) {
    console.error('Project search error:', error)
    return []
  }

  return (data || []).map((project: any) => {
    const score = calculateRelevanceScore(query, [project.name])
    const nextCursor = encodeCursor({
      id: project.id,
      created_at: project.created_at
    })

    return {
      id: project.id,
      type: 'project' as const,
      score,
      data: project,
      cursor: nextCursor
    }
  })
}

async function searchEmployers(
  supabase: any,
  query: string,
  limit: number,
  cursor: CursorInfo | null,
  filters: any,
  userPatchIds: string[] | null
): Promise<SearchResult[]> {
  let dbQuery = supabase
    .from('employers')
    .select(`
      id,
      name,
      abn,
      tier,
      created_at,
      enterprise_agreement_status
    `)
    .order('name', { ascending: true })

  // Apply user patch restrictions if needed
  if (userPatchIds && userPatchIds.length > 0) {
    dbQuery = dbQuery.in('id',
      supabase
        .from('v_patch_employers_current')
        .select('employer_id')
        .in('patch_id', userPatchIds)
    )
  }

  // Apply text search using trigram index
  if (query && query.length >= 2) {
    dbQuery = dbQuery.ilike('name', `%${escapeLikePattern(query)}%`)
  }

  // Apply filters
  if (filters?.employer_tiers?.length) {
    dbQuery = dbQuery.in('tier', filters.employer_tiers)
  }

  // Apply cursor for pagination
  if (cursor) {
    dbQuery = dbQuery.gt('name', cursor.name || '')
  }

  const { data, error } = await dbQuery.limit(limit)

  if (error) {
    console.error('Employer search error:', error)
    return []
  }

  return (data || []).map((employer: any) => {
    const score = calculateRelevanceScore(query, [employer.name, employer.abn])
    const nextCursor = encodeCursor({
      id: employer.id,
      name: employer.name
    })

    return {
      id: employer.id,
      type: 'employer' as const,
      score,
      data: employer,
      cursor: nextCursor
    }
  })
}

async function searchWorkers(
  supabase: any,
  query: string,
  limit: number,
  cursor: CursorInfo | null,
  filters: any,
  userPatchIds: string[] | null
): Promise<SearchResult[]> {
  let dbQuery = supabase
    .from('worker_list_view')
    .select(`
      id,
      first_name,
      surname,
      email,
      mobile_phone,
      member_number,
      union_membership_status,
      created_at
    `)
    .order('surname', { ascending: true })
    .order('first_name', { ascending: true })

  // Apply text search using pre-computed search_text
  if (query && query.length >= 2) {
    dbQuery = dbQuery.ilike('search_text', `%${escapeLikePattern(query)}%`)
  }

  // Apply membership filter
  if (filters?.membership && filters.membership !== 'all') {
    if (filters.membership === 'member') {
      dbQuery = dbQuery.not('union_membership_status', 'is', null)
                 .neq('union_membership_status', 'non_member')
    } else if (filters.membership === 'non_member') {
      dbQuery = dbQuery.or('union_membership_status.is.null,union_membership_status.eq.non_member')
    }
  }

  // Apply cursor for pagination
  if (cursor) {
    dbQuery = dbQuery.or(`surname.gt.${cursor.name || ''},and(surname.eq.${cursor.name || ''},first_name.gt.${cursor.name || ''})`)
  }

  const { data, error } = await dbQuery.limit(limit)

  if (error) {
    console.error('Worker search error:', error)
    return []
  }

  return (data || []).map((worker: any) => {
    const fullName = `${worker.first_name} ${worker.surname}`
    const score = calculateRelevanceScore(query, [fullName, worker.email, worker.mobile_phone])
    const nextCursor = encodeCursor({
      id: worker.id,
      name: worker.surname
    })

    return {
      id: worker.id,
      type: 'worker' as const,
      score,
      data: worker,
      cursor: nextCursor
    }
  })
}

async function searchJobSites(
  supabase: any,
  query: string,
  limit: number,
  cursor: CursorInfo | null,
  filters: any,
  userPatchIds: string[] | null,
  lat?: number,
  lng?: number,
  radiusKm?: number
): Promise<SearchResult[]> {
  // Use existing find_nearby_projects for geographic search
  if (lat && lng && radiusKm) {
    const { data, error } = await supabase.rpc('find_nearby_projects', {
      search_lat: lat,
      search_lng: lng,
      max_results: limit,
      max_distance_km: radiusKm
    })

    if (error) {
      console.error('Job site geographic search error:', error)
      return []
    }

    return (data || []).map((site: any) => {
      const score = 100 - (site.distance_km || 0) // Closer sites get higher scores
      const nextCursor = encodeCursor({
        id: site.job_site_id,
        distance_km: site.distance_km
      })

      return {
        id: site.job_site_id,
        type: 'job_site' as const,
        score,
        data: {
          id: site.job_site_id,
          name: site.job_site_name,
          address: site.job_site_address,
          latitude: site.latitude,
          longitude: site.longitude,
          distance_km: site.distance_km,
          project: {
            id: site.project_id,
            name: site.project_name,
            tier: site.project_tier,
            builder_name: site.builder_name
          }
        },
        cursor: nextCursor
      }
    })
  }

  // Regular text-based job site search
  let dbQuery = supabase
    .from('job_sites')
    .select(`
      id,
      name,
      full_address,
      location,
      latitude,
      longitude,
      created_at,
      projects!inner(
        id,
        name,
        tier,
        stage_class
      )
    `)
    .order('name', { ascending: true })

  // Apply user patch restrictions if needed
  if (userPatchIds && userPatchIds.length > 0) {
    dbQuery = dbQuery.in('id',
      supabase
        .from('v_patch_sites_current')
        .select('job_site_id')
        .in('patch_id', userPatchIds)
    )
  }

  // Apply text search
  if (query && query.length >= 2) {
    dbQuery = dbQuery.or(`name.ilike.%${escapeLikePattern(query)}%,full_address.ilike.%${escapeLikePattern(query)}%,location.ilike.%${escapeLikePattern(query)}%`)
  }

  // Apply location filter
  if (filters?.has_location) {
    dbQuery = dbQuery.not('latitude', 'is', null)
                   .not('longitude', 'is', null)
  }

  // Apply cursor for pagination
  if (cursor) {
    dbQuery = dbQuery.gt('name', cursor.name || '')
  }

  const { data, error } = await dbQuery.limit(limit)

  if (error) {
    console.error('Job site search error:', error)
    return []
  }

  return (data || []).map((site: any) => {
    const score = calculateRelevanceScore(query, [site.name, site.full_address, site.location])
    const nextCursor = encodeCursor({
      id: site.id,
      name: site.name
    })

    return {
      id: site.id,
      type: 'job_site' as const,
      score,
      data: site,
      cursor: nextCursor
    }
  })
}

// Get user patch assignments for filtering
async function getUserPatchIds(supabase: any, userId: string, role: string): Promise<string[] | null> {
  if (role === 'admin') {
    return null // Admin sees everything
  }

  const patchIdSet = new Set<string>()

  if (role === 'lead_organiser') {
    // Get direct patch assignments
    const { data: direct } = await supabase
      .from("lead_organiser_patch_assignments")
      .select("patch_id")
      .is("effective_to", null)
      .eq("lead_organiser_id", userId)

    direct?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))

    // Get team members' patches
    const today = new Date().toISOString().slice(0, 10)
    const { data: links } = await supabase
      .from("role_hierarchy")
      .select("child_user_id")
      .eq("parent_user_id", userId)
      .eq("is_active", true)
      .or(`end_date.is.null,end_date.gte.${today}`)

    const childIds = Array.from(new Set(links?.map((r: any) => r.child_user_id).filter(Boolean) || []))
    if (childIds.length > 0) {
      const { data: team } = await supabase
        .from("organiser_patch_assignments")
        .select("patch_id")
        .is("effective_to", null)
        .in("organiser_id", childIds)
      team?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
    }
  } else if (role === 'organiser') {
    const { data } = await supabase
      .from("organiser_patch_assignments")
      .select("patch_id")
      .is("effective_to", null)
      .eq("organiser_id", userId)
    data?.forEach((r: any) => r?.patch_id && patchIdSet.add(r.patch_id))
  }

  return Array.from(patchIdSet)
}

// Main search handler
async function unifiedSearchHandler(request: NextRequest) {
  const startTime = Date.now()

  try {
    const searchParams = request.nextUrl.searchParams
    const supabase = await createServerSupabase()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user profile and role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.role) {
      return NextResponse.json({ error: 'Unable to verify user role' }, { status: 403 })
    }

    // Parse search parameters
    const q = searchParams.get('q') || undefined
    const entities = (searchParams.get('entities')?.split(',') as SearchRequest['entities']) || ['projects', 'employers']
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Cap at 100
    const cursor = decodeCursor(searchParams.get('cursor') || undefined)
    const lat = searchParams.get('lat') ? parseFloat(searchParams.get('lat')!) : undefined
    const lng = searchParams.get('lng') ? parseFloat(searchParams.get('lng')!) : undefined
    const radiusKm = searchParams.get('radiusKm') ? parseFloat(searchParams.get('radiusKm')!) : 50
    const sort = (searchParams.get('sort') || 'relevance') as SearchRequest['sort']
    const dir = (searchParams.get('dir') || 'desc') as SearchRequest['dir']

    // Parse filters
    const filters: SearchRequest['filters'] = {}
    const projectTiers = searchParams.get('project_tiers')?.split(',')
    const employerTiers = searchParams.get('employer_tiers')?.split(',')
    const membership = searchParams.get('membership') as SearchRequest['filters']['membership']
    const stageClass = searchParams.get('stage_class')
    const hasLocation = searchParams.get('has_location') === 'true'

    if (projectTiers?.length) filters.project_tiers = projectTiers
    if (employerTiers?.length) filters.employer_tiers = employerTiers
    if (membership) filters.membership = membership
    if (stageClass) filters.stage_class = stageClass
    if (hasLocation) filters.has_location = hasLocation

    // Validate entities
    const validEntities = ['projects', 'employers', 'workers', 'job_sites']
    const requestedEntities = entities.filter(e => validEntities.includes(e))

    if (requestedEntities.length === 0) {
      return NextResponse.json({ error: 'No valid entities specified' }, { status: 400 })
    }

    // Get user patch assignments for data filtering
    const userPatchIds = await getUserPatchIds(supabase, user.id, profile.role)

    // Calculate per-entity limits
    const limitPerEntity = Math.ceil(limit / requestedEntities.length)

    // Execute searches in parallel
    const searchPromises = requestedEntities.map(async entity => {
      switch (entity) {
        case 'projects':
          return searchProjects(supabase, q || '', limitPerEntity, cursor, filters, userPatchIds)
        case 'employers':
          return searchEmployers(supabase, q || '', limitPerEntity, cursor, filters, userPatchIds)
        case 'workers':
          return searchWorkers(supabase, q || '', limitPerEntity, cursor, filters, userPatchIds)
        case 'job_sites':
          return searchJobSites(supabase, q || '', limitPerEntity, cursor, filters, userPatchIds, lat, lng, radiusKm)
        default:
          return []
      }
    })

    const searchResults = await Promise.all(searchPromises)
    const allResults = searchResults.flat()

    // Sort results based on requested sort order
    if (sort === 'relevance') {
      allResults.sort((a, b) => b.score - a.score)
    } else if (sort === 'distance') {
      allResults.sort((a, b) => (a.data.distance_km || 0) - (b.data.distance_km || 0))
    }

    // Apply final limit and pagination
    const finalResults = allResults.slice(0, limit)
    const hasMore = allResults.length > limit

    // Generate next cursor from last result
    let nextCursor: string | undefined
    if (hasMore && finalResults.length > 0) {
      const lastResult = finalResults[finalResults.length - 1]
      nextCursor = lastResult.cursor
    }

    const queryTime = Date.now() - startTime

    const response: UnifiedSearchResponse = {
      results: finalResults,
      pagination: {
        hasMore,
        nextCursor,
        limit,
      },
      debug: {
        queryTime,
        entitiesSearched: requestedEntities,
        filters: {
          query: q,
          ...filters,
          geographic: lat && lng ? { lat, lng, radiusKm } : undefined
        }
      }
    }

    // Add cache headers for search results
    const headers = {
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      'Content-Type': 'application/json'
    }

    return NextResponse.json(response, { headers })

  } catch (error) {
    console.error('Unified search error:', error)
    return NextResponse.json(
      { error: 'Search failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Health check endpoint
export async function HEAD() {
  try {
    const supabase = await createServerSupabase()

    const [projectCount, employerCount] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('employers').select('*', { count: 'exact', head: true })
    ])

    return new NextResponse(null, {
      status: 200,
      headers: {
        'X-Total-Projects': projectCount.count?.toString() || '0',
        'X-Total-Employers': employerCount.count?.toString() || '0',
        'X-Search-Health': 'ok',
        'X-Last-Updated': new Date().toISOString()
      }
    })
  } catch (error) {
    return new NextResponse(null, { status: 503 })
  }
}

// Export rate-limited GET handler
export const GET = withRateLimit(unifiedSearchHandler, RATE_LIMIT_PRESETS.EXPENSIVE_QUERY)
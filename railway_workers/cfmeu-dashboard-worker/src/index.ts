import express from 'express'
import pino from 'pino'
import { config } from './config'
import { getServiceRoleClient, getUserClientFromToken } from './supabase'
import { scheduleMaterializedViewRefreshes, refreshPatchProjectMappingViewInBackground } from './refresh'
import { cache, makeCacheKey } from './cache'
import crypto from 'crypto'

const logger = pino({ level: process.env.LOG_LEVEL || 'info' })

const app = express()
app.use(express.json())
app.use((req, res, next) => {
  // Basic configurable CORS suitable for local dev; tighten for prod
  res.header('Access-Control-Allow-Origin', config.corsOrigin)
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.get('/health', async (_req, res) => {
  try {
    // Lightweight check: ensure service client can reach DB
    const svc = getServiceRoleClient()
    const { error } = await svc
      .from('project_list_comprehensive_view')
      .select('*', { count: 'exact', head: true })

    if (error) throw error
    res.status(200).json({ status: 'ok', time: new Date().toISOString() })
  } catch (err) {
    logger.error({ err }, 'Health check failed')
    res.status(503).json({ status: 'degraded' })
  }
})

// Utilities
function getBearerToken(req: express.Request): string | null {
  const auth = req.header('authorization') || req.header('Authorization')
  if (!auth) return null
  const parts = auth.split(' ')
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) return parts[1]
  return null
}

function hashToken(token: string | null): string {
  if (!token) return 'anon'
  return crypto.createHash('sha1').update(token).digest('hex').slice(0, 16)
}

type CoreTradeKey = 'demolition' | 'piling' | 'concreting' | 'formwork' | 'scaffold' | 'cranes'

const CORE_TRADE_CODE_MAP: Record<CoreTradeKey, string[]> = {
  demolition: ['demolition'],
  piling: ['piling'],
  concreting: ['concrete', 'concreting'],
  formwork: ['form_work', 'formwork'],
  scaffold: ['scaffolding', 'scaffold'],
  cranes: ['tower_crane', 'mobile_crane', 'crane', 'cranes'],
}

function createCoreTradeSetRecord(): Record<CoreTradeKey, Set<string>> {
  return {
    demolition: new Set<string>(),
    piling: new Set<string>(),
    concreting: new Set<string>(),
    formwork: new Set<string>(),
    scaffold: new Set<string>(),
    cranes: new Set<string>(),
  }
}

function createEmptyCoreTradeCounts(): Record<CoreTradeKey, number> {
  return {
    demolition: 0,
    piling: 0,
    concreting: 0,
    formwork: 0,
    scaffold: 0,
    cranes: 0,
  }
}

function aggregateCoreTradeSets(record: Record<CoreTradeKey, Set<string>>): Record<CoreTradeKey, number> {
  const counts = createEmptyCoreTradeCounts()
  for (const key of Object.keys(counts) as CoreTradeKey[]) {
    counts[key] = record[key].size
  }
  return counts
}

function mapTradeCodeToCore(code?: string | null): CoreTradeKey | null {
  if (!code) return null
  const normalized = code.toLowerCase()
  for (const [key, codes] of Object.entries(CORE_TRADE_CODE_MAP) as Array<[CoreTradeKey, string[]]>) {
    if (codes.some((c) => c === normalized)) {
      return key
    }
  }
  return null
}

function getOrCreateProjectCoreSet(
  map: Map<string, Record<CoreTradeKey, Set<string>>>,
  projectId: string
): Record<CoreTradeKey, Set<string>> {
  let record = map.get(projectId)
  if (!record) {
    record = createCoreTradeSetRecord()
    map.set(projectId, record)
  }
  return record
}

function normalizeEmployerField(raw: any): any {
  if (!raw) return null
  if (Array.isArray(raw)) return raw[0]
  return raw
}

function employerHasActiveEba(employer: any): boolean {
  if (!employer) return false
  if (employer.enterprise_agreement_status === true) return true
  const records = employer.company_eba_records
  if (Array.isArray(records)) {
    return records.some((record: any) => record?.fwc_certified_date)
  }
  return false
}

async function ensureAuthorizedUser(token: string) {
  const client = getUserClientFromToken(token)
  const { data: auth, error: authError } = await client.auth.getUser()
  if (authError || !auth?.user) {
    throw new Error('Unauthorized')
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('role, last_seen_projects_at')
    .eq('id', auth.user.id)
    .maybeSingle()

  if (profileError) {
    throw Object.assign(new Error('profile_load_failed'), { cause: profileError })
  }

  const allowedRoles = new Set(['organiser', 'lead_organiser', 'admin'])
  if (!profile || !allowedRoles.has(profile.role)) {
    throw new Error('Forbidden')
  }

  return { client, profile }
}

// GET /v1/projects — mirrors Next.js /api/projects semantics, with caching
app.get('/v1/projects', async (req, res) => {
  const startTime = Date.now()
  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Parse query params
  const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1)
  const rawPageSize = Math.max(parseInt(String(req.query.pageSize || '24'), 10), 1)
  const pageSize = Math.min(rawPageSize, 100)
  const sort = String(req.query.sort || 'name')
  const dir = String(req.query.dir || 'asc') as 'asc' | 'desc'
  const q = (req.query.q ? String(req.query.q) : undefined)?.toLowerCase()
  const patchParam = req.query.patch ? String(req.query.patch) : undefined
  const tier = String(req.query.tier || 'all')
  const universe = String(req.query.universe || 'all')
  const stage = String(req.query.stage || 'all')
  const workers = String(req.query.workers || 'all')
  const special = String(req.query.special || 'all')
  const eba = String(req.query.eba || 'all')

  const patchIds = patchParam ? patchParam.split(',').map((s) => s.trim()).filter(Boolean) : []

  try {
    const { client: sb, profile } = await ensureAuthorizedUser(token)
    const sinceParam = req.query.since ? String(req.query.since) : undefined
    const newOnlyParam = req.query.newOnly ? String(req.query.newOnly) : undefined
    const newOnly = newOnlyParam === '1' || newOnlyParam === 'true'
    const effectiveSince = sinceParam || (profile as any)?.last_seen_projects_at || null

    const cacheKey = makeCacheKey('projects', hashToken(token), {
      page,
      pageSize,
      sort,
      dir,
      q,
      patchIds,
      tier,
      universe,
      stage,
      workers,
      special,
      eba,
      newOnly,
      since: effectiveSince,
    })

    const cached = cache.get(cacheKey)
    if (cached) {
      return res.status(200).set({ 'X-Cache': 'HIT' }).json(cached)
    }

    // Base query on materialized view
    let query = sb.from('project_list_comprehensive_view').select('*', { count: 'exact' })

    // Patch filtering via mapping view, with fallback
    let patchProjectCount = 0
    let patchFilteringMethod: 'none' | 'materialized_view' | 'fallback_job_sites' = 'none'
    if (patchIds.length > 0) {
      let { data: patchProjects, error: viewError } = await sb
        .from('patch_project_mapping_view')
        .select('project_id')
        .in('patch_id', patchIds)

      let usedFallback = false
      if (viewError) {
        logger.warn({ err: viewError }, 'patch_project_mapping_view error, falling back')
      }

      if (!patchProjects || patchProjects.length === 0) {
        const { data: fallbackData, error: fallbackError } = await sb
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)
          .not('project_id', 'is', null)

        if (fallbackError) throw fallbackError
        patchProjects = fallbackData || []
        usedFallback = true

        // Best-effort background refresh using service client (won't block request)
        refreshPatchProjectMappingViewInBackground(logger)
      }

      patchProjectCount = patchProjects?.length || 0
      patchFilteringMethod = usedFallback ? 'fallback_job_sites' : 'materialized_view'

      if (patchProjectCount === 0) {
        const sinceParam = req.query.since ? String(req.query.since) : undefined
        const newOnlyParam = req.query.newOnly ? String(req.query.newOnly) : undefined
        const newOnly = newOnlyParam === '1' || newOnlyParam === 'true'
        const effectiveSince = sinceParam || (profile as any)?.last_seen_projects_at || null
        const response = {
          projects: [],
          summaries: {},
          pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
          debug: {
            queryTime: Date.now() - startTime,
            cacheHit: false,
            appliedFilters: {
              q,
              patchIds,
              tier,
              universe,
              stage,
              workers,
              special,
              eba,
              sort,
              dir,
              newOnly,
              since: effectiveSince,
            },
            patchProjectCount,
            patchFilteringUsed: true,
            patchFilteringMethod,
          },
        }
        cache.set(cacheKey, response, 30_000)
        return res
          .status(200)
          .set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' })
          .json(response)
      }

      const projectIds = Array.from(new Set((patchProjects || []).map((r: any) => r.project_id)))
      if (projectIds.length > 0) {
        query = query.in('id', projectIds)
      }
    }

    // Text search
    if (q) query = query.ilike('search_text', `%${q}%`)

    // Filters
    if (tier !== 'all') query = query.eq('tier', tier)
    if (universe !== 'all') query = query.eq('organising_universe', universe)
    if (stage !== 'all') query = query.eq('stage_class', stage)

    // Workers filter using pre-computed columns
    if (workers === 'zero') query = query.eq('total_workers', 0)
    else if (workers === 'nonzero') query = query.gt('total_workers', 0)

    // Special filter
    if (special === 'noBuilderWithEmployers') {
      query = query.eq('has_builder', false).gt('engaged_employer_count', 0)
    }

    // EBA filter
    if (eba !== 'all') {
      if (eba === 'eba_active') query = query.eq('has_builder', true).eq('builder_has_eba', true)
      else if (eba === 'eba_inactive') query = query.eq('has_builder', true).eq('builder_has_eba', false)
      else if (eba === 'builder_unknown') query = query.eq('has_builder', false)
    }

    if (newOnly && effectiveSince) {
      query = query.gt('created_at', effectiveSince)
    }

    // Sorting
    const summarySorts = new Set(['workers', 'members', 'delegates', 'eba_coverage', 'employers'])
    if (!summarySorts.has(sort)) {
      if (sort === 'name') query = query.order('name', { ascending: dir === 'asc' })
      else if (sort === 'value') query = query.order('value', { ascending: dir === 'asc', nullsFirst: false })
      else if (sort === 'tier') query = query.order('tier', { ascending: dir === 'asc', nullsFirst: false })
      else query = query.order('created_at', { ascending: dir === 'asc' })
    } else {
      if (sort === 'workers') query = query.order('total_workers', { ascending: dir === 'asc' })
      else if (sort === 'members') query = query.order('total_members', { ascending: dir === 'asc' })
      else if (sort === 'employers') query = query.order('engaged_employer_count', { ascending: dir === 'asc' })
      else if (sort === 'eba_coverage') query = query.order('eba_coverage_percent', { ascending: dir === 'asc' })
      else if (sort === 'delegates') query = query.order('delegate_name', { ascending: dir === 'asc', nullsFirst: dir === 'desc' })
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    query = query.range(from, to)

    const { data, error, count } = await query
    if (error) throw error

    // Transform to client shapes
    const projects = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      main_job_site_id: row.main_job_site_id,
      value: row.value,
      tier: row.tier,
      organising_universe: row.organising_universe,
      stage_class: row.stage_class,
      builder_name: row.builder_name,
      created_at: row.created_at,
      full_address: row.full_address,
      project_assignments: row.project_assignments_data || [],
    }))

    const summaries: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      summaries[row.id] = {
        project_id: row.id,
        total_workers: row.total_workers || 0,
        total_members: row.total_members || 0,
        engaged_employer_count: row.engaged_employer_count || 0,
        eba_active_employer_count: row.eba_active_employer_count || 0,
        estimated_total: row.estimated_total || 0,
        delegate_name: row.delegate_name,
        first_patch_name: row.first_patch_name,
        organiser_names: row.organiser_names,
      }
    })

    const totalCount = count || 0
    const totalPages = Math.ceil(totalCount / pageSize)
    const queryTime = Date.now() - startTime

    const response = {
      projects,
      summaries,
      pagination: { page, pageSize, totalCount, totalPages },
      debug: {
        queryTime,
        cacheHit: false,
        appliedFilters: {
          q,
          patchIds,
          tier,
          universe,
          stage,
          workers,
          special,
          eba,
          sort,
          dir,
          newOnly,
          since: effectiveSince,
        },
        patchProjectCount,
        patchFilteringUsed: patchIds.length > 0,
        patchFilteringMethod,
      },
    }

    cache.set(cacheKey, response, 30_000)

    res
      .status(200)
      .set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' })
      .json(response)
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (err?.message === 'Forbidden') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (err?.message === 'profile_load_failed') {
      logger.error({ err }, 'Profile load failed')
      return res.status(500).json({ error: 'Unable to load user profile' })
    }
    logger.error({ err }, 'Projects endpoint error')
    res.status(500).json({ error: 'Failed to fetch projects' })
  }
})

// GET /v1/dashboard — aggregated dashboard metrics with short TTL caching
app.get('/v1/dashboard', async (req, res) => {
  const startTime = Date.now()
  const token = getBearerToken(req)
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const tier = (req.query.tier ? String(req.query.tier) : undefined) || undefined
  const stage = (req.query.stage ? String(req.query.stage) : undefined) || undefined
  const universe = (req.query.universe ? String(req.query.universe) : undefined) || undefined
  const rawPatch = req.query.patchIds ? String(req.query.patchIds) : undefined
  const patchIds = rawPatch ? rawPatch.split(',').map((s) => s.trim()).filter(Boolean) : undefined

  const cacheKey = makeCacheKey('dashboard', hashToken(token), { tier, stage, universe, patchIds })
  const cached = cache.get<any>(cacheKey)
  if (cached) {
    return res.status(200).set({ 'X-Cache': 'HIT' }).json(cached)
  }

  try {
    const { client: sb } = await ensureAuthorizedUser(token)

    // Optional scoping: patch -> project ids (using mapping view, fallback if needed)
    let scopedProjectIds: string[] | null = null
    if (patchIds && patchIds.length > 0) {
      let { data: patchProjects } = await sb
        .from('patch_project_mapping_view')
        .select('project_id')
        .in('patch_id', patchIds)

      if (!patchProjects || patchProjects.length === 0) {
        const { data: fallbackData, error: fbErr } = await sb
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)
          .not('project_id', 'is', null)
        if (fbErr) throw fbErr
        patchProjects = fallbackData || []
      }
      scopedProjectIds = Array.from(new Set((patchProjects || []).map((r: any) => r.project_id).filter(Boolean)))
    }

    // Base projects for counts, filtered by patch/tier/stage/universe if provided
    let projectsQuery = sb.from('projects').select('id, organising_universe, stage_class, tier')
    if (scopedProjectIds && scopedProjectIds.length > 0) projectsQuery = projectsQuery.in('id', scopedProjectIds)
    if (tier && tier !== 'all') projectsQuery = projectsQuery.eq('tier', tier)
    if (universe && universe !== 'all') projectsQuery = projectsQuery.eq('organising_universe', universe)
    if (stage && stage !== 'all') projectsQuery = projectsQuery.eq('stage_class', stage)
    const { data: projects, error: projectsError } = await projectsQuery
    if (projectsError) throw projectsError
    const projectRows = (projects || []) as any[]

    // Project counts by organizing_universe + stage_class
    const counts: Record<string, number> = {}
    for (const p of projectRows) {
      const key = `${p.organising_universe || 'excluded'}_${p.stage_class || 'archived'}`
      counts[key] = (counts[key] || 0) + 1
    }
    const project_counts = {
      active_construction: counts.active_construction || 0,
      active_pre_construction: counts.active_pre_construction || 0,
      potential_construction: counts.potential_construction || 0,
      potential_pre_construction: counts.potential_pre_construction || 0,
      potential_future: counts.potential_future || 0,
      potential_archived: counts.potential_archived || 0,
      excluded_construction: counts.excluded_construction || 0,
      excluded_pre_construction: counts.excluded_pre_construction || 0,
      excluded_future: counts.excluded_future || 0,
      excluded_archived: counts.excluded_archived || 0,
      total: projectRows.length || 0,
    }

    // Active construction builder metrics
    const activeConstructionIds = projectRows
      .filter((p) => p.organising_universe === 'active' && p.stage_class === 'construction')
      .map((p) => p.id)

    const activePreConstructionIds = projectRows
      .filter((p) => p.organising_universe === 'active' && p.stage_class === 'pre_construction')
      .map((p) => p.id)

    let total_builders = 0
    let eba_builders = 0
    let total_employers = 0
    let eba_employers = 0
    const projectCoreTradeEmployers = new Map<string, Record<CoreTradeKey, Set<string>>>()
    const projectCoreTradeEbaEmployers = new Map<string, Record<CoreTradeKey, Set<string>>>()
    let avg_estimated_workers = 0
    let avg_assigned_workers = 0
    let avg_members = 0
    let financial_audit_activities = 0
    let coreTrades = createEmptyCoreTradeCounts()
    let projectsWithSiteDelegates = 0
    let projectsWithCompanyDelegates = 0
    let projectsWithHsrs = 0
    let projectsWithHsrChairDelegate = 0
    let projectsWithFullHsCommittee = 0

    if (activeConstructionIds.length > 0) {
      const { data: activeBuilders } = await sb
        .from('project_assignments')
        .select(
          `project_id,
          employer_id,
          assignment_type,
          estimated_worker_count,
          assigned_worker_count,
          organiser_worker_count,
          delegate_type,
          is_hsr,
          is_hsr_chair_delegate,
          has_full_health_and_safety_committee,
          contractor_role_types ( code ),
          trade_types ( code ),
          employers!inner(
            id,
            enterprise_agreement_status,
            company_eba_records(id, fwc_certified_date)
          )`
        )
        .in('project_id', activeConstructionIds)

      const uniqueBuilders = new Set((activeBuilders || []).map((b: any) => b.employer_id))
      total_builders = uniqueBuilders.size
      eba_builders = new Set(
        (activeBuilders || [])
          .filter((b: any) => Array.isArray(b.employers?.company_eba_records) && b.employers.company_eba_records.length > 0)
          .map((b: any) => b.employer_id)
      ).size

      const activeEmployerAssignments = (activeBuilders || []).filter((b: any) => b.assignment_type === 'employer')
      const uniqueActiveEmployers = new Set(activeEmployerAssignments.map((b: any) => b.employer_id))
      total_employers = uniqueActiveEmployers.size
      eba_employers = new Set(
        activeEmployerAssignments
          .filter(
            (b: any) => Array.isArray(b.employers?.company_eba_records) && b.employers.company_eba_records.some((eba: any) => eba.fwc_certified_date)
          )
          .map((b: any) => b.employer_id)
      ).size

      const totalsByProject: Record<string, { estimated: number[]; assigned: number[]; members: number[] }> = {}
      ;(activeBuilders || []).forEach((assignment: any) => {
        const entry = (totalsByProject[assignment.project_id] ||= { estimated: [], assigned: [], members: [] })
        if (typeof assignment.estimated_worker_count === 'number') entry.estimated.push(assignment.estimated_worker_count)
        if (typeof assignment.assigned_worker_count === 'number') entry.assigned.push(assignment.assigned_worker_count)
        if (typeof assignment.organiser_worker_count === 'number') entry.members.push(assignment.organiser_worker_count)

        if (assignment.delegate_type === 'site_delegate') projectsWithSiteDelegates++
        if (assignment.delegate_type === 'company_delegate') projectsWithCompanyDelegates++
        if (assignment.is_hsr) projectsWithHsrs++
        if (assignment.is_hsr_chair_delegate) projectsWithHsrChairDelegate++
        if (assignment.has_full_health_and_safety_committee) projectsWithFullHsCommittee++

        if (assignment.assignment_type === 'trade_work' && assignment.trade_types?.code) {
          const coreKey = mapTradeCodeToCore(assignment.trade_types.code)
          if (coreKey) {
            const projectSets = getOrCreateProjectCoreSet(projectCoreTradeEmployers, assignment.project_id)
            projectSets[coreKey].add(assignment.employer_id)

            const employer = normalizeEmployerField(assignment.employers)
            if (employerHasActiveEba(employer)) {
              const ebaSets = getOrCreateProjectCoreSet(projectCoreTradeEbaEmployers, assignment.project_id)
              ebaSets[coreKey].add(assignment.employer_id)
            }
          }
        }
      })

      const calcAverage = (values: number[]) => (values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0)
      const estimatedValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.estimated))
      const assignedValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.assigned))
      const memberValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.members))

      avg_estimated_workers = calcAverage(estimatedValues)
      avg_assigned_workers = calcAverage(assignedValues)
      avg_members = calcAverage(memberValues)

      const { count: faaCount } = await sb
        .from('union_activities')
        .select('*', { count: 'exact', head: true })
        .eq('activity_type', 'financial_audit')
        .in('project_id', activeConstructionIds)

      financial_audit_activities = faaCount || 0
    }

    let preConstructionBuilders = 0
    let preConstructionEbaBuilders = 0
    let preConstructionTotalEmployers = 0
    let preConstructionEbaEmployers = 0
    let preConstructionAvgEstimatedWorkers = 0
    let preConstructionAvgAssignedWorkers = 0
    let preConstructionAvgMembers = 0

    if (activePreConstructionIds.length > 0) {
      const { data: preConstructionAssignments } = await sb
        .from('project_assignments')
        .select(
          `project_id,
          employer_id,
          assignment_type,
          estimated_worker_count,
          assigned_worker_count,
          organiser_worker_count,
          employers!inner(
            id,
            company_eba_records(id, fwc_certified_date)
          )`
        )
        .in('project_id', activePreConstructionIds)

      const uniqueBuilders = new Set(
        (preConstructionAssignments || [])
          .filter((a: any) => a.assignment_type === 'contractor_role')
          .map((a: any) => a.employer_id)
      )
      preConstructionBuilders = uniqueBuilders.size
      preConstructionEbaBuilders = new Set(
        (preConstructionAssignments || [])
          .filter(
            (a: any) =>
              a.assignment_type === 'contractor_role' &&
              Array.isArray(a.employers?.company_eba_records) &&
              a.employers.company_eba_records.some((eba: any) => eba.fwc_certified_date)
          )
          .map((a: any) => a.employer_id)
      ).size

      const employerAssignments = (preConstructionAssignments || []).filter((a: any) => a.assignment_type === 'employer')
      const uniqueEmployers = new Set(employerAssignments.map((a: any) => a.employer_id))
      preConstructionTotalEmployers = uniqueEmployers.size
      preConstructionEbaEmployers = new Set(
        employerAssignments
          .filter(
            (a: any) =>
              Array.isArray(a.employers?.company_eba_records) &&
              a.employers.company_eba_records.some((eba: any) => eba.fwc_certified_date)
          )
          .map((a: any) => a.employer_id)
      ).size

      const totalsByProject: Record<string, { estimated: number[]; assigned: number[]; members: number[] }> = {}
      ;(preConstructionAssignments || []).forEach((assignment: any) => {
        const entry = (totalsByProject[assignment.project_id] ||= { estimated: [], assigned: [], members: [] })
        if (typeof assignment.estimated_worker_count === 'number') entry.estimated.push(assignment.estimated_worker_count)
        if (typeof assignment.assigned_worker_count === 'number') entry.assigned.push(assignment.assigned_worker_count)
        if (typeof assignment.organiser_worker_count === 'number') entry.members.push(assignment.organiser_worker_count)

        if (assignment.assignment_type === 'trade_work' && assignment.trade_types?.code) {
          const coreKey = mapTradeCodeToCore(assignment.trade_types.code)
          if (coreKey) {
            const projectSets = getOrCreateProjectCoreSet(projectCoreTradeEmployers, assignment.project_id)
            projectSets[coreKey].add(assignment.employer_id)

            const employer = normalizeEmployerField(assignment.employers)
            if (employerHasActiveEba(employer)) {
              const ebaSets = getOrCreateProjectCoreSet(projectCoreTradeEbaEmployers, assignment.project_id)
              ebaSets[coreKey].add(assignment.employer_id)
            }
          }
        }
      })

      const calcAverage = (values: number[]) => (values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0)
      const estimatedValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.estimated))
      const assignedValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.assigned))
      const memberValues = Object.values(totalsByProject).map((vals) => calcAverage(vals.members))

      preConstructionAvgEstimatedWorkers = calcAverage(estimatedValues)
      preConstructionAvgAssignedWorkers = calcAverage(assignedValues)
      preConstructionAvgMembers = calcAverage(memberValues)
    }

    // Global counts (head-only count for big tables)
    const [workersCount, employersCount, sitesCount, activitiesCount, ebasCount, membersCount, employerAnalytics] = await Promise.all([
      sb.from('workers').select('*', { count: 'exact', head: true }),
      sb.from('employers').select('*', { count: 'exact', head: true }),
      sb.from('job_sites').select('*', { count: 'exact', head: true }),
      sb.from('union_activities').select('*', { count: 'exact', head: true }),
      sb.from('company_eba_records').select('*', { count: 'exact', head: true }),
      sb.from('workers').select('*', { count: 'exact', head: true }).eq('union_membership_status', 'member'),
      sb.from('employer_analytics').select('*'),
    ])

    const totalWorkers = workersCount.count || 0
    const totalEmployers = employersCount.count || 0
    const totalSites = sitesCount.count || 0
    const totalActivities = activitiesCount.count || 0
    const totalEbas = ebasCount.count || 0
    const memberCount = membersCount.count || 0
    const ebaPercentage = totalEmployers ? (totalEbas / totalEmployers) * 100 : 0

    // EBA expiry rollups
    const { data: ebaRows } = await sb
      .from('company_eba_records')
      .select('nominal_expiry_date, fwc_certified_date, date_eba_signed, eba_lodged_fwc')
    const now = new Date()
    const sixWeeks = new Date(now.getTime() + 6 * 7 * 24 * 60 * 60 * 1000)
    const threeMonths = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000)
    const sixMonths = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000)
    const ebaExpiry = { expired: 0, expiring6Weeks: 0, expiring3Months: 0, expiring6Months: 0, certified: 0, signed: 0, lodged: 0 }
    ;(ebaRows || []).forEach((eba: any) => {
      if (eba.fwc_certified_date) ebaExpiry.certified++
      if (eba.date_eba_signed) ebaExpiry.signed++
      if (eba.eba_lodged_fwc) ebaExpiry.lodged++
      if (eba.nominal_expiry_date) {
        const expiry = new Date(eba.nominal_expiry_date)
        if (expiry < now) ebaExpiry.expired++
        else if (expiry <= sixWeeks) ebaExpiry.expiring6Weeks++
        else if (expiry <= threeMonths) ebaExpiry.expiring3Months++
        else if (expiry <= sixMonths) ebaExpiry.expiring6Months++
      }
    })

    const mappedEmployers = (employerAnalytics?.data || []).filter((e: any) => (e.estimated_worker_count || 0) > 0 && (e.current_worker_count || 0) > 0)
    const avgMemberDensity = mappedEmployers.length
      ? mappedEmployers.reduce((sum: number, emp: any) => sum + (emp.member_density_percent || 0), 0) / mappedEmployers.length
      : 0

    const aggregatedCoreTrades = createEmptyCoreTradeCounts()
    const aggregatedEbaCoreTrades = createEmptyCoreTradeCounts()

    for (const projectId of projectCoreTradeEmployers.keys()) {
      const employerSets = projectCoreTradeEmployers.get(projectId)!
      const counts = aggregateCoreTradeSets(employerSets)
      for (const key of Object.keys(counts) as CoreTradeKey[]) {
        aggregatedCoreTrades[key] += counts[key]
      }

      const ebaSets = projectCoreTradeEbaEmployers.get(projectId)
      if (ebaSets) {
        const ebaCounts = aggregateCoreTradeSets(ebaSets)
        for (const key of Object.keys(ebaCounts) as CoreTradeKey[]) {
          aggregatedEbaCoreTrades[key] += ebaCounts[key]
        }
      }
    }

    const response = {
      project_counts,
      active_construction: {
        total_projects: activeConstructionIds.length,
        total_builders,
        eba_builders,
        eba_builder_percentage: total_builders > 0 ? (eba_builders / total_builders) * 100 : 0,
        total_employers,
        eba_employers,
        eba_employer_percentage: total_employers > 0 ? (eba_employers / total_employers) * 100 : 0,
        core_trades: aggregatedCoreTrades,
        core_trades_eba: aggregatedEbaCoreTrades,
        projects_with_site_delegates: projectsWithSiteDelegates,
        projects_with_company_delegates: projectsWithCompanyDelegates,
        projects_with_hsrs: projectsWithHsrs,
        projects_with_hsr_chair_delegate: projectsWithHsrChairDelegate,
        projects_with_full_hs_committee: projectsWithFullHsCommittee,
        avg_estimated_workers,
        avg_assigned_workers,
        avg_members,
        financial_audit_activities,
      },
      active_pre_construction: {
        total_projects: activePreConstructionIds.length,
        total_builders: preConstructionBuilders,
        eba_builders: preConstructionEbaBuilders,
        eba_builder_percentage: preConstructionBuilders > 0 ? (preConstructionEbaBuilders / preConstructionBuilders) * 100 : 0,
        total_employers: preConstructionTotalEmployers,
        eba_employers: preConstructionEbaEmployers,
        eba_employer_percentage:
          preConstructionTotalEmployers > 0 ? (preConstructionEbaEmployers / preConstructionTotalEmployers) * 100 : 0,
        avg_estimated_workers: preConstructionAvgEstimatedWorkers,
        avg_assigned_workers: preConstructionAvgAssignedWorkers,
        avg_members: preConstructionAvgMembers,
      },
      projects: [], // Optional list, not needed by current UI
      errors: [],
      totals: {
        totalWorkers,
        totalEmployers,
        totalSites,
        totalActivities,
        totalEbas,
        memberCount,
        ebaPercentage,
        avgMemberDensity,
      },
      ebaExpiry,
      debug: { queryTime: Date.now() - startTime },
    }

    cache.set(cacheKey, response, 30_000)
    res.status(200).set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' }).json(response)
  } catch (err: any) {
    if (err?.message === 'Unauthorized') {
      return res.status(401).json({ error: 'Unauthorized' })
    }
    if (err?.message === 'Forbidden') {
      return res.status(403).json({ error: 'Forbidden' })
    }
    if (err?.message === 'profile_load_failed') {
      logger.error({ err }, 'Profile load failed for dashboard')
      return res.status(500).json({ error: 'Unable to load user profile' })
    }
    logger.error({ err }, 'Dashboard endpoint error')
    res.status(500).json({ error: 'Failed to fetch dashboard' })
  }
})

// Start server and schedule refreshes
app.listen(config.port, () => {
  logger.info({ port: config.port }, 'cfmeu-dashboard-worker listening')
  // Schedule materialized view refreshes
  scheduleMaterializedViewRefreshes(logger)
})



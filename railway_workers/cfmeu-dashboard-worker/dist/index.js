"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const pino_1 = __importDefault(require("pino"));
const config_1 = require("./config");
const supabase_1 = require("./supabase");
const refresh_1 = require("./refresh");
const cache_1 = require("./cache");
const crypto_1 = __importDefault(require("crypto"));
const logger = (0, pino_1.default)({ level: process.env.LOG_LEVEL || 'info' });
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((req, res, next) => {
    // Basic configurable CORS suitable for local dev; tighten for prod
    res.header('Access-Control-Allow-Origin', config_1.config.corsOrigin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS')
        return res.sendStatus(204);
    next();
});
app.get('/health', async (_req, res) => {
    try {
        // Lightweight check: ensure service client can reach DB
        const svc = (0, supabase_1.getServiceRoleClient)();
        const { error } = await svc
            .from('project_list_comprehensive_view')
            .select('*', { count: 'exact', head: true });
        if (error)
            throw error;
        res.status(200).json({ status: 'ok', time: new Date().toISOString() });
    }
    catch (err) {
        logger.error({ err }, 'Health check failed');
        res.status(503).json({ status: 'degraded' });
    }
});
// Utilities
function getBearerToken(req) {
    const auth = req.header('authorization') || req.header('Authorization');
    if (!auth)
        return null;
    const parts = auth.split(' ');
    if (parts.length === 2 && /^bearer$/i.test(parts[0]))
        return parts[1];
    return null;
}
function hashToken(token) {
    if (!token)
        return 'anon';
    return crypto_1.default.createHash('sha1').update(token).digest('hex').slice(0, 16);
}
// GET /v1/projects — mirrors Next.js /api/projects semantics, with caching
app.get('/v1/projects', async (req, res) => {
    const startTime = Date.now();
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    // Parse query params
    const page = Math.max(parseInt(String(req.query.page || '1'), 10), 1);
    const rawPageSize = Math.max(parseInt(String(req.query.pageSize || '24'), 10), 1);
    const pageSize = Math.min(rawPageSize, 100);
    const sort = String(req.query.sort || 'name');
    const dir = String(req.query.dir || 'asc');
    const q = (req.query.q ? String(req.query.q) : undefined)?.toLowerCase();
    const patchParam = req.query.patch ? String(req.query.patch) : undefined;
    const tier = String(req.query.tier || 'all');
    const universe = String(req.query.universe || 'all');
    const stage = String(req.query.stage || 'all');
    const workers = String(req.query.workers || 'all');
    const special = String(req.query.special || 'all');
    const eba = String(req.query.eba || 'all');
    const patchIds = patchParam ? patchParam.split(',').map((s) => s.trim()).filter(Boolean) : [];
    const cacheKey = (0, cache_1.makeCacheKey)('projects', hashToken(token), {
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
    });
    const cached = cache_1.cache.get(cacheKey);
    if (cached) {
        return res.status(200).set({ 'X-Cache': 'HIT' }).json(cached);
    }
    try {
        const sb = (0, supabase_1.getUserClientFromToken)(token);
        // Base query on materialized view
        let query = sb.from('project_list_comprehensive_view').select('*', { count: 'exact' });
        // Patch filtering via mapping view, with fallback
        let patchProjectCount = 0;
        let patchFilteringMethod = 'none';
        if (patchIds.length > 0) {
            let { data: patchProjects, error: viewError } = await sb
                .from('patch_project_mapping_view')
                .select('project_id')
                .in('patch_id', patchIds);
            let usedFallback = false;
            if (viewError) {
                logger.warn({ err: viewError }, 'patch_project_mapping_view error, falling back');
            }
            if (!patchProjects || patchProjects.length === 0) {
                const { data: fallbackData, error: fallbackError } = await sb
                    .from('job_sites')
                    .select('project_id')
                    .in('patch_id', patchIds)
                    .not('project_id', 'is', null);
                if (fallbackError)
                    throw fallbackError;
                patchProjects = fallbackData || [];
                usedFallback = true;
                // Best-effort background refresh using service client (won't block request)
                (0, refresh_1.refreshPatchProjectMappingViewInBackground)(logger);
            }
            patchProjectCount = patchProjects?.length || 0;
            patchFilteringMethod = usedFallback ? 'fallback_job_sites' : 'materialized_view';
            if (patchProjectCount === 0) {
                const response = {
                    projects: [],
                    summaries: {},
                    pagination: { page, pageSize, totalCount: 0, totalPages: 0 },
                    debug: {
                        queryTime: Date.now() - startTime,
                        cacheHit: false,
                        appliedFilters: { q, patchIds, tier, universe, stage, workers, special, eba, sort, dir },
                        patchProjectCount,
                        patchFilteringUsed: true,
                        patchFilteringMethod,
                    },
                };
                cache_1.cache.set(cacheKey, response, 30000);
                return res
                    .status(200)
                    .set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' })
                    .json(response);
            }
            const projectIds = Array.from(new Set((patchProjects || []).map((r) => r.project_id)));
            if (projectIds.length > 0) {
                query = query.in('id', projectIds);
            }
        }
        // Text search
        if (q)
            query = query.ilike('search_text', `%${q}%`);
        // Filters
        if (tier !== 'all')
            query = query.eq('tier', tier);
        if (universe !== 'all')
            query = query.eq('organising_universe', universe);
        if (stage !== 'all')
            query = query.eq('stage_class', stage);
        // Workers filter using pre-computed columns
        if (workers === 'zero')
            query = query.eq('total_workers', 0);
        else if (workers === 'nonzero')
            query = query.gt('total_workers', 0);
        // Special filter
        if (special === 'noBuilderWithEmployers') {
            query = query.eq('has_builder', false).gt('engaged_employer_count', 0);
        }
        // EBA filter
        if (eba !== 'all') {
            if (eba === 'eba_active')
                query = query.eq('has_builder', true).eq('builder_has_eba', true);
            else if (eba === 'eba_inactive')
                query = query.eq('has_builder', true).eq('builder_has_eba', false);
            else if (eba === 'builder_unknown')
                query = query.eq('has_builder', false);
        }
        // Sorting
        const summarySorts = new Set(['workers', 'members', 'delegates', 'eba_coverage', 'employers']);
        if (!summarySorts.has(sort)) {
            if (sort === 'name')
                query = query.order('name', { ascending: dir === 'asc' });
            else if (sort === 'value')
                query = query.order('value', { ascending: dir === 'asc', nullsFirst: false });
            else if (sort === 'tier')
                query = query.order('tier', { ascending: dir === 'asc', nullsFirst: false });
            else
                query = query.order('created_at', { ascending: false });
        }
        else {
            if (sort === 'workers')
                query = query.order('total_workers', { ascending: dir === 'asc' });
            else if (sort === 'members')
                query = query.order('total_members', { ascending: dir === 'asc' });
            else if (sort === 'employers')
                query = query.order('engaged_employer_count', { ascending: dir === 'asc' });
            else if (sort === 'eba_coverage')
                query = query.order('eba_coverage_percent', { ascending: dir === 'asc' });
            else if (sort === 'delegates')
                query = query.order('delegate_name', { ascending: dir === 'asc', nullsFirst: dir === 'desc' });
        }
        // Pagination
        const from = (page - 1) * pageSize;
        const to = from + pageSize - 1;
        query = query.range(from, to);
        const { data, error, count } = await query;
        if (error)
            throw error;
        // Transform to client shapes
        const projects = (data || []).map((row) => ({
            id: row.id,
            name: row.name,
            main_job_site_id: row.main_job_site_id,
            value: row.value,
            tier: row.tier,
            organising_universe: row.organising_universe,
            stage_class: row.stage_class,
            full_address: row.full_address,
            project_assignments: row.project_assignments_data || [],
        }));
        const summaries = {};
        (data || []).forEach((row) => {
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
            };
        });
        const totalCount = count || 0;
        const totalPages = Math.ceil(totalCount / pageSize);
        const queryTime = Date.now() - startTime;
        const response = {
            projects,
            summaries,
            pagination: { page, pageSize, totalCount, totalPages },
            debug: {
                queryTime,
                cacheHit: false,
                appliedFilters: { q, patchIds, tier, universe, stage, workers, special, eba, sort, dir },
                patchProjectCount,
                patchFilteringUsed: patchIds.length > 0,
                patchFilteringMethod,
            },
        };
        cache_1.cache.set(cacheKey, response, 30000);
        res
            .status(200)
            .set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' })
            .json(response);
    }
    catch (err) {
        logger.error({ err }, 'Projects endpoint error');
        res.status(500).json({ error: 'Failed to fetch projects' });
    }
});
// GET /v1/dashboard — aggregated dashboard metrics with short TTL caching
app.get('/v1/dashboard', async (req, res) => {
    const startTime = Date.now();
    const token = getBearerToken(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const tier = (req.query.tier ? String(req.query.tier) : undefined) || undefined;
    const stage = (req.query.stage ? String(req.query.stage) : undefined) || undefined;
    const universe = (req.query.universe ? String(req.query.universe) : undefined) || undefined;
    const rawPatch = req.query.patchIds ? String(req.query.patchIds) : undefined;
    const patchIds = rawPatch ? rawPatch.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    const cacheKey = (0, cache_1.makeCacheKey)('dashboard', hashToken(token), { tier, stage, universe, patchIds });
    const cached = cache_1.cache.get(cacheKey);
    if (cached) {
        return res.status(200).set({ 'X-Cache': 'HIT' }).json(cached);
    }
    try {
        const sb = (0, supabase_1.getUserClientFromToken)(token);
        // Optional scoping: patch -> project ids (using mapping view, fallback if needed)
        let scopedProjectIds = null;
        if (patchIds && patchIds.length > 0) {
            let { data: patchProjects } = await sb
                .from('patch_project_mapping_view')
                .select('project_id')
                .in('patch_id', patchIds);
            if (!patchProjects || patchProjects.length === 0) {
                const { data: fallbackData, error: fbErr } = await sb
                    .from('job_sites')
                    .select('project_id')
                    .in('patch_id', patchIds)
                    .not('project_id', 'is', null);
                if (fbErr)
                    throw fbErr;
                patchProjects = fallbackData || [];
            }
            scopedProjectIds = Array.from(new Set((patchProjects || []).map((r) => r.project_id).filter(Boolean)));
        }
        // Base projects for counts, filtered by patch/tier/stage/universe if provided
        let projectsQuery = sb.from('projects').select('id, organising_universe, stage_class, tier');
        if (scopedProjectIds && scopedProjectIds.length > 0)
            projectsQuery = projectsQuery.in('id', scopedProjectIds);
        if (tier && tier !== 'all')
            projectsQuery = projectsQuery.eq('tier', tier);
        if (universe && universe !== 'all')
            projectsQuery = projectsQuery.eq('organising_universe', universe);
        if (stage && stage !== 'all')
            projectsQuery = projectsQuery.eq('stage_class', stage);
        const { data: projects, error: projectsError } = await projectsQuery;
        if (projectsError)
            throw projectsError;
        const projectRows = (projects || []);
        // Project counts by organizing_universe + stage_class
        const counts = {};
        for (const p of projectRows) {
            const key = `${p.organising_universe || 'excluded'}_${p.stage_class || 'archived'}`;
            counts[key] = (counts[key] || 0) + 1;
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
        };
        // Active construction builder metrics
        const activeConstructionIds = projectRows
            .filter((p) => p.organising_universe === 'active' && p.stage_class === 'construction')
            .map((p) => p.id);
        let total_builders = 0;
        let eba_builders = 0;
        if (activeConstructionIds.length > 0) {
            const { data: activeBuilders } = await sb
                .from('project_assignments')
                .select('employer_id, employers!inner(id, company_eba_records(id, fwc_certified_date))')
                .eq('assignment_type', 'contractor_role')
                .in('project_id', activeConstructionIds);
            const uniqueBuilders = new Set((activeBuilders || []).map((b) => b.employer_id));
            total_builders = uniqueBuilders.size;
            eba_builders = (activeBuilders || []).filter((b) => b.employers?.company_eba_records?.length > 0).length;
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
        ]);
        const totalWorkers = workersCount.count || 0;
        const totalEmployers = employersCount.count || 0;
        const totalSites = sitesCount.count || 0;
        const totalActivities = activitiesCount.count || 0;
        const totalEbas = ebasCount.count || 0;
        const memberCount = membersCount.count || 0;
        const ebaPercentage = totalEmployers ? (totalEbas / totalEmployers) * 100 : 0;
        // EBA expiry rollups
        const { data: ebaRows } = await sb
            .from('company_eba_records')
            .select('nominal_expiry_date, fwc_certified_date, date_eba_signed, eba_lodged_fwc');
        const now = new Date();
        const sixWeeks = new Date(now.getTime() + 6 * 7 * 24 * 60 * 60 * 1000);
        const threeMonths = new Date(now.getTime() + 3 * 30 * 24 * 60 * 60 * 1000);
        const sixMonths = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
        const ebaExpiry = { expired: 0, expiring6Weeks: 0, expiring3Months: 0, expiring6Months: 0, certified: 0, signed: 0, lodged: 0 };
        (ebaRows || []).forEach((eba) => {
            if (eba.fwc_certified_date)
                ebaExpiry.certified++;
            if (eba.date_eba_signed)
                ebaExpiry.signed++;
            if (eba.eba_lodged_fwc)
                ebaExpiry.lodged++;
            if (eba.nominal_expiry_date) {
                const expiry = new Date(eba.nominal_expiry_date);
                if (expiry < now)
                    ebaExpiry.expired++;
                else if (expiry <= sixWeeks)
                    ebaExpiry.expiring6Weeks++;
                else if (expiry <= threeMonths)
                    ebaExpiry.expiring3Months++;
                else if (expiry <= sixMonths)
                    ebaExpiry.expiring6Months++;
            }
        });
        const mappedEmployers = (employerAnalytics?.data || []).filter((e) => (e.estimated_worker_count || 0) > 0 && (e.current_worker_count || 0) > 0);
        const avgMemberDensity = mappedEmployers.length
            ? mappedEmployers.reduce((sum, emp) => sum + (emp.member_density_percent || 0), 0) / mappedEmployers.length
            : 0;
        const response = {
            project_counts,
            active_construction: {
                total_builders,
                eba_builders,
            },
            active_pre_construction: {
                avg_members: 0, // Placeholder; compute when needed
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
        };
        cache_1.cache.set(cacheKey, response, 30000);
        res.status(200).set({ 'Cache-Control': 'public, max-age=30', 'X-Cache': 'MISS' }).json(response);
    }
    catch (err) {
        logger.error({ err }, 'Dashboard endpoint error');
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
});
// Start server and schedule refreshes
app.listen(config_1.config.port, () => {
    logger.info({ port: config_1.config.port }, 'cfmeu-dashboard-worker listening');
    // Schedule materialized view refreshes
    (0, refresh_1.scheduleMaterializedViewRefreshes)(logger);
});

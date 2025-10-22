"use client"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export type PatchKpis = {
  members: { current: number; goal: number }
  dd: { current: number; goal: number }
  leaders: { current: number; goal: number }
  openAudits: number
}

export type PatchRow = {
  id: string
  site: string
  project: string
  employers: number
  members: { current: number; goal: number }
  dd: { current: number; goal: number }
  leadersScore: number
  lastVisit?: string
}

export function usePatchDashboard(patchId?: string) {
  return useQuery<{ kpis: PatchKpis; rows: PatchRow[] }>({
    queryKey: ["patch-dashboard", patchId || "default"],
    queryFn: async () => {
      // OPTIMIZATION: Resolve user and sites in parallel
      const [authResult, sitesResult] = await Promise.all([
        supabase.auth.getUser(),
        patchId
          ? supabase
              .from('patch_job_sites')
              .select('job_sites:job_site_id(id,name,location,project_id)')
              .is('effective_to', null)
              .eq('patch_id', patchId)
          : Promise.resolve({ data: null })
      ])

      const userId = authResult.data?.user?.id

      // Get scoped sites if user exists
      let scopedSites: string[] = []
      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('scoped_sites').eq('id', userId).single()
        scopedSites = (prof as any)?.scoped_sites || []
      }

      // Resolve target site ids based on patch selection and/or legacy field
      let sites: any[] = []
      if (patchId && sitesResult.data) {
        const list = ((sitesResult.data as any[]) || []).map(r => (r as any).job_sites).filter(Boolean)
        sites = list
      }
      // If no patch selected, fallback: direct query of job_sites only
      if (!patchId && sites.length === 0) {
        let sitesQuery: any = supabase.from('job_sites').select('id,name,location,project_id')
        if (scopedSites.length > 0) sitesQuery = sitesQuery.in('id', scopedSites)
        const { data: sitesRaw, error: sitesErr } = await sitesQuery
        if (sitesErr) throw sitesErr
        sites = (sitesRaw as any[]) || []
      }
      // Apply organiser scoping if present
      if (scopedSites.length > 0) {
        const allowed = new Set(scopedSites)
        sites = sites.filter((s: any) => allowed.has(s.id))
      }
      const siteIds = sites.map(s => s.id)

      // OPTIMIZATION: Parallelize all site-dependent queries
      const projectIds = Array.from(new Set(sites.map(s => s.project_id).filter(Boolean)))

      const [projectsResult, placementsResult, rolesResult, visitsResult, campaignsResult, kpiDefsResult] = await Promise.all([
        // Projects lookup
        projectIds.length > 0
          ? supabase.from('projects').select('id,name').in('id', projectIds)
          : Promise.resolve({ data: [] }),

        // Worker placements with workers
        siteIds.length > 0
          ? supabase
              .from('worker_placements')
              .select('job_site_id, employer_id, worker_id, workers!inner(id, union_membership_status)')
              .in('job_site_id', siteIds)
          : Promise.resolve({ data: [] }),

        // Union roles per site
        siteIds.length > 0
          ? supabase
              .from('union_roles')
              .select('job_site_id, name')
              .in('job_site_id', siteIds)
          : Promise.resolve({ data: [] }),

        // Last site visits
        siteIds.length > 0
          ? supabase
              .from('site_visit')
              .select('id, job_site_id, date')
              .in('job_site_id', siteIds)
              .order('date', { ascending: false })
          : Promise.resolve({ data: [] }),

        // Active campaign (independent of sites)
        supabase
          .from('campaigns')
          .select('id, status, start_date')
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(1),

        // KPI definitions (independent of sites)
        supabase.from('kpi_definitions').select('id, code')
      ])

      let projectNameById: Record<string, string> = {}
      ;(projectsResult.data as any[] || []).forEach(p => { projectNameById[p.id] = p.name })

      const placements = (placementsResult.data as any[]) || []
      const roles = (rolesResult.data as any[]) || []
      const visits = (visitsResult.data as any[]) || []

      // Aggregate per site
      const leaderRoleSet = new Set([ 'site_delegate', 'shift_delegate', 'company_delegate', 'hsr' ])
      const lastVisitBySite: Record<string, { id: string; date: string }> = {}
      visits.forEach(v => { if (!lastVisitBySite[v.job_site_id]) lastVisitBySite[v.job_site_id] = { id: v.id, date: v.date } })

      // Process campaign and KPI definitions (already fetched in parallel)
      const activeCampaignId = (campaignsResult.data as any[])?.length ? (campaignsResult.data as any[])[0].id : null
      const defs = (kpiDefsResult.data as any[]) || []
      const codeMatches = (codes: string[]) => defs.filter(d => codes.some(c => String(d.code).toLowerCase().includes(c)))
      let kpiIdByKind: { members?: string[]; dd?: string[]; leaders?: string[] } = {
        members: codeMatches(['membership','membership_joins']).map(d => d.id),
        dd: codeMatches(['dd','direct_debit','dd_conversion']).map(d => d.id),
        leaders: codeMatches(['leaders','delegates_hsr','delegate','hsr']).map(d => d.id)
      }

      // OPTIMIZATION: Fetch worker memberships and targets in parallel
      const workerIds = Array.from(new Set(placements.map(p => p.worker_id).filter(Boolean)))

      const [wmPluralResult, wmSingResult, targetsResult] = await Promise.all([
        // Worker memberships (try plural table name)
        workerIds.length > 0
          ? supabase
              .from('worker_memberships')
              .select('worker_id, payment_method')
              .in('worker_id', workerIds)
          : Promise.resolve({ data: null, error: null }),

        // Worker membership (try singular table name as fallback)
        workerIds.length > 0
          ? supabase
              .from('worker_membership')
              .select('worker_id, payment_method')
              .in('worker_id', workerIds)
          : Promise.resolve({ data: null, error: null }),

        // KPI targets
        activeCampaignId && siteIds.length > 0 && (kpiIdByKind.members?.length || kpiIdByKind.dd?.length || kpiIdByKind.leaders?.length)
          ? (() => {
              let tq = supabase
                .from('kpi_targets')
                .select('job_site_id, kpi_id, target_value')
                .eq('campaign_id', activeCampaignId)
                .in('job_site_id', siteIds)
              if (userId) tq = tq.eq('organiser_id', userId)
              return tq
            })()
          : Promise.resolve({ data: [] })
      ])

      // Process worker memberships (prefer plural, fallback to singular)
      let ddByWorkerId: Record<string, string> = {}
      const wm = !wmPluralResult.error ? wmPluralResult.data : wmSingResult.data
      if (wm) {
        ;(wm as any[]).forEach(r => { if (!(r.worker_id in ddByWorkerId)) ddByWorkerId[r.worker_id] = r.payment_method })
      }

      // Process targets
      type TargetRow = { job_site_id: string; kpi_id: string; target_value: number }
      const targetsBySite: Record<string, { members: number; dd: number; leaders: number }> = {}
      if (activeCampaignId) {
        for (const s of siteIds) targetsBySite[s] = { members: 0, dd: 0, leaders: 0 }
        const list = (targetsResult.data as TargetRow[] | null) || []
        list.forEach(row => {
          const bucket = targetsBySite[row.job_site_id] || (targetsBySite[row.job_site_id] = { members: 0, dd: 0, leaders: 0 })
          if (kpiIdByKind.members?.includes(row.kpi_id)) bucket.members += Number(row.target_value || 0)
          if (kpiIdByKind.dd?.includes(row.kpi_id)) bucket.dd += Number(row.target_value || 0)
          if (kpiIdByKind.leaders?.includes(row.kpi_id)) bucket.leaders += Number(row.target_value || 0)
        })
      }

      // OPTIMIZATION: Batch all open issues queries for all sites
      const openIssuesBySite: Record<string, number> = {}
      const visitIds = sites.map(s => lastVisitBySite[s.id]?.id).filter(Boolean)

      if (visitIds.length > 0) {
        // Fetch all assessments and audits for all visits in parallel
        const [assPluralResult, assSingResult, entResult] = await Promise.all([
          supabase.from('whs_assesment').select('id, site_visit_id').in('site_visit_id', visitIds),
          supabase.from('whs_assessment').select('id, site_visit_id').in('site_visit_id', visitIds),
          supabase.from('entitlements_audit').select('*, site_visit_id').in('site_visit_id', visitIds),
        ])

        // Use whichever assessment table exists
        const assessments = (assPluralResult.data as any[]) || (assSingResult.data as any[]) || []
        const assIds = assessments.map((a: any) => a.id)

        // Map assessments to visit IDs
        const assessmentsByVisit: Record<string, string[]> = {}
        assessments.forEach((a: any) => {
          if (!assessmentsByVisit[a.site_visit_id]) assessmentsByVisit[a.site_visit_id] = []
          assessmentsByVisit[a.site_visit_id].push(a.id)
        })

        // Fetch all breaches in parallel if we have assessments
        let breachesByAssessment: Record<string, number> = {}
        if (assIds.length > 0) {
          const [brAssesmentResult, brAssessmentResult] = await Promise.all([
            supabase.from('whs_breach').select('id, whs_assesment_id').in('whs_assesment_id', assIds),
            supabase.from('whs_breach').select('id, whs_assessment_id').in('whs_assessment_id', assIds),
          ])

          const breaches = (brAssesmentResult.data as any[]) || (brAssessmentResult.data as any[]) || []
          breaches.forEach((b: any) => {
            const assId = b.whs_assesment_id || b.whs_assessment_id
            breachesByAssessment[assId] = (breachesByAssessment[assId] || 0) + 1
          })
        }

        // Process entitlements audits
        const entRows = (entResult.data as any[]) || []
        const entIssuesByVisit: Record<string, number> = {}
        entRows.forEach((r: any) => {
          const flags = [
            'supe_paid',
            'super_paid_to_fund',
            'reducndancy_contributions_up_to_date',
            'wages_correct',
            'eba_allowances_correct',
          ]
          let count = 0
          flags.forEach((k) => {
            if (k in r && typeof r[k] === 'boolean' && r[k] === false) count += 1
          })
          entIssuesByVisit[r.site_visit_id] = (entIssuesByVisit[r.site_visit_id] || 0) + count
        })

        // Calculate total issues per site
        for (const s of sites) {
          const lv = lastVisitBySite[s.id]
          let openIssues = 0
          if (lv?.id) {
            const visitId = lv.id
            // Count breaches from assessments
            const siteAssIds = assessmentsByVisit[visitId] || []
            siteAssIds.forEach(assId => {
              openIssues += breachesByAssessment[assId] || 0
            })
            // Add entitlement issues
            openIssues += entIssuesByVisit[visitId] || 0
          }
          openIssuesBySite[s.id] = openIssues
        }
      } else {
        // No visits, all sites have 0 issues
        sites.forEach(s => { openIssuesBySite[s.id] = 0 })
      }

      const rows: PatchRow[] = sites.map(s => {
        const sitePlacements = placements.filter(p => p.job_site_id === s.id)
        const employerSet = new Set(sitePlacements.map(p => p.employer_id).filter(Boolean))
        const membersCurrent = sitePlacements.filter(p => p.workers?.union_membership_status === 'member').length
        const siteRoles = roles.filter(r => r.job_site_id === s.id)
        const leadersCurrent = siteRoles.filter(r => leaderRoleSet.has(r.name)).length
        const leadersScore = leadersCurrent // Placeholder score = count; can be replaced with breadth/depth calc
        const ddCurrent = sitePlacements.filter(p => ddByWorkerId[p.worker_id] === 'direct_debit').length
        const goals = targetsBySite[s.id] || { members: 0, dd: 0, leaders: 0 }
        const lv = lastVisitBySite[s.id]
        return {
          id: s.id,
          site: s.name,
          project: projectNameById[s.project_id] || '—',
          employers: employerSet.size,
          members: { current: membersCurrent, goal: goals.members },
          dd: { current: ddCurrent, goal: goals.dd },
          leadersScore,
          lastVisit: lv?.date,
        }
      })

      // Top-level KPIs (deduplicated across sites)
      const uniqueMemberIds = new Set<string>(
        placements
          .filter(p => p.workers?.union_membership_status === 'member')
          .map(p => String(p.worker_id))
      )
      const totalMembers = uniqueMemberIds.size
      const totalMembersGoal = rows.reduce((sum, r) => sum + r.members.goal, 0)
      const totalLeaders = roles.filter(r => leaderRoleSet.has(r.name)).length
      const totalLeadersGoal = rows.reduce((sum, r) => sum + (targetsBySite[r.id]?.leaders || 0), 0)
      const uniqueDdIds = new Set<string>(
        placements
          .filter(p => ddByWorkerId[p.worker_id] === 'direct_debit')
          .map(p => String(p.worker_id))
      )
      const totalDd = uniqueDdIds.size
      const totalDdGoal = rows.reduce((sum, r) => sum + r.dd.goal, 0)
      const totalOpenIssues = sites.reduce((sum, s) => sum + (openIssuesBySite[s.id] || 0), 0)
      const kpis: PatchKpis = {
        members: { current: totalMembers, goal: totalMembersGoal },
        dd: { current: totalDd, goal: totalDdGoal },
        leaders: { current: totalLeaders, goal: totalLeadersGoal },
        openAudits: totalOpenIssues,
      }
      return { kpis, rows }
    }
  })
}

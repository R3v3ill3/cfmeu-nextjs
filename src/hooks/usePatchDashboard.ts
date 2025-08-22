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
      // Resolve current user and optional site scoping
      const { data: auth } = await supabase.auth.getUser()
      const userId = auth?.user?.id
      let scopedSites: string[] = []
      if (userId) {
        const { data: prof } = await supabase.from('profiles').select('scoped_sites').eq('id', userId).single()
        scopedSites = (prof as any)?.scoped_sites || []
      }

      // Resolve target site ids based on patch selection and/or legacy field
      let sites: any[] = []
      // If a patch id is provided, collect sites strictly from patch mappings
      if (patchId) {
        try {
          const { data: mappedSites } = await supabase
            .from('patch_job_sites')
            .select('job_sites:job_site_id(id,name,location,project_id)')
            .is('effective_to', null)
            .eq('patch_id', patchId)
          const list = ((mappedSites as any[]) || []).map(r => (r as any).job_sites).filter(Boolean)
          sites = list
        } catch {}
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

      // Map project names
      const projectIds = Array.from(new Set(sites.map(s => s.project_id).filter(Boolean)))
      let projectNameById: Record<string, string> = {}
      if (projectIds.length > 0) {
        const { data: projects } = await supabase.from('projects').select('id,name').in('id', projectIds)
        ;(projects as any[] || []).forEach(p => { projectNameById[p.id] = p.name })
      }

      // Worker placements with workers to compute members and employer counts
      let placements: any[] = []
      if (siteIds.length > 0) {
        const { data: pl } = await supabase
          .from('worker_placements')
          .select('job_site_id, employer_id, worker_id, workers!inner(id, union_membership_status)')
          .in('job_site_id', siteIds)
        placements = (pl as any[]) || []
      }

      // Union roles per site for leaders score
      let roles: any[] = []
      if (siteIds.length > 0) {
        const { data: rls } = await supabase
          .from('union_roles')
          .select('job_site_id, name')
          .in('job_site_id', siteIds)
        roles = (rls as any[]) || []
      }

      // Last site visit per site (capture id and date)
      let visits: any[] = []
      if (siteIds.length > 0) {
        const { data: vs } = await supabase
          .from('site_visit')
          .select('id, job_site_id, date')
          .in('job_site_id', siteIds)
          .order('date', { ascending: false })
        visits = (vs as any[]) || []
      }

      // Aggregate per site
      const leaderRoleSet = new Set([ 'site_delegate', 'shift_delegate', 'company_delegate', 'hsr' ])
      const lastVisitBySite: Record<string, { id: string; date: string }> = {}
      visits.forEach(v => { if (!lastVisitBySite[v.job_site_id]) lastVisitBySite[v.job_site_id] = { id: v.id, date: v.date } })

      // Fetch worker membership (DD) for placed workers in scope
      let ddByWorkerId: Record<string, string> = {}
      const workerIds = Array.from(new Set(placements.map(p => p.worker_id).filter(Boolean)))
      if (workerIds.length > 0) {
        // Prefer plural table name; fallback to singular if needed
        let wm: any[] | null = null
        let err: any = null
        const { data: wmPlural, error: wmPluralErr } = await supabase
          .from('worker_memberships')
          .select('worker_id, payment_method')
          .in('worker_id', workerIds)
        if (!wmPluralErr) { wm = wmPlural as any[] } else { err = wmPluralErr }
        if (!wm) {
          const { data: wmSing, error: wmSingErr } = await supabase
            .from('worker_membership')
            .select('worker_id, payment_method')
            .in('worker_id', workerIds)
          if (!wmSingErr) wm = wmSing as any[]
          else err = wmSingErr
        }
        if (wm) {
          wm.forEach(r => { if (!(r.worker_id in ddByWorkerId)) ddByWorkerId[r.worker_id] = r.payment_method })
        } else if (err) {
          // tolerate absence; DD metrics will be zero
        }
      }

      // Determine active campaign for goals
      let activeCampaignId: string | null = null
      {
        const { data: campaigns } = await supabase
          .from('campaigns')
          .select('id, status, start_date')
          .eq('status', 'active')
          .order('start_date', { ascending: false })
          .limit(1)
        if ((campaigns as any[])?.length) activeCampaignId = (campaigns as any[])[0].id
      }

      // Resolve KPI codes → ids
      const desiredCodes = [ 'membership', 'membership_joins', 'dd', 'direct_debit', 'dd_conversion', 'leaders', 'delegates_hsr' ]
      let kpiIdByKind: { members?: string[]; dd?: string[]; leaders?: string[] } = {}
      {
        const { data: allDefs } = await supabase
          .from('kpi_definitions')
          .select('id, code')
        const defs = (allDefs as any[]) || []
        const codeMatches = (codes: string[]) => defs.filter(d => codes.some(c => String(d.code).toLowerCase().includes(c)))
        kpiIdByKind.members = codeMatches(['membership','membership_joins']).map(d => d.id)
        kpiIdByKind.dd = codeMatches(['dd','direct_debit','dd_conversion']).map(d => d.id)
        kpiIdByKind.leaders = codeMatches(['leaders','delegates_hsr','delegate','hsr']).map(d => d.id)
      }

      // Load targets scoped by campaign, organiser, and site
      type TargetRow = { job_site_id: string; kpi_id: string; target_value: number }
      const targetsBySite: Record<string, { members: number; dd: number; leaders: number }> = {}
      if (activeCampaignId && siteIds.length > 0 && (kpiIdByKind.members?.length || kpiIdByKind.dd?.length || kpiIdByKind.leaders?.length)) {
        let tq = supabase
          .from('kpi_targets')
          .select('job_site_id, kpi_id, target_value')
          .eq('campaign_id', activeCampaignId)
          .in('job_site_id', siteIds)
        if (userId) tq = tq.eq('organiser_id', userId)
        const { data: tRows } = await tq
        const list = (tRows as TargetRow[] | null) || []
        for (const s of siteIds) targetsBySite[s] = { members: 0, dd: 0, leaders: 0 }
        list.forEach(row => {
          const bucket = targetsBySite[row.job_site_id] || (targetsBySite[row.job_site_id] = { members: 0, dd: 0, leaders: 0 })
          if (kpiIdByKind.members?.includes(row.kpi_id)) bucket.members += Number(row.target_value || 0)
          if (kpiIdByKind.dd?.includes(row.kpi_id)) bucket.dd += Number(row.target_value || 0)
          if (kpiIdByKind.leaders?.includes(row.kpi_id)) bucket.leaders += Number(row.target_value || 0)
        })
      }

      // Preload open issues for each site's last visit to avoid await inside map
      const openIssuesBySite: Record<string, number> = {}
      for (const s of sites) {
        const lv = lastVisitBySite[s.id]
        let openIssues = 0
        if (lv?.id) {
          const visitId = lv.id
          // Load WHS assessment (handle schema name variance)
          const [assPlural, assSing, entRes] = await Promise.all([
            supabase.from('whs_assesment').select('id').eq('site_visit_id', visitId),
            supabase.from('whs_assessment').select('id').eq('site_visit_id', visitId),
            supabase.from('entitlements_audit').select('*').eq('site_visit_id', visitId),
          ])
          const assIds = (((assPlural as any).data as any[]) || ((assSing as any).data as any[]) || []).map((a: any) => a.id)
          if (assIds.length > 0) {
            // Try both FK column spellings
            const [brAssesment, brAssessment] = await Promise.all([
              supabase.from('whs_breach').select('id').in('whs_assesment_id', assIds),
              supabase.from('whs_breach').select('id').in('whs_assessment_id', assIds),
            ])
            const countA = (((brAssesment as any).data as any[]) || []).length
            const countB = (((brAssessment as any).data as any[]) || []).length
            openIssues += Math.max(countA, countB)
          }
          const entRows = (((entRes as any).data as any[]) || [])
          for (const r of entRows) {
            const flags = [
              'supe_paid',
              'super_paid_to_fund',
              'reducndancy_contributions_up_to_date',
              'wages_correct',
              'eba_allowances_correct',
            ]
            flags.forEach((k) => {
              if (k in r && typeof r[k] === 'boolean' && r[k] === false) openIssues += 1
            })
          }
        }
        openIssuesBySite[s.id] = openIssues
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

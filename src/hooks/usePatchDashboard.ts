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

      // Load job sites (scoped if provided)
      let sitesQuery = supabase.from('job_sites').select('id,name,location,project_id')
      if (scopedSites.length > 0) {
        sitesQuery = sitesQuery.in('id', scopedSites)
      }
      const { data: sitesRaw, error: sitesErr } = await sitesQuery
      if (sitesErr) throw sitesErr
      const sites = (sitesRaw as any[]) || []
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
          .select('job_site_id, employer_id, workers!inner(union_membership_status)')
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

      // Last site visit per site
      let visits: any[] = []
      if (siteIds.length > 0) {
        const { data: vs } = await supabase
          .from('site_visit')
          .select('job_site_id, date')
          .in('job_site_id', siteIds)
          .order('date', { ascending: false })
        visits = (vs as any[]) || []
      }

      // Aggregate per site
      const leaderRoleSet = new Set([ 'site_delegate', 'shift_delegate', 'company_delegate', 'hsr' ])
      const lastVisitBySite: Record<string, string> = {}
      visits.forEach(v => { if (!lastVisitBySite[v.job_site_id]) lastVisitBySite[v.job_site_id] = v.date })

      const rows: PatchRow[] = sites.map(s => {
        const sitePlacements = placements.filter(p => p.job_site_id === s.id)
        const employerSet = new Set(sitePlacements.map(p => p.employer_id).filter(Boolean))
        const membersCurrent = sitePlacements.filter(p => p.workers?.union_membership_status === 'member').length
        const siteRoles = roles.filter(r => r.job_site_id === s.id)
        const leadersCurrent = siteRoles.filter(r => leaderRoleSet.has(r.name)).length
        const leadersScore = leadersCurrent // Placeholder score = count; can be replaced with breadth/depth calc
        return {
          id: s.id,
          site: s.name,
          project: projectNameById[s.project_id] || '—',
          employers: employerSet.size,
          members: { current: membersCurrent, goal: 0 },
          dd: { current: 0, goal: 0 },
          leadersScore,
          lastVisit: lastVisitBySite[s.id],
        }
      })

      // Top-level KPIs
      const totalMembers = rows.reduce((sum, r) => sum + r.members.current, 0)
      const totalLeaders = roles.filter(r => leaderRoleSet.has(r.name)).length
      const kpis: PatchKpis = {
        members: { current: totalMembers, goal: 0 },
        dd: { current: 0, goal: 0 },
        leaders: { current: totalLeaders, goal: 0 },
        openAudits: 0,
      }
      return { kpis, rows }
    }
  })
}

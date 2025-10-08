import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"

export type KeyTradeCode = 'demolition' | 'piling' | 'concreting' | 'form_work' | 'scaffolding' | 'tower_crane' | 'mobile_crane'

export interface TradeMetric {
  code: KeyTradeCode
  label: string
  totalProjects: number
  knownEmployers: number
  ebaEmployers: number
}

export interface KeyContractorTradeMetricsOptions {
  patchIds?: string[]
  tier?: string
  stage?: string
  universe?: string
}

const TRADE_LABEL: Record<KeyTradeCode, string> = {
  demolition: 'Demolition',
  piling: 'Piling',
  concreting: 'Concreting',
  form_work: 'Form work',
  scaffolding: 'Scaffold',
  tower_crane: 'Tower crane',
  mobile_crane: 'Mobile crane',
}

export function useKeyContractorTradeMetrics(opts: KeyContractorTradeMetricsOptions = {}) {
  return useQuery<{ trades: TradeMetric[] }>({
    queryKey: ['key-contractor-trade-metrics', opts],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      // Determine project scope
      let projectIds: string[] | null = null
      if (opts.patchIds && opts.patchIds.length > 0) {
        const { data: js } = await supabase
          .from('job_sites')
          .select('project_id')
          .in('patch_id', opts.patchIds)
          .not('project_id', 'is', null)
        projectIds = Array.from(new Set(((js as any[]) || []).map(r => r.project_id).filter(Boolean)))
      }

      // Base project filter
      let projectsQuery = supabase
        .from('projects')
        .select('id, organising_universe, stage_class, tier')

      if (projectIds && projectIds.length > 0) projectsQuery = projectsQuery.in('id', projectIds)
      if (opts.tier && opts.tier !== 'all') projectsQuery = projectsQuery.eq('tier', opts.tier)
      if (opts.universe && opts.universe !== 'all') projectsQuery = projectsQuery.eq('organising_universe', opts.universe)
      if (opts.stage && opts.stage !== 'all') projectsQuery = projectsQuery.eq('stage_class', opts.stage)

      const { data: projects } = await projectsQuery
      const scopedIds = new Set(((projects as any[]) || []).map(p => p.id))

      // For each key trade, compute totals
      const tradeCodes: KeyTradeCode[] = ['demolition', 'piling', 'concreting', 'form_work', 'scaffolding', 'tower_crane', 'mobile_crane']
      const TRADE_ALIASES: Partial<Record<KeyTradeCode, string[]>> = {
        concreting: ['concreting', 'concrete'],
        form_work: ['form_work', 'formwork'],
      }
      const results: TradeMetric[] = []

      // Fetch contractor trades joined to projects via sites
      const { data: sct } = await supabase
        .from('site_contractor_trades')
        .select('job_site_id, trade_type, employer_id, employers(id, company_eba_records(id, fwc_certified_date)), job_sites(project_id)')

      const rows = ((sct as any[]) || []).filter(r => scopedIds.has(r.job_sites?.project_id))

      for (const code of tradeCodes) {
        const aliases = TRADE_ALIASES[code] || [code]
        const byTrade = rows.filter(r => aliases.includes(r.trade_type))
        const employerIds = new Set(byTrade.map(r => r.employer_id).filter(Boolean))
        const ebaEmployerIds = new Set(
          byTrade
            .filter(r => {
              const emp = Array.isArray(r.employers) ? r.employers[0] : r.employers
              const recs = (emp?.company_eba_records as any[]) || []
              return recs.some(e => e.fwc_certified_date)
            })
            .map(r => r.employer_id)
            .filter(Boolean)
        )

        results.push({
          code,
          label: TRADE_LABEL[code],
          // Treat total projects as the full scoped project count so it's the same for each trade
          totalProjects: scopedIds.size,
          knownEmployers: employerIds.size,
          ebaEmployers: ebaEmployerIds.size,
        })
      }

      return { trades: results }
    }
  })
}



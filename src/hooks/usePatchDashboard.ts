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
      // TODO: Replace with campaign service aggregations when available
      // Attempt minimal reads to verify connectivity, otherwise return seed
      try {
        await supabase.from("job_sites").select("id").limit(1)
      } catch {}

      const kpis: PatchKpis = {
        members: { current: 124, goal: 180 },
        dd: { current: 80, goal: 140 },
        leaders: { current: 9, goal: 15 },
        openAudits: 6,
      }
      const rows: PatchRow[] = [
        { id: "s1", site: "Metro Tunnel - CBD South", project: "Metro Tunnel", employers: 12, members: { current: 56, goal: 80 }, dd: { current: 34, goal: 60 }, leadersScore: 3.2, lastVisit: new Date(Date.now() - 1000*60*60*24*2).toISOString() },
        { id: "s2", site: "West Gate Bridge", project: "West Gate", employers: 8, members: { current: 22, goal: 50 }, dd: { current: 10, goal: 35 }, leadersScore: 2.1, lastVisit: new Date(Date.now() - 1000*60*60*24*10).toISOString() },
        { id: "s3", site: "Airport Rail Link - Tulla", project: "ARL", employers: 5, members: { current: 30, goal: 40 }, dd: { current: 24, goal: 35 }, leadersScore: 4.0, lastVisit: new Date(Date.now() - 1000*60*60*24*1).toISOString() },
      ]
      return { kpis, rows }
    }
  })
}

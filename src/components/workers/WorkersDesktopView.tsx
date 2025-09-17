"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { WorkersList } from "@/components/workers/WorkersList"
import { useSearchParams } from "next/navigation"
import { useWorkersServerSideCompatible } from "@/hooks/useWorkersServerSide"

export function WorkersDesktopView() {
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const page = parseInt(sp.get("page") || "1")
  const pageSize = parseInt(sp.get("pageSize") || "100")
  const sort = (sp.get("sort") || "name") as 'name' | 'member_number' | 'placements'
  const dir = (sp.get("dir") || "asc") as 'asc' | 'desc'
  const membership = (sp.get("membership") || "all") as 'all' | 'member' | 'non_member'

  // Feature flag for server-side processing
  const USE_SERVER_SIDE = process.env.NEXT_PUBLIC_USE_SERVER_SIDE_WORKERS === 'true'

  // CLIENT-SIDE DATA FETCHING (Original implementation)
  const { data: clientWorkers = [], isFetching: clientFetching, refetch: clientRefetch } = useQuery({
    queryKey: ["workers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workers")
        .select(`
          id, first_name, surname, nickname, email, mobile_phone, member_number, union_membership_status,
          worker_placements:worker_placements!left(
            job_title,
            job_sites:job_sites!left(name)
          ),
          organisers:organisers!left(first_name,last_name)
        `)
        .limit(100)
      if (error) throw error
      const rows = (data || []) as any[]
      if (!q) return rows
      return rows.filter((w: any) => {
        const name = `${w.first_name || ""} ${w.surname || ""}`.toLowerCase()
        const member = String(w.member_number || "").toLowerCase()
        const email = String(w.email || "").toLowerCase()
        const phone = String(w.mobile_phone || "").toLowerCase()
        return [name, member, email, phone].some((s) => s.includes(q))
      })
    },
    enabled: !USE_SERVER_SIDE // Only run when server-side is disabled
  })

  // SERVER-SIDE DATA FETCHING (New implementation)
  const serverSideResult = useWorkersServerSideCompatible({
    page,
    pageSize,
    sort,
    dir,
    q: q || undefined,
    membership,
  })

  // Conditional data selection based on feature flag
  const workers = USE_SERVER_SIDE ? serverSideResult.data : clientWorkers
  const isFetching = USE_SERVER_SIDE ? serverSideResult.isFetching : clientFetching
  const refetch = USE_SERVER_SIDE ? serverSideResult.refetch : clientRefetch

  return (
    <div className="h-full p-0">
      {/* Development indicator for which implementation is active */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-4 right-4 z-50 text-xs px-2 py-1 rounded border bg-white">
          {USE_SERVER_SIDE ? (
            <span className="text-green-600">🚀 Workers Server-side {serverSideResult.debug?.queryTime ? `(${serverSideResult.debug.queryTime}ms)` : ''}</span>
          ) : (
            <span className="text-blue-600">💻 Workers Client-side</span>
          )}
        </div>
      )}
      <WorkersList workers={workers as any[]} loading={isFetching} onWorkerUpdate={() => refetch()} />
    </div>
  )
}

"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { WorkersList } from "@/components/workers/WorkersList"
import { useSearchParams } from "next/navigation"

export default function WorkersPage() {
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()
  const { data: workers = [], isFetching, refetch } = useQuery({
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
    }
  })

  return (
    <div className="h-full p-0">
      <WorkersList workers={workers as any[]} loading={isFetching} onWorkerUpdate={() => refetch()} />
    </div>
  )
}


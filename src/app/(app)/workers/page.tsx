"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { WorkersList } from "@/components/workers/WorkersList"

export default function WorkersPage() {
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
      return data || []
    }
  })

  return (
    <div className="h-full p-0">
      <WorkersList workers={workers as any[]} loading={isFetching} onWorkerUpdate={() => refetch()} />
    </div>
  )
}


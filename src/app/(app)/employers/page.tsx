"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { EmployerCard } from "@/components/employers/EmployerCard"

export default function EmployersPage() {
  const { data: employers = [], isFetching, refetch } = useQuery({
    queryKey: ["employers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employers")
        .select(`
          id, name, abn, industry, website, email, phone,
          estimated_worker_count, current_worker_count, member_density_percent
        `)
        .order("name", { ascending: true })
      if (error) throw error
      return data || []
    }
  })

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Employers</h1>
      {isFetching && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(employers as any[]).map((emp) => (
          <EmployerCard key={emp.id} employer={emp} onClick={() => {}} />
        ))}
      </div>
    </div>
  )
}


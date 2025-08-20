"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { EmployerCard } from "@/components/employers/EmployerCard"
import { useState, useMemo } from "react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Switch } from "@/components/ui/switch"
import { useSearchParams } from "next/navigation"

export default function EmployersPage() {
  const [onlyEngaged, setOnlyEngaged] = useState(true)
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()

  const { data: employers = [], isFetching } = useQuery({
    queryKey: ["employers-list", { onlyEngaged }],
    queryFn: async () => {
      let query = supabase
        .from("employers")
        .select(`
          id,
          name,
          abn,
          employer_type,
          website,
          email,
          phone,
          estimated_worker_count,
          enterprise_agreement_status,
          company_eba_records!left(id),
          worker_placements!left(id)
        `)
        .order("name", { ascending: true })

      // Only load employers that are likely to be relevant/engaged by default
      // Engaged means: has an EBA record OR has an estimated worker count > 0
      if (onlyEngaged) {
        query = query.or([
          "estimated_worker_count.gt.0",
          "enterprise_agreement_status.eq.true",
          "id.in.(select employer_id from company_eba_records)",
          "id.in.(select employer_id from worker_placements)",
        ].join(","))
      }

      const { data, error } = await query
      if (error) throw error
      return data || []
    }
  })

  const [selectedEmployerId, setSelectedEmployerId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Employers</h1>
      <div className="flex items-center gap-3">
        <Switch checked={onlyEngaged} onCheckedChange={setOnlyEngaged} />
        <span className="text-sm text-muted-foreground">Show engaged employers only (EBA or estimated workers)</span>
      </div>
      {isFetching && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(employers as any[])
          .filter((emp: any) => {
            if (!q) return true
            const hay = [emp.name, emp.abn, emp.website, emp.email, emp.phone].map((v: any) => String(v || "").toLowerCase())
            return hay.some((s: string) => s.includes(q))
          })
          .map((emp) => (
          <EmployerCard
            key={emp.id}
            employer={emp}
            onClick={() => {
              setSelectedEmployerId(emp.id)
              setIsDetailOpen(true)
            }}
          />
        ))}
      </div>

      <EmployerDetailModal
        employerId={selectedEmployerId}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        initialTab="overview"
      />
    </div>
  )
}


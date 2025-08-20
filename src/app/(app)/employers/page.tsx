"use client"
export const dynamic = 'force-dynamic'

import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { EmployerCard } from "@/components/employers/EmployerCard"
import { useState, useMemo } from "react"
import { EmployerDetailModal } from "@/components/employers/EmployerDetailModal"
import { Switch } from "@/components/ui/switch"
import { useSearchParams } from "next/navigation"
import { getEbaCategory } from "@/components/employers/ebaHelpers"

export default function EmployersPage() {
  const [onlyEngaged, setOnlyEngaged] = useState(true)
  const sp = useSearchParams()
  const q = (sp.get("q") || "").toLowerCase()

  const { data: employers = [], isFetching } = useQuery({
    queryKey: ["employers-list"],
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
          company_eba_records!left(*),
          worker_placements!left(id),
          project_employer_roles!left(id)
        `)
        .order("name", { ascending: true })

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
        <span className="text-sm text-muted-foreground">Show engaged employers only (recent EBA, workers, or projects)</span>
      </div>
      {isFetching && <p className="text-sm text-muted-foreground">Loading…</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(employers as any[])
          .filter((emp: any) => {
            if (!q) return true
            const hay = [emp.name, emp.abn, emp.website, emp.email, emp.phone].map((v: any) => String(v || "").toLowerCase())
            return hay.some((s: string) => s.includes(q))
          })
          .filter((emp: any) => {
            if (!onlyEngaged) return true
            const hasEstimatedWorkers = (emp.estimated_worker_count || 0) > 0
            const hasWorkers = Array.isArray(emp.worker_placements) && emp.worker_placements.length > 0
            const hasProjectRoles = Array.isArray(emp.project_employer_roles) && emp.project_employer_roles.length > 0
            const ebaRec = emp.company_eba_records?.[0]
            const ebaCat = ebaRec ? getEbaCategory(ebaRec).category : 'no'
            const hasRecentEba = ebaCat !== 'no'
            return hasEstimatedWorkers || hasWorkers || hasProjectRoles || hasRecentEba
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


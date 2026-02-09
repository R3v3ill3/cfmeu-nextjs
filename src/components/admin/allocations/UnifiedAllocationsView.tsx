"use client"

import { useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RoleHierarchyManager } from "@/components/admin/RoleHierarchyManager"
import PatchManager from "@/components/admin/PatchManager"
import OrganiserScopeManager from "@/components/admin/OrganiserScopeManager"
import CoordinatorRollupSummary from "@/components/admin/allocations/CoordinatorRollupSummary"

// #region agent log
fetch('http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'UnifiedAllocationsView.tsx:imports',message:'Import check',data:{RoleHierarchyManager:typeof RoleHierarchyManager,PatchManager:typeof PatchManager,OrganiserScopeManager:typeof OrganiserScopeManager,CoordinatorRollupSummary:typeof CoordinatorRollupSummary},timestamp:Date.now(),hypothesisId:'H1-H4'})}).catch(()=>{});
// #endregion

interface UnifiedAllocationsViewProps {
  onOpenWizard?: () => void
}

export function UnifiedAllocationsView({ onOpenWizard }: UnifiedAllocationsViewProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const [effectiveDate, setEffectiveDate] = useState<string>(today)

  const { data: users = [] } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .order("full_name")
      if (error) throw error
      return data || []
    }
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Unified allocations</CardTitle>
              <CardDescription>
                Coordinate patch assignments, organiser scoping, and coordinator links in one place.
              </CardDescription>
            </div>
            {onOpenWizard && (
              <Button variant="outline" onClick={onOpenWizard}>
                Open reallocation wizard
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[220px_1fr] md:items-center">
            <div className="text-sm font-medium">Effective date (default forward)</div>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(event) => setEffectiveDate(event.target.value)}
              className="max-w-[220px]"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Coordinator links respect the effective date. Patch assignments take effect immediately.
          </div>
        </CardContent>
      </Card>

      <CoordinatorRollupSummary effectiveDate={effectiveDate} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <RoleHierarchyManager users={users} effectiveDate={effectiveDate} />
          <OrganiserScopeManager />
        </div>
        <div className="space-y-6">
          <PatchManager />
        </div>
      </div>
    </div>
  )
}

export default UnifiedAllocationsView

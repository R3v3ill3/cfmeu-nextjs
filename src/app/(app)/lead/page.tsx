"use client"
export const dynamic = 'force-dynamic'

import RoleGuard from "@/components/guards/RoleGuard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function LeadOverviewPage() {
  return (
    <RoleGuard allow={["lead_organiser", "admin"]}>
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Lead organiser overview</h1>
        <Card>
          <CardHeader>
            <CardTitle>Organisers roll-up</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Stub page: aggregate KPIs per organiser and drill into each patch.</p>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  )
}


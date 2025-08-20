"use client"
export const dynamic = 'force-dynamic'

import RoleGuard from "@/components/guards/RoleGuard"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import LeadConsole from "@/components/lead/LeadConsole"

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
            <p className="text-sm text-muted-foreground">Manage organisers and patches you own.</p>
          </CardContent>
        </Card>
        <LeadConsole />
      </div>
    </RoleGuard>
  )
}
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { getProgressIndicatorClass } from "@/utils/densityColors"

type KPI = {
  label: string
  current: number
  goal: number
}

export function PatchKPICards({ data }: { data: { members: KPI; dd: KPI; leaders: KPI; openAudits: number } }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Members</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{data.members.current} / {data.members.goal}</div>
          <Progress value={Math.min(100, (data.members.current / Math.max(1, data.members.goal)) * 100)} className="h-2 mt-2" indicatorClassName={getProgressIndicatorClass((data.members.current / Math.max(1, data.members.goal)) * 100)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Direct Debit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{data.dd.current} / {data.dd.goal}</div>
          <Progress value={Math.min(100, (data.dd.current / Math.max(1, data.dd.goal)) * 100)} className="h-2 mt-2" indicatorClassName={getProgressIndicatorClass((data.dd.current / Math.max(1, data.dd.goal)) * 100)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Delegates/HSR</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{data.leaders.current} / {data.leaders.goal}</div>
          <Progress value={Math.min(100, (data.leaders.current / Math.max(1, data.leaders.goal)) * 100)} className="h-2 mt-2" indicatorClassName={getProgressIndicatorClass((data.leaders.current / Math.max(1, data.leaders.goal)) * 100)} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Open EBA/WHS Audits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold">{data.openAudits}</div>
        </CardContent>
      </Card>
    </div>
  )
}


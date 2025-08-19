"use client"
export const dynamic = 'force-dynamic'

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function ActivitiesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Activities</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          Activities management will be implemented here.
        </CardContent>
      </Card>
    </div>
  )
}


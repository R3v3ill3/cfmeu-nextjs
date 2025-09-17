"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function MobileDashboardView() {
  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-300 rounded-lg p-4 shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">Key metrics at a glance</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Welcome</CardTitle>
        </CardHeader>
        <CardContent>
          <p>The mobile dashboard view is under construction. Key metrics and alerts will be displayed here for a streamlined, on-the-go experience.</p>
        </CardContent>
      </Card>
    </div>
  )
}

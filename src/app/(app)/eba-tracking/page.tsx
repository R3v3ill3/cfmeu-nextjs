"use client"
export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function EbaTrackingPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">EBA Tracking</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          This page will display EBA tracking analytics similar to the original app.
        </CardContent>
      </Card>
    </div>
  )
}


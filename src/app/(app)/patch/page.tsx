"use client"
export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PatchPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Patch</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          Patch wall visualizations will be implemented here.
        </CardContent>
      </Card>
    </div>
  )
}


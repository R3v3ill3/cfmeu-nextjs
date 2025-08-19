"use client"
export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"

export default function PatchPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Patch</h1>
      <Card>
        <CardHeader>
          <CardTitle>Wallcharts</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Open the wallchart for a specific project and site to view workers by employer.
          </p>
          <p>
            Go to a project and click a site name to open its wallchart, or open the walls index:
          </p>
          <div className="mt-3">
            <Link href="/patch/walls" className="text-primary hover:underline">Open Walls</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


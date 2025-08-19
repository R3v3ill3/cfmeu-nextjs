"use client"
export const dynamic = 'force-dynamic'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function UploadPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Upload Data</h1>
      <Card>
        <CardHeader>
          <CardTitle>Coming soon</CardTitle>
        </CardHeader>
        <CardContent>
          Upload flows (Workers, EBA) will be wired here using the existing components.
        </CardContent>
      </Card>
    </div>
  )
}


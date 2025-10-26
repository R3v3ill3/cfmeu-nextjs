import { NextResponse } from "next/server"

// Temporary alerts endpoint returning an empty collection. Replace with
// a real data source when the ratings alerts workflow is implemented.
export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    alerts: [],
  })
}



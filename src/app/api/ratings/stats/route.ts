import { NextResponse } from "next/server"

// Temporary placeholder stats endpoint used by the ratings dashboard.
// Once the backend metrics are finalised, replace the mocked payload
// with the real data source (likely Supabase or an analytics materialised view).
export async function GET() {
  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    stats: {
      totalEmployers: 0,
      greenCount: 0,
      amberCount: 0,
      redCount: 0,
      recentActivity: 0,
    },
  })
}



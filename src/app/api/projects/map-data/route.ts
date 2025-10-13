import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase.rpc("get_projects_for_map_view")

    if (error) {
      console.error("Error fetching projects for map view:", error)
      return NextResponse.json({ error: "Failed to fetch map data" }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error("Projects map-data API unexpected error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}


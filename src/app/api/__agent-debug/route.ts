import { NextResponse } from "next/server"
import { appendFile } from "node:fs/promises"

export const runtime = "nodejs"

const DEBUG_LOG_PATH = "/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/.cursor/debug.log"

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  try {
    const body = await req.json()

    // Minimal validation: only allow object payloads
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    // Append as NDJSON
    await appendFile(DEBUG_LOG_PATH, `${JSON.stringify(body)}\n`, { encoding: "utf8" })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}


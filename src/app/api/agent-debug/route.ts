import { NextResponse } from "next/server"
import { appendFile } from "node:fs/promises"

export const runtime = "nodejs"

const DEBUG_LOG_PATH = "/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/.cursor/debug.log"
const DEBUG_INGEST_ENDPOINT =
  "http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2"

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

    // Also forward to debug ingest (server-local) so it's visible even if the file path isn't readable.
    // #region agent log
    fetch(DEBUG_INGEST_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "E",
        location: "src/app/api/agent-debug/route.ts:POST",
        message: "Relay received client debug payload",
        data: {
          keys: Object.keys(body ?? {}),
          hasSessionId: typeof (body as any)?.sessionId === "string",
          hasLocation: typeof (body as any)?.location === "string",
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}


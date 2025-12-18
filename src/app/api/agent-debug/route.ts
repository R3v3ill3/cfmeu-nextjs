import { NextResponse } from "next/server"
import { appendFile } from "node:fs/promises"
import * as Sentry from "@sentry/nextjs"

export const runtime = "nodejs"

const DEBUG_LOG_PATH = "/Volumes/DataDrive/cursor_repos/cfmeu-nextjs/.cursor/debug.log"
const DEBUG_INGEST_ENDPOINT =
  "http://127.0.0.1:7242/ingest/b23848a9-6360-4993-af9d-8e53783219d2"

export async function POST(req: Request) {
  const isProd = process.env.NODE_ENV === "production"
  const cookieHeader = req.headers.get("cookie") || ""
  const allowProdDebug = cookieHeader.includes("__agent_debug=1")
  if (isProd && !allowProdDebug) {
    return NextResponse.json({ ok: false }, { status: 404 })
  }

  try {
    const body = await req.json()

    // Minimal validation: only allow object payloads
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false }, { status: 400 })
    }

    if (!isProd) {
      // Dev: append as NDJSON
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
    } else {
      // Prod (debug gated): send to Sentry + Vercel logs (avoid filesystem writes)
      try {
        const payload = body as Record<string, unknown>
        const payloadAny = payload as any
        const payloadLocation = typeof payloadAny?.location === "string" ? payloadAny.location : null
        const payloadRunId = typeof payloadAny?.runId === "string" ? payloadAny.runId : null
        const payloadHypothesisId =
          typeof payloadAny?.hypothesisId === "string" ? payloadAny.hypothesisId : null
        Sentry.withScope((scope) => {
          scope.setLevel("info")
          scope.setTag("component", "agent-debug-relay")
          if (payloadLocation) scope.setTag("payload_location", payloadLocation.slice(0, 180))
          if (payloadRunId) scope.setTag("payload_runId", payloadRunId.slice(0, 80))
          if (payloadHypothesisId) scope.setTag("payload_hypothesisId", payloadHypothesisId.slice(0, 80))
          scope.setExtra("keys", Object.keys(payload ?? {}))
          scope.setExtra("payload", payload)
          Sentry.captureMessage("[AgentDebug] relay payload")
        })
      } catch {}
      try {
        console.log("[AgentDebug] relay payload", {
          keys: Object.keys((body as any) ?? {}),
          location: (body as any)?.location ?? null,
          message: (body as any)?.message ?? null,
          timestamp: new Date().toISOString(),
        })
      } catch {}
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
}


import { NextResponse } from 'next/server'

/**
 * /api/ping — zero-dependency smoke route.
 *
 * No Supabase. No external SDKs. No filesystem reads. The only purpose is to
 * confirm that the Next.js → Vercel function plumbing is alive, separately
 * from any backend slowness.
 *
 * Use this in the "two-lane" triage flowchart (Lane 1 vs Lane 2): when
 * `/api/health` is slow but `/api/ping` is fast, the issue is in the health
 * check's dependencies, not in Vercel routing. When BOTH are slow, suspect
 * the Vercel function layer.
 *
 * cross-ref docs/CONNECTION_STABILITY_REMEDIATION_PLAN.md P2-3.
 */

export const dynamic = 'force-dynamic'
export const runtime = 'edge'

export async function GET() {
  return NextResponse.json(
    { status: 'ok', ts: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  )
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}

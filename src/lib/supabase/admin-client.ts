/**
 * createAdminClient — shared factory for service-role Supabase access from
 * trusted server contexts (cron jobs, admin-only API routes, webhooks with
 * verified signatures).
 *
 * USAGE RULES — read before adopting:
 *
 *   1. NEVER call from a `'use client'` file. The service-role key bypasses
 *      RLS; shipping it to the browser is a critical security incident.
 *
 *   2. NEVER substitute this for the cookie-based `createServerSupabase()`
 *      in a user-facing route handler. RLS exists to scope data to the
 *      authenticated user; this client bypasses RLS entirely.
 *
 *   3. Call this AFTER you have independently verified the request is
 *      authorised (CRON_SECRET, webhook signature, or explicit admin role
 *      check on a user-bound session client).
 *
 *   4. Do not cache the returned client across requests in a way that would
 *      mix it with a user session. The client is cheap to construct.
 *
 * cross-ref docs/CONNECTION_STABILITY_REMEDIATION_PLAN.md P2-8.
 */

import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient(): SupabaseClient<Database> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      'createAdminClient: missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY. ' +
      'This helper must only be invoked in trusted server contexts and requires ' +
      'the service-role key in the environment.'
    )
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * Constant-time string comparison for shared-secret header checks (CRON_SECRET,
 * webhook secrets). Avoid the JS `===` operator for secrets — it short-circuits
 * on first mismatch and is theoretically timing-leakable.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return result === 0
}

/**
 * Verify a request carries `Authorization: Bearer <CRON_SECRET>`.
 * Returns false if `CRON_SECRET` is unset (fail-closed).
 */
export function isCronAuthorized(request: { headers: { get(name: string): string | null } }): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return false
  const expected = `Bearer ${cronSecret}`
  return timingSafeEqual(authHeader, expected)
}

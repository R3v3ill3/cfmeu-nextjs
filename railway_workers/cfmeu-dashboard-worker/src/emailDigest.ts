import 'dotenv/config'

// Lightweight scaffold for daily email digest (no-op by default)
// Uses NEXT_PUBLIC_DASHBOARD_WORKER_URL or local API to query new counts

export async function runEmailDigestOnce() {
  const baseUrl = process.env.DASHBOARD_BASE_URL || 'http://localhost:3000'
  const flag = process.env.ENABLE_EMAIL_DIGEST === 'true'
  if (!flag) {
    console.log('[emailDigest] Skipped (flag disabled)')
    return
  }
  try {
    // This is a placeholder. Real implementation would iterate organiser users from DB
    console.log('[emailDigest] Placeholder run - implement provider + recipients later')
    const res = await fetch(`${baseUrl}/api/projects/new-count`, { headers: { 'Cache-Control': 'no-store' } })
    const json = await res.json().catch(() => ({}))
    console.log('[emailDigest] Example count', json)
  } catch (e) {
    console.error('[emailDigest] Error', e)
  }
}

if (require.main === module) {
  runEmailDigestOnce()
}



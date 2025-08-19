import { createServerSupabase } from '@/lib/supabase/server'

type ProjectRow = Record<string, unknown>

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const supabase = await createServerSupabase()
  // Basic Supabase read example; ignore errors if table does not exist
  let rows: ProjectRow[] = []
  try {
    const { data } = await supabase.from('projects').select('*').limit(5)
    rows = data ?? []
  } catch {}

  return (
    <main className="p-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="text-sm text-gray-500">Replace with migrated Dashboard component.</p>
      <div className="mt-6 text-sm">
        <div className="font-medium">Sample Supabase rows from `projects`:</div>
        <pre className="mt-2 rounded bg-gray-100 p-3 overflow-auto text-xs">{JSON.stringify(rows, null, 2)}</pre>
      </div>
    </main>
  )
}


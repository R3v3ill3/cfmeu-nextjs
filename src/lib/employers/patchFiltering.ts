import { createServerSupabase } from '@/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createServerSupabase>>

export interface PatchFilterResult {
  employerIds: string[]
  employerMap: Map<string, true>
}

/**
 * Returns employer IDs that belong to the provided patch IDs by inspecting both
 * `site_employers` and `project_assignments`.
 */
export async function getEmployersByPatches(
  supabase: SupabaseClient,
  patchIds: string[]
): Promise<PatchFilterResult> {
  if (patchIds.length === 0) {
    return { employerIds: [], employerMap: new Map() }
  }

  try {
    const [{ data: siteEmployers, error: siteError }, { data: projectEmployers, error: projectError }] = await Promise.all([
      supabase
        .from('site_employers')
        .select('employer_id, job_sites!inner(patch_id)')
        .in('job_sites.patch_id', patchIds),
      supabase
        .from('project_assignments')
        .select('employer_id, projects!inner(job_sites!inner(patch_id))')
        .in('projects.job_sites.patch_id', patchIds)
    ])

    if (siteError) {
      console.warn('Patch filtering: site employers query failed', siteError)
    }

    if (projectError) {
      console.warn('Patch filtering: project employers query failed', projectError)
    }

    const employerIdsSet = new Set<string>()

    ;(siteEmployers || []).forEach((row: any) => {
      if (row.employer_id) {
        employerIdsSet.add(row.employer_id)
      }
    })

    ;(projectEmployers || []).forEach((row: any) => {
      if (row.employer_id) {
        employerIdsSet.add(row.employer_id)
      }
    })

    const employerIds = Array.from(employerIdsSet)
    const employerMap = new Map(employerIds.map(id => [id, true] as const))

    return { employerIds, employerMap }
  } catch (error) {
    console.error('Patch filtering failed', error)
    return { employerIds: [], employerMap: new Map() }
  }
}





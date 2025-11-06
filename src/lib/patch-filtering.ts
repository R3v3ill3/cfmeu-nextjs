import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Efficiently gets project IDs for given patch IDs using the materialized view
 * with fallback to direct job_sites query if view is stale.
 * 
 * This matches the optimization pattern used in /api/projects/route.ts
 * 
 * @param supabase - Supabase client instance
 * @param patchIds - Array of patch IDs to filter by
 * @returns Array of unique project IDs that belong to the specified patches
 */
export async function getProjectIdsForPatches(
  supabase: SupabaseClient,
  patchIds: string[]
): Promise<string[]> {
  if (!patchIds || patchIds.length === 0) {
    return []
  }

  // Primary: Use the patch mapping view for efficient filtering
  let { data: patchProjects, error: viewError } = await supabase
    .from('patch_project_mapping_view')
    .select('project_id')
    .in('patch_id', patchIds)

  let usedFallback = false

  // Fallback: If materialized view is empty/stale, query job_sites directly
  if (viewError || !patchProjects || patchProjects.length === 0) {
    if (viewError) {
      console.warn('⚠️ patch_project_mapping_view error, falling back to job_sites query:', viewError)
    } else {
      console.warn('⚠️ patch_project_mapping_view returned no results, falling back to job_sites query')
    }

    const { data: fallbackData, error: fallbackError } = await supabase
      .from('job_sites')
      .select('project_id')
      .in('patch_id', patchIds)
      .not('project_id', 'is', null)

    if (fallbackError) {
      console.error('❌ Fallback patch filtering error:', fallbackError)
      throw fallbackError
    }

    patchProjects = fallbackData || []
    usedFallback = true
  }

  // Extract unique project IDs
  const projectIds = Array.from(
    new Set(
      (patchProjects || [])
        .map((row: any) => row.project_id)
        .filter(Boolean)
    )
  )

  if (process.env.NODE_ENV === 'development' && usedFallback) {
    console.log(`[patch-filtering] Used ${usedFallback ? 'fallback' : 'materialized view'} for ${patchIds.length} patch(es), found ${projectIds.length} projects`)
  }

  return projectIds
}


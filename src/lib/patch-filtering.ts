import { SupabaseClient } from '@supabase/supabase-js'
import { withTimeout, isDatabaseTimeoutError } from './query-timeout'

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

  try {
    // Primary: Use the patch mapping view for efficient filtering
    // Add timeout to prevent stack depth issues
    const viewQuery = supabase
      .from('patch_project_mapping_view')
      .select('project_id')
      .in('patch_id', patchIds)

    let { data: patchProjects, error: viewError } = await withTimeout(
      viewQuery,
      8000,
      'Patch mapping view query timeout'
    )

    let usedFallback = false

    // Fallback: If materialized view is empty/stale, query job_sites directly
    if (viewError || !patchProjects || patchProjects.length === 0) {
      if (viewError) {
        // If it's a timeout error, return empty array instead of trying fallback
        if (isDatabaseTimeoutError(viewError)) {
          console.warn('⚠️ patch_project_mapping_view timeout, returning empty result')
          return []
        }
        console.warn('⚠️ patch_project_mapping_view error, falling back to job_sites query:', viewError)
      } else {
        console.warn('⚠️ patch_project_mapping_view returned no results, falling back to job_sites query')
      }

      try {
        const fallbackQuery = supabase
          .from('job_sites')
          .select('project_id')
          .in('patch_id', patchIds)
          .not('project_id', 'is', null)

        const { data: fallbackData, error: fallbackError } = await withTimeout(
          fallbackQuery,
          8000,
          'Job sites fallback query timeout'
        )

        if (fallbackError) {
          // If fallback also times out, return empty array
          if (isDatabaseTimeoutError(fallbackError)) {
            console.error('❌ Fallback patch filtering timeout, returning empty result')
            return []
          }
          console.error('❌ Fallback patch filtering error:', fallbackError)
          throw fallbackError
        }

        patchProjects = fallbackData || []
        usedFallback = true
      } catch (fallbackError) {
        // If fallback times out, return empty array
        if (isDatabaseTimeoutError(fallbackError)) {
          console.error('❌ Fallback patch filtering timeout, returning empty result')
          return []
        }
        throw fallbackError
      }
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
  } catch (error) {
    // If any error occurs and it's a timeout, return empty array
    if (isDatabaseTimeoutError(error)) {
      console.error('❌ Patch filtering timeout, returning empty result')
      return []
    }
    // Re-throw non-timeout errors
    throw error
  }
}



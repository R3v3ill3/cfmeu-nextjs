/**
 * Utility to backfill existing projects with geocoded coordinates
 * This will enable patch matching for projects imported before the geocoding fix
 */

import { supabase } from "@/integrations/supabase/client"
import { geocodeAddress, validateCoordinates } from "./geocoding"

export type BackfillResult = {
  processed: number
  geocoded: number
  matched: number
  failed: number
  errors: string[]
}

/**
 * Backfill coordinates for job sites that don't have them
 */
export async function backfillJobSiteCoordinates(
  onProgress?: (current: number, total: number, siteName: string) => void
): Promise<BackfillResult> {
  const result: BackfillResult = {
    processed: 0,
    geocoded: 0,
    matched: 0,
    failed: 0,
    errors: []
  }

  try {
    // Get all job sites without coordinates that have addresses
    const { data: sites, error: sitesError } = await supabase
      .from('job_sites')
      .select('id, name, location, full_address, project_id')
      .is('latitude', null)
      .is('longitude', null)
      .not('location', 'is', null)
      .not('location', 'eq', '')

    if (sitesError) {
      throw new Error(`Failed to fetch job sites: ${sitesError.message}`)
    }

    if (!sites || sites.length === 0) {
      console.log('No job sites found that need coordinate backfill')
      return result
    }

    console.log(`Found ${sites.length} job sites to process`)

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i]
      result.processed++

      if (onProgress) {
        onProgress(i + 1, sites.length, site.name || 'Unnamed site')
      }

      try {
        // Try to geocode the address
        const address = site.full_address || site.location
        if (!address) {
          result.failed++
          result.errors.push(`Site ${site.name}: No address available`)
          continue
        }

        const geocodeResult = await geocodeAddress(address)
        
        if (!geocodeResult) {
          result.failed++
          result.errors.push(`Site ${site.name}: Geocoding failed for address: ${address}`)
          continue
        }

        // Validate coordinates are reasonable
        if (!validateCoordinates(geocodeResult.latitude, geocodeResult.longitude)) {
          result.failed++
          result.errors.push(`Site ${site.name}: Invalid coordinates (${geocodeResult.latitude}, ${geocodeResult.longitude})`)
          continue
        }

        // Update the job site with coordinates
        const { error: updateError } = await supabase
          .from('job_sites')
          .update({
            latitude: geocodeResult.latitude,
            longitude: geocodeResult.longitude
          })
          .eq('id', site.id)

        if (updateError) {
          result.failed++
          result.errors.push(`Site ${site.name}: Failed to update coordinates: ${updateError.message}`)
          continue
        }

        result.geocoded++
        console.log(`Geocoded site ${site.name}: ${geocodeResult.latitude}, ${geocodeResult.longitude}`)

        // Small delay to avoid hitting API rate limits
        if (i < sites.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }

      } catch (error) {
        result.failed++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Site ${site.name}: ${errorMessage}`)
        console.error(`Error processing site ${site.name}:`, error)
      }
    }

    // After all coordinates are updated, check how many got matched to patches
    const { data: matchedSites } = await supabase
      .from('patch_job_sites')
      .select('job_site_id')
      .in('job_site_id', sites.map(s => s.id))
      .is('effective_to', null)

    result.matched = matchedSites?.length || 0

    console.log(`Backfill complete: ${result.geocoded} geocoded, ${result.matched} matched to patches, ${result.failed} failed`)

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Backfill process failed: ${errorMessage}`)
    console.error('Backfill process error:', error)
  }

  return result
}

/**
 * Get count of job sites that need coordinate backfill
 */
export async function getBackfillCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('job_sites')
      .select('id', { count: 'exact', head: true })
      .is('latitude', null)
      .is('longitude', null)
      .not('location', 'is', null)
      .not('location', 'eq', '')

    if (error) {
      console.error('Error getting backfill count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error getting backfill count:', error)
    return 0
  }
}

/**
 * Get count of job sites that need patch matching (have coordinates but no patch)
 */
export async function getPatchMatchingCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('job_sites')
      .select('id', { count: 'exact', head: true })
      .is('patch_id', null)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null)

    if (error) {
      console.error('Error getting patch matching count:', error)
      return 0
    }

    return count || 0
  } catch (error) {
    console.error('Error getting patch matching count:', error)
    return 0
  }
}

/**
 * Run patch matching for job sites that have coordinates but no patch assignment
 */
export async function runPatchMatching(): Promise<BackfillResult> {
  const result: BackfillResult = {
    processed: 0,
    geocoded: 0,
    matched: 0,
    failed: 0,
    errors: []
  }

  try {
    // Use the database function for proper spatial matching
    const { data, error } = await supabase.rpc('match_job_sites_to_patches')

    if (error) {
      throw new Error(`Patch matching RPC failed: ${error.message}`)
    }

    if (data && data.length > 0) {
      const matchResult = data[0]
      result.processed = matchResult.sites_processed || 0
      result.matched = matchResult.sites_matched || 0
      
      console.log(`Patch matching complete: ${result.matched} sites matched to patches (${matchResult.patches_used} patches used)`)
    } else {
      result.processed = 0
      result.matched = 0
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    result.errors.push(`Patch matching failed: ${errorMessage}`)
    console.error('Patch matching error:', error)
  }

  return result
}

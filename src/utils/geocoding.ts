/**
 * Utility functions for geocoding addresses using Google Maps API
 */

export type GeocodeResult = {
  latitude: number
  longitude: number
  formatted_address: string
  place_id?: string
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    console.warn('Google Maps API key not available for geocoding')
    return null
  }

  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${apiKey}`
    )
    
    if (!response.ok) {
      throw new Error(`Geocoding API request failed: ${response.status}`)
    }

    const data = await response.json()
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0]
      const location = result.geometry.location
      
      return {
        latitude: location.lat,
        longitude: location.lng,
        formatted_address: result.formatted_address,
        place_id: result.place_id
      }
    } else {
      console.warn(`Geocoding failed for address "${address}":`, data.status, data.error_message)
      return null
    }
  } catch (error) {
    console.error('Error geocoding address:', error)
    return null
  }
}

/**
 * Batch geocode multiple addresses with rate limiting
 */
export async function geocodeAddresses(
  addresses: string[], 
  onProgress?: (completed: number, total: number) => void
): Promise<Array<GeocodeResult | null>> {
  const results: Array<GeocodeResult | null> = []
  
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i]
    const result = await geocodeAddress(address)
    results.push(result)
    
    if (onProgress) {
      onProgress(i + 1, addresses.length)
    }
    
    // Rate limiting: wait 100ms between requests to avoid hitting API limits
    if (i < addresses.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}

/**
 * Validate coordinates are reasonable for Australia/New Zealand region
 */
export function validateCoordinates(lat: number, lng: number): boolean {
  // Rough bounds for Australia/New Zealand region
  const minLat = -50  // South of New Zealand
  const maxLat = -10  // North of Australia
  const minLng = 110  // West of Australia
  const maxLng = 180  // East of New Zealand
  
  return lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng
}

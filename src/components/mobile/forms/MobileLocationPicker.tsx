"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, Search, Crosshair, Loader2 } from 'lucide-react'
import { useHapticFeedback } from '@/components/mobile/shared/HapticFeedback'

interface Location {
  lat: number
  lng: number
  address?: string
  accuracy?: number
}

interface MobileLocationPickerProps {
  onLocationSelect: (location: Location) => void
  initialLocation?: Location
  className?: string
  enableSearch?: boolean
  enableCurrentLocation?: boolean
}

export function MobileLocationPicker({
  onLocationSelect,
  initialLocation,
  className = "",
  enableSearch = true,
  enableCurrentLocation = true
}: MobileLocationPickerProps) {
  const [currentLocation, setCurrentLocation] = useState<Location | null>(initialLocation || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Array<{
    address: string
    lat: number
    lng: number
  }>>([])
  const [isGettingLocation, setIsGettingLocation] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()

  const { trigger, success, error } = useHapticFeedback()

  // Clean up location watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  // Get current GPS location
  const getCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by this device')
      error()
      return
    }

    setIsGettingLocation(true)
    setLocationError(null)

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 300000 // 5 minutes
          }
        )
      })

      const location: Location = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      }

      // Get address from coordinates (reverse geocoding)
      const address = await reverseGeocode(location.lat, location.lng)
      location.address = address

      setCurrentLocation(location)
      onLocationSelect(location)
      success()
    } catch (err) {
      console.error('Error getting location:', err)
      let errorMessage = 'Failed to get location'

      if (err instanceof GeolocationPositionError) {
        switch (err.code) {
          case GeolocationPositionError.PERMISSION_DENIED:
            errorMessage = 'Location permission denied. Please enable location services.'
            break
          case GeolocationPositionError.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable.'
            break
          case GeolocationPositionError.TIMEOUT:
            errorMessage = 'Location request timed out.'
            break
        }
      }

      setLocationError(errorMessage)
      error()
    } finally {
      setIsGettingLocation(false)
    }
  }, [onLocationSelect, success, error])

  // Start watching location for continuous updates
  const startLocationWatch = useCallback(() => {
    if (!navigator.geolocation) return

    const id = navigator.geolocation.watchPosition(
      (position) => {
        const location: Location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }

        setCurrentLocation(location)
        onLocationSelect(location)
      },
      (err) => {
        console.error('Location watch error:', err)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000 // 1 minute
      }
    )

    setWatchId(id)
  }, [onLocationSelect])

  // Search for locations
  const searchLocations = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    setLocationError(null)

    try {
      // Using Nominatim (OpenStreetMap) for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=au`,
        {
          headers: {
            'User-Agent': 'CFMEU Mobile App'
          }
        }
      )

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const results = await response.json()
      const formattedResults = results.map((result: any) => ({
        address: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon)
      }))

      setSearchResults(formattedResults)
    } catch (err) {
      console.error('Search error:', err)
      setLocationError('Search failed. Please try again.')
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Debounced search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchLocations(searchQuery)
    }, 500)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, searchLocations])

  // Reverse geocoding
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        {
          headers: {
            'User-Agent': 'CFMEU Mobile App'
          }
        }
      )

      if (!response.ok) {
        return 'Unknown location'
      }

      const result = await response.json()
      return result.display_name || 'Unknown location'
    } catch (err) {
      console.error('Reverse geocoding error:', err)
      return 'Unknown location'
    }
  }

  const handleSearchResultSelect = useCallback((result: typeof searchResults[0]) => {
    trigger()
    const location: Location = {
      lat: result.lat,
      lng: result.lng,
      address: result.address
    }
    setCurrentLocation(location)
    onLocationSelect(location)
    setSearchQuery('')
    setSearchResults([])
    success()
  }, [onLocationSelect, trigger, success])

  const handleManualInput = useCallback(() => {
    const [latStr, lngStr] = searchQuery.split(',').map(s => s.trim())
    const lat = parseFloat(latStr)
    const lng = parseFloat(lngStr)

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      trigger()
      const location: Location = { lat, lng }
      setCurrentLocation(location)
      onLocationSelect(location)
      setSearchQuery('')
      setSearchResults([])
      success()
    }
  }, [searchQuery, onLocationSelect, trigger, success])

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Location Display */}
      {currentLocation && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Selected Location</span>
                {currentLocation.accuracy && (
                  <Badge variant="outline" className="text-xs">
                    ±{Math.round(currentLocation.accuracy)}m
                  </Badge>
                )}
              </div>
              {currentLocation.address ? (
                <p className="text-sm text-muted-foreground">{currentLocation.address}</p>
              ) : (
                <p className="text-sm font-mono text-muted-foreground">
                  {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Location Button */}
      {enableCurrentLocation && (
        <Button
          type="button"
          onClick={getCurrentLocation}
          disabled={isGettingLocation}
          className="w-full h-12"
        >
          {isGettingLocation ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Getting Location...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4 mr-2" />
              Use Current Location
            </>
          )}
        </Button>
      )}

      {/* Search */}
      {enableSearch && (
        <div className="space-y-3">
          <Label htmlFor="location-search" className="text-sm font-medium">
            Search Location
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="location-search"
              type="text"
              placeholder="Search address or enter lat,lng"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((result, index) => (
                <Button
                  key={index}
                  type="button"
                  variant="outline"
                  onClick={() => handleSearchResultSelect(result)}
                  className="w-full h-auto p-3 justify-start text-left whitespace-normal"
                >
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm">{result.address}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {result.lat.toFixed(6)}, {result.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          )}

          {/* Manual coordinates hint */}
          {searchQuery.includes(',') && (
            <Button
              type="button"
              variant="ghost"
              onClick={handleManualInput}
              className="w-full text-xs"
            >
              Use coordinates: {searchQuery}
            </Button>
          )}
        </div>
      )}

      {/* Error Display */}
      {locationError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-3">
            <p className="text-sm text-red-700">{locationError}</p>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Use "Use Current Location" for GPS coordinates</p>
        <p>• Search for an address or place name</p>
        <p>• Or enter coordinates manually (lat,lng)</p>
        {currentLocation?.accuracy && (
          <p>• Location accuracy: ±{Math.round(currentLocation.accuracy)}m</p>
        )}
      </div>
    </div>
  )
}
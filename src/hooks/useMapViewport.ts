import { useState, useEffect, useCallback } from 'react'

interface ProjectLocation {
  latitude: number | null
  longitude: number | null
  [key: string]: any
}

/**
 * Hook to filter projects based on the current map viewport bounds.
 * This optimizes rendering performance by only showing markers visible in the current view.
 *
 * @param map - Google Maps instance
 * @param allProjects - All projects with location data
 * @returns Projects currently visible in the map viewport
 */
export function useMapViewport<T extends ProjectLocation>(
  map: google.maps.Map | null,
  allProjects: T[]
) {
  const [visibleProjects, setVisibleProjects] = useState<T[]>(allProjects)

  const updateVisible = useCallback(() => {
    if (!map) {
      setVisibleProjects(allProjects)
      return
    }

    const bounds = map.getBounds()
    if (!bounds) {
      setVisibleProjects(allProjects)
      return
    }

    const visible = allProjects.filter(p => {
      if (!p.latitude || !p.longitude) return false
      return bounds.contains(
        new google.maps.LatLng(p.latitude, p.longitude)
      )
    })

    setVisibleProjects(visible)
  }, [map, allProjects])

  useEffect(() => {
    if (!map) {
      setVisibleProjects(allProjects)
      return
    }

    // Update on map bounds change (pan/zoom)
    const listener = map.addListener('bounds_changed', updateVisible)
    updateVisible() // Initial

    return () => {
      google.maps.event.removeListener(listener)
    }
  }, [map, allProjects, updateVisible])

  return visibleProjects
}

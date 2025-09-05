"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { GoogleMap, Polygon, Marker, InfoWindow } from "@react-google-maps/api"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Building, Users, ExternalLink } from "lucide-react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

interface ProjectsMapViewProps {
  projects: any[]
  summaries: Record<string, any>
  onProjectClick: (projectId: string) => void
  searchQuery: string
  patchIds: string[]
  tierFilter: string
  workersFilter: string
}

interface PatchData {
  id: string
  name: string
  code: string
  type: string
  status: string
  geom_geojson: any
}

interface JobSiteData {
  id: string
  name: string
  location: string
  latitude: number
  longitude: number
  project_id: string
  patch_id: string | null
  projects?: {
    name: string
    tier: string | null
  }
}

const mapContainerStyle = {
  width: "100%",
  height: "70vh"
}

const defaultCenter = {
  lat: -33.8688,
  lng: 151.2093 // Sydney, Australia
}

const GOOGLE_SCRIPT_ID = "google-maps-script"

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isMapsReady = () => !!(window.google && window.google.maps && window.google.maps.geometry)

    if (isMapsReady()) {
      resolve()
      return
    }
    if (document.getElementById(GOOGLE_SCRIPT_ID)) {
      const check = setInterval(() => {
        if (isMapsReady()) {
          clearInterval(check)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(check)
        if (!isMapsReady()) {
          reject(new Error("Google Maps failed to load"))
        }
      }, 10000)
      return
    }

    const script = document.createElement("script")
    script.id = GOOGLE_SCRIPT_ID
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async&v=weekly`
    script.async = true
    script.onload = async () => {
      try {
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary("geometry")
        }
      } catch {}

      const check = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.geometry) {
          clearInterval(check)
          resolve()
        }
      }, 100)
      setTimeout(() => {
        clearInterval(check)
        if (!(window.google && window.google.maps && window.google.maps.geometry)) {
          reject(new Error("Google Maps failed to load"))
        }
      }, 10000)
    }
    script.onerror = () => reject(new Error("Failed to load Google Maps"))
    document.head.appendChild(script)
  })
}

// Color scheme for different patch types
const patchColors = {
  geo: "#ef4444", // red
  trade: "#22c55e", // green
  "sub-sector": "#3b82f6", // blue
  other: "#f97316" // orange
}

export default function ProjectsMapView({
  projects,
  summaries,
  onProjectClick,
  searchQuery,
  patchIds,
  tierFilter,
  workersFilter
}: ProjectsMapViewProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedJobSite, setSelectedJobSite] = useState<JobSiteData | null>(null)
  const [selectedPatch, setSelectedPatch] = useState<PatchData | null>(null)
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ lat: number, lng: number } | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)

  // Load Google Maps
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined
        if (!key) {
          setMapsError("Google Maps API key not configured")
          return
        }
        await loadGoogleMaps(key)
        if (!cancelled) setMapsLoaded(true)
      } catch (e) {
        console.error(e)
        setMapsError("Failed to load Google Maps")
      }
    })()
    return () => { cancelled = true }
  }, [])

  // Get project IDs from filtered projects
  const projectIds = useMemo(() => projects.map(p => p.id), [projects])

  // Fetch job sites for the filtered projects
  const { data: jobSites = [], error: jobSitesError, isLoading: jobSitesLoading } = useQuery({
    queryKey: ["project-job-sites-for-map", projectIds],
    queryFn: async () => {
      if (projectIds.length === 0) return []
      
      const { data, error } = await supabase
        .from("job_sites")
        .select(`
          id,
          name,
          location,
          latitude,
          longitude,
          project_id,
          patch_id,
          projects:projects!fk_job_sites_project(name, tier)
        `)
        .in("project_id", projectIds)
        .not("latitude", "is", null)
        .not("longitude", "is", null)
      
      if (error) throw error
      return (data || []) as unknown as JobSiteData[]
    },
    enabled: projectIds.length > 0,
    retry: 1,
    staleTime: 30000
  })

  // Fetch patches data with geometry (only if patchIds filter is applied)
  const { data: patches = [] } = useQuery<PatchData[]>({
    queryKey: ["patches-with-geometry-filtered", patchIds],
    queryFn: async () => {
      if (patchIds.length === 0) return []
      
      const { data, error } = await supabase
        .from("patches_with_geojson")
        .select("id, name, code, geom_geojson")
        .in("id", patchIds)
        .not("geom_geojson", "is", null)

      if (error) throw error

      const normalized: PatchData[] = (data || []).map((row: any) => ({
        id: row.id,
        name: row.name,
        code: row.code,
        type: "geo",
        status: "active",
        geom_geojson: row.geom_geojson
      }))

      return normalized
    },
    enabled: patchIds.length > 0,
    retry: 1,
    staleTime: 30000
  })

  // Convert GeoJSON to Google Maps Polygon paths
  const extractPolygonsFromGeoJSON = useCallback((geojson: any): google.maps.LatLngLiteral[][][] => {
    try {
      if (!geojson || !geojson.type || !geojson.coordinates) return []

      const toRing = (coords: [number, number][]) => coords.map(([lng, lat]) => ({ lat, lng }))

      if (geojson.type === "Polygon") {
        const rings: google.maps.LatLngLiteral[][] = (geojson.coordinates as [number, number][][]).map(toRing)
        return [rings]
      }
      if (geojson.type === "MultiPolygon") {
        const polygons: google.maps.LatLngLiteral[][][] = (geojson.coordinates as [number, number][][][]).map(
          (poly) => (poly as [number, number][][]).map(toRing)
        )
        return polygons
      }
      return []
    } catch (e) {
      console.warn("Failed to parse GeoJSON:", e)
      return []
    }
  }, [])

  // Handle job site marker click
  const handleJobSiteClick = useCallback((jobSite: JobSiteData) => {
    setSelectedJobSite(jobSite)
    setSelectedPatch(null)
    setInfoWindowPosition({
      lat: jobSite.latitude,
      lng: jobSite.longitude
    })
  }, [])

  // Handle patch click
  const handlePatchClick = useCallback((patch: PatchData, event: google.maps.PolyMouseEvent) => {
    if (event.latLng) {
      setSelectedPatch(patch)
      setSelectedJobSite(null)
      setInfoWindowPosition({
        lat: event.latLng.lat(),
        lng: event.latLng.lng()
      })
    }
  }, [])

  // Handle map click to close info windows
  const handleMapClick = useCallback(() => {
    setSelectedJobSite(null)
    setSelectedPatch(null)
    setInfoWindowPosition(null)
  }, [])

  // Auto-fit bounds when data changes - focus on first project and ensure all are visible
  useEffect(() => {
    if (!map || jobSites.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    // Add job site bounds
    jobSites.forEach(site => {
      bounds.extend({ lat: site.latitude, lng: site.longitude })
      hasPoints = true
    })

    // Add patch bounds if any
    patches.forEach(patch => {
      if (patch.geom_geojson) {
        const polys = extractPolygonsFromGeoJSON(patch.geom_geojson)
        polys.forEach((rings) => {
          const outer = rings[0] || []
          outer.forEach((point) => { bounds.extend(point); hasPoints = true })
        })
      }
    })

    if (hasPoints) {
      // If we have a first project, center on it but ensure all are visible
      if (jobSites.length > 0) {
        const firstSite = jobSites[0]
        map.fitBounds(bounds)
        
        // After fitting bounds, ensure minimum zoom to show all projects
        setTimeout(() => {
          const currentZoom = map.getZoom() || 10
          if (currentZoom > 15) {
            map.setZoom(15) // Max zoom to keep context
          }
        }, 100)
      }
    }
  }, [map, jobSites, patches, extractPolygonsFromGeoJSON])

  // Deterministic color per patch id
  const colorForPatch = useCallback((patchId: string) => {
    let hash = 0
    for (let i = 0; i < patchId.length; i++) hash = (hash * 31 + patchId.charCodeAt(i)) >>> 0
    const hue = hash % 360
    return `hsl(${hue} 80% 60%)`
  }, [])

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    clickableIcons: false,
    mapTypeId: "roadmap",
    styles: [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ]
  }), [])

  // Handle loading states
  if (mapsError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">{mapsError}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!mapsLoaded) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600">Loading map...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (jobSites.length === 0 && !jobSitesLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="text-center">
            <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No projects with location data found for the current filters.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-0">
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          center={defaultCenter}
          zoom={10}
          options={mapOptions}
          onLoad={setMap}
          onClick={handleMapClick}
        >
          {/* Render Patches as Polygons */}
          {patches.map(patch => {
            if (!patch.geom_geojson) return null
            
            const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson)
            if (polygons.length === 0) return null
            
            const color = colorForPatch(patch.id)
            return (
              <div key={patch.id}>
                {polygons.map((rings, idx) => (
                  <Polygon
                    key={`${patch.id}-${idx}`}
                    paths={rings}
                    options={{
                      fillColor: color,
                      fillOpacity: 0.2,
                      strokeColor: "#000000",
                      strokeOpacity: 1,
                      strokeWeight: 2,
                      clickable: true
                    }}
                    onClick={(event) => handlePatchClick(patch, event)}
                  />
                ))}
              </div>
            )
          })}

          {/* Render Job Sites as Markers */}
          {jobSites.map(site => (
            <Marker
              key={site.id}
              position={{ lat: site.latitude, lng: site.longitude }}
              icon={{
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="#3b82f6" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
              }}
              onClick={() => handleJobSiteClick(site)}
            />
          ))}

          {/* Info Window for Job Sites */}
          {selectedJobSite && infoWindowPosition && (
            <InfoWindow
              position={infoWindowPosition}
              onCloseClick={() => {
                setSelectedJobSite(null)
                setInfoWindowPosition(null)
              }}
            >
              <div className="p-2 min-w-[250px]">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{selectedJobSite.name}</h3>
                  <MapPin className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-sm text-gray-600 mb-2">{selectedJobSite.location}</p>
                {selectedJobSite.projects && (
                  <div className="mb-2">
                    <p className="text-sm text-gray-600">
                      Project: {selectedJobSite.projects.name}
                    </p>
                    {selectedJobSite.projects.tier && (
                      <Badge variant="outline" className="text-xs mt-1">
                        {selectedJobSite.projects.tier}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex items-center gap-2"
                    onClick={() => onProjectClick(selectedJobSite.project_id)}
                  >
                    <Building className="h-3 w-3" />
                    View Project
                  </Button>
                  {selectedJobSite.patch_id && (
                    <Link href={`/patch?patch=${selectedJobSite.patch_id}`}>
                      <Button size="sm" variant="outline" className="flex items-center gap-2">
                        <Users className="h-3 w-3" />
                        View Patch
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </InfoWindow>
          )}

          {/* Info Window for Patches */}
          {selectedPatch && infoWindowPosition && (
            <InfoWindow
              position={infoWindowPosition}
              onCloseClick={() => {
                setSelectedPatch(null)
                setInfoWindowPosition(null)
              }}
            >
              <div className="p-2 min-w-[250px]">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-lg">{selectedPatch.name}</h3>
                  <Badge 
                    variant="secondary"
                    style={{ 
                      backgroundColor: patchColors[selectedPatch.type as keyof typeof patchColors] || patchColors.other,
                      color: "white"
                    }}
                  >
                    {selectedPatch.type}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 mb-2">Code: {selectedPatch.code}</p>
                <p className="text-sm text-gray-600 mb-3">Status: {selectedPatch.status}</p>
                <Link href={`/patch?patch=${selectedPatch.id}`}>
                  <Button size="sm" className="flex items-center gap-2">
                    <ExternalLink className="h-3 w-3" />
                    View Patch Details
                  </Button>
                </Link>
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </CardContent>
    </Card>
  )
}

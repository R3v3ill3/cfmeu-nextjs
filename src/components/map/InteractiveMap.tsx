"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { GoogleMap, Polygon, Marker, InfoWindow } from "@react-google-maps/api"
import { useQuery } from "@tanstack/react-query"
import { supabase } from "@/integrations/supabase/client"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MapPin, Building, Users, ExternalLink } from "lucide-react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { usePatchOrganiserLabels } from "@/hooks/usePatchOrganiserLabels"

interface InteractiveMapProps {
  showJobSites: boolean
  showPatches: boolean
  selectedPatchTypes: string[]
  mapMode: "standard" | "satellite"
  showPatchNames?: boolean
  showOrganisers?: boolean
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
  }
}

const mapContainerStyle = {
  width: "100%",
  height: "100%"
}

const defaultCenter = {
  lat: -33.8688,
  lng: 151.2093 // Sydney, Australia
}

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_SCRIPT_ID = "google-maps-script";

function loadGoogleMaps(apiKey: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const isMapsReady = () => !!(window.google && window.google.maps && window.google.maps.geometry);

    if (isMapsReady()) {
      resolve();
      return;
    }
    if (document.getElementById(GOOGLE_SCRIPT_ID)) {
      const check = setInterval(() => {
        if (isMapsReady()) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        if (!isMapsReady()) {
          reject(new Error("Google Maps failed to load"));
        }
      }, 10000);
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry&loading=async&v=weekly`;
    script.async = true;
    script.onload = async () => {
      try {
        if (window.google?.maps?.importLibrary) {
          await window.google.maps.importLibrary("geometry");
        }
      } catch {}

      const check = setInterval(() => {
        if (window.google && window.google.maps && window.google.maps.geometry) {
          clearInterval(check);
          resolve();
        }
      }, 100);
      setTimeout(() => {
        clearInterval(check);
        if (!(window.google && window.google.maps && window.google.maps.geometry)) {
          reject(new Error("Google Maps failed to load"));
        }
      }, 10000);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps"));
    document.head.appendChild(script);
  });
}

// Color scheme for different patch types
const patchColors = {
  geo: "#ef4444", // red
  trade: "#22c55e", // green
  "sub-sector": "#3b82f6", // blue
  other: "#f97316" // orange
}

export default function InteractiveMap({
  showJobSites,
  showPatches,
  selectedPatchTypes,
  mapMode,
  showPatchNames = false,
  showOrganisers = false
}: InteractiveMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPatch, setSelectedPatch] = useState<PatchData | null>(null)
  const [selectedJobSite, setSelectedJobSite] = useState<JobSiteData | null>(null)
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ lat: number, lng: number } | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)

  // Load Google Maps
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY as string | undefined;
        if (!key) {
          setMapsError("Google Maps API key not configured");
          return;
        }
        await loadGoogleMaps(key);
        if (!cancelled) setMapsLoaded(true);
      } catch (e) {
        console.error(e);
        setMapsError("Failed to load Google Maps");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Debug authentication and environment
  useEffect(() => {
    const checkAuth = async () => {
      console.log("🌍 Environment check:")
      console.log("  SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING")
      console.log("  SUPABASE_ANON_KEY:", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? "SET" : "MISSING")
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      console.log("🔐 Auth getUser result:", { user: user?.email, error: userError })
      
      if (user) {
        console.log("👤 User details:", {
          id: user.id,
          email: user.email,
          role: user.role,
          aud: user.aud
        })
        
        // Test a simple query first
        const { data: testData, error: testError } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .single()
        
        console.log("🧪 Profile query test:", { data: testData, error: testError })
        
        // Test patches table access
        const { data: patchTest, error: patchError } = await supabase
          .from('patches')
          .select('count')
          .limit(1)
        
        console.log("🧪 Patches table access test:", { count: patchTest?.length, error: patchError })
        
        // Test patches_with_geojson view access  
        const { data: viewTest, error: viewError } = await supabase
          .from('patches_with_geojson')
          .select('id')
          .limit(1)
        
        console.log("🧪 Patches view access test:", { count: viewTest?.length, error: viewError })
        
      } else {
        console.log("❌ No authenticated user")
      }
    }
    checkAuth()
  }, [])

  // Fetch patch data with geometry (only geographic patches)
  const { data: patches = [], error: patchesError, isLoading: patchesLoading } = useQuery<PatchData[]>({
    queryKey: ["patches-with-geometry"],
    queryFn: async () => {
      console.log("🔍 Starting patch data fetch (via view)...")

      try {
        // Single-query approach: use view that exposes GeoJSON
        const { data, error } = await supabase
          .from("patches_with_geojson")
          .select("id, name, code, geom_geojson")
          .not("geom_geojson", "is", null)

        console.log("📊 patches_with_geojson result:", {
          count: data?.length || 0,
          error,
          sample: data?.[0]
        })

        if (error) {
          console.error("❌ Patches view query failed:", error)
          throw error
        }

        if (!data || data.length === 0) {
          console.warn("⚠️ No patches returned from patches_with_geojson")
          return []
        }

        // Diagnostic counts to reconcile with admin/spatial views
        try {
          const [{ count: geoTotal }, { count: geoWithGeom }, { count: activeGeoWithGeom }] = await Promise.all([
            supabase.from("patches").select("*", { count: "exact", head: true }).eq("type", "geo"),
            supabase.from("patches").select("*", { count: "exact", head: true }).eq("type", "geo").not("geom", "is", null),
            supabase.from("patches").select("*", { count: "exact", head: true }).eq("type", "geo").eq("status", "active").not("geom", "is", null)
          ])
          console.log("📈 Patch diagnostics:", {
            geoTotal,
            geoWithGeom,
            activeGeoWithGeom,
            viewCount: data.length
          })
        } catch (diagErr) {
          console.warn("⚠️ Failed to compute patch diagnostics:", diagErr)
        }

        const normalized: PatchData[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          code: row.code,
          // View is only used for geographic shapes; normalize type/status for styling
          type: "geo",
          status: "active",
          geom_geojson: row.geom_geojson
        }))

        console.log("✅ Final patches with GeoJSON:", normalized.length)
        return normalized
      } catch (err) {
        console.error("❌ Patch query completely failed:", err)
        throw err
      }
    },
    enabled: showPatches,
    retry: 1,
    staleTime: 30000
  })

  // Log patch loading state and errors
  console.log("🗺️ Map state:", { 
    showPatches, 
    patchesLoading, 
    patchesCount: patches.length, 
    patchesError,
    mapsLoaded 
  })

  // Fetch job sites data
  const { data: jobSites = [], error: jobSitesError, isLoading: jobSitesLoading } = useQuery({
    queryKey: ["job-sites-for-map"],
    queryFn: async () => {
      console.log("🏗️ Starting job sites fetch...")
      
      try {
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
            projects:projects!fk_job_sites_project(name)
          `)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
        
        console.log("📊 Job sites query result:", {
          count: data?.length || 0,
          error: error,
          sample: data?.[0]
        })
        
        if (error) {
          console.error("❌ Job sites query failed:", error)
          throw error
        }
        
        console.log("✅ Job sites loaded:", data?.length || 0)
        return (data || []) as unknown as JobSiteData[]
      } catch (err) {
        console.error("❌ Job sites query completely failed:", err)
        throw err
      }
    },
    enabled: showJobSites,
    retry: 1,
    staleTime: 30000
  })

  // Log job sites state
  console.log("🏗️ Job sites state:", { 
    showJobSites, 
    jobSitesLoading, 
    jobSitesCount: jobSites.length, 
    jobSitesError 
  })

  // Filter patches (only geographic patches are loaded)
  const filteredPatches = useMemo(() => {
    if (!showPatches) return []
    return patches // All patches are already filtered to geographic and active
  }, [patches, showPatches])

  // Convert GeoJSON to Google Maps Polygon paths
  // Extract polygons from GeoJSON. Returns an array of polygons; each polygon is an array of rings; each ring is an array of LatLng points
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
      console.warn("⚠️ Unsupported GeoJSON type:", geojson.type)
      return []
    } catch (e) {
      console.warn("⚠️ Failed to parse GeoJSON:", e)
      return []
    }
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

  // Handle job site marker click
  const handleJobSiteClick = useCallback((jobSite: JobSiteData) => {
    setSelectedJobSite(jobSite)
    setSelectedPatch(null)
    setInfoWindowPosition({
      lat: jobSite.latitude,
      lng: jobSite.longitude
    })
  }, [])

  // Handle map click to close info windows
  const handleMapClick = useCallback(() => {
    setSelectedPatch(null)
    setSelectedJobSite(null)
    setInfoWindowPosition(null)
  }, [])

  // Auto-fit bounds when data changes
  useEffect(() => {
    if (!map || (!filteredPatches.length && !jobSites.length)) return

    const bounds = new google.maps.LatLngBounds()
    let hasPoints = false

    // Add patch bounds
    filteredPatches.forEach(patch => {
      if (patch.geom_geojson) {
        const polys = extractPolygonsFromGeoJSON(patch.geom_geojson)
        polys.forEach((rings) => {
          const outer = rings[0] || []
          outer.forEach((point) => { bounds.extend(point); hasPoints = true })
        })
      }
    })

    // Add job site bounds
    if (showJobSites) {
      jobSites.forEach(site => {
        bounds.extend({ lat: site.latitude, lng: site.longitude })
        hasPoints = true
      })
    }

    if (hasPoints) {
      map.fitBounds(bounds)
    }
  }, [map, filteredPatches, jobSites, showJobSites, extractPolygonsFromGeoJSON])
  // Build organiser labels per patch
  const patchIdsForLabels = useMemo(() => (showOrganisers ? filteredPatches.map(p => p.id) : []), [filteredPatches, showOrganisers])
  const { byPatchId: organiserNamesByPatch } = usePatchOrganiserLabels(patchIdsForLabels)

  // Helpers for label placement
  const centroidOfRing = (ring: google.maps.LatLngLiteral[]) => {
    if (!ring.length) return null
    const sum = ring.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 })
    return { lat: sum.lat / ring.length, lng: sum.lng / ring.length }
  }
  const bboxArea = (ring: google.maps.LatLngLiteral[]) => {
    if (!ring.length) return 0
    let minLat = ring[0].lat, maxLat = ring[0].lat, minLng = ring[0].lng, maxLng = ring[0].lng
    for (const p of ring) { if (p.lat < minLat) minLat = p.lat; if (p.lat > maxLat) maxLat = p.lat; if (p.lng < minLng) minLng = p.lng; if (p.lng > maxLng) maxLng = p.lng }
    return Math.abs((maxLat - minLat) * (maxLng - minLng))
  }

  const mapOptions = useMemo(() => ({
    disableDefaultUI: false,
    clickableIcons: false,
    mapTypeId: mapMode === "satellite" ? "satellite" : "roadmap",
    styles: mapMode === "standard" ? [
      {
        featureType: "poi",
        elementType: "labels",
        stylers: [{ visibility: "off" }]
      }
    ] : []
  }), [mapMode])

  // Deterministic color per patch id
  const colorForPatch = useCallback((patchId: string) => {
    // Hash string to HSL
    let hash = 0
    for (let i = 0; i < patchId.length; i++) hash = (hash * 31 + patchId.charCodeAt(i)) >>> 0
    const hue = hash % 360
    const fill = `hsl(${hue} 80% 60%)`
    return fill
  }, [])

  // Compute label for patch
  const labelForPatch = useCallback((patch: PatchData, organiserNames: string[] | undefined) => {
    const namePart = showPatchNames ? patch.name : undefined
    const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined
    if (namePart && orgPart) return `${namePart} — ${orgPart}`
    return namePart || orgPart || undefined
  }, [showPatchNames, showOrganisers])

  // Handle loading states
  if (mapsError) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-center">
          <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{mapsError}</p>
        </div>
      </div>
    )
  }

  if (!mapsLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    )
  }

  return (
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={10}
        options={mapOptions}
        onLoad={setMap}
        onClick={handleMapClick}
      >
        {/* Render Patches as Polygons */}
        {showPatches && filteredPatches.map(patch => {
          console.log("🎨 Rendering patch:", patch.name, patch.geom_geojson ? "has geometry" : "NO GEOMETRY")
          
          if (!patch.geom_geojson) {
            console.warn("⚠️ Patch has no geom_geojson:", patch)
            return null
          }
          
          const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson)
          if (polygons.length === 0) {
            console.warn("⚠️ No paths generated for patch:", patch.name)
            return null
          }
          const color = colorForPatch(patch.id)
          return (
            <>
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
            </>
          )
        })}

        {/* Render labels for patches (centroid markers with text) */}
        {showPatches && (showPatchNames || showOrganisers) && filteredPatches.map(patch => {
          if (!patch.geom_geojson) return null
          const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson)
          if (polygons.length === 0) return null
          // Pick centroid of the largest polygon's outer ring
          let best: { center: google.maps.LatLngLiteral | null; area: number } = { center: null, area: 0 }
          polygons.forEach(rings => {
            const outer = rings[0] || []
            const area = bboxArea(outer)
            if (area > best.area) best = { center: centroidOfRing(outer), area }
          })
          const pos = best.center
          if (!pos) return null
          const label = labelForPatch(patch, organiserNamesByPatch[patch.id])
          if (!label) return null
          return (
            <Marker
              key={`label-${patch.id}`}
              position={pos}
              icon={{
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='1' height='1'></svg>`),
                scaledSize: new google.maps.Size(1, 1)
              }}
              label={{ text: label, color: "#111827", fontSize: "12px", fontWeight: "600" }}
            />
          )
        })}

        {/* Debug: compare view vs table counts to help diagnose missing patches */}
        {/* Intentionally logs in queryFn and auth check above */}

        {/* Render Job Sites as Markers */}
        {showJobSites && jobSites.map(site => (
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
                <p className="text-sm text-gray-600 mb-2">
                  Project: {selectedJobSite.projects.name}
                </p>
              )}
              <div className="flex gap-2">
                <Link href={`/projects/${selectedJobSite.project_id}`}>
                  <Button size="sm" variant="outline" className="flex items-center gap-2">
                    <Building className="h-3 w-3" />
                    View Project
                  </Button>
                </Link>
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
      </GoogleMap>
  )
}

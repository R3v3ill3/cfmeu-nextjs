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
import { getProjectColor } from "@/utils/projectColors"
import { useNavigationLoading } from "@/hooks/useNavigationLoading"

interface InteractiveMapProps {
  showJobSites: boolean
  showPatches: boolean
  selectedPatchTypes: string[]
  mapMode: "standard" | "satellite"
  showPatchNames?: boolean
  showOrganisers?: boolean
  selectedPatchIds?: string[]
  projectColorBy?: 'tier' | 'organising_universe' | 'stage' | 'builder_eba' | 'default'
  labelMode?: 'always' | 'hover' | 'key' | 'off'
  autoFocusPatches?: boolean
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
    tier?: string | null
    organising_universe?: string | null
    stage_class?: string | null
    builder_id?: string | null
    project_assignments?: Array<{
      assignment_type?: string | null
      contractor_role_types?: any
      employers?: any
    }>
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
  showOrganisers = false,
  selectedPatchIds = [],
  projectColorBy = 'default',
  labelMode = 'always',
  autoFocusPatches = false
}: InteractiveMapProps) {
  const { startNavigation } = useNavigationLoading()
  const [map, setMap] = useState<google.maps.Map | null>(null)
  const [selectedPatch, setSelectedPatch] = useState<PatchData | null>(null)
  const [selectedJobSite, setSelectedJobSite] = useState<JobSiteData | null>(null)
  const [infoWindowPosition, setInfoWindowPosition] = useState<{ lat: number, lng: number } | null>(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [mapsError, setMapsError] = useState<string | null>(null)
  const [hoveredPatchId, setHoveredPatchId] = useState<string | null>(null)

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
            projects:projects!fk_job_sites_project(
              name,
              tier,
              organising_universe,
              stage_class,
              builder_id,
              project_assignments:project_assignments(
                assignment_type,
                contractor_role_types(code),
                employers(name, enterprise_agreement_status)
              )
            )
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
    
    // If specific patches are selected via FiltersBar, filter to only those
    if (selectedPatchIds.length > 0) {
      return patches.filter(patch => selectedPatchIds.includes(patch.id))
    }
    
    // Otherwise show all patches (already filtered to geographic and active)
    return patches
  }, [patches, showPatches, selectedPatchIds])

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

  const deriveBuilderStatus = useCallback((project: any): 'active_builder' | 'inactive_builder' | 'unknown_builder' => {
    try {
      if (!project) return 'unknown_builder'
      const assignmentsRaw = project.project_assignments || []
      const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw : [assignmentsRaw]
      const builderAssignments = assignments.filter((pa) => {
        if (pa?.assignment_type !== 'contractor_role') return false
        const roleTypes = Array.isArray(pa?.contractor_role_types) ? pa.contractor_role_types : (pa?.contractor_role_types ? [pa.contractor_role_types] : [])
        return roleTypes.some((rt: any) => rt?.code === 'builder' || rt?.code === 'head_contractor')
      })

      for (const assignment of builderAssignments) {
        const employers = Array.isArray(assignment?.employers) ? assignment.employers : (assignment?.employers ? [assignment.employers] : [])
        for (const emp of employers) {
          if (emp?.enterprise_agreement_status === true) return 'active_builder'
          if (emp && (emp?.enterprise_agreement_status === false || emp?.enterprise_agreement_status === 'no_eba')) return 'inactive_builder'
        }
        if (employers.length > 0) return 'inactive_builder'
      }

      // Legacy builder_id without status info -> unknown
      if (project.builder_id) return 'unknown_builder'
    } catch {}
    return 'unknown_builder'
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

  // Handle patch hover
  const handlePatchMouseOver = useCallback((patch: PatchData) => {
    setHoveredPatchId(patch.id)
  }, [])

  const handlePatchMouseOut = useCallback(() => {
    setHoveredPatchId(null)
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
    if (!map) return

    // For auto-focus mode (batch printing), only focus on selected patches
    if (autoFocusPatches && selectedPatchIds.length > 0 && filteredPatches.length > 0) {
      const bounds = new google.maps.LatLngBounds()
      let hasPoints = false

      // Add only the selected patch bounds
      filteredPatches.forEach(patch => {
        if (patch.geom_geojson) {
          const polys = extractPolygonsFromGeoJSON(patch.geom_geojson)
          polys.forEach((rings) => {
            const outer = rings[0] || []
            outer.forEach((point) => { bounds.extend(point); hasPoints = true })
          })
        }
      })

      if (hasPoints) {
        map.fitBounds(bounds)
        // Add some padding and limit max zoom for better visibility
        setTimeout(() => {
          const currentZoom = map.getZoom() || 10
          if (currentZoom > 16) {
            map.setZoom(16) // Max zoom to maintain context
          }
        }, 100)
      }
      return
    }

    // Regular auto-fit logic for normal viewing
    if (!filteredPatches.length && !jobSites.length) return

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
  }, [map, filteredPatches, jobSites, showJobSites, extractPolygonsFromGeoJSON, autoFocusPatches, selectedPatchIds])
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
                  onMouseOver={() => handlePatchMouseOver(patch)}
                  onMouseOut={handlePatchMouseOut}
                />
              ))}
            </>
          )
        })}

        {/* Render labels for patches (centroid markers with text) - Group by location */}
        {(() => {
          if (!showPatches || (!showPatchNames && !showOrganisers) || labelMode === 'off') return null;
          
          // For key mode, show only patch codes and exit early
          if (labelMode === 'key') {
            return filteredPatches.map(patch => {
              if (!patch.geom_geojson) return null;
              const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson);
              if (polygons.length === 0) return null;
              
              // Pick centroid of the largest polygon's outer ring
              let best: { center: google.maps.LatLngLiteral | null; area: number } = { center: null, area: 0 };
              polygons.forEach(rings => {
                const outer = rings[0] || [];
                const area = bboxArea(outer);
                if (area > best.area) best = { center: centroidOfRing(outer), area };
              });
              
              const pos = best.center;
              if (!pos) return null;
              
              // Show only the patch code in large font
              const codeLabel = patch.code || patch.name;
              
              const svgIcon = `
                <svg xmlns='http://www.w3.org/2000/svg' width='80' height='40' viewBox='0 0 80 40'>
                  <defs>
                    <filter id="code-shadow-${patch.id}" x="-20%" y="-20%" width="140%" height="140%">
                      <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.8"/>
                    </filter>
                  </defs>
                  <rect x='2' y='6' width='76' height='28' rx='4' ry='4' 
                        fill='rgba(0,0,0,0.9)' stroke='rgba(255,255,255,0.4)' stroke-width='1' 
                        filter="url(#code-shadow-${patch.id})"/>
                  <text x='40' y='26' text-anchor='middle' fill='white' 
                        font-family='Arial, sans-serif' font-size='16' font-weight='bold'>
                    ${codeLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                  </text>
                </svg>
              `;
              
              return (
                <Marker
                  key={`code-${patch.id}`}
                  position={pos}
                  icon={{
                    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgIcon),
                    scaledSize: new google.maps.Size(80, 40),
                    anchor: new google.maps.Point(40, 20)
                  }}
                />
              );
            });
          }
          
          // Continue with regular label logic only for non-key modes
          
          // Group patches by their centroid coordinates to handle multiple patches at same location
          const patchGroups = new Map<string, {
            position: google.maps.LatLngLiteral;
            patches: Array<{patch: PatchData; organiserNames: string[] | undefined}>;
          }>();
          
          filteredPatches.forEach(patch => {
            
            if (!patch.geom_geojson) return;
            const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson);
            if (polygons.length === 0) return;
            
            // Pick centroid of the largest polygon's outer ring
            let best: { center: google.maps.LatLngLiteral | null; area: number } = { center: null, area: 0 };
            polygons.forEach(rings => {
              const outer = rings[0] || [];
              const area = bboxArea(outer);
              if (area > best.area) best = { center: centroidOfRing(outer), area };
            });
            
            const pos = best.center;
            if (!pos) return;
            
            // Create a key based on rounded coordinates to group nearby patches
            const locationKey = `${Math.round(pos.lat * 10000)},${Math.round(pos.lng * 10000)}`;
            
            if (!patchGroups.has(locationKey)) {
              patchGroups.set(locationKey, {
                position: pos,
                patches: []
              });
            }
            
            patchGroups.get(locationKey)!.patches.push({
              patch,
              organiserNames: organiserNamesByPatch[patch.id]
            });
          });
          
          // Render one label per location group
          return Array.from(patchGroups.entries()).map(([locationKey, group]) => {
            // For hover mode, only show if any patch in this group is hovered
            if (labelMode === 'hover') {
              const hasHoveredPatch = group.patches.some(p => p.patch.id === hoveredPatchId);
              if (!hasHoveredPatch) return null;
            }
            // Combine all patch names and organiser names
            const allPatchNames = group.patches.map(p => p.patch.name).filter(Boolean);
            const allOrganiserNames = group.patches
              .flatMap(p => p.organiserNames || [])
              .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
            
            const namePart = showPatchNames && allPatchNames.length > 0 ? allPatchNames.join(", ") : undefined;
            const orgPart = showOrganisers && allOrganiserNames.length > 0 ? allOrganiserNames.join(", ") : undefined;
            
            let label: string;
            if (namePart && orgPart) {
              label = `${namePart} — ${orgPart}`;
            } else {
              label = namePart || orgPart || "";
            }
            
            if (!label) return null;
            
            // Calculate label dimensions based on text length
            const fontSize = 12;
            const charWidth = fontSize * 0.6; // Approximate character width
            const padding = 12; // Horizontal padding
            const minWidth = 120;
            const maxWidth = 400;
            const labelWidth = Math.min(maxWidth, Math.max(minWidth, label.length * charWidth + padding));
            const labelHeight = 40;
            
            // Create SVG with dynamic width for better readability
            const svgIcon = `
              <svg xmlns='http://www.w3.org/2000/svg' width='${labelWidth}' height='${labelHeight}' viewBox='0 0 ${labelWidth} ${labelHeight}'>
                <defs>
                  <filter id="shadow-${locationKey}" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="2" dy="2" stdDeviation="2" flood-color="black" flood-opacity="0.6"/>
                  </filter>
                </defs>
                <rect x='2' y='6' width='${labelWidth - 4}' height='28' rx='4' ry='4' 
                      fill='rgba(0,0,0,0.8)' stroke='rgba(255,255,255,0.3)' stroke-width='1' 
                      filter="url(#shadow-${locationKey})"/>
                <text x='${labelWidth / 2}' y='24' text-anchor='middle' fill='white' 
                      font-family='Arial, sans-serif' font-size='${fontSize}' font-weight='bold'>
                  ${label.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
                </text>
              </svg>
            `;
            
            return (
              <Marker
                key={`label-group-${locationKey}`}
                position={group.position}
                icon={{
                  url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svgIcon),
                  scaledSize: new google.maps.Size(labelWidth, labelHeight),
                  anchor: new google.maps.Point(labelWidth / 2, labelHeight / 2)
                }}
              />
            );
          });
        })()}

        {/* Debug: compare view vs table counts to help diagnose missing patches */}
        {/* Intentionally logs in queryFn and auth check above */}

        {/* Render Job Sites as Markers */}
        {showJobSites && jobSites.map(site => {
          const project = site.projects || {}
          if (projectColorBy === 'builder_eba') {
            const builderStatus = deriveBuilderStatus(project)
            const color = getProjectColor('builder_eba', { builder_status: builderStatus } as any)
            const useFavicon = builderStatus === 'active_builder'
            const icon = useFavicon
              ? {
                  url: '/favicon.ico',
                  scaledSize: new google.maps.Size(24, 24),
                  anchor: new google.maps.Point(12, 12)
                }
              : {
                  url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                      <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                    </svg>
                  `),
                  scaledSize: new google.maps.Size(24, 24),
                  anchor: new google.maps.Point(12, 12)
                }
            return (
              <Marker
                key={site.id}
                position={{ lat: site.latitude, lng: site.longitude }}
                icon={icon as any}
                onClick={() => handleJobSiteClick(site)}
              />
            )
          }
          const color = getProjectColor(projectColorBy, project)
          return (
            <Marker
              key={site.id}
              position={{ lat: site.latitude, lng: site.longitude }}
              icon={{
                url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                  </svg>
                `),
                scaledSize: new google.maps.Size(24, 24),
                anchor: new google.maps.Point(12, 12)
              }}
              onClick={() => handleJobSiteClick(site)}
            />
          )
        })}

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
                <Link 
                  href={`/projects/${selectedJobSite.project_id}`}
                  onClick={() => startNavigation(`/projects/${selectedJobSite.project_id}`)}
                >
                  <Button size="sm" variant="outline" className="flex items-center gap-2">
                    <Building className="h-3 w-3" />
                    View Project
                  </Button>
                </Link>
                {selectedJobSite.patch_id && (
                  <Link 
                    href={`/patch?patch=${selectedJobSite.patch_id}`}
                    onClick={() => startNavigation(`/patch?patch=${selectedJobSite.patch_id}`)}
                  >
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

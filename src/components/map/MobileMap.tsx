'use client';
import { GoogleMap, Polygon, Marker } from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePatchOrganiserLabels } from '@/hooks/usePatchOrganiserLabels';
import { getProjectColor } from '@/utils/projectColors';
import { MapErrorBoundary } from '@/components/map/MapErrorBoundary';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { AlertCircle } from 'lucide-react';

interface MobileMapProps {
  showJobSites?: boolean;
  showPatchNames?: boolean;
  showOrganisers?: boolean;
  selectedPatchIds?: string[];
  projectColorBy?: 'tier' | 'organising_universe' | 'stage' | 'builder_eba' | 'default';
  labelMode?: 'always' | 'hover' | 'key' | 'off';
  autoFocusPatches?: boolean;
}

interface PatchData {
  id: string;
  name: string;
  code: string;
  geom_geojson: any;
}

interface JobSiteData {
  id: string;
  name: string;
  location: string;
  latitude: number;
  longitude: number;
  project_id: string;
  patch_id: string | null;
  projects?: {
    name?: string;
    tier?: string | null;
    organising_universe?: string | null;
    stage_class?: string | null;
  };
}

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 200px)', // Adjust height for mobile view
};

const center = {
  lat: -33.8688,
  lng: 151.2093,
};

function MobileMap({
  showJobSites = true,
  showPatchNames = false,
  showOrganisers = false,
  selectedPatchIds = [],
  projectColorBy = 'builder_eba',
  labelMode = 'always',
  autoFocusPatches = false
}: MobileMapProps) {
  const { isLoaded, loadError } = useGoogleMaps();
  const isOnline = useNetworkStatus();

  const [hoveredPatchId, setHoveredPatchId] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  // Refs for marker clustering
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const labelMarkersRef = useRef<google.maps.Marker[]>([]);

  // Fetch patch data with geometry
  const { data: patches = [] } = useQuery<PatchData[]>({
    queryKey: ["mobile-patches-with-geometry"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("patches_with_geojson")
        .select("id, name, code, geom_geojson")
        .not("geom_geojson", "is", null);

      if (error) throw error;
      return (data || []) as PatchData[];
    },
    retry: 1,
    staleTime: 30000
  });

  // Fetch job sites data
  const { data: jobSites = [] } = useQuery({
    queryKey: ["mobile-job-sites-for-map"],
    queryFn: async () => {
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
        .not("longitude", "is", null);
      
      if (error) throw error;
      return (data || []) as JobSiteData[];
    },
    enabled: showJobSites,
    retry: 1,
    staleTime: 30000
  });
  const deriveBuilderStatus = useCallback((project: any): 'active_builder' | 'inactive_builder' | 'unknown_builder' => {
    try {
      if (!project) return 'unknown_builder'
      const assignmentsRaw = (project as any).project_assignments || []
      const assignments = Array.isArray(assignmentsRaw) ? assignmentsRaw : [assignmentsRaw]
      const builderAssignments = assignments.filter((pa: any) => {
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
      if ((project as any).builder_id) return 'unknown_builder'
    } catch {}
    return 'unknown_builder'
  }, [])


  // Filter patches based on selected patch IDs from FiltersBar
  const filteredPatches = useMemo(() => {
    // If specific patches are selected via FiltersBar, filter to only those
    if (selectedPatchIds.length > 0) {
      return patches.filter(patch => selectedPatchIds.includes(patch.id));
    }
    
    // Otherwise show all patches
    return patches;
  }, [patches, selectedPatchIds]);

  // Get organiser labels for filtered patches
  const patchIdsForLabels = showOrganisers ? filteredPatches.map(p => p.id) : [];
  const { byPatchId: organiserNamesByPatch } = usePatchOrganiserLabels(patchIdsForLabels);

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
      console.warn("⚠️ Failed to parse GeoJSON:", e)
      return []
    }
  }, []);

  // Deterministic color per patch id
  const colorForPatch = useCallback((patchId: string) => {
    let hash = 0;
    for (let i = 0; i < patchId.length; i++) hash = (hash * 31 + patchId.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 80% 60%)`;
  }, []);

  // Helper functions for label placement
  const centroidOfRing = (ring: google.maps.LatLngLiteral[]) => {
    if (!ring.length) return null;
    const sum = ring.reduce((acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }), { lat: 0, lng: 0 });
    return { lat: sum.lat / ring.length, lng: sum.lng / ring.length };
  };

  const bboxArea = (ring: google.maps.LatLngLiteral[]) => {
    if (!ring.length) return 0;
    let minLat = ring[0].lat, maxLat = ring[0].lat, minLng = ring[0].lng, maxLng = ring[0].lng;
    for (const p of ring) { 
      if (p.lat < minLat) minLat = p.lat; 
      if (p.lat > maxLat) maxLat = p.lat; 
      if (p.lng < minLng) minLng = p.lng; 
      if (p.lng > maxLng) maxLng = p.lng; 
    }
    return Math.abs((maxLat - minLat) * (maxLng - minLng));
  };

  // Handle patch hover
  const handlePatchMouseOver = useCallback((patch: PatchData) => {
    setHoveredPatchId(patch.id);
  }, []);

  const handlePatchMouseOut = useCallback(() => {
    setHoveredPatchId(null);
  }, []);

  // Marker clustering effect for job sites
  useEffect(() => {
    if (!map || !isLoaded || !showJobSites || jobSites.length === 0) {
      return;
    }

    // Clear existing job site markers and clusterer
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create markers for all job sites
    const newMarkers = jobSites.map(site => {
      const project = site.projects || {};
      const status = deriveBuilderStatus(project);
      const color = getProjectColor(projectColorBy, { builder_status: status, ...project } as any);
      const useFavicon = projectColorBy === 'builder_eba' && status === 'active_builder';

      const icon = useFavicon
        ? {
            url: '/favicon.ico',
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          }
        : {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                <circle cx="12" cy="12" r="3" fill="#ffffff"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
          };

      const marker = new google.maps.Marker({
        position: { lat: site.latitude, lng: site.longitude },
        icon: icon as any,
        title: site.name,
        optimized: true
      });

      return marker;
    });

    markersRef.current = newMarkers;

    // Create clusterer with mobile-optimized settings
    const clusterer = new MarkerClusterer({
      map,
      markers: newMarkers,
      renderer: {
        render: ({ count, position }) => {
          // Larger clusters for mobile touch targets
          const size = count < 10 ? 50 : count < 100 ? 60 : 70;
          const fontSize = count < 10 ? 16 : count < 100 ? 18 : 20;

          return new google.maps.Marker({
            position,
            icon: {
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 3}" fill="#ef4444" stroke="#ffffff" stroke-width="3" opacity="0.9"/>
                  <text x="${size/2}" y="${size/2 + fontSize/3}" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="bold" font-family="Arial">
                    ${count}
                  </text>
                </svg>
              `),
              scaledSize: new google.maps.Size(size, size),
              anchor: new google.maps.Point(size/2, size/2)
            },
            label: {
              text: String(count),
              color: 'transparent',
              fontSize: '0px'
            },
            zIndex: Number(google.maps.Marker.MAX_ZINDEX) + count
          });
        }
      },
      algorithmOptions: {
        radius: 120, // Slightly larger radius for mobile
        maxZoom: 14 // Cluster until zoom level 14
      }
    });

    clustererRef.current = clusterer;

    return () => {
      if (clustererRef.current) {
        clustererRef.current.clearMarkers();
        clustererRef.current = null;
      }
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];
    };
  }, [map, isLoaded, showJobSites, jobSites, projectColorBy, deriveBuilderStatus]);

  // Auto-focus on selected patches for batch printing
  useEffect(() => {
    if (!map || !autoFocusPatches || selectedPatchIds.length === 0 || filteredPatches.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    filteredPatches.forEach(patch => {
      if (patch.geom_geojson) {
        try {
          const geojson = patch.geom_geojson;
          
          const extractCoords = (coords: any): google.maps.LatLngLiteral[] => {
            if (geojson.type === 'Polygon') {
              return coords[0].map(([lng, lat]: [number, number]) => ({ lat, lng }));
            } else if (geojson.type === 'MultiPolygon') {
              return coords.flat(2).filter((_: any, i: number) => i % 2 === 0)
                .map((lng: number, i: number) => ({ 
                  lat: coords.flat(2)[i * 2 + 1], 
                  lng 
                }));
            }
            return [];
          };
          
          const coordinates = extractCoords(geojson.coordinates);
          coordinates.forEach(coord => {
            bounds.extend(coord);
            hasPoints = true;
          });
        } catch (e) {
          console.warn('Could not process geometry for mobile patch:', patch.name);
        }
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds);
      // Limit max zoom for better context
      setTimeout(() => {
        const currentZoom = map.getZoom() || 10;
        if (currentZoom > 15) {
          map.setZoom(15); // Max zoom for mobile
        }
      }, 100);
    }
  }, [map, autoFocusPatches, selectedPatchIds, filteredPatches]);

  // Compute label for patch
  const labelForPatch = useCallback((patch: PatchData, organiserNames: string[] | undefined) => {
    const namePart = showPatchNames ? patch.name : undefined;
    const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
    if (namePart && orgPart) return `${namePart} — ${orgPart}`;
    return namePart || orgPart || undefined;
  }, [showPatchNames, showOrganisers]);

  // Handle offline state
  if (!isOnline) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-yellow-50 rounded-lg border-2 border-yellow-200">
        <AlertCircle className="h-12 w-12 text-yellow-600 mb-4" />
        <h3 className="text-lg font-semibold mb-2">You are offline</h3>
        <p className="text-sm text-yellow-800 text-center max-w-md px-4">
          Map features require an internet connection. Please check your network and try again.
        </p>
      </div>
    );
  }

  // Handle map load error
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-semibold mb-2">Map Failed to Load</h3>
        <p className="text-sm text-gray-600 mb-4 max-w-md text-center px-4">
          {loadError.message || 'There was an error loading Google Maps.'}
        </p>
      </div>
    );
  }

  // Handle loading state
  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600">Loading map...</p>
        </div>
      </div>
    );
  }

  return (
    <MapErrorBoundary>
      <GoogleMap 
      mapContainerStyle={containerStyle} 
      center={center} 
      zoom={10}
      onLoad={setMap}
    >
      {/* Render Patches as Polygons */}
      {filteredPatches.map(patch => {
        if (!patch.geom_geojson) return null;
        const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson);
        const color = colorForPatch(patch.id);
        return polygons.map((rings, idx) => (
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
            onMouseOver={() => handlePatchMouseOver(patch)}
            onMouseOut={handlePatchMouseOut}
          />
        ));
      })}

      {/* Render labels for patches (centroid markers with text) - Group by location */}
      {(() => {
        if (!showPatchNames && !showOrganisers || labelMode === 'off') return null;
        
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
            
            // Show only the patch code in large font (smaller for mobile)
            const codeLabel = patch.code || patch.name;
            
            const svgIcon = `
              <svg xmlns='http://www.w3.org/2000/svg' width='60' height='30' viewBox='0 0 60 30'>
                <defs>
                  <filter id="code-shadow-mobile-${patch.id}" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.8"/>
                  </filter>
                </defs>
                <rect x='2' y='4' width='56' height='22' rx='3' ry='3' 
                      fill='rgba(0,0,0,0.9)' stroke='rgba(255,255,255,0.4)' stroke-width='1' 
                      filter="url(#code-shadow-mobile-${patch.id})"/>
                <text x='30' y='19' text-anchor='middle' fill='white' 
                      font-family='Arial, sans-serif' font-size='12' font-weight='bold'>
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
                  scaledSize: new google.maps.Size(60, 30),
                  anchor: new google.maps.Point(30, 15)
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
          
          // Calculate label dimensions based on text length (smaller for mobile)
          const fontSize = 10;
          const charWidth = fontSize * 0.6; // Approximate character width
          const padding = 10; // Horizontal padding
          const minWidth = 100;
          const maxWidth = 300;
          const labelWidth = Math.min(maxWidth, Math.max(minWidth, label.length * charWidth + padding));
          const labelHeight = 32;
          
          // Create SVG with dynamic width for better readability (smaller for mobile)
          const svgIcon = `
            <svg xmlns='http://www.w3.org/2000/svg' width='${labelWidth}' height='${labelHeight}' viewBox='0 0 ${labelWidth} ${labelHeight}'>
              <defs>
                <filter id="shadow-mobile-${locationKey}" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="black" flood-opacity="0.6"/>
                </filter>
              </defs>
              <rect x='2' y='4' width='${labelWidth - 4}' height='24' rx='3' ry='3' 
                    fill='rgba(0,0,0,0.8)' stroke='rgba(255,255,255,0.3)' stroke-width='1' 
                    filter="url(#shadow-mobile-${locationKey})"/>
              <text x='${labelWidth / 2}' y='19' text-anchor='middle' fill='white' 
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

      {/* Job site markers are now rendered via clustering effect - see useEffect above */}
    </GoogleMap>
    </MapErrorBoundary>
  );
}

export default MobileMap;

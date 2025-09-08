'use client';
import { GoogleMap, useJsApiLoader, Polygon, Marker } from '@react-google-maps/api';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePatchOrganiserLabels } from '@/hooks/usePatchOrganiserLabels';
import { getProjectColor } from '@/utils/projectColors';

interface MobileMapProps {
  showJobSites?: boolean;
  showPatchNames?: boolean;
  showOrganisers?: boolean;
  selectedPatchIds?: string[];
  projectColorBy?: 'tier' | 'organising_universe' | 'stage' | 'default';
  labelMode?: 'always' | 'hover' | 'key' | 'off';
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
  projectColorBy = 'default',
  labelMode = 'always'
}: MobileMapProps) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [hoveredPatchId, setHoveredPatchId] = useState<string | null>(null);

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
          projects:projects!fk_job_sites_project(name, tier, organising_universe, stage_class)
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

  // Compute label for patch
  const labelForPatch = useCallback((patch: PatchData, organiserNames: string[] | undefined) => {
    const namePart = showPatchNames ? patch.name : undefined;
    const orgPart = showOrganisers && organiserNames && organiserNames.length > 0 ? organiserNames.join(", ") : undefined;
    if (namePart && orgPart) return `${namePart} — ${orgPart}`;
    return namePart || orgPart || undefined;
  }, [showPatchNames, showOrganisers]);

  return isLoaded ? (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={10}>
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
        if (!showPatchNames && !showOrganisers || labelMode === 'off' || labelMode === 'key') return null;
        
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

      {/* Render Job Sites as Markers */}
      {showJobSites && jobSites.map(site => {
        const color = getProjectColor(projectColorBy, site.projects || {});
        return (
          <Marker
            key={site.id}
            position={{ lat: site.latitude, lng: site.longitude }}
            icon={{
              url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="12" cy="12" r="8" fill="${color}" stroke="#ffffff" stroke-width="2"/>
                  <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                </svg>
              `),
              scaledSize: new google.maps.Size(20, 20),
              anchor: new google.maps.Point(10, 10)
            }}
          />
        );
      })}
    </GoogleMap>
  ) : <></>;
}

export default MobileMap;

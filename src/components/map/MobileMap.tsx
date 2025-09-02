'use client';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

const containerStyle = {
  width: '100%',
  height: 'calc(100vh - 200px)', // Adjust height for mobile view
};

const center = {
  lat: -33.8688,
  lng: 151.2093,
};

function MobileMap() {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
  });

  const [patches, setPatches] = useState<any[]>([]);

  useEffect(() => {
    const fetchPatches = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.from('patches_with_geojson').select('*');
      if (error) {
        console.error('Error fetching patches:', error);
      } else if (data) {
        setPatches(data);
      }
    };
    fetchPatches();
  }, []);

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

  return isLoaded ? (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={10}>
      {patches.map(patch => {
        if (!patch.geom_geojson) return null;
        const polygons = extractPolygonsFromGeoJSON(patch.geom_geojson);
        return polygons.map((rings, idx) => (
          <Polygon
            key={`${patch.id}-${idx}`}
            paths={rings}
            options={{
              fillOpacity: 0.2,
              strokeOpacity: 1,
              strokeWeight: 2,
            }}
          />
        ));
      })}
    </GoogleMap>
  ) : <></>;
}

export default MobileMap;

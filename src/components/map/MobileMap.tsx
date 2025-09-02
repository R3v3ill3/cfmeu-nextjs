'use client';
import { GoogleMap, useJsApiLoader, Polygon } from '@react-google-maps/api';
import { useState, useEffect } from 'react';
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

  const polygons = patches.map(patch => {
    if (!patch.geom_geojson) return null;
    const geojson = typeof patch.geom_geojson === 'string' ? JSON.parse(patch.geom_geojson) : patch.geom_geojson;
    const paths = geojson.coordinates[0].map((coord: any) => ({ lat: coord[1], lng: coord[0] }));
    return <Polygon key={patch.id} paths={paths} />;
  });

  return isLoaded ? (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={10}>
      {polygons}
    </GoogleMap>
  ) : <></>;
}

export default MobileMap;

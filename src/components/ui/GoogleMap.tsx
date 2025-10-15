'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin, ZoomIn, ZoomOut, AlertCircle } from 'lucide-react';
import { GoogleMap as RGMMap, Polygon as RGMPolygon, MarkerF as RGMMarker } from '@react-google-maps/api';
import { useGoogleMaps } from '@/providers/GoogleMapsProvider';

interface GoogleMapProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  patches?: Array<{
    id: string;
    name: string;
    geom: string;
    color?: string;
  }>;
  height?: string;
  showControls?: boolean;
  onPatchClick?: (patchId: string) => void;
  projectMarkers?: Array<{ id: string; name: string; lat: number; lng: number; color?: string; iconUrl?: string }>;
  onProjectClick?: (projectId: string) => void;
}

declare global {
  interface Window {
    google?: any;
  }
}

export function GoogleMap({
  center = { lat: -25.2744, lng: 133.7751 },
  zoom = 5,
  patches = [],
  height = '400px',
  showControls = true,
  onPatchClick,
  projectMarkers = [],
  onProjectClick,
}: GoogleMapProps) {
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const [mapError, setMapError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const { isLoaded, loadError } = useGoogleMaps();

  useEffect(() => {
    setDebugInfo(`Loaded: ${isLoaded ? 'Yes' : 'No'}`);
    if (loadError) setMapError('Failed to load Google Maps script. Please check your API key and internet connection.');
  }, [isLoaded, loadError]);

  // WKT parsing helpers -> returns array of polygons, each with optional holes
  const parseWktPolygons = (wktRaw: string): Array<{ paths: google.maps.LatLngLiteral[][] }> => {
    const result: Array<{ paths: google.maps.LatLngLiteral[][] }> = [];
    if (!wktRaw || typeof wktRaw !== 'string') return result;
    let wkt = wktRaw.trim();
    const sridSep = wkt.indexOf(';');
    if (wkt.toUpperCase().startsWith('SRID') && sridSep > -1) {
      wkt = wkt.slice(sridSep + 1).trim();
    }
    const toRing = (coords: string): google.maps.LatLngLiteral[] => {
      return coords.split(',').map(p => {
        const [lng, lat] = p.trim().split(/\s+/);
        return { lat: parseFloat(lat), lng: parseFloat(lng) };
      }).filter(pt => !Number.isNaN(pt.lat) && !Number.isNaN(pt.lng));
    };
    const parsePolygonBody = (body: string): google.maps.LatLngLiteral[][] => {
      // body like: ((outer),(hole)) OR (outer) depending on stripping level
      const rings: string[] = [];
      let depth = 0; let buf = '';
      for (let i = 0; i < body.length; i++) {
        const c = body[i];
        if (c === '(') { depth++; if (depth === 1) { buf = ''; } else if (depth >= 2) { buf += c; } }
        else if (c === ')') { if (depth >= 2) { buf += c; } depth--; if (depth === 0) { if (buf) rings.push(buf.replace(/^\(|\)$/g, '')); buf = ''; } }
        else if (c === ',' && depth === 0) { /* between polygons/higher level */ }
        else { if (depth >= 1) buf += c; }
      }
      if (!rings.length) {
        // Fallback: maybe single ring without extra () nesting
        const single = body.replace(/^\(|\)$/g, '');
        if (single.includes(',')) rings.push(single);
      }
      return rings.map(r => toRing(r));
    };
    const upper = wkt.toUpperCase();
    if (upper.startsWith('POLYGON')) {
      const inner = wkt.replace(/^POLYGON\s*\(/i, '').replace(/\)\s*$/i, '');
      const paths = parsePolygonBody(inner).filter(r => r.length >= 3);
      if (paths.length) result.push({ paths });
      return result;
    }
    if (upper.startsWith('MULTIPOLYGON')) {
      const inner = wkt.replace(/^MULTIPOLYGON\s*\(/i, '').replace(/\)\s*$/i, '');
      // Iterate top-level polygons separated by '),(' at depth 0
      let depth = 0; let buf = ''; const polys: string[] = [];
      for (let i = 0; i < inner.length; i++) {
        const c = inner[i];
        if (c === '(') { depth++; buf += c; }
        else if (c === ')') { depth--; buf += c; if (depth === 0) { polys.push(buf); buf = ''; } }
        else { buf += c; }
      }
      polys.forEach(p => {
        const body = p.replace(/^\(\(/, '(').replace(/\)\)$/, ')');
        const paths = parsePolygonBody(body).filter(r => r.length >= 3);
        if (paths.length) result.push({ paths });
      });
      return result;
    }
    return result;
  };

  // Precompute polygons from patches
  const polygons = useMemo(() => {
    return patches.flatMap(patch => {
      const parsed = parseWktPolygons(patch.geom);
      return parsed.map(pol => ({ id: patch.id, name: patch.name, color: patch.color || '#FF0000', paths: pol.paths }));
    });
  }, [patches]);

  // Fit bounds when polygons or map are ready
  useEffect(() => {
    if (!map || !polygons.length || !window.google?.maps) return;
    const bounds = new window.google.maps.LatLngBounds();
    polygons.forEach(pg => {
      pg.paths.forEach(ring => ring.forEach(pt => bounds.extend(pt)));
    });
    if (!bounds.isEmpty()) map.fitBounds(bounds);
  }, [map, polygons]);

  const handleZoomIn = () => {
    if (map) {
      const newZoom = Math.min((map.getZoom() ?? currentZoom) + 1, 20);
      map.setZoom(newZoom);
      setCurrentZoom(newZoom);
    }
  };

  const handleZoomOut = () => {
    if (map) {
      const newZoom = Math.max((map.getZoom() ?? currentZoom) - 1, 1);
      map.setZoom(newZoom);
      setCurrentZoom(newZoom);
    }
  };

  if (mapError) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-600">{mapError}</p>
          {debugInfo && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs text-gray-600">
              <strong>Debug:</strong> {debugInfo}
            </div>
          )}
          <Button 
            variant="outline" 
            onClick={() => window.location.reload()} 
            className="mt-3"
          >
            Reload Page
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Patch Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          {(!isLoaded || !map) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
              <div className="text-center">
                <img src="/spinner.gif" alt="Loading" className="h-8 w-8 mx-auto mb-2" />
                <div className="text-sm text-gray-600">Loading map...</div>
                {debugInfo && (
                  <div className="text-xs text-gray-500 mt-1">{debugInfo}</div>
                )}
              </div>
            </div>
          )}
          
          <div className="rounded-b-lg" style={{ height, width: '100%' }}>
            {isLoaded && (
              <RGMMap
                onLoad={(m) => { setMap(m); setCurrentZoom(m.getZoom() ?? zoom); }}
                center={center}
                zoom={zoom}
                options={{ mapTypeControl: false, streetViewControl: false, fullscreenControl: false }}
                mapContainerStyle={{ height, width: '100%' }}
              >
                {polygons.map((pg) => (
                  <RGMPolygon
                    key={`${pg.id}-${pg.paths[0]?.[0]?.lat ?? Math.random()}`}
                    paths={pg.paths}
                    options={{
                      strokeColor: pg.color,
                      strokeOpacity: 0.8,
                      strokeWeight: 2,
                      fillColor: pg.color,
                      fillOpacity: 0.35,
                    }}
                    onClick={() => onPatchClick?.(pg.id)}
                  />
                ))}
                {projectMarkers.map(pm => {
                  const icon = pm.iconUrl
                    ? { url: pm.iconUrl, scaledSize: new window.google.maps.Size(24, 24), anchor: new window.google.maps.Point(12, 12) }
                    : pm.color
                    ? {
                        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="8" fill="${pm.color}" stroke="#ffffff" stroke-width="2"/>
                            <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                          </svg>
                        `),
                        scaledSize: new window.google.maps.Size(24, 24),
                        anchor: new window.google.maps.Point(12, 12)
                      }
                    : undefined
                  return (
                    <RGMMarker
                      key={`prj-${pm.id}`}
                      position={{ lat: pm.lat, lng: pm.lng }}
                      title={pm.name}
                      onClick={() => onProjectClick?.(pm.id)}
                      icon={icon as any}
                    />
                  )
                })}
              </RGMMap>
            )}
          </div>
          
          {showControls && map && (
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleZoomIn}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleZoomOut}
                className="h-8 w-8 p-0"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Debug Panel */}
        {debugInfo && (
          <div className="p-3 bg-gray-50 border-t">
            <div className="text-xs text-gray-600">
              <strong>Debug:</strong> {debugInfo}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Loaded: {isLoaded ? 'Yes' : 'No'} | Map Instance: {map ? 'Yes' : 'No'}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
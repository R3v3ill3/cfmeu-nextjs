'use client';

import {  useMemo, useState  } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MapPin, Eye, EyeOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap } from '@/components/ui/GoogleMap';

interface PatchMapViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Patch {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  geom: string;
}

interface ProjectPoint {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  patch_id: string | null;
}

export function PatchMapViewer({ open, onOpenChange }: PatchMapViewerProps) {
  const [selectedPatchId, setSelectedPatchId] = useState<string | null>(null);
  const [visiblePatches, setVisiblePatches] = useState<Set<string>>(new Set());

  // Fetch all patches with geometry
  const { data: patches = [], isLoading } = useQuery({
    queryKey: ['admin-patch-map-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_patches_with_geometry_text');

      if (error) throw error;
      return (data || []) as Patch[];
    },
    enabled: open
  });

  // Fetch projects (job sites) with coordinates; filter by visible geo patches when applied
  const { data: projectPoints = [] } = useQuery({
    queryKey: ['map-project-points', open],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('job_sites')
        .select('id,name,latitude,longitude,patch_id')
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .limit(2000);
      if (error) throw error;
      return (data || []) as ProjectPoint[];
    }
  });

  // Only render geo patches; non-geo types are excluded from the map
  const geoPatches = patches.filter(p => p.type === 'geo' && Boolean(p.geom));

  // Generate colors (only relevant for geo patches)
  const getPatchColor = (_type: string, status: string) => {
    if (status !== 'active') return '#808080';
    return '#FF0000';
  };

  // Prepare patches for map display
  const mapPatches = geoPatches
    .filter(patch => visiblePatches.has(patch.id) || visiblePatches.size === 0)
    .map(patch => ({
      ...patch,
      color: getPatchColor(patch.type, patch.status)
    }));

  const visibleProjectMarkers = useMemo(() => {
    const allowed = new Set(
      mapPatches.map(p => p.id)
    );
    const filterByPatch = visiblePatches.size === 0 ? null : allowed;
    return (projectPoints as ProjectPoint[])
      .filter(p => typeof p.latitude === 'number' && typeof p.longitude === 'number')
      .filter(p => !filterByPatch || (p.patch_id && filterByPatch.has(p.patch_id)))
      .map(p => ({ id: p.id, name: p.name, lat: p.latitude as number, lng: p.longitude as number }));
  }, [projectPoints, mapPatches, visiblePatches]);

  const handlePatchClick = (patchId: string) => {
    setSelectedPatchId(patchId);
  };

  const togglePatchVisibility = (patchId: string) => {
    setVisiblePatches(prev => {
      const next = new Set(prev);
      if (next.has(patchId)) {
        next.delete(patchId);
      } else {
        next.add(patchId);
      }
      return next;
    });
  };

  const showAllPatches = () => {
    setVisiblePatches(new Set(geoPatches.map(p => p.id)));
  };

  const hideAllPatches = () => {
    setVisiblePatches(new Set());
  };

  const selectedPatch = geoPatches.find(p => p.id === selectedPatchId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Patch Map Viewer
          </DialogTitle>
          <DialogDescription>
            View and interact with all patches on an interactive map. Click on patches to see details and toggle visibility.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex gap-4 h-[80vh]">
          {/* Map */}
          <div className="flex-1 h-full">
            <GoogleMap
              patches={mapPatches}
              height="640px"
              showControls={true}
              onPatchClick={handlePatchClick}
              projectMarkers={visibleProjectMarkers}
              onProjectClick={(projectId) => {
                try { window.open(`/projects/${projectId}`, '_blank') } catch {}
              }}
            />
          </div>

          {/* Sidebar */}
          <div className="w-80 space-y-4 overflow-y-auto">
            {/* Controls */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Button size="sm" onClick={showAllPatches} variant="outline">
                  <Eye className="h-4 w-4 mr-1" />
                  Show All
                </Button>
                <Button size="sm" onClick={hideAllPatches} variant="outline">
                  <EyeOff className="h-4 w-4 mr-1" />
                  Hide All
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                {geoPatches.length} geo patches • {mapPatches.length} visible
              </p>
            </div>

            {/* Patch List */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">Geo patches</h3>
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {geoPatches.map(patch => (
                  <div
                    key={patch.id}
                    className={`p-2 rounded border cursor-pointer transition-colors ${
                      visiblePatches.has(patch.id) || visiblePatches.size === 0
                        ? 'border-gray-300 bg-white'
                        : 'border-gray-200 bg-gray-50'
                    } ${
                      selectedPatchId === patch.id ? 'ring-2 ring-blue-500' : ''
                    }`}
                    onClick={() => {
                      setSelectedPatchId(patch.id);
                      if (!visiblePatches.has(patch.id) && visiblePatches.size > 0) {
                        setVisiblePatches(prev => new Set([...prev, patch.id]));
                      }
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{patch.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {patch.code}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge variant={patch.status === 'active' ? 'default' : 'secondary'}>
                          {patch.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePatchVisibility(patch.id);
                          }}
                        >
                          {visiblePatches.has(patch.id) || visiblePatches.size === 0 ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Selected Patch Details */}
            {selectedPatch && (
              <div className="border rounded-lg p-3 bg-gray-50">
                <h4 className="font-medium text-sm mb-2">Selected Patch</h4>
                <div className="space-y-1 text-sm">
                  <div><span className="font-medium">Name:</span> {selectedPatch.name}</div>
                  <div><span className="font-medium">Code:</span> {selectedPatch.code}</div>
                  <div><span className="font-medium">Type:</span> {selectedPatch.type}</div>
                  <div><span className="font-medium">Status:</span> {selectedPatch.status}</div>
                  <div className="pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/patch?patch=${selectedPatch.id}`, '_blank')}
                    >
                      View Patch Details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-2"
                      onClick={() => {
                        if (navigator.clipboard) navigator.clipboard.writeText(selectedPatch.geom || '');
                      }}
                    >
                      Copy WKT
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="border rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Legend</h4>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Geo patches</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-500 rounded"></div>
                  <span>Inactive</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

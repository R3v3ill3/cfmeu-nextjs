'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink, Palette } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap } from '@/components/ui/GoogleMap';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getProjectColor, getColorSchemeLegend } from '@/utils/projectColors';

interface AllPatchesMapProps {
  height?: string;
  selectedPatchIds?: string[];
  onPatchClick?: (patchId: string) => void;
}

interface Patch {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  geom: string;
}

interface JobSiteMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  project_id: string;
  project_name: string;
  patch_id: string;
}

export function AllPatchesMap({ 
  height = '500px', 
  selectedPatchIds = [],
  onPatchClick 
}: AllPatchesMapProps) {
  const router = useRouter();
  const [projectColorBy, setProjectColorBy] = useState<'tier' | 'organising_universe' | 'stage' | 'builder_eba' | 'default'>('builder_eba')
  // Fetch all active geo patches
  const { data: patches = [], isLoading: patchesLoading } = useQuery({
    queryKey: ['all-patches-map-data'],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_patches_with_geometry_text');

      if (error) throw error;
      return (data || []) as Patch[];
    }
  });

  // Fetch all job sites with projects for the selected patches (or all if none selected)
  const { data: jobSites = [], isLoading: sitesLoading } = useQuery({
    queryKey: ['all-patch-job-sites', selectedPatchIds],
    queryFn: async () => {
      let query = supabase
        .from('patch_job_sites')
        .select(`
          patch_id,
          job_site_id,
          job_sites:job_site_id (
            id,
            name,
            latitude,
            longitude,
            project_id,
            projects:project_id (
              id,
              name
            )
          )
        `)
        .is('effective_to', null);

      // Filter by selected patches if any are specified
      if (selectedPatchIds.length > 0) {
        query = query.in('patch_id', selectedPatchIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return (data || [])
        .map((item: any) => {
          const site = item.job_sites;
          const project = site?.projects;
          if (!site || !site.latitude || !site.longitude) return null;
          
          return {
            id: site.id,
            name: site.name,
            lat: site.latitude,
            lng: site.longitude,
            project_id: project?.id || '',
            project_name: project?.name || 'Unknown Project',
            patch_id: item.patch_id
          } as JobSiteMarker;
        })
        .filter(Boolean) as JobSiteMarker[];
    }
  });

  const isLoading = patchesLoading || sitesLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
            <span>Loading patches map...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Generate color based on patch type
  const getPatchColor = (type: string, status: string, isSelected: boolean) => {
    if (status !== 'active') return '#808080'; // Gray for inactive
    
    // Highlight selected patches
    if (isSelected) {
      switch (type) {
        case 'geo': return '#FF0000'; // Bright red for selected geo patches
        case 'trade': return '#00FF00'; // Bright green for selected trade patches
        case 'sub-sector': return '#0000FF'; // Bright blue for selected sub-sector patches
        default: return '#FFA500'; // Orange for other selected types
      }
    }
    
    // Muted colors for unselected patches
    switch (type) {
      case 'geo': return '#FF9999'; // Light red for unselected geo patches
      case 'trade': return '#99FF99'; // Light green for unselected trade patches
      case 'sub-sector': return '#9999FF'; // Light blue for unselected sub-sector patches
      default: return '#FFD699'; // Light orange for other unselected types
    }
  };

  const mapPatches = patches.map(patch => ({
    ...patch,
    color: getPatchColor(patch.type, patch.status, selectedPatchIds.includes(patch.id))
  }));

  // Convert job sites to project markers for the map
  const projectMarkers = jobSites.map(site => {
    if (projectColorBy === 'builder_eba') {
      // We don't have builder status in this query; fall back to default colored circle
      // Future improvement: join project_assignments here similar to other maps
      return {
        id: site.project_id,
        name: `${site.project_name} - ${site.name}`,
        lat: site.lat,
        lng: site.lng,
        color: getProjectColor('builder_eba', { builder_status: 'unknown_builder' } as any)
      }
    }
    return {
      id: site.project_id,
      name: `${site.project_name} - ${site.name}`,
      lat: site.lat,
      lng: site.lng
    }
  });

  const handleProjectClick = (projectId: string) => {
    // Navigate to the project detail page
    router.push(`/projects/${projectId}`);
  };

  const handlePatchClickInternal = (patchId: string) => {
    if (onPatchClick) {
      onPatchClick(patchId);
    } else {
      // Default behavior: navigate to patch page with selection
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('patch', patchId);
      router.push(currentUrl.pathname + currentUrl.search);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {selectedPatchIds.length > 0 ? 'Selected Patches Map' : 'All Patches Map'}
            {jobSites.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {jobSites.length} project{jobSites.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Palette className="h-4 w-4 text-gray-500" />
            <Select value={projectColorBy} onValueChange={(value) => setProjectColorBy(value as typeof projectColorBy)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Color projects by..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default (Blue)</SelectItem>
                <SelectItem value="tier">Tier</SelectItem>
                <SelectItem value="organising_universe">Organising Universe</SelectItem>
                <SelectItem value="stage">Stage</SelectItem>
                <SelectItem value="builder_eba">Builder EBA Status</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline">
              {patches.length} patch{patches.length !== 1 ? 'es' : ''}
            </Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(`/admin?tab=patches`, '_blank')}
              className="h-8 w-8 p-0"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <GoogleMap
          patches={mapPatches}
          projectMarkers={projectMarkers}
          height={height}
          showControls={true}
          onPatchClick={handlePatchClickInternal}
          onProjectClick={handleProjectClick}
        />
        {projectColorBy !== 'default' && (
          <div className="p-3 bg-muted/50 border-t">
            <div className="text-sm font-medium mb-2">Project Colour Legend</div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {getColorSchemeLegend(projectColorBy).map(({ label, color }) => {
                if (projectColorBy === 'builder_eba' && label.startsWith('Builder = EBA active')) {
                  return (
                    <div key={label} className="flex items-center gap-2">
                      <img src="/favicon.ico" alt="Active EBA" className="w-4 h-4" />
                      <span className="text-sm">{label}</span>
                    </div>
                  )
                }
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: color }} />
                    <span className="text-sm">{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        {selectedPatchIds.length === 0 && (
          <div className="p-3 bg-muted/50 border-t text-xs text-muted-foreground">
            Click on a patch to view its details, or click on project markers to view project details.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

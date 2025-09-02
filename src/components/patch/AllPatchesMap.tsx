'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap } from '@/components/ui/GoogleMap';

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
  const projectMarkers = jobSites.map(site => ({
    id: site.project_id,
    name: `${site.project_name} - ${site.name}`,
    lat: site.lat,
    lng: site.lng
  }));

  const handleProjectClick = (projectId: string) => {
    // Navigate to the project detail page
    window.location.href = `/projects/${projectId}`;
  };

  const handlePatchClickInternal = (patchId: string) => {
    if (onPatchClick) {
      onPatchClick(patchId);
    } else {
      // Default behavior: navigate to patch page with selection
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('patch', patchId);
      window.location.href = currentUrl.toString();
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
          <div className="flex items-center gap-2">
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
        {selectedPatchIds.length === 0 && (
          <div className="p-3 bg-muted/50 border-t text-xs text-muted-foreground">
            Click on a patch to view its details, or click on project markers to view project details.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

;
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, ExternalLink } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { GoogleMap } from '@/components/ui/GoogleMap';

interface PatchMapProps {
  patchId: string;
  height?: string;
}

interface JobSiteMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  project_id: string;
  project_name: string;
}

interface Patch {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  geom: string;
}

export function PatchMap({ patchId, height = '400px' }: PatchMapProps) {
  const { data: patch, isLoading, error } = useQuery({
    queryKey: ['patch-map-data', patchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_patches_with_geometry_text')
        .eq('id', patchId)
        .single();

      if (error) throw error;
      return data as Patch;
    }
  });

  // Fetch job sites within this patch
  const { data: jobSites = [] } = useQuery({
    queryKey: ['patch-job-sites', patchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('patch_job_sites')
        .select(`
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
        .eq('patch_id', patchId)
        .is('effective_to', null);

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
            project_name: project?.name || 'Unknown Project'
          } as JobSiteMarker;
        })
        .filter(Boolean) as JobSiteMarker[];
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="flex items-center justify-center gap-2">
            <img src="/spinner.gif" alt="Loading" className="h-4 w-4" />
            <span>Loading patch map...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !patch) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-red-600">Failed to load patch map</p>
        </CardContent>
      </Card>
    );
  }

  if (!patch.geom) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">This patch doesn't have a map boundary defined</p>
        </CardContent>
      </Card>
    );
  }

  // Generate color based on patch type
  const getPatchColor = (type: string, status: string) => {
    if (status !== 'active') return '#808080'; // Gray for inactive
    
    switch (type) {
      case 'geo': return '#FF0000'; // Red for geo patches
      case 'trade': return '#00FF00'; // Green for trade patches
      case 'sub-sector': return '#0000FF'; // Blue for sub-sector patches
      default: return '#FFA500'; // Orange for other types
    }
  };

  const mapPatches = [{
    ...patch,
    color: getPatchColor(patch.type, patch.status)
  }];

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

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Patch Map
            {jobSites.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {jobSites.length} project{jobSites.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={patch.status === 'active' ? 'default' : 'secondary'}>
              {patch.status}
            </Badge>
            <Badge variant="outline">{patch.type}</Badge>
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
          onPatchClick={() => {}} // No action needed for single patch view
          onProjectClick={handleProjectClick}
        />
      </CardContent>
    </Card>
  );
}

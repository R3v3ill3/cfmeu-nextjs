'use client';

;
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
  // Use a simpler approach: query job_sites directly filtered by patch_id to avoid RLS issues with nested selects
  const { data: jobSites = [], error: jobSitesError } = useQuery({
    queryKey: ['patch-job-sites', patchId],
    enabled: !!patchId,
    queryFn: async () => {
      // First, try to get job sites via patch_job_sites (simpler query without nested selects)
      const { data: patchJobSites, error: patchError } = await supabase
        .from('patch_job_sites')
        .select('job_site_id')
        .eq('patch_id', patchId)
        .is('effective_to', null);

      if (patchError) {
        console.warn('Could not fetch patch_job_sites:', patchError);
        // Fallback: try querying job_sites directly by patch_id
        const { data: directSites, error: directError } = await supabase
          .from('job_sites')
          .select('id, name, latitude, longitude, project_id')
          .eq('patch_id', patchId)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null);

        if (directError) {
          console.warn('Could not fetch job sites directly:', directError);
          return [];
        }

        // Get project names for these sites
        const projectIds = (directSites || [])
          .map((s: any) => s.project_id)
          .filter(Boolean);
        
        let projectMap = new Map<string, string>();
        if (projectIds.length > 0) {
          const { data: projects } = await supabase
            .from('projects')
            .select('id, name')
            .in('id', projectIds);
          
          if (projects) {
            projects.forEach((p: any) => {
              projectMap.set(String(p.id), p.name || 'Unknown Project');
            });
          }
        }

        return (directSites || []).map((site: any) => ({
          id: site.id,
          name: site.name,
          lat: site.latitude,
          lng: site.longitude,
          project_id: site.project_id || '',
          project_name: projectMap.get(String(site.project_id)) || 'Unknown Project'
        })) as JobSiteMarker[];
      }

      // If patch_job_sites query succeeded, get the job site IDs
      const jobSiteIds = (patchJobSites || [])
        .map((item: any) => item.job_site_id)
        .filter(Boolean);

      if (jobSiteIds.length === 0) return [];

      // Query job_sites directly (simpler, avoids nested RLS issues)
      const { data: sites, error: sitesError } = await supabase
        .from('job_sites')
        .select('id, name, latitude, longitude, project_id')
        .in('id', jobSiteIds)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (sitesError) {
        console.warn('Could not fetch job sites:', sitesError);
        return [];
      }

      // Get project names separately to avoid nested select RLS issues
      const projectIds = (sites || [])
        .map((s: any) => s.project_id)
        .filter(Boolean);
      
      let projectMap = new Map<string, string>();
      if (projectIds.length > 0) {
        const { data: projects } = await supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIds);
        
        if (projects) {
          projects.forEach((p: any) => {
            projectMap.set(String(p.id), p.name || 'Unknown Project');
          });
        }
      }

      return (sites || []).map((site: any) => ({
        id: site.id,
        name: site.name,
        lat: site.latitude,
        lng: site.longitude,
        project_id: site.project_id || '',
        project_name: projectMap.get(String(site.project_id)) || 'Unknown Project'
      })) as JobSiteMarker[];
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
          {error && (
            <p className="text-sm text-muted-foreground mt-2">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // Log job sites error but don't block rendering
  if (jobSitesError) {
    console.warn('Could not load job sites for map:', jobSitesError);
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
    lng: site.lng,
    color: '#3B82F6' // Blue color for project markers to ensure visibility
  }));

  const handleProjectClick = (projectId: string) => {
    // Navigate to the project detail page
    window.location.href = `/projects/${projectId}`;
  };

  return (
    <Card>
      <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {jobSites.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {jobSites.length} project{jobSites.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={patch.status === 'active' ? 'default' : 'secondary'}>
              {patch.status}
            </Badge>
            <Badge variant="outline">{patch.type}</Badge>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.open(`/admin?tab=patches`, '_blank')}
              className="h-8 w-8 p-0 min-h-[44px] min-w-[44px]"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        </div>
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

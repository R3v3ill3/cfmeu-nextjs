'use client';

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Info, Loader2, MapPin, Users, Building2 } from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface UnassignedProject {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  patch_id: string | null;
}

interface PatchAssignment {
  patch_id: string;
  patch_name: string;
  project_count: number;
  unassigned_count: number;
}

export default function SpatialAssignmentTool() {
  const [isAssigning, setIsAssigning] = useState(false);
  const [progress, setProgress] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get unassigned projects
  const { data: unassignedProjects = [], refetch: refetchProjects } = useQuery({
    queryKey: ['unassigned-projects'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('job_sites')
        .select(`
          id,
          project_id,
          projects!inner(
            id,
            name
          ),
          location,
          full_address,
          latitude,
          longitude,
          patch_id
        `)
        .is('patch_id', null)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null);

      if (error) throw error;
      
      return (data || []).map(site => ({
        id: (site.projects as any)?.id || site.project_id,
        name: (site.projects as any)?.name || 'Unknown Project',
        address: site.full_address || site.location,
        latitude: site.latitude,
        longitude: site.longitude,
        patch_id: site.patch_id
      }));
    }
  });

  // Get patch statistics
  const { data: patchStats = [] } = useQuery({
    queryKey: ['patch-assignment-stats'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('patches')
        .select(`
          id,
          name,
          type
        `)
        .eq('type', 'geo');

      if (error) throw error;

      // Get project counts for each patch
      const stats = await Promise.all(
        (data || []).map(async (patch) => {
          const { count: projectCount } = await supabase
            .from('job_sites')
            .select('*', { count: 'exact', head: true })
            .eq('patch_id', patch.id);

          const { count: unassignedCount } = await supabase
            .from('job_sites')
            .select('*', { count: 'exact', head: true })
            .is('patch_id', null)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);

          return {
            patch_id: patch.id,
            patch_name: patch.name,
            project_count: projectCount || 0,
            unassigned_count: unassignedCount || 0
          };
        })
      );

      return stats;
    }
  });

  // Spatial assignment mutation
  const assignProjectsMutation = useMutation({
    mutationFn: async () => {
      setIsAssigning(true);
      setProgress(0);
      
      const supabase = getSupabaseBrowserClient();
      let assigned = 0;
      let errors = 0;
      const total = unassignedProjects.length;

      for (let i = 0; i < total; i++) {
        const project = unassignedProjects[i];
        
        try {
          // Find which patch contains this project's coordinates
          const { data: patches, error } = await supabase
            .rpc('find_patch_for_coordinates', {
              lat: project.latitude,
              lng: project.longitude
            });

          if (error) throw error;

          if (patches && patches.length > 0) {
            // Assign to the first matching patch
            const { error: updateError } = await supabase
              .from('job_sites')
              .update({ patch_id: patches[0].id })
              .eq('project_id', project.id)
              .is('patch_id', null);

            if (updateError) throw updateError;
            assigned++;
          }
          
        } catch (error) {
          console.error(`Error assigning project ${project.id}:`, error);
          errors++;
        }

        setProgress(((i + 1) / total) * 100);
      }

      return { assigned, errors, total };
    },
    onSuccess: (result) => {
      toast({
        title: "Spatial assignment completed",
        description: `Assigned: ${result.assigned}, Errors: ${result.errors}, Total: ${result.total}`,
        variant: result.errors > 0 ? "destructive" : "default"
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['unassigned-projects'] });
      queryClient.invalidateQueries({ queryKey: ['patch-assignment-stats'] });
      refetchProjects();
    },
    onError: (error) => {
      toast({
        title: "Spatial assignment failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive"
      });
    },
    onSettled: () => {
      setIsAssigning(false);
      setProgress(0);
    }
  });

  const handleSpatialAssignment = () => {
    if (unassignedProjects.length === 0) {
      toast({
        title: "No projects to assign",
        description: "All projects with coordinates are already assigned to patches",
        variant: "default"
      });
      return;
    }

    assignProjectsMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Spatial Assignment Tool</h2>
          <p className="text-gray-600 mt-1">
            Automatically assign projects to patches based on geographic coordinates
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Summary Cards */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Unassigned Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unassignedProjects.length}</div>
            <p className="text-xs text-muted-foreground">
              Projects with coordinates but no patch
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Geographic Patches</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{patchStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Active geographic patches
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {patchStats.reduce((sum, p) => sum + p.project_count, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Projects currently assigned to patches
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Assignment Action */}
      <Card>
        <CardHeader>
          <CardTitle>Automatic Assignment</CardTitle>
          <CardDescription>
            Use PostGIS spatial queries to automatically assign unassigned projects to patches
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {unassignedProjects.length > 0 ? (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Found {unassignedProjects.length} projects with coordinates that can be automatically assigned to patches.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All projects with coordinates are already assigned to patches.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            onClick={handleSpatialAssignment}
            disabled={isAssigning || unassignedProjects.length === 0}
            className="w-full"
          >
            {isAssigning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning Projects...
              </>
            ) : (
              <>
                <MapPin className="mr-2 h-4 w-4" />
                Assign Projects to Patches
              </>
            )}
          </Button>

          {isAssigning && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Patch Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Patch Assignment Statistics</CardTitle>
          <CardDescription>
            Current project distribution across patches
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {patchStats.map((patch) => (
              <div key={patch.patch_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{patch.patch_name}</span>
                  <Badge variant="secondary">{patch.project_count} projects</Badge>
                </div>
                <div className="text-sm text-gray-500">
                  {patch.unassigned_count} unassigned nearby
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

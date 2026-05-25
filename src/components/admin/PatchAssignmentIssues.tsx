'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  Layers,
  CircleDot,
} from 'lucide-react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { withTimeout, isTimeoutError } from '@/lib/util/withTimeout';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Total dataset is <2000 sites, so the RPC's PL/pgSQL loop should complete in
// well under 20s. If it doesn't, surface a clear timeout to the user rather
// than letting Vercel's 30/60s function limit close the connection silently.
const REEVALUATE_RPC_TIMEOUT_MS = 20_000;

interface IssueJobSite {
  id: string;
  name: string;
  location: string;
  full_address: string | null;
  latitude: number | null;
  longitude: number | null;
  patch_id: string | null;
  patch_assignment_status: string;
  overlap_patch_ids: string[] | null;
  project_id: string | null;
  project_name: string | null;
  current_patch_name: string | null;
}

interface PatchOption {
  id: string;
  name: string;
  code: string;
}

type FilterStatus = 'all' | 'overlap' | 'gap' | 'fallback';

export function PatchAssignmentIssues() {
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [isReevaluating, setIsReevaluating] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch job sites with assignment issues
  const { data: issueSites = [], isLoading: sitesLoading, refetch: refetchSites } = useQuery({
    queryKey: ['patch-assignment-issues'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('job_sites')
        .select(`
          id,
          name,
          location,
          full_address,
          latitude,
          longitude,
          patch_id,
          patch_assignment_status,
          overlap_patch_ids,
          project_id,
          projects!inner(name),
          patches:patch_id(name)
        `)
        .in('patch_assignment_status', ['overlap', 'gap', 'fallback'])
        .order('patch_assignment_status', { ascending: true });

      if (error) throw error;

      return (data || []).map((site: any) => ({
        id: site.id,
        name: site.name,
        location: site.location,
        full_address: site.full_address,
        latitude: site.latitude,
        longitude: site.longitude,
        patch_id: site.patch_id,
        patch_assignment_status: site.patch_assignment_status,
        overlap_patch_ids: site.overlap_patch_ids,
        project_id: site.project_id,
        project_name: site.projects?.name || null,
        current_patch_name: site.patches?.name || null,
      }));
    },
  });

  // Fetch all active geo patches for the manual assignment dropdown
  const { data: allPatches = [] } = useQuery({
    queryKey: ['all-geo-patches'],
    queryFn: async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('patches')
        .select('id, name, code')
        .eq('type', 'geo')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return (data || []) as PatchOption[];
    },
  });

  // Fetch patch names for overlap_patch_ids display
  const overlapPatchIds = useMemo(() => {
    const ids = new Set<string>();
    issueSites.forEach(site => {
      site.overlap_patch_ids?.forEach(id => ids.add(id));
    });
    return Array.from(ids);
  }, [issueSites]);

  const { data: overlapPatchNames = {} } = useQuery({
    queryKey: ['overlap-patch-names', overlapPatchIds],
    queryFn: async () => {
      if (overlapPatchIds.length === 0) return {};
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from('patches')
        .select('id, name')
        .in('id', overlapPatchIds);

      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach(p => { map[p.id] = p.name; });
      return map;
    },
    enabled: overlapPatchIds.length > 0,
  });

  // Summary counts
  const counts = useMemo(() => {
    const c = { overlap: 0, gap: 0, fallback: 0, total: 0 };
    issueSites.forEach(s => {
      if (s.patch_assignment_status === 'overlap') c.overlap++;
      else if (s.patch_assignment_status === 'gap') c.gap++;
      else if (s.patch_assignment_status === 'fallback') c.fallback++;
    });
    c.total = c.overlap + c.gap + c.fallback;
    return c;
  }, [issueSites]);

  // Filtered sites
  const filteredSites = useMemo(() => {
    if (filterStatus === 'all') return issueSites;
    return issueSites.filter(s => s.patch_assignment_status === filterStatus);
  }, [issueSites, filterStatus]);

  // Manual patch assignment mutation
  const assignPatchMutation = useMutation({
    mutationFn: async ({ siteId, patchId }: { siteId: string; patchId: string }) => {
      const supabase = getSupabaseBrowserClient();

      // Close any existing patch_job_sites link
      await supabase
        .from('patch_job_sites')
        .update({ effective_to: new Date().toISOString() })
        .eq('job_site_id', siteId)
        .is('effective_to', null);

      // Update the job site
      const { error: updateError } = await supabase
        .from('job_sites')
        .update({
          patch_id: patchId,
          patch_assignment_status: 'manual',
          overlap_patch_ids: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', siteId);

      if (updateError) throw updateError;

      // Create new patch_job_sites link
      const { error: linkError } = await supabase
        .from('patch_job_sites')
        .insert({ patch_id: patchId, job_site_id: siteId });

      if (linkError && !linkError.message?.includes('duplicate')) throw linkError;
    },
    onSuccess: () => {
      toast({
        title: 'Patch assigned',
        description: 'Job site has been manually assigned to the selected patch.',
      });
      queryClient.invalidateQueries({ queryKey: ['patch-assignment-issues'] });
    },
    onError: (error) => {
      toast({
        title: 'Assignment failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  // Re-evaluate all assignments
  const handleReevaluate = async () => {
    setIsReevaluating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // Bounded client-side timeout — paired with the DB-side statement_timeout
      // applied by migration tighten_rpc_statement_timeouts. If the RPC stalls
      // (e.g. spatial trigger contention), the user gets an explicit toast
      // rather than an indefinite spinner.
      const { data, error } = await withTimeout(
        supabase.rpc('reevaluate_patch_assignments'),
        REEVALUATE_RPC_TIMEOUT_MS,
        'reevaluate_patch_assignments'
      );

      if (error) throw error;

      const result = data?.[0] || data;
      toast({
        title: 'Re-evaluation complete',
        description: `Processed: ${result?.total_sites || 0} sites. Clean: ${result?.clean_count || 0}, Overlaps: ${result?.overlap_count || 0}, Gaps: ${result?.gap_count || 0}`,
      });

      queryClient.invalidateQueries({ queryKey: ['patch-assignment-issues'] });
      queryClient.invalidateQueries({ queryKey: ['unassigned-projects'] });
      queryClient.invalidateQueries({ queryKey: ['patch-assignment-stats'] });
    } catch (error) {
      if (isTimeoutError(error)) {
        toast({
          title: 'Re-evaluation timed out',
          description: `The operation did not finish within ${Math.round(REEVALUATE_RPC_TIMEOUT_MS / 1000)}s. It may still be running in the background — try refreshing the page in a minute. If this keeps happening, contact an admin.`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Re-evaluation failed',
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setIsReevaluating(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'overlap':
        return <Badge variant="destructive" className="gap-1"><Layers className="h-3 w-3" />Overlap</Badge>;
      case 'gap':
        return <Badge variant="outline" className="gap-1 border-orange-400 text-orange-600"><CircleDot className="h-3 w-3" />Gap</Badge>;
      case 'fallback':
        return <Badge variant="secondary" className="gap-1"><AlertTriangle className="h-3 w-3" />Fallback</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Patch Assignment Issues</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Job sites that fall in patch overlaps, gaps, or were assigned to the fallback patch.
            After redrawing patch boundaries, use &quot;Re-evaluate All&quot; to detect new issues.
          </p>
        </div>
        <Button
          onClick={handleReevaluate}
          disabled={isReevaluating}
          variant="outline"
          className="shrink-0"
        >
          {isReevaluating ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Re-evaluating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Re-evaluate All
            </>
          )}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilterStatus('all')}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Issues</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold">{counts.total}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilterStatus('overlap')}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Layers className="h-3 w-3 text-red-500" />Overlaps
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{counts.overlap}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilterStatus('gap')}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <CircleDot className="h-3 w-3 text-orange-500" />Gaps
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-orange-600">{counts.gap}</div>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setFilterStatus('fallback')}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-yellow-500" />Fallback
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-yellow-600">{counts.fallback}</div>
          </CardContent>
        </Card>
      </div>

      {/* Issue list */}
      {counts.total === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            No patch assignment issues found. All job sites with coordinates are cleanly assigned to a single patch.
          </AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  {filterStatus === 'all' ? 'All Issues' : 
                   filterStatus === 'overlap' ? 'Overlap Issues' :
                   filterStatus === 'gap' ? 'Gap Issues' : 'Fallback Issues'}
                </CardTitle>
                <CardDescription>
                  {filteredSites.length} site{filteredSites.length !== 1 ? 's' : ''} requiring attention
                </CardDescription>
              </div>
              {filterStatus !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setFilterStatus('all')}>
                  Show all
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {sitesLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading issues...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Site / Address</TableHead>
                      <TableHead>Current Patch</TableHead>
                      <TableHead>Overlapping Patches</TableHead>
                      <TableHead className="text-right">Assign To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSites.map(site => (
                      <TableRow key={site.id}>
                        <TableCell>{statusBadge(site.patch_assignment_status)}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {site.project_name || '—'}
                        </TableCell>
                        <TableCell className="max-w-[250px]">
                          <div className="truncate text-sm">{site.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {site.full_address || site.location}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {site.current_patch_name || <span className="text-muted-foreground italic">None</span>}
                        </TableCell>
                        <TableCell>
                          {site.patch_assignment_status === 'overlap' && site.overlap_patch_ids ? (
                            <div className="flex flex-wrap gap-1">
                              {site.overlap_patch_ids.map(pid => (
                                <Badge key={pid} variant="outline" className="text-xs">
                                  {overlapPatchNames[pid] || pid.slice(0, 8)}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Select
                              onValueChange={(patchId) => {
                                assignPatchMutation.mutate({ siteId: site.id, patchId });
                              }}
                            >
                              <SelectTrigger className="w-[180px] h-8 text-xs">
                                <SelectValue placeholder="Select patch..." />
                              </SelectTrigger>
                              <SelectContent>
                                {/* Show overlapping patches first for overlap issues */}
                                {site.patch_assignment_status === 'overlap' && site.overlap_patch_ids && (
                                  <>
                                    {site.overlap_patch_ids.map(pid => {
                                      const patch = allPatches.find(p => p.id === pid);
                                      if (!patch) return null;
                                      return (
                                        <SelectItem key={pid} value={pid} className="text-xs">
                                          <span className="font-medium">{patch.name}</span>
                                          <span className="text-muted-foreground ml-1">(overlapping)</span>
                                        </SelectItem>
                                      );
                                    })}
                                    <div className="h-px bg-border my-1" />
                                  </>
                                )}
                                {allPatches.map(patch => (
                                  <SelectItem key={patch.id} value={patch.id} className="text-xs">
                                    {patch.name} {patch.code ? `(${patch.code})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Help text */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How to use:</strong> After redrawing patch boundaries in the Patch Editor, click
          &quot;Re-evaluate All&quot; to check all job sites against the new boundaries. Sites in
          overlapping patches or gaps will appear here for manual assignment. Select the correct
          patch from the dropdown to resolve each issue.
        </AlertDescription>
      </Alert>
    </div>
  );
}

export default PatchAssignmentIssues;

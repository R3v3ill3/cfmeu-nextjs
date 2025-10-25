'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, Search, Building2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ProjectDuplicateDetectionResult, DuplicateProjectGroup, ProjectConflictResolution } from '@/types/pendingProjectReview';

interface PendingProjectDuplicateDetectorProps {
  pendingCount: number;
  onMergeComplete: () => void;
}

export function PendingProjectDuplicateDetector({
  pendingCount,
  onMergeComplete,
}: PendingProjectDuplicateDetectorProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [detectionResult, setDetectionResult] = useState<ProjectDuplicateDetectionResult | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, ProjectConflictResolution>>({});
  const { toast } = useToast();

  const shouldAutoScan = pendingCount > 2 && pendingCount < 50;

  // Auto-scan on mount if conditions met
  useEffect(() => {
    if (shouldAutoScan && !detectionResult) {
      detectDuplicates();
    }
  }, [shouldAutoScan]);

  const detectDuplicates = async () => {
    setIsDetecting(true);
    try {
      const response = await fetch('/api/admin/pending-projects/detect-duplicates', {
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('[PendingProjectDuplicateDetector] API Error Response:', result);
        throw new Error(result.error || result.details || 'Failed to detect duplicates');
      }
      setDetectionResult(result);

      if (result.total_groups > 0) {
        toast({
          title: 'Duplicates detected',
          description: `Found ${result.total_groups} group(s) of potential duplicates`,
        });

        // Auto-merge high-confidence groups (>90% similarity)
        await autoMergeHighConfidence(result.groups);
      } else {
        toast({
          title: 'No duplicates found',
          description: 'All pending projects appear to be unique',
        });
      }
    } catch (error) {
      console.error('Error detecting duplicates:', error);
      toast({
        title: 'Detection failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsDetecting(false);
    }
  };

  const autoMergeHighConfidence = async (groups: DuplicateProjectGroup[]) => {
    const highConfidenceGroups = groups.filter(g => g.min_similarity >= 90);

    if (highConfidenceGroups.length === 0) return;

    for (const group of highConfidenceGroups) {
      try {
        const mergeIds = group.members
          .filter(m => m.id !== group.canonical_id)
          .map(m => m.id);

        await fetch('/api/admin/pending-projects/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canonicalProjectId: group.canonical_id,
            mergeProjectIds: mergeIds,
            conflictResolutions: {},
            autoMerge: true,
          }),
        });

        toast({
          title: 'Auto-merged group',
          description: `Merged ${mergeIds.length} duplicate(s) into "${group.canonical_name}"`,
        });
      } catch (error) {
        console.error('Error auto-merging group:', error);
      }
    }

    // Refresh detection results
    setTimeout(() => {
      onMergeComplete();
      detectDuplicates();
    }, 1000);
  };

  const handleManualMerge = async (group: DuplicateProjectGroup) => {
    setIsMerging(true);
    try {
      const mergeIds = group.members
        .filter(m => m.id !== group.canonical_id)
        .map(m => m.id);

      const response = await fetch('/api/admin/pending-projects/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalProjectId: group.canonical_id,
          mergeProjectIds: mergeIds,
          conflictResolutions: conflictResolutions[group.canonical_id] || {},
          autoMerge: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to merge');

      const result = await response.json();

      toast({
        title: 'Merge successful',
        description: `Merged ${result.merged_count} project(s)`,
      });

      onMergeComplete();
      setSelectedGroup(null);
      detectDuplicates();
    } catch (error) {
      console.error('Error merging projects:', error);
      toast({
        title: 'Merge failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsMerging(false);
    }
  };

  const updateConflictResolution = (groupId: string, field: string, value: string | number) => {
    setConflictResolutions(prev => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] || {}),
        [field]: value,
      },
    }));
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return 'Not specified';
    return `$${value.toLocaleString()}`;
  };

  if (!shouldAutoScan && !detectionResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Detection</CardTitle>
          <CardDescription>
            {pendingCount === 0
              ? 'No pending projects to scan'
              : pendingCount <= 2
              ? 'Too few pending projects for automatic scanning'
              : 'Too many pending projects for automatic scanning'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {pendingCount > 50 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Large dataset detected. Manual scan recommended to avoid performance issues.
              </AlertDescription>
            </Alert>
          )}
          <Button
            onClick={detectDuplicates}
            disabled={isDetecting || pendingCount === 0}
          >
            {isDetecting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Scan for Duplicates
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Duplicate Detection</CardTitle>
            <CardDescription>
              {detectionResult
                ? `Found ${detectionResult.total_groups} group(s) of potential duplicates`
                : 'Scanning for duplicate pending projects...'}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            onClick={detectDuplicates}
            disabled={isDetecting}
          >
            {isDetecting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Re-scan
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isDetecting ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <span className="ml-3 text-muted-foreground">Detecting duplicates...</span>
          </div>
        ) : detectionResult && detectionResult.total_groups > 0 ? (
          <div className="space-y-4">
            {/* Summary */}
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Detected {detectionResult.total_groups} group(s) of duplicates.
                High-confidence matches (≥90% similarity) have been auto-merged.
              </AlertDescription>
            </Alert>

            {/* Duplicate Groups */}
            {detectionResult.groups.map((group) => (
              <Card key={group.canonical_id} className="border-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{group.canonical_name}</CardTitle>
                      <CardDescription>
                        {group.member_count} potential duplicates •{' '}
                        {group.min_similarity.toFixed(0)}-{group.max_similarity.toFixed(0)}% similarity
                      </CardDescription>
                    </div>
                    {group.min_similarity >= 90 ? (
                      <Badge variant="default" className="bg-green-500">
                        Auto-merged
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Needs review</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* Member List */}
                    <div className="space-y-2">
                      {group.members.map((member) => (
                        <div
                          key={member.id}
                          className="flex items-start justify-between p-3 bg-muted/50 rounded"
                        >
                          <div className="flex items-start gap-2 flex-1">
                            <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium">{member.name}</span>
                                {member.id === group.canonical_id && (
                                  <Badge variant="outline" className="text-xs">
                                    Primary
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                                {member.value && (
                                  <div>Value: {formatCurrency(member.value)}</div>
                                )}
                                {member.address && (
                                  <div>Address: {member.address}</div>
                                )}
                                {(member.suburb || member.state || member.postcode) && (
                                  <div>
                                    {[member.suburb, member.state, member.postcode]
                                      .filter(Boolean)
                                      .join(', ')}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="ml-2">
                            {member.similarity.toFixed(0)}%
                          </Badge>
                        </div>
                      ))}
                    </div>

                    {/* Conflict Resolution (if needed) */}
                    {group.min_similarity < 90 && (
                      <div className="space-y-3 pt-3 border-t">
                        <h4 className="font-semibold text-sm">Resolve Conflicts:</h4>

                        {/* Check for differing project values */}
                        {(() => {
                          const values = new Set(group.members.map(m => m.value).filter(v => v !== null));
                          if (values.size > 1) {
                            return (
                              <div>
                                <Label>Project Value</Label>
                                <Select
                                  value={conflictResolutions[group.canonical_id]?.value?.toString()}
                                  onValueChange={(value) =>
                                    updateConflictResolution(group.canonical_id, 'value', parseFloat(value))
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select project value" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(values).map((value) => (
                                      <SelectItem key={value} value={value!.toString()}>
                                        {formatCurrency(value!)}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        <div className="flex gap-2">
                          <Button
                            onClick={() => handleManualMerge(group)}
                            disabled={isMerging}
                            className="flex-1"
                          >
                            {isMerging ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Merging...
                              </>
                            ) : (
                              'Merge This Group'
                            )}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              No duplicate pending projects detected. All projects appear to be unique.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

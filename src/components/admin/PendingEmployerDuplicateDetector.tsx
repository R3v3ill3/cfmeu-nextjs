'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle, CheckCircle, Search, Undo, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { DuplicateDetectionResult, DuplicateGroup, ConflictResolution } from '@/types/pendingEmployerReview';

interface PendingEmployerDuplicateDetectorProps {
  pendingCount: number;
  onMergeComplete: () => void;
}

export function PendingEmployerDuplicateDetector({
  pendingCount,
  onMergeComplete,
}: PendingEmployerDuplicateDetectorProps) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [detectionResult, setDetectionResult] = useState<DuplicateDetectionResult | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [conflictResolutions, setConflictResolutions] = useState<Record<string, ConflictResolution>>({});
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
      const response = await fetch('/api/admin/pending-employers/detect-duplicates', {
        method: 'POST',
      });

      const result = await response.json();
      
      if (!response.ok) {
        console.error('[PendingEmployerDuplicateDetector] API Error Response:', result);
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
          description: 'All pending employers appear to be unique',
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

  const autoMergeHighConfidence = async (groups: DuplicateGroup[]) => {
    const highConfidenceGroups = groups.filter(g => g.min_similarity >= 90);
    
    if (highConfidenceGroups.length === 0) return;

    for (const group of highConfidenceGroups) {
      try {
        const mergeIds = group.members
          .filter(m => m.id !== group.canonical_id)
          .map(m => m.id);

        await fetch('/api/admin/pending-employers/merge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canonicalEmployerId: group.canonical_id,
            mergeEmployerIds: mergeIds,
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

  const handleManualMerge = async (group: DuplicateGroup) => {
    setIsMerging(true);
    try {
      const mergeIds = group.members
        .filter(m => m.id !== group.canonical_id)
        .map(m => m.id);

      const response = await fetch('/api/admin/pending-employers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canonicalEmployerId: group.canonical_id,
          mergeEmployerIds: mergeIds,
          conflictResolutions: conflictResolutions[group.canonical_id] || {},
          autoMerge: false,
        }),
      });

      if (!response.ok) throw new Error('Failed to merge');

      const result = await response.json();

      toast({
        title: 'Merge successful',
        description: `Merged ${result.merged_count} employer(s)`,
      });

      onMergeComplete();
      setSelectedGroup(null);
      detectDuplicates();
    } catch (error) {
      console.error('Error merging employers:', error);
      toast({
        title: 'Merge failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsMerging(false);
    }
  };

  const handleUndoMerge = async (mergeLogId: string) => {
    try {
      const reason = prompt('Enter reason for undoing this merge:');
      if (!reason) return;

      const response = await fetch('/api/admin/pending-employers/undo-merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mergeLogId, reason }),
      });

      if (!response.ok) throw new Error('Failed to undo merge');

      toast({
        title: 'Merge undone',
        description: 'Successfully restored merged employers',
      });

      onMergeComplete();
      detectDuplicates();
    } catch (error) {
      console.error('Error undoing merge:', error);
      toast({
        title: 'Undo failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const updateConflictResolution = (groupId: string, field: string, value: string) => {
    setConflictResolutions(prev => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] || {}),
        [field]: value,
      },
    }));
  };

  if (!shouldAutoScan && !detectionResult) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Duplicate Detection</CardTitle>
          <CardDescription>
            {pendingCount === 0 
              ? 'No pending employers to scan'
              : pendingCount <= 2
              ? 'Too few pending employers for automatic scanning'
              : 'Too many pending employers for automatic scanning'}
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
                : 'Scanning for duplicate pending employers...'}
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
                          className="flex items-center justify-between p-2 bg-muted/50 rounded"
                        >
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{member.name}</span>
                            {member.id === group.canonical_id && (
                              <Badge variant="outline" className="text-xs">
                                Primary
                              </Badge>
                            )}
                          </div>
                          <Badge variant="secondary">{member.similarity.toFixed(0)}%</Badge>
                        </div>
                      ))}
                    </div>

                    {/* Conflict Resolution (if needed) */}
                    {group.min_similarity < 90 && (
                      <div className="space-y-3 pt-3 border-t">
                        <h4 className="font-semibold text-sm">Resolve Conflicts:</h4>
                        
                        {/* Check for differing employer types */}
                        {(() => {
                          const types = new Set(group.members.map(m => m.employer_type).filter(Boolean));
                          if (types.size > 1) {
                            return (
                              <div>
                                <Label>Employer Type</Label>
                                <Select
                                  value={conflictResolutions[group.canonical_id]?.employer_type}
                                  onValueChange={(value) =>
                                    updateConflictResolution(group.canonical_id, 'employer_type', value)
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select employer type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from(types).map((type) => (
                                      <SelectItem key={type} value={type!}>
                                        {type!.replace(/_/g, ' ')}
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
              No duplicate pending employers detected. All employers appear to be unique.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}


'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle, CheckCircle2, Loader2, Building } from 'lucide-react';
import type { MatchSearchResult } from '@/types/pendingEmployerReview';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface PendingEmployerDuplicateMergeProps {
  isOpen: boolean;
  onClose: () => void;
  duplicateEmployers: MatchSearchResult[];
  onMergeComplete: (canonicalEmployerId: string) => void;
}

export function PendingEmployerDuplicateMerge({
  isOpen,
  onClose,
  duplicateEmployers,
  onMergeComplete,
}: PendingEmployerDuplicateMergeProps) {
  const [selectedCanonicalId, setSelectedCanonicalId] = useState<string>(
    duplicateEmployers[0]?.id || ''
  );
  const [isMerging, setIsMerging] = useState(false);
  const { toast } = useToast();

  const handleMerge = async () => {
    if (!selectedCanonicalId) {
      toast({
        title: 'No employer selected',
        description: 'Please select a canonical employer to merge into',
        variant: 'destructive',
      });
      return;
    }

    const duplicateIds = duplicateEmployers
      .filter(emp => emp.id !== selectedCanonicalId)
      .map(emp => emp.id);

    if (duplicateIds.length === 0) {
      toast({
        title: 'No duplicates to merge',
        description: 'At least two employers are required for a merge',
        variant: 'destructive',
      });
      return;
    }

    setIsMerging(true);

    // Show progress toast for long operations
    const progressToast = toast({
      title: 'Merging employers...',
      description: 'This may take up to 30 seconds. Please wait.',
      duration: 30000, // Keep toast visible for full merge duration
    });

    try {
      const supabase = getSupabaseBrowserClient();
      
      console.log('[PendingEmployerDuplicateMerge] Starting merge:', {
        canonical: selectedCanonicalId,
        duplicates: duplicateIds,
        timestamp: new Date().toISOString(),
      });

      // Call RPC with extended timeout handling
      const { data, error } = await supabase.rpc('merge_employers', {
        p_primary_employer_id: selectedCanonicalId,
        p_duplicate_employer_ids: duplicateIds,
      });

      console.log('[PendingEmployerDuplicateMerge] Merge completed:', {
        success: !error,
        data,
        error,
        timestamp: new Date().toISOString(),
      });

      if (error) {
        console.error('[PendingEmployerDuplicateMerge] Error merging employers:', error);
        throw new Error(error.message);
      }

      const result = data as any;

      // Check if merge was successful
      if (result && !result.success && result.error) {
        throw new Error(result.error);
      }

      toast({
        title: 'Employers merged successfully',
        description: `Merged ${duplicateIds.length} duplicate employer(s). ${result?.relationships_moved || 0} relationships transferred.`,
      });

      onMergeComplete(selectedCanonicalId);
    } catch (error) {
      console.error('[PendingEmployerDuplicateMerge] Failed to merge employers:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      
      toast({
        title: 'Merge failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsMerging(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Merge Duplicate Employers
          </DialogTitle>
          <DialogDescription>
            Select which employer should be the canonical record. All relationships from the other employers will be transferred to it.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          <Alert>
            <AlertDescription>
              <strong>What happens during a merge:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>All projects, job sites, and workers from duplicate employers will be transferred</li>
                <li>Trade capabilities will be combined (no duplicates)</li>
                <li>Duplicate employer names will be saved as aliases</li>
                <li>Duplicate records will be deleted</li>
                <li>This process may take up to 30 seconds for large employers</li>
              </ul>
            </AlertDescription>
          </Alert>

          {isMerging && (
            <Alert className="bg-blue-50 border-blue-200">
              <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              <AlertDescription className="text-blue-800">
                <strong>Merging in progress...</strong> Please wait while we consolidate the employer records.
                This may take up to 30 seconds. Do not close this window or refresh the page.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Label className="text-base font-semibold">Select the canonical employer:</Label>
            <RadioGroup value={selectedCanonicalId} onValueChange={setSelectedCanonicalId}>
              {duplicateEmployers.map((employer) => (
                <Card key={employer.id} className={selectedCanonicalId === employer.id ? 'border-blue-500 border-2' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <RadioGroupItem value={employer.id} id={`employer-${employer.id}`} className="mt-1" />
                      <Label htmlFor={`employer-${employer.id}`} className="flex-1 cursor-pointer">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold text-base">{employer.name}</h4>
                            {selectedCanonicalId === employer.id && (
                              <Badge variant="default" className="bg-blue-500">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Canonical
                              </Badge>
                            )}
                            {employer.enterprise_agreement_status && (
                              <Badge variant="outline" className="border-green-500 text-green-700">
                                EBA
                              </Badge>
                            )}
                          </div>

                          <div className="space-y-1 text-sm text-muted-foreground">
                            {employer.employer_type && (
                              <div>Type: {employer.employer_type.replace(/_/g, ' ')}</div>
                            )}
                            {employer.abn && <div>ABN: {employer.abn}</div>}
                            {(employer.address_line_1 || employer.suburb || employer.state || employer.postcode) && (
                              <div>
                                Address: {[employer.address_line_1, employer.suburb, employer.state, employer.postcode]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-4">
                              {employer.phone && <span>📞 {employer.phone}</span>}
                              {employer.email && <span>✉️ {employer.email}</span>}
                            </div>
                            {employer.website && (
                              <div className="text-blue-600">🌐 {employer.website}</div>
                            )}
                            {employer.aliases && employer.aliases.length > 0 && (
                              <div className="text-xs">
                                Known aliases: {employer.aliases.slice(0, 3).map((alias) => alias.alias).join(', ')}
                                {employer.aliases.length > 3 && '…'}
                              </div>
                            )}
                          </div>
                        </div>
                      </Label>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </RadioGroup>
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={isMerging}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isMerging || !selectedCanonicalId}>
            {isMerging ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <Building className="h-4 w-4 mr-2" />
                Merge {duplicateEmployers.length - 1} Employer{duplicateEmployers.length > 2 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


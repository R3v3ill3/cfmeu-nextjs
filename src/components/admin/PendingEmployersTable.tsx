'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Check, X, Eye, ChevronDown, ChevronRight, Undo } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { PendingEmployer } from '@/types/pendingEmployerReview';
import { PendingEmployerMatchSearch } from './PendingEmployerMatchSearch';
import { PendingEmployerFinalDecision } from './PendingEmployerFinalDecision';
import { EmployerDetailModal } from '@/components/employers/EmployerDetailModal';
import { usePendingEmployerReview } from '@/hooks/usePendingEmployerReview';
import { useToast } from '@/hooks/use-toast';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

interface PendingEmployersTableProps {
  employers: PendingEmployer[];
  onRefresh: () => void;
  onUndoMerge?: (mergeLogId: string) => Promise<void>;
}

export function PendingEmployersTable({
  employers,
  onRefresh,
  onUndoMerge,
}: PendingEmployersTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  
  const {
    workflowState,
    isReviewing,
    currentStep,
    startReview,
    nextStep,
    setMatchedEmployer,
    updateEmployerData,
    completeReview,
    cancelReview,
  } = usePendingEmployerReview({
    onComplete: () => {
      onRefresh();
      toast({
        title: 'Review completed',
        description: 'The employer has been processed successfully.',
      });
    },
    onCancel: () => {
      toast({
        title: 'Review cancelled',
        variant: 'default',
      });
    },
  });

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const handleQuickApprove = async (employerId: string) => {
    if (!window.confirm('Are you sure you want to approve this employer without review?')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/approve-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerId }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      toast({
        title: 'Employer approved',
        variant: 'default',
      });
      onRefresh();
    } catch (error) {
      console.error('Error approving employer:', error);
      toast({
        title: 'Failed to approve employer',
        variant: 'destructive',
      });
    }
  };

  const handleQuickReject = async (employerId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    try {
      const response = await fetch('/api/admin/reject-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employerId, reason }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      toast({
        title: 'Employer rejected',
        variant: 'default',
      });
      onRefresh();
    } catch (error) {
      console.error('Error rejecting employer:', error);
      toast({
        title: 'Failed to reject employer',
        variant: 'destructive',
      });
    }
  };

  const handleSelectExisting = async (existingEmployerId: string) => {
    if (!workflowState) return;

    // Merge pending into existing
    try {
      const response = await fetch('/api/admin/pending-employers/merge-into-existing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingEmployerId: workflowState.employerId,
          existingEmployerId,
          transferJobsites: true,
          transferProjects: true,
          transferTrades: true,
          createAlias: true,
        }),
      });

      if (!response.ok) throw new Error('Failed to merge');

      const result = await response.json();
      
      toast({
        title: 'Employer merged successfully',
        description: `Merged into existing employer. ${result.projects_transferred} projects, ${result.trades_transferred} trades transferred.`,
      });

      completeReview('merged');
    } catch (error) {
      console.error('Error merging employers:', error);
      toast({
        title: 'Failed to merge employers',
        variant: 'destructive',
      });
    }
  };

  const handleCreateNew = () => {
    setMatchedEmployer(null, false);
    nextStep(); // Go to employer edit step
  };

  const handlePendingReviewClose = () => {
    // When closing from employer modal, go to final decision
    nextStep();
  };

  const handleApprove = async (notes?: string) => {
    if (!workflowState) return;

    try {
      const response = await fetch('/api/admin/approve-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employerId: workflowState.employerId,
          notes 
        }),
      });

      if (!response.ok) throw new Error('Failed to approve');

      completeReview('approved');
    } catch (error) {
      console.error('Error approving employer:', error);
      toast({
        title: 'Failed to approve employer',
        variant: 'destructive',
      });
    }
  };

  const handleReject = async (reason: string) => {
    if (!workflowState) return;

    try {
      const response = await fetch('/api/admin/reject-employer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          employerId: workflowState.employerId,
          reason 
        }),
      });

      if (!response.ok) throw new Error('Failed to reject');

      completeReview('rejected');
    } catch (error) {
      console.error('Error rejecting employer:', error);
      toast({
        title: 'Failed to reject employer',
        variant: 'destructive',
      });
    }
  };

  if (employers.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No pending employers
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employers.map((employer) => (
            <Collapsible
              key={employer.id}
              open={expandedRows.has(employer.id)}
              onOpenChange={() => toggleRow(employer.id)}
              asChild
            >
              <>
                <TableRow className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm">
                        {expandedRows.has(employer.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </CollapsibleTrigger>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {employer.name}
                      {employer.auto_merged && (
                        <Badge variant="secondary" className="text-xs">
                          Auto-merged
                        </Badge>
                      )}
                      {employer.currently_reviewed_by && (
                        <Badge variant="outline" className="text-xs">
                          Under review
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {employer.employer_type ? (
                      <Badge variant="outline">
                        {employer.employer_type.replace(/_/g, ' ')}
                      </Badge>
                    ) : (
                      'N/A'
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">Pending</Badge>
                  </TableCell>
                  <TableCell>
                    {format(new Date(employer.created_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          startReview(employer);
                        }}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Review
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickReject(employer.id);
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleQuickApprove(employer.id);
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                <CollapsibleContent asChild>
                  <TableRow>
                    <TableCell colSpan={6} className="bg-muted/30">
                      <div className="p-4 space-y-3">
                        {/* Expanded Details */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {employer.website && (
                            <div>
                              <span className="font-semibold">Website:</span>{' '}
                              <a
                                href={employer.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                {employer.website}
                              </a>
                            </div>
                          )}
                          {employer.phone && (
                            <div>
                              <span className="font-semibold">Phone:</span> {employer.phone}
                            </div>
                          )}
                          {employer.email && (
                            <div>
                              <span className="font-semibold">Email:</span> {employer.email}
                            </div>
                          )}
                          {employer.address_line_1 && (
                            <div>
                              <span className="font-semibold">Address:</span>{' '}
                              {employer.address_line_1}
                              {employer.suburb && `, ${employer.suburb}`}
                              {employer.state && ` ${employer.state}`}
                            </div>
                          )}
                        </div>

                        {/* Merged IDs */}
                        {employer.auto_merged && employer.merged_from_pending_ids.length > 0 && (
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">
                              Merged from {employer.merged_from_pending_ids.length} duplicate(s)
                            </Badge>
                            {onUndoMerge && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  // Note: We'd need the merge log ID to undo
                                  toast({
                                    title: 'Undo functionality',
                                    description: 'Contact admin to undo this merge',
                                  });
                                }}
                              >
                                <Undo className="h-3 w-3 mr-1" />
                                Undo Merge
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                </CollapsibleContent>
              </>
            </Collapsible>
          ))}
        </TableBody>
      </Table>

      {/* Review Workflow Dialogs */}
      {isReviewing && workflowState && (
        <>
          {/* Step 1: Match Search */}
          <PendingEmployerMatchSearch
            isOpen={currentStep === 'match_search'}
            onClose={cancelReview}
            pendingEmployer={workflowState.employerData as PendingEmployer}
            onSelectExisting={handleSelectExisting}
            onCreateNew={handleCreateNew}
          />

          {/* Step 2: Edit Employer */}
          <EmployerDetailModal
            employerId={workflowState.employerId}
            isOpen={currentStep === 'edit_employer'}
            onClose={cancelReview}
            mode="pending_review"
            onPendingReviewClose={handlePendingReviewClose}
            onEmployerUpdated={() => {
              // Refresh data after updates
              onRefresh();
            }}
          />

          {/* Step 3: Final Decision */}
          <PendingEmployerFinalDecision
            isOpen={currentStep === 'final_decision'}
            onClose={cancelReview}
            pendingEmployer={workflowState.employerData as PendingEmployer}
            changes={workflowState.changes}
            onApprove={handleApprove}
            onReject={handleReject}
            onReviewAgain={() => {
              // Go back to match search
              workflowState.currentStep = 'match_search';
            }}
          />
        </>
      )}
    </>
  );
}

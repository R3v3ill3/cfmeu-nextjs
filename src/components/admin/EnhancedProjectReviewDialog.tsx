'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Check, X, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { usePendingProjectData } from '@/hooks/usePendingProjectData';
import { useToast } from '@/hooks/use-toast';
import { ContactsSection } from './project-review/ContactsSection';
import { EmployersSection } from './project-review/EmployersSection';
import { MetadataSection } from './project-review/MetadataSection';
import { SourceFileSection } from './project-review/SourceFileSection';
import { DuplicatesTab } from './project-review/DuplicatesTab';
import { ProjectFieldEditor } from './project-review/ProjectFieldEditor';
import type { ProjectEditableFields } from '@/types/pendingProjectReview';

interface EnhancedProjectReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string | null;
  onApprove: (projectId: string, notes?: string) => Promise<void>;
  onReject: (projectId: string, reason: string) => Promise<void>;
  onRefresh?: () => void;
}

export function EnhancedProjectReviewDialog({
  open,
  onOpenChange,
  projectId,
  onApprove,
  onReject,
  onRefresh,
}: EnhancedProjectReviewDialogProps) {
  const [notes, setNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  const { toast } = useToast();
  const { data: project, isLoading, error } = usePendingProjectData({
    projectId,
    enabled: open && !!projectId,
  });

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setNotes('');
      setRejectionReason('');
      setShowRejectConfirm(false);
      setActiveTab('overview');
    }
  }, [open]);

  const handleApprove = async () => {
    if (!project) return;

    setIsApproving(true);
    try {
      await onApprove(project.id, notes || undefined);
      setNotes('');
      toast({
        title: 'Project approved',
        description: `${project.name} has been approved successfully.`,
      });
      onRefresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to approve project:', error);
      toast({
        title: 'Failed to approve project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!project || !rejectionReason.trim()) return;

    setIsRejecting(true);
    try {
      await onReject(project.id, rejectionReason);
      setRejectionReason('');
      setShowRejectConfirm(false);
      toast({
        title: 'Project rejected',
        description: `${project.name} has been rejected.`,
      });
      onRefresh?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to reject project:', error);
      toast({
        title: 'Failed to reject project',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleSaveEdits = async (updates: ProjectEditableFields) => {
    if (!project) return;

    try {
      const response = await fetch(`/api/admin/pending-projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update project');
      }

      toast({
        title: 'Changes saved',
        description: 'Project details have been updated.',
      });
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save changes:', error);
      toast({
        title: 'Failed to save changes',
        description: error instanceof Error ? error.message : 'An error occurred',
        variant: 'destructive',
      });
      throw error;
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Review Project
            {project && (
              <Badge variant="secondary" className="ml-2">
                Pending
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            {project ? (
              <>
                Submitted {format(new Date(project.created_at), 'MMMM d, yyyy')} by{' '}
                {project.scan?.[0]?.uploader?.full_name ||
                  project.scan?.[0]?.uploader?.email ||
                  'Unknown'}
              </>
            ) : (
              'Loading project details...'
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">Loading project data...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Content */}
        {project && !isLoading && (
          <div className="flex-1 overflow-y-auto">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="contacts">
                  Contacts
                  {project.main_job_site?.site_contacts && project.main_job_site.site_contacts.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {project.main_job_site.site_contacts.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="employers">
                  Employers
                  {project.project_assignments && project.project_assignments.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {project.project_assignments.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="duplicates">Duplicates</TabsTrigger>
                <TabsTrigger value="source">Source</TabsTrigger>
              </TabsList>

              <div className="mt-4 space-y-4">
                <TabsContent value="overview" className="space-y-4">
                  <ProjectFieldEditor
                    project={project}
                    onSave={handleSaveEdits}
                    readOnly={false}
                  />
                  <MetadataSection project={project} />
                </TabsContent>

                <TabsContent value="contacts">
                  <ContactsSection
                    contacts={project.main_job_site?.site_contacts || []}
                    readOnly={true}
                  />
                </TabsContent>

                <TabsContent value="employers">
                  <EmployersSection
                    assignments={project.project_assignments || []}
                    readOnly={true}
                  />
                </TabsContent>

                <TabsContent value="duplicates">
                  <DuplicatesTab project={project} />
                </TabsContent>

                <TabsContent value="source">
                  <SourceFileSection scans={project.scan || []} />
                </TabsContent>
              </div>
            </Tabs>
          </div>
        )}

        {/* Footer Actions */}
        {project && !showRejectConfirm && (
          <DialogFooter className="border-t pt-4">
            <div className="flex flex-col gap-4 w-full">
              <div className="space-y-2">
                <Label htmlFor="approval-notes">Approval Notes (optional)</Label>
                <Textarea
                  id="approval-notes"
                  placeholder="Add any notes about this approval..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isApproving || isRejecting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowRejectConfirm(true)}
                  disabled={isApproving || isRejecting}
                >
                  <X className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button onClick={handleApprove} disabled={isApproving || isRejecting}>
                  <Check className="h-4 w-4 mr-1" />
                  {isApproving ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        )}

        {/* Rejection Confirmation */}
        {project && showRejectConfirm && (
          <div className="space-y-4 border-t pt-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to reject this project? This action cannot be undone.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection Reason (required)</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Explain why this project is being rejected..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={4}
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectConfirm(false);
                  setRejectionReason('');
                }}
                disabled={isRejecting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isRejecting}
              >
                {isRejecting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

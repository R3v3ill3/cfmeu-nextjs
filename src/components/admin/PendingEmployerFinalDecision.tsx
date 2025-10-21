'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PendingEmployer } from '@/types/pendingEmployerReview';

interface PendingEmployerFinalDecisionProps {
  isOpen: boolean;
  onClose: () => void;
  pendingEmployer: PendingEmployer;
  changes: Record<string, any>;
  onApprove: (notes?: string) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  onReviewAgain: () => void;
}

export function PendingEmployerFinalDecision({
  isOpen,
  onClose,
  pendingEmployer,
  changes,
  onApprove,
  onReject,
  onReviewAgain,
}: PendingEmployerFinalDecisionProps) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasChanges = Object.keys(changes).length > 0;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(notes || undefined);
      onClose();
    } catch (error) {
      console.error('Error approving employer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) {
      alert('Please provide a reason for rejection');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onReject(reason);
      onClose();
    } catch (error) {
      console.error('Error rejecting employer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReviewAgain = () => {
    setDecision(null);
    setNotes('');
    setReason('');
    onReviewAgain();
  };

  const renderChangeSummary = () => {
    if (!hasChanges) {
      return (
        <Alert>
          <AlertDescription>
            No changes were made during review.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="space-y-2">
        <h4 className="font-semibold text-sm">Changes Made During Review:</h4>
        <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
          {Object.entries(changes).map(([key, value]) => (
            <div key={key} className="flex justify-between">
              <span className="font-medium">{key.replace(/_/g, ' ')}:</span>
              <span className="text-muted-foreground">
                {value === null || value === undefined ? 'Cleared' : String(value)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Final Decision</DialogTitle>
          <DialogDescription>
            Review the employer details and make a final decision
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employer Summary */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">{pendingEmployer.name}</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>{' '}
                {pendingEmployer.employer_type?.replace(/_/g, ' ') || 'Not specified'}
              </div>
              {pendingEmployer.website && (
                <div>
                  <span className="text-muted-foreground">Website:</span>{' '}
                  {pendingEmployer.website}
                </div>
              )}
              {pendingEmployer.phone && (
                <div>
                  <span className="text-muted-foreground">Phone:</span>{' '}
                  {pendingEmployer.phone}
                </div>
              )}
              {pendingEmployer.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  {pendingEmployer.email}
                </div>
              )}
            </div>
          </div>

          {/* Changes Summary */}
          {renderChangeSummary()}

          {/* Decision Section */}
          {!decision && (
            <div className="space-y-3">
              <Label className="text-base font-semibold">Choose Action:</Label>
              <div className="grid grid-cols-3 gap-3">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => setDecision('approve')}
                >
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <span>Approve</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={() => setDecision('reject')}
                >
                  <XCircle className="h-6 w-6 text-red-600" />
                  <span>Reject</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex flex-col gap-2"
                  onClick={handleReviewAgain}
                >
                  <RotateCcw className="h-6 w-6 text-blue-600" />
                  <span>Review Again</span>
                </Button>
              </div>
            </div>
          )}

          {/* Approve Form */}
          {decision === 'approve' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <Label className="text-base font-semibold">Approve Employer</Label>
              </div>
              <Alert className="bg-green-50 border-green-200">
                <AlertDescription>
                  This employer will be approved and made active in the system.
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Add any notes about this approval..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* Reject Form */}
          {decision === 'reject' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <Label className="text-base font-semibold">Reject Employer</Label>
              </div>
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This employer will be rejected and not added to the system.
                </AlertDescription>
              </Alert>
              <div>
                <Label htmlFor="reason">Rejection Reason *</Label>
                <Textarea
                  id="reason"
                  placeholder="Provide a reason for rejection..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  required
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          {!decision && (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}

          {decision === 'approve' && (
            <>
              <Button variant="outline" onClick={() => setDecision(null)}>
                Back
              </Button>
              <Button
                onClick={handleApprove}
                disabled={isSubmitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? 'Approving...' : 'Confirm Approval'}
              </Button>
            </>
          )}

          {decision === 'reject' && (
            <>
              <Button variant="outline" onClick={() => setDecision(null)}>
                Back
              </Button>
              <Button
                onClick={handleReject}
                disabled={isSubmitting || !reason.trim()}
                variant="destructive"
              >
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



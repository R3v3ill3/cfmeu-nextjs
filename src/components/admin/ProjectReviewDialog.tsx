'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Check, X, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'

interface ProjectReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: any
  onApprove: (notes?: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

export function ProjectReviewDialog({
  open,
  onOpenChange,
  project,
  onApprove,
  onReject,
}: ProjectReviewDialogProps) {
  const [notes, setNotes] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isApproving, setIsApproving] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [showRejectConfirm, setShowRejectConfirm] = useState(false)

  const handleApprove = async () => {
    setIsApproving(true)
    try {
      await onApprove(notes || undefined)
      setNotes('')
    } finally {
      setIsApproving(false)
    }
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      return
    }
    setIsRejecting(true)
    try {
      await onReject(rejectionReason)
      setRejectionReason('')
      setShowRejectConfirm(false)
    } finally {
      setIsRejecting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Project: {project.name}</DialogTitle>
          <DialogDescription>
            Submitted {format(new Date(project.created_at), 'MMMM d, yyyy')} by{' '}
            {project.scan?.[0]?.uploader?.full_name ||
              project.scan?.[0]?.uploader?.email}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="mt-4">
          <TabsList>
            <TabsTrigger value="details">Project Details</TabsTrigger>
            <TabsTrigger value="duplicates">Duplicate Check</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Project Name</Label>
                <p className="font-medium">{project.name}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Value</Label>
                <p className="font-medium">
                  {project.value
                    ? `$${project.value.toLocaleString()}`
                    : 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Address</Label>
                <p className="font-medium">
                  {project.main_job_site?.full_address || 'Not specified'}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Start Date</Label>
                <p className="font-medium">
                  {project.proposed_start_date
                    ? format(new Date(project.proposed_start_date), 'MMM d, yyyy')
                    : 'Not specified'}
                </p>
              </div>
            </div>

            {/* TODO: Add more project details, contacts, subcontractors */}
          </TabsContent>

          <TabsContent value="duplicates">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Duplicate detection not yet implemented. Manually verify this
                project does not already exist in the system.
              </AlertDescription>
            </Alert>
            {/* TODO: Implement duplicate detection logic */}
          </TabsContent>
        </Tabs>

        {!showRejectConfirm ? (
          <DialogFooter className="mt-6">
            <div className="flex flex-col gap-4 w-full">
              <div className="space-y-2">
                <Label htmlFor="approval-notes">
                  Approval Notes (optional)
                </Label>
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
                <Button
                  onClick={handleApprove}
                  disabled={isApproving || isRejecting}
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isApproving ? 'Approving...' : 'Approve'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        ) : (
          <div className="space-y-4 mt-6">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Are you sure you want to reject this project? This action cannot
                be undone.
              </AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">
                Rejection Reason (required)
              </Label>
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
                  setShowRejectConfirm(false)
                  setRejectionReason('')
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
  )
}

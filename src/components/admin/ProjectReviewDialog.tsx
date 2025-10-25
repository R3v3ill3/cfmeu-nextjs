'use client'

import { useState, useEffect } from 'react'
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
import { Check, X, AlertTriangle, Loader2, Building2, MapPin, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { PendingProjectMatchSearch } from './PendingProjectMatchSearch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { ProjectMatchSearchResult } from '@/types/pendingProjectReview'

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
  const [showMatchSearch, setShowMatchSearch] = useState(false)
  const [isLoadingDuplicates, setIsLoadingDuplicates] = useState(false)
  const [duplicates, setDuplicates] = useState<ProjectMatchSearchResult[]>([])
  const [duplicatesError, setDuplicatesError] = useState<string | null>(null)

  // Auto-detect duplicates when dialog opens
  useEffect(() => {
    if (open && project) {
      detectDuplicates()
    }
    if (!open) {
      setDuplicates([])
      setDuplicatesError(null)
    }
  }, [open, project])

  const detectDuplicates = async () => {
    setIsLoadingDuplicates(true)
    setDuplicatesError(null)

    try {
      const response = await fetch(`/api/admin/pending-projects/search?q=${encodeURIComponent(project.name)}&limit=10`)

      if (!response.ok) {
        throw new Error('Failed to search for duplicates')
      }

      const data = await response.json()
      setDuplicates(data.results || [])
    } catch (err) {
      console.error('Error detecting duplicates:', err)
      setDuplicatesError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsLoadingDuplicates(false)
    }
  }

  const handleSelectExisting = (projectId: string) => {
    // TODO: Implement merge into existing project
    console.log('Selected existing project:', projectId)
    setShowMatchSearch(false)
  }

  const handleCreateNew = () => {
    setShowMatchSearch(false)
    // Proceed with approval
  }

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
            {isLoadingDuplicates ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Checking for duplicates...</span>
              </div>
            ) : duplicatesError ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Error checking for duplicates: {duplicatesError}
                </AlertDescription>
              </Alert>
            ) : duplicates.length > 0 ? (
              <div className="space-y-4">
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Found {duplicates.length} potential duplicate project(s). Please review before approving.
                  </AlertDescription>
                </Alert>

                <div className="space-y-2">
                  {duplicates.map((duplicate) => (
                    <Card key={duplicate.id} className="border-2 border-yellow-200">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-semibold">{duplicate.name}</h4>
                            <Badge variant="secondary">
                              {Math.round(duplicate.searchScore)}% match
                            </Badge>
                            {duplicate.matchType === 'name' && (
                              <Badge variant="default" className="bg-green-600">
                                Name Match
                              </Badge>
                            )}
                            {duplicate.matchType === 'address' && (
                              <Badge variant="secondary">Address Match</Badge>
                            )}
                            {duplicate.matchType === 'value' && (
                              <Badge variant="outline">Value Match</Badge>
                            )}
                          </div>

                          <div className="text-sm text-muted-foreground space-y-1">
                            {duplicate.value !== null && (
                              <div className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                ${duplicate.value.toLocaleString()}
                              </div>
                            )}
                            {duplicate.main_job_site?.full_address && (
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {duplicate.main_job_site.full_address}
                              </div>
                            )}
                            {duplicate.builder && (
                              <div className="flex items-center gap-1">
                                <Building2 className="h-3 w-3" />
                                Builder: {duplicate.builder.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setShowMatchSearch(true)}
                  className="w-full"
                >
                  Search for More Matches
                </Button>
              </div>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  No potential duplicates found. This project appears to be unique.
                </AlertDescription>
              </Alert>
            )}
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

        {/* Match Search Dialog */}
        <PendingProjectMatchSearch
          isOpen={showMatchSearch}
          onClose={() => setShowMatchSearch(false)}
          pendingProject={project}
          onSelectExisting={handleSelectExisting}
          onCreateNew={handleCreateNew}
        />
      </DialogContent>
    </Dialog>
  )
}

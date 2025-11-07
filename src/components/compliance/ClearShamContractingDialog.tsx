"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2 } from "lucide-react"
import { toast } from "sonner"

interface ClearShamContractingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  employerId: string
  employerName: string
  projectId?: string // If provided, clears only for this project
  onSuccess?: () => void
}

export function ClearShamContractingDialog({
  open,
  onOpenChange,
  employerId,
  employerName,
  projectId,
  onSuccess
}: ClearShamContractingDialogProps) {
  const [clearingReason, setClearingReason] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClear = async () => {
    if (clearingReason.trim().length < 10) {
      toast.error("Please provide a reason of at least 10 characters")
      return
    }

    setIsSubmitting(true)
    try {
      const url = projectId
        ? `/api/projects/${projectId}/employers/${employerId}/sham-contracting`
        : `/api/employers/${employerId}/sham-contracting`

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clearing_reason: clearingReason,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to clear flag")
      }

      toast.success(
        projectId
          ? "Sham contracting flag cleared for this project"
          : "All sham contracting flags cleared for employer"
      )

      setClearingReason("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      console.error("Error clearing sham contracting flag:", error)
      toast.error(error instanceof Error ? error.message : "Failed to clear flag")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            Clear Sham Contracting Flag
          </DialogTitle>
          <DialogDescription>
            Clear the sham contracting detection for <strong>{employerName}</strong>
            {projectId ? " on this project only" : " globally across all projects"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              {projectId
                ? "This will clear the flag for this project only. Flags on other projects will remain."
                : "This will clear ALL sham contracting flags for this employer across all projects."}
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="clearing-reason">
              Reason for Clearing <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="clearing-reason"
              placeholder="Explain why this flag is being cleared (minimum 10 characters)..."
              value={clearingReason}
              onChange={(e) => setClearingReason(e.target.value)}
              rows={4}
              className="resize-none"
            />
            <p className="text-sm text-muted-foreground">
              {clearingReason.length}/10 characters minimum
            </p>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This action will be logged in the audit trail with your details. The employer will
              be able to receive green ratings again if other criteria are met.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleClear}
            disabled={isSubmitting || clearingReason.trim().length < 10}
          >
            {isSubmitting ? "Clearing..." : "Clear Flag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

